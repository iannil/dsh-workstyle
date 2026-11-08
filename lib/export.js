/**
 * Pack export for dsh-workstyle — P1.
 *
 * Produces a self-contained, portable `.tar.gz` that a colleague can extract
 * and apply directly:
 *
 *   workstyle_apply "/path/to/extracted-fde-engineering"
 *
 * The archive is a valid pack directory: `workstyle.json` (manifest + the
 * effective rules, i.e. bundled rules plus locally adopted distillation rules),
 * `skills/` (all bundled skill files), `README-EXPORT.md` and `manifest.json`
 * (export metadata). No dependencies: tar (ustar) + gzip via node:zlib.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const BLOCK = 512

function tryStat(file) {
  try { return fs.statSync(file) } catch { return undefined }
}

function octal(value, length) {
  return Math.max(0, Math.floor(value)).toString(8).padStart(length - 1, '0') + '\0'
}

/**
 * Split an entry name into ustar `name` (<=100 bytes) and `prefix` (<=155).
 * Returns undefined when the path cannot be represented.
 */
function splitName(name) {
  if (Buffer.byteLength(name) <= 100) return { name, prefix: '' }
  const parts = name.split('/')
  for (let i = parts.length - 1; i > 0; i--) {
    const prefix = parts.slice(0, i).join('/')
    const rest = parts.slice(i).join('/')
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(rest) <= 100) {
      return { name: rest, prefix }
    }
  }
  return undefined
}

function header(entryName, size, mtime, typeflag) {
  const split = splitName(entryName)
  if (!split) throw new Error('tar: path too long for ustar: ' + entryName)
  const buf = Buffer.alloc(BLOCK)
  buf.write(split.name, 0, 100, 'utf8')
  buf.write(octal(typeflag === '5' ? 0o755 : 0o644, 8), 100, 8, 'ascii')
  buf.write(octal(0, 8), 108, 8, 'ascii')          // uid
  buf.write(octal(0, 8), 116, 8, 'ascii')          // gid
  buf.write(octal(size, 12), 124, 12, 'ascii')
  buf.write(octal(mtime, 12), 136, 12, 'ascii')
  buf.write('        ', 148, 8, 'ascii')           // checksum placeholder
  buf.write(typeflag, 156, 1, 'ascii')
  buf.write('ustar\0', 257, 6, 'ascii')
  buf.write('00', 263, 2, 'ascii')
  buf.write(octal(0, 8), 329, 8, 'ascii')          // devmajor
  buf.write(octal(0, 8), 337, 8, 'ascii')          // devminor
  if (split.prefix) buf.write(split.prefix, 345, 155, 'utf8')
  let sum = 0
  for (const byte of buf) sum += byte
  buf.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
  return buf
}

function walk(root, rel, out) {
  for (const name of fs.readdirSync(path.join(root, rel)).sort()) {
    const relPath = rel ? rel + '/' + name : name
    const full = path.join(root, relPath)
    const stat = tryStat(full)
    if (!stat) continue
    if (stat.isDirectory()) {
      out.push({ name: relPath + '/', dir: true, mtime: stat.mtimeMs / 1000 })
      walk(root, relPath, out)
    } else if (stat.isFile()) {
      out.push({ name: relPath, data: fs.readFileSync(full), mtime: stat.mtimeMs / 1000 })
    }
  }
}

function tarGz(entries) {
  const chunks = []
  for (const entry of entries) {
    if (entry.dir) {
      chunks.push(header(entry.name, 0, entry.mtime, '5'))
      continue
    }
    chunks.push(header(entry.name, entry.data.length, entry.mtime, '0'))
    chunks.push(entry.data)
    const pad = entry.data.length % BLOCK
    if (pad) chunks.push(Buffer.alloc(BLOCK - pad))
  }
  chunks.push(Buffer.alloc(BLOCK * 2))
  return zlib.gzipSync(Buffer.concat(chunks), { level: 9 })
}

function stripRule(rule) {
  return {
    id: rule.id,
    title: rule.title,
    text: rule.text,
    evidence: rule.evidence || '',
    severity: rule.severity || 'medium',
    ...(rule.source ? { source: rule.source } : {}),
  }
}

