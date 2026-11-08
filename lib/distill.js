/**
 * Local evidence distillation for dsh-workstyle.
 *
 * Read-only scan of the agent session stores on this machine. Nothing is
 * uploaded and no raw prompt text is persisted: the report only keeps
 * aggregate counts, histograms and the matched keyword categories.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { spawnSync } from 'node:child_process'
import { dshHome, reportsDir } from './pack.js'

const PLAN = /(先.{0,4}方案|方案|计划|规划|先不要|别写代码|先给|先出|评审|确认后再)/i
const VERIFY = /(测试|验证|跑一下|npm test|pnpm test|build|typecheck|lint|验收|核对)/i
const CJK = /[\u4e00-\u9fff]/

export function defaultSources() {
  return {
    claude: path.join(os.homedir(), '.claude', 'history.jsonl'),
    codexIndex: path.join(os.homedir(), '.codex', 'session_index.jsonl'),
    codexSessions: path.join(os.homedir(), '.codex', 'sessions'),
    dshSessions: path.join(dshHome(), 'sessions'),
    piSessions: path.join(os.homedir(), '.pi', 'agent', 'sessions'),
  }
}

function topN(map, n) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n)
}

async function forEachLine(file, handler) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' })
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  for await (const line of rl) {
    if (!line.trim()) continue
    try { handler(line) } catch { /* skip malformed line */ }
  }
}

/* ---------------------------- Claude Code ---------------------------- */

export async function scanClaude(file, keywords = []) {
  const words = Array.isArray(keywords) ? keywords.filter((word) => typeof word === 'string' && word) : []
  const ruleHits = {}
  for (const word of words) ruleHits[word] = 0
  const result = {
    source: 'claude-code',
    path: file,
    available: fs.existsSync(file),
    prompts: 0,
    projects: {},
    hours: {},
    chinese: 0,
    planKeywords: 0,
    verifyKeywords: 0,
    questions: 0,
    totalChars: 0,
    first: undefined,
    last: undefined,
  }
  if (!result.available) return result
  await forEachLine(file, (line) => {
    const item = JSON.parse(line)
    const text = typeof item.display === 'string' ? item.display : ''
    if (!text.trim()) return
    result.prompts++
    result.totalChars += text.length
    const project = item.project || '(unknown)'
    result.projects[project] = (result.projects[project] || 0) + 1
    const ts = Number(item.timestamp)
    if (Number.isFinite(ts)) {
      const date = new Date(ts)
      const hour = String(date.getHours()).padStart(2, '0')
      result.hours[hour] = (result.hours[hour] || 0) + 1
      if (result.first === undefined || ts < result.first) result.first = ts
      if (result.last === undefined || ts > result.last) result.last = ts
    }
    if (CJK.test(text)) result.chinese++
    if (PLAN.test(text)) result.planKeywords++
    if (VERIFY.test(text)) result.verifyKeywords++
    if (/[？?]\s*$/.test(text)) result.questions++
    // Count keyword hits per prompt, then drop the text: the report keeps
    // numbers, never prompt content.
    for (const word of words) {
      if (text.includes(word)) ruleHits[word]++
    }
  })
  result.ruleHits = ruleHits
  result.avgChars = result.prompts ? Math.round(result.totalChars / result.prompts) : 0
  result.topProjects = topN(result.projects, 8)
  result.topHours = topN(result.hours, 6)
  delete result.projects
  delete result.hours
  return result
}

/* ------------------------------ Codex -------------------------------- */

export async function scanCodex(indexFile) {
  const result = { source: 'codex', path: indexFile, available: fs.existsSync(indexFile), sessions: 0, latest: undefined, threadNames: [] }
  if (!result.available) return result
  const names = []
  await forEachLine(indexFile, (line) => {
    const item = JSON.parse(line)
    result.sessions++
    if (item.updated_at && (!result.latest || item.updated_at > result.latest)) result.latest = item.updated_at
    if (item.thread_name) names.push(item.thread_name)
  })
  result.threadNames = names.slice(-10)
  return result
}

/* ------------------------------- DSH --------------------------------- */

function findDshSessions(root) {
  const found = []
  const walk = (dir, depth) => {
    if (depth > 5) return
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full, depth + 1)
      else if (entry.isFile() && entry.name.endsWith('.zstd')) {
        try {
          const stat = fs.statSync(full)
          found.push({ file: full, mtime: stat.mtimeMs, size: stat.size })
        } catch { /* ignore */ }
      }
    }
  }
  walk(root, 0)
  return found.sort((a, b) => b.mtime - a.mtime)
}

function decompressZstd(file) {
  const zstd = spawnSync(process.env.ZSTD_BIN || 'zstd', ['-dc', file], { maxBuffer: 96 * 1024 * 1024, timeout: 20000 })
  if (zstd.status === 0 && zstd.stdout) return zstd.stdout.toString('utf8')
  return undefined
}

export async function scanDsh(root, limit = 12) {
  const result = { source: 'deepseek-harness', path: root, available: false, sessions: 0, sampled: 0, events: {}, userMessages: 0, planKeywords: 0, verifyKeywords: 0, toolCalls: 0 }
  if (!fs.existsSync(root)) return result
  result.available = true
  const sessions = findDshSessions(root)
  result.sessions = sessions.length
  const sample = sessions.slice(0, Math.max(0, limit))
  for (const entry of sample) {
    const text = decompressZstd(entry.file)
    if (!text) continue
    result.sampled++
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let item
      try { item = JSON.parse(line) } catch { continue }
      const type = item && typeof item.type === 'string' ? item.type : 'unknown'
      result.events[type] = (result.events[type] || 0) + 1
      if (type.startsWith('tool/call')) result.toolCalls++
      if (type === 'user/message') {
        result.userMessages++
        const data = JSON.stringify(item.data || '')
        if (PLAN.test(data)) result.planKeywords++
        if (VERIFY.test(data)) result.verifyKeywords++
      }
    }
  }
  result.topEvents = topN(result.events, 10)
  delete result.events
  return result
}

