/**
 * Pack loading for dsh-workstyle.
 *
 * A pack is a directory containing `workstyle.json` (or a simple
 * `workstyle.yaml`) plus a `skills/` directory. Packs are discovered from:
 *   1. the plugin's own `pack/` directory (optional bundled packs)
 *   2. `$DSH_HOME/workstyle/packs/<id>/` (installed or authored locally)
 *
 * The default FDE pack now lives in the plugin's `market/packs/` source tree
 * and is copied to (2) on first boot; `pack/` remains supported for hosts that
 * still bundle packs directly.
 *
 * No third-party dependencies: the YAML subset accepted here is intentionally
 * small and documented in WORKSTYLE.md.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

export function workstyleHome() {
  return path.join(dshHome(), 'workstyle')
}

export function statePath() {
  return path.join(workstyleHome(), 'state.json')
}

export function reportsDir() {
  return path.join(workstyleHome(), 'reports')
}

export function exportsDir() {
  return path.join(workstyleHome(), 'exports')
}

export function readState() {
  try {
    const raw = fs.readFileSync(statePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    // A half-written state file would otherwise silently reset adoptions and
    // presets; keep the corrupt bytes around as evidence instead of letting
    // the next writeState overwrite them unnoticed.
    try {
      const corrupt = statePath() + '.corrupt'
      if (!fs.existsSync(corrupt)) fs.renameSync(statePath(), corrupt)
      logStateCorruption(error)
    } catch { /* nothing more we can do */ }
    return {}
  }
}

function logStateCorruption(error) {
  try { fs.writeFileSync(statePath() + '.corrupt.log', String(error && error.stack || error) + '\n') } catch { /* best effort */ }
}

// Writes go through a temp file + rename so a crash mid-write can never leave
// a truncated JSON file behind (rename is atomic on the same volume).
export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

export function writeState(patch) {
  const next = { ...readState(), ...patch, updatedAt: new Date().toISOString() }
  writeJsonAtomic(statePath(), next)
  return next
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

function readManifest(dir) {
  const jsonPath = path.join(dir, 'workstyle.json')
  if (fs.existsSync(jsonPath)) {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    return { manifest: parsed, format: 'json' }
  }
  const yamlPath = path.join(dir, 'workstyle.yaml')
  if (fs.existsSync(yamlPath)) {
    return { manifest: parseYaml(fs.readFileSync(yamlPath, 'utf8')), format: 'yaml' }
  }
  return undefined
}

function normalizePack(dir, manifest, format) {
  const rules = Array.isArray(manifest.rules) ? manifest.rules : []
  const skills = manifest.skills && typeof manifest.skills === 'object' ? manifest.skills : {}
  const skillsDir = path.join(dir, skills.dir || 'skills')
  return {
    ...manifest,
    id: manifest.id || path.basename(dir),
    name: manifest.name || manifest.id || path.basename(dir),
    displayName: manifest.displayName || manifest.name || path.basename(dir),
    version: manifest.version || '0.0.0',
    format,
    dir,
    rules: rules.map((rule, i) => ({
      id: rule.id || 'rule-' + (i + 1),
      title: rule.title || rule.id || '规则 ' + (i + 1),
      text: rule.text || '',
      evidence: rule.evidence || '',
      severity: rule.severity || 'medium',
      // Per-rule keywords feed the hit metric; dropping them here made every
      // pack rule report as unmeasurable.
      ...(Array.isArray(rule.measures) && rule.measures.length
        ? { measures: rule.measures.filter((word) => typeof word === 'string' && word) }
        : {}),
      ...(rule.source ? { source: rule.source } : {}),
    })).filter((rule) => rule.text),
    skillsDir,
    skillsMeta: skills,
    measures: Array.isArray(manifest.measures) ? manifest.measures : [],
  }
}

export function loadPackAt(dir) {
  if (!isDir(dir)) return undefined
  try {
    const found = readManifest(dir)
    if (!found) return undefined
    return normalizePack(dir, found.manifest, found.format)
  } catch {
    return undefined
  }
}

export function loadPacks(pkgDir) {
  const dirs = []
  const bundled = path.join(pkgDir, 'pack')
  if (isDir(bundled)) {
    for (const name of fs.readdirSync(bundled)) {
      const dir = path.join(bundled, name)
      if (isDir(dir)) dirs.push(dir)
    }
  }
  const user = path.join(workstyleHome(), 'packs')
  if (isDir(user)) {
    for (const name of fs.readdirSync(user)) {
      const dir = path.join(user, name)
      if (isDir(dir)) dirs.push(dir)
    }
  }
  const packs = []
  for (const dir of dirs) {
    const pack = loadPackAt(dir)
    if (pack) packs.push(pack)
  }
  // Stable, human-friendly order; bundled reference pack first.
  packs.sort((a, b) => (a.id === 'fde-engineering' ? -1 : b.id === 'fde-engineering' ? 1 : a.id.localeCompare(b.id)))
  return packs
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */


function parseFrontmatter(text) {
  const result = {}
  if (!text.startsWith('---')) return result
  const end = text.indexOf('\n---', 3)
  if (end < 0) return result
  const body = text.slice(3, end)
  let lastKey = ''
  for (const rawLine of body.split('\n')) {
    if (!rawLine.trim()) continue
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(rawLine)
    if (match) {
      const key = match[1]
      let value = match[2].trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (value === '>' || value === '|') {
        result[key] = ''
        lastKey = key
      } else if (value === '') {
        result[key] = ''
        lastKey = key
      } else {
        result[key] = value
        lastKey = key
      }
      continue
    }
    if (lastKey && /^\s+/.test(rawLine)) {
      result[lastKey] = (result[lastKey] ? result[lastKey] + ' ' : '') + rawLine.trim()
    }
  }
  return result
}

export function listSkills(pack) {
  const dir = pack.skillsDir
  if (!isDir(dir)) return []
  const skills = []
  for (const name of fs.readdirSync(dir).sort()) {
    const skillDir = path.join(dir, name)
    if (!isDir(skillDir)) continue
    const skillFile = path.join(skillDir, 'SKILL.md')
    if (!fs.existsSync(skillFile)) continue
    let front = {}
    let text = ''
    try {
      text = fs.readFileSync(skillFile, 'utf8')
      front = parseFrontmatter(text)
    } catch {
      continue
    }
    const description = front.description || 'Bundled workstyle skill'
    skills.push({
      name: front.name || name,
      description,
      whenToUse: front.whenToUse,
      dirName: name,
      dir: skillDir,
      file: skillFile,
      frontmatter: front,
    })
  }
  return skills
}

/* ------------------------------------------------------------------ */
/* Prompt rendering                                                    */
/* ------------------------------------------------------------------ */

export function renderRules(pack) {
  if (!pack) return ''
  const lines = []
  lines.push('## 工作方式：' + pack.displayName + '（dsh-workstyle / ' + pack.id + ' v' + pack.version + '）')
  lines.push('')
  lines.push('以下规则来自用户本机的工作方式包，默认生效；用户明确要求时以用户当前指令为准。')
  for (const rule of pack.rules) {
    lines.push('- **' + rule.title + '**：' + rule.text)
  }
  const skillCount = typeof pack.skillCount === 'number'
    ? pack.skillCount
    : (pack.skillsMeta && pack.skillsMeta.count)
  if (skillCount) {
    lines.push('- 已加载 ' + skillCount + ' 个工作方式技能（skills provider）。相关任务优先查这些技能。')
  }
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* Minimal YAML subset parser                                          */
/* ------------------------------------------------------------------ */

function stripComment(line) {
  let inSingle = false
  let inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) inSingle = !inSingle
    else if (ch === '"' && !inSingle) inDouble = !inDouble
    else if (ch === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i)
    }
  }
  return line
}