function readme(pack, rules, meta) {
  const lines = []
  lines.push('# ' + (pack.displayName || pack.name) + ' v' + pack.version + ' — dsh-workstyle pack')
  lines.push('')
  lines.push('- 导出时间：' + meta.exportedAt)
  lines.push('- 来源：' + meta.packId + ' v' + meta.packVersion + (meta.adoptedRules ? '（含本机蒸馏采纳规则 ' + meta.adoptedRules + ' 条）' : ''))
  lines.push('- 规则：' + rules.length + ' 条 · 内置技能：' + pack.skillCount + ' 个')
  lines.push('- 许可：' + (pack.license || '见包内许可证'))
  lines.push('')
  lines.push('## 安装到 DeepSeek Harness')
  lines.push('')
  lines.push('1. 解压本归档：`tar -xzf ' + meta.archive + '`')
  lines.push('2. 在 DSH 中应用这个解压目录（任选其一）：')
  lines.push('   - 工具：`workstyle_apply ' + meta.extractHint + '`')
  lines.push('   - 或把目录放到 `~/.dsh/workstyle/packs/` 下，重启后即可在面板切换')
  lines.push('3. 面板「工作方式」里应看到 ' + rules.length + ' 条规则、' + pack.skillCount + ' 个技能。')
  lines.push('')
  lines.push('## 规则')
  lines.push('')
  for (const rule of rules) {
    lines.push('### ' + rule.title)
    lines.push('')
    lines.push(rule.text)
    if (rule.evidence) lines.push('')
    if (rule.evidence) lines.push('> 证据：' + rule.evidence)
    lines.push('')
  }
  lines.push('## 隐私与许可')
  lines.push('')
  lines.push('规则来自本机会话数据的聚合蒸馏，不含 prompt 原文；仅聚合统计与规则文本被打包。')
  lines.push(pack.source && pack.source.skills ? '参考技能来源：' + pack.source.skills + '（' + (pack.source.license || '') + '）' : '')
  lines.push('')
  return lines.join('\n')
}

/**
 * Export one pack (with the caller's effective rules) into a `.tar.gz`.
 *
 * @param {object} options
 * @param {object} options.pack      normalized pack (from lib/pack.js)
 * @param {Array}  options.rules     effective rules (bundled + adopted)
 * @param {string} options.destDir   destination directory
 * @param {Date}   [options.now]
 * @param {object} [options.projectSnapshot] sanitized project scope snapshot
 * @returns {{file:string, bytes:number, files:number, manifest:object}}
 */
export function exportPack({ pack, rules, destDir, now, projectSnapshot }) {
  if (!pack) throw new Error('no pack to export')
  const at = now instanceof Date ? now : new Date()
  const stamp = at.toISOString().replace(/[:.]/g, '-').replace('T', 'T').replace('Z', 'Z')
  const base = pack.id + '-v' + pack.version + '-' + stamp
  const archive = base + '.tar.gz'
  const dest = path.resolve(destDir)
  fs.mkdirSync(dest, { recursive: true })
  const file = path.join(dest, archive)

  const meta = {
    exportedAt: at.toISOString(),
    packId: pack.id,
    packVersion: pack.version,
    pluginVersion: pack.pluginVersion,
    rules: rules.length,
    skills: pack.skillCount || 0,
    archive,
    extractHint: '<解压目录绝对路径>',
  }

  const stubs = (pack.skillList || []).map((skill) => ({
    name: skill.name,
    dir: skill.dirName,
    description: skill.description,
    whenToUse: skill.whenToUse,
  }))

  const hasProjectSnapshot = !!projectSnapshot && typeof projectSnapshot === 'object' && !Array.isArray(projectSnapshot)
  const manifest = {
    format: 'dsh-workstyle-pack',
    exportedAt: meta.exportedAt,
    pack: { id: pack.id, version: pack.version, displayName: pack.displayName, license: pack.license },
    ruleCount: rules.length,
    skillCount: stubs.length,
    rules: rules.map((rule) => ({ id: rule.id, source: rule.source || 'bundled' })),
    skills: stubs,
    ...(hasProjectSnapshot ? { scope: 'project', projectSnapshot: 'project.workstyle.json' } : {}),
  }

  const packManifest = {
    id: pack.id,
    name: pack.name,
    displayName: pack.displayName,
    version: pack.version,
    license: pack.license || 'MIT',
    description: pack.description || '',
    author: pack.author || '',
    ...(pack.source ? { source: pack.source } : {}),
    ...(pack.measures && pack.measures.length ? { measures: pack.measures } : {}),
    rules: rules.map(stripRule),
    skills: { dir: 'skills', count: stubs.length },
    exportedAt: meta.exportedAt,
  }

  const entries = []
  entries.push({ name: 'workstyle.json', data: Buffer.from(JSON.stringify(packManifest, null, 2) + '\n', 'utf8'), mtime: at.getTime() / 1000 })
  entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8'), mtime: at.getTime() / 1000 })
  entries.push({ name: 'README-EXPORT.md', data: Buffer.from(readme({ ...pack, rules }, rules, meta), 'utf8'), mtime: at.getTime() / 1000 })
  if (hasProjectSnapshot) {
    entries.push({
      name: 'project.workstyle.json',
      data: Buffer.from(JSON.stringify(projectSnapshot, null, 2) + '\n', 'utf8'),
      mtime: at.getTime() / 1000,
    })
  }

  const skillsRoot = pack.skillsDir
  const skillStat = skillsRoot ? tryStat(skillsRoot) : undefined
  if (skillStat && skillStat.isDirectory()) {
    const skillEntries = []
    walk(skillsRoot, '', skillEntries)
    for (const entry of skillEntries) {
      entries.push({ ...entry, name: 'skills/' + entry.name })
    }
  }

  const gz = tarGz(entries)
  fs.writeFileSync(file, gz)
  return {
    file,
    bytes: gz.length,
    files: entries.length,
    manifest: { ...manifest, bytes: gz.length, files: entries.length },
  }
}