/* -------------------------------- Pi --------------------------------- */

export async function scanPi(root) {
  const result = { source: 'pi', path: root, available: fs.existsSync(root), sessions: 0, messages: 0 }
  if (!result.available) return result
  const files = []
  try {
    for (const name of fs.readdirSync(root)) {
      const full = path.join(root, name)
      if (name.endsWith('.jsonl')) files.push(full)
      else {
        try {
          if (fs.statSync(full).isDirectory()) {
            for (const inner of fs.readdirSync(full)) {
              if (inner.endsWith('.jsonl')) files.push(path.join(full, inner))
            }
          }
        } catch { /* ignore */ }
      }
    }
  } catch { return result }
  result.sessions = files.length
  for (const file of files.slice(0, 20)) {
    try {
      const text = fs.readFileSync(file, 'utf8')
      result.messages += (text.match(/"type":\s*"message"/g) || []).length
    } catch { /* ignore */ }
  }
  return result
}

/* ---------------------------- Orchestration -------------------------- */

function suggestRules(evidence) {
  const rules = []
  const claude = evidence.claude
  if (claude.available && claude.prompts > 0) {
    const planRate = claude.planKeywords / claude.prompts
    rules.push({
      id: 'plan-first',
      title: '先方案后实现',
      text: '多文件/架构/新功能类请求，先给可评审方案，确认后再写代码。',
      evidence: 'Claude Code 会话中 ' + claude.planKeywords + '/' + claude.prompts + ' 条 prompt 含方案类指令（' + (planRate * 100).toFixed(1) + '%）。',
      confidence: planRate >= 0.03 ? 'high' : 'medium',
    })
    if (claude.chinese / claude.prompts >= 0.5) {
      rules.push({
        id: 'chinese-terse',
        title: '中文、短句、先结论',
        text: '默认中文回复；先给结论，再给依据和步骤。',
        evidence: 'Claude Code prompt 中文占 ' + Math.round((claude.chinese / claude.prompts) * 100) + '%，平均 ' + claude.avgChars + ' 字符。',
        confidence: 'high',
      })
    }
  }
  if (evidence.dsh.available && evidence.dsh.sampled > 0) {
    rules.push({
      id: 'evidence-first',
      title: '证据优先，不猜',
      text: '先读真实文件、先跑真实命令，再下结论；引用路径与命令输出。',
      evidence: 'DSH 最近 ' + evidence.dsh.sampled + ' 个会话中工具调用 ' + evidence.dsh.toolCalls + ' 次，用户消息 ' + evidence.dsh.userMessages + ' 条。',
      confidence: 'high',
    })
  }
  if (evidence.codex.available) {
    rules.push({
      id: 'artifactize',
      title: '产物化',
      text: '每个任务尽量沉淀脚本、skill、模板或文档，不停在对话里。',
      evidence: 'Codex 本地索引 ' + evidence.codex.sessions + ' 个会话，说明同一工作被多次续接；沉淀产物可复用。',
      confidence: 'medium',
    })
  }
  rules.push({
    id: 'verify-before-done',
    title: '验证后才宣称完成',
    text: '说完成之前必须跑验证命令或给出可复现证据；未验证要明确标注。',
    evidence: '采纳度量核心指标；本包默认启用。',
    confidence: 'high',
  })
  return rules
}

export async function distill(options = {}) {
  const sources = { ...defaultSources(), ...(options.sources || {}) }
  const dshLimit = Number.isFinite(options.dshSessions) ? options.dshSessions : 12
  const keywords = Array.isArray(options.keywords) ? options.keywords : []
  const evidence = {
    generatedAt: new Date().toISOString(),
    claude: await scanClaude(sources.claude, keywords),
    codex: await scanCodex(sources.codexIndex),
    dsh: await scanDsh(sources.dshSessions, dshLimit),
    pi: await scanPi(sources.piSessions),
  }
  const suggestedRules = suggestRules(evidence)
  const report = { version: 1, generatedAt: evidence.generatedAt, sources: evidence, suggestedRules }
  fs.mkdirSync(reportsDir(), { recursive: true })
  const stamp = evidence.generatedAt.replace(/[:.]/g, '-')
  const file = path.join(reportsDir(), 'report-' + stamp + '.json')
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n')
  fs.writeFileSync(path.join(reportsDir(), 'latest.json'), JSON.stringify(report, null, 2) + '\n')
  return { file, report }
}

export function readLatestReport() {
  try {
    return JSON.parse(fs.readFileSync(path.join(reportsDir(), 'latest.json'), 'utf8'))
  } catch {
    return undefined
  }
}

/**
 * The newest `count` distilled reports, newest first.
 *
 * Metrics use this to show a diff against the previous run instead of
 * pretending a single snapshot is a trend.
 */
export function readReports(count = 2) {
  let names
  try {
    names = fs.readdirSync(reportsDir())
  } catch {
    return []
  }
  const files = names
    .filter((name) => /^report-.*\.json$/.test(name))
    .sort()
    .reverse()
    .slice(0, Math.max(1, count))
  const out = []
  for (const name of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(reportsDir(), name), 'utf8')))
    } catch { /* skip a corrupt report rather than failing the whole metric */ }
  }
  return out
}