export function parseYaml(text) {
  const root = {}
  const stack = [{ indent: -1, value: root }]
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    i++
    if (!raw.trim()) continue
    const line = stripComment(raw).replace(/\s+$/, '')
    if (!line.trim()) continue
    const indent = line.length - line.trimStart().length
    const content = line.trim()
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].value
    if (content.startsWith('- ')) {
      const item = content.slice(2).trim()
      const arr = Array.isArray(parent) ? parent : undefined
      if (!arr) continue
      const mapMatch = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(item)
      if (mapMatch) {
        const obj = {}
        arr.push(obj)
        stack.push({ indent, value: obj })
        assign(obj, mapMatch[1], mapMatch[2], lines, i, stack)
      } else {
        arr.push(unquote(item))
      }
      continue
    }
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(content)
    if (!match) continue
    const key = match[1]
    let value = match[2].trim()
    if (value === '') {
      // Look ahead: list or map?
      const next = nextContent(lines, i)
      const child = next && next.content.startsWith('- ') ? [] : {}
      parent[key] = child
      stack.push({ indent, value: child })
      continue
    }
    if (value === '|' || value === '>') {
      const block = []
      let blockIndent = -1
      while (i < lines.length) {
        const l = lines[i]
        if (l.trim() === '') { block.push(''); i++; continue }
        const ind = l.length - l.trimStart().length
        if (blockIndent < 0) blockIndent = ind
        if (ind < blockIndent) break
        block.push(l.slice(blockIndent))
        i++
      }
      parent[key] = block.join('\n').replace(/\n+$/, '')
      continue
    }
    parent[key] = unquote(value)
  }
  return root
}

function assign(target, key, rawValue, lines, index, stack) {
  let value = rawValue.trim()
  if (value === '') {
    const next = nextContent(lines, index)
    const child = next && next.content.startsWith('- ') ? [] : {}
    target[key] = child
    return
  }
  target[key] = unquote(value)
}

function nextContent(lines, from) {
  for (let i = from; i < lines.length; i++) {
    const line = stripComment(lines[i]).replace(/\s+$/, '')
    if (!line.trim()) continue
    return { content: line.trim(), indent: line.length - line.trimStart().length }
  }
  return undefined
}

function unquote(value) {
  const v = value.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}
