/**
 * Pack import for dsh-workstyle — L1 sharing.
 *
 * An import is a two-step, human-confirmed flow:
 *
 *   1. stage   → download or read an archive, hash it, keep it in
 *                `$DSH_HOME/workstyle/imports/<token>.tar.gz`
 *   2. apply   → re-verify the hash, unpack, validate, install
 *
 * The archive format is the one `lib/export.js` writes: a plain ustar gzip
 * with `workstyle.json` at the root. No dependencies: gzip via node:zlib.
 *
 * Security posture: a share link must carry `#sha256=<64 hex>`; archives are
 * capped in bytes / expanded bytes / entries; absolute paths, `..`, backslashes,
 * symlinks and hardlinks are rejected; extraction is confined to a fresh
 * directory before anything is moved into `packs/`.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { workstyleHome } from './pack.js'

export const LIMITS = Object.freeze({
  downloadBytes: 20 * 1024 * 1024,
  extractedBytes: 100 * 1024 * 1024,
  entries: 5000,
})

const STAGE_TTL_MS = 15 * 60 * 1000
const TOKEN_RE = /^[a-f0-9]{32}$/
const SHA_RE = /^[0-9a-f]{64}$/i
const BLOCK = 512

function fail(message, status = 400, details) {
  const error = new Error(message)
  error.status = status
  if (details) error.details = details
  return error
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/* --- share links ---------------------------------------------------- */

/**
 * Split `https://host/pack.tar.gz#sha256=<hex>` into a fetchable URL and the
 * expected digest. The fragment never goes to the server, so it is a pure
 * integrity pin chosen by the sender.
 */
export function parseShareUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw fail('share link is empty')
  let parsed
  try {
    parsed = new URL(raw.trim())
  } catch {
    throw fail('share link is not a valid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw fail('share link must use http or https')
  }
  const fragment = parsed.hash.replace(/^#/, '')
  if (!fragment) throw fail('share link must carry #sha256=<64 hex characters>')
  const match = /^sha256=([0-9a-f]{64})$/i.exec(fragment)
  if (!match) throw fail('share link fragment must be exactly sha256=<64 hex characters>')
  parsed.hash = ''
  return { url: parsed.toString(), expectedSha256: match[1].toLowerCase() }
}

/**
 * Download a pinned archive. Redirects are followed; the size cap is enforced
 * both on `content-length` and on the bytes actually read.
 */
export async function downloadArchive(rawUrl, { maxBytes = LIMITS.downloadBytes, timeoutMs = 30000 } = {}) {
  const { url, expectedSha256 } = parseShareUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response
    try {
      response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: { accept: 'application/gzip,application/x-gzip,application/octet-stream;q=0.9,*/*;q=0.1' },
      })
    } catch (error) {
      if (error && error.name === 'AbortError') throw fail('download timed out', 504)
      throw fail('download failed: ' + (error && error.message ? error.message : String(error)), 502)
    }
    if (!response.ok) throw fail('download failed: HTTP ' + response.status, 502)
    const declared = Number(response.headers.get('content-length') || 0)
    if (Number.isFinite(declared) && declared > maxBytes) {
      throw fail('archive is larger than ' + maxBytes + ' bytes')
    }
    const chunks = []
    let total = 0
    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
          controller.abort()
          throw fail('archive is larger than ' + maxBytes + ' bytes')
        }
        chunks.push(Buffer.from(value))
      }
    } else {
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length > maxBytes) throw fail('archive is larger than ' + maxBytes + ' bytes')
      chunks.push(buffer)
    }
    return { buffer: Buffer.concat(chunks), url, source: url, expectedSha256 }
  } finally {
    clearTimeout(timer)
  }
}

/* --- tar reader ----------------------------------------------------- */

function readString(block, offset, length) {
  let end = offset
  const limit = offset + length
  while (end < limit && block[end] !== 0) end += 1
  return block.toString('utf8', offset, end)
}

function readOctal(block, offset, length) {
  const raw = readString(block, offset, length).trim()
  if (!raw) return 0
  if (!/^[0-7]+$/.test(raw)) throw fail('archive is corrupt: invalid tar octal field')
  return parseInt(raw, 8)
}

function checksum(block) {
  let sum = 0
  for (let i = 0; i < BLOCK; i += 1) sum += i >= 148 && i < 156 ? 32 : block[i]
  return sum
}

function normalizeEntryName(raw) {
  let name = raw
  const nul = name.indexOf('\0')
  if (nul !== -1) name = name.slice(0, nul)
  if (!name) throw fail('archive contains an entry with an empty name')
  if (name.includes('\\')) throw fail('archive contains a backslash path: ' + name)
  name = name.replace(/\/+$/, '')
  name = name.replace(/^(\.\/)+/, '')
  if (!name) return ''
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    throw fail('archive contains an absolute path: ' + name)
  }
  for (const part of name.split('/')) {
    if (part === '' || part === '.' || part === '..') {
      throw fail('archive contains an unsafe path: ' + name)
    }
  }
  if (name.length > 400) throw fail('archive contains an over-long path')
  return name
}

/**
 * Parse a gzip'd ustar archive into `{entries, bytes}` without touching disk.
 * Entry data are views into the decompressed buffer, so the caller must not
 * hold them after the returned object is dropped.
 */
export function readTarGz(buffer, { maxBytes = LIMITS.extractedBytes, maxEntries = LIMITS.entries } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 18) throw fail('file is not a gzip archive')
  if (buffer[0] !== 0x1f || buffer[1] !== 0x8b) throw fail('file is not a gzip archive')
  let raw
  try {
    raw = zlib.gunzipSync(buffer, { maxOutputLength: maxBytes })
  } catch (error) {
    if (error && (error.code === 'ERR_BUFFER_TOO_LARGE' || /maxOutputLength|output length/i.test(String(error.message)))) {
      throw fail('archive expands beyond ' + maxBytes + ' bytes')
    }
    throw fail('archive is not a valid gzip stream')
  }

  const entries = []
  const seen = new Set()
  let offset = 0
  let total = 0
  let sawEnd = false

  while (offset + BLOCK <= raw.length) {
    const block = raw.subarray(offset, offset + BLOCK)
    let empty = true
    for (let i = 0; i < BLOCK; i += 1) {
      if (block[i] !== 0) { empty = false; break }
    }
    if (empty) {
      sawEnd = true
      break
    }
    const stored = readOctal(block, 148, 8)
    if (stored !== checksum(block)) throw fail('archive is corrupt: bad tar header checksum')
    const namePart = readString(block, 0, 100)
    const prefix = readString(block, 345, 155)
    const full = prefix ? prefix + '/' + namePart : namePart
    const size = readOctal(block, 124, 12)
    const type = readString(block, 156, 1) || '0'
    const magic = readString(block, 257, 6)
    if (magic && !magic.startsWith('ustar')) throw fail('archive uses an unsupported tar format')
    if (type !== '0' && type !== '5') {
      throw fail('archive contains unsupported entry type "' + type + '" (only plain files and directories are allowed)')
    }
    const name = normalizeEntryName(full)
    offset += BLOCK
    if (type === '5') {
      if (name && !seen.has(name)) { seen.add(name); entries.push({ name, type: 'dir', size: 0, data: null }) }
    } else if (name) {
      if (!Number.isFinite(size) || size < 0) throw fail('archive is corrupt: invalid entry size')
      const end = offset + size
      if (end > raw.length) throw fail('archive is truncated')
      total += size
      if (total > maxBytes) throw fail('archive expands beyond ' + maxBytes + ' bytes')
      if (seen.has(name)) throw fail('archive contains a duplicate entry: ' + name)
      if (entries.length >= maxEntries) throw fail('archive contains more than ' + maxEntries + ' entries')
      seen.add(name)
      entries.push({ name, type: 'file', size, data: raw.subarray(offset, end) })
    }
    offset += Math.ceil(size / BLOCK) * BLOCK
  }

  if (!sawEnd && offset < raw.length && raw.length - offset >= BLOCK) throw fail('archive is truncated')
  if (!entries.length) throw fail('archive is empty')
  return { entries, bytes: total }
}

function countFiles(entries) {
  return entries.filter((entry) => entry.type === 'file').length
}

/**
 * Read the pack manifest from the archive root. `manifest.json` is export
 * metadata only; `workstyle.json` is the pack itself.
 */
export function inspectEntries(entries) {
  const files = new Map(entries.filter((entry) => entry.type === 'file').map((entry) => [entry.name, entry]))
  const entry = files.get('workstyle.json')
  if (!entry) throw fail('archive must contain workstyle.json at its root')
  let pack
  try {
    pack = JSON.parse(entry.data.toString('utf8'))
  } catch {
    throw fail('workstyle.json is not valid JSON')
  }
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) throw fail('workstyle.json must be a JSON object')
  const skillNames = []
  for (const name of files.keys()) {
    const match = /^skills\/([^/]+)\/SKILL\.md$/.exec(name)
    if (match) skillNames.push(match[1])
  }
  return {
    pack,
    files: countFiles(entries),
    ruleCount: Array.isArray(pack.rules) ? pack.rules.length : 0,
    skillCount: skillNames.length || (pack.skills && Number.isFinite(pack.skills.count) ? pack.skills.count : 0),
    skillNames: skillNames.slice(0, 60),
  }
}

/**
 * Write validated entries under `destDir`, re-checking every resolved path.
 */
export function extractArchive(entries, destDir) {
  const root = path.resolve(destDir)
  fs.mkdirSync(root, { recursive: true })
  let files = 0
  for (const entry of entries) {
    const target = path.resolve(root, entry.name)
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw fail('archive entry escapes the destination: ' + entry.name)
    }
    if (entry.type === 'dir') {
      fs.mkdirSync(target, { recursive: true })
      continue
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, entry.data, { mode: 0o644 })
    files += 1
  }
  return { files }
}

/* --- staged archives ------------------------------------------------ */

export function importsDir() {
  return path.join(workstyleHome(), 'imports')
}

/** Lazy TTL cleanup; called before every stage. */
export function cleanupStaged({ ttlMs = STAGE_TTL_MS, now = Date.now() } = {}) {
  const dir = importsDir()
  let names = []
  try { names = fs.readdirSync(dir) } catch { return 0 }
  let removed = 0
  for (const name of names) {
    const abs = path.join(dir, name)
    let stat
    try { stat = fs.statSync(abs) } catch { continue }
    if (now - stat.mtimeMs <= ttlMs) continue
    try { fs.rmSync(abs, { recursive: true, force: true }); removed += 1 } catch { /* best effort */ }
  }
  return removed
}

/**
 * Persist an archive candidate and return its preview token. The expected
 * digest (from a share link) is checked here, before anything is kept.
 */
export function stageArchive({ buffer, source, expectedSha256 } = {}) {
  cleanupStaged()
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw fail('archive is empty')
  if (buffer.length > LIMITS.downloadBytes) {
    throw fail('archive is larger than ' + LIMITS.downloadBytes + ' bytes')
  }
  const actualSha = sha256(buffer)
  if (expectedSha256) {
    if (!SHA_RE.test(String(expectedSha256))) throw fail('expected sha256 is malformed')
    if (actualSha !== String(expectedSha256).toLowerCase()) {
      throw fail('sha256 mismatch: expected ' + expectedSha256 + ', got ' + actualSha, 400, {
        expectedSha256: String(expectedSha256).toLowerCase(),
        actualSha256: actualSha,
      })
    }
  }
  const token = crypto.randomBytes(16).toString('hex')
  const dir = importsDir()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, token + '.tar.gz'), buffer, { mode: 0o600 })
  const meta = {
    token,
    sha256: actualSha,
    bytes: buffer.length,
    source: typeof source === 'string' && source ? source : 'local file',
    createdAt: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(dir, token + '.json'), JSON.stringify(meta, null, 2) + '\n', { mode: 0o600 })
  return { ...meta, buffer }
}

export function readStaged(token) {
  const clean = String(token || '')
  if (!TOKEN_RE.test(clean)) throw fail('import token is invalid')
  const dir = importsDir()
  let meta
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, clean + '.json'), 'utf8'))
  } catch {
    throw fail('import preview expired; start again', 410)
  }
  const age = Date.now() - Date.parse(meta.createdAt || 0)
  if (!Number.isFinite(age) || age > STAGE_TTL_MS) {
    dropStaged(clean)
    throw fail('import preview expired; start again', 410)
  }
  let buffer
  try {
    buffer = fs.readFileSync(path.join(dir, clean + '.tar.gz'))
  } catch {
    throw fail('import preview expired; start again', 410)
  }
  if (sha256(buffer) !== meta.sha256) {
    dropStaged(clean)
    throw fail('staged archive changed after preview; start again', 410)
  }
  return { ...meta, buffer }
}

export function dropStaged(token) {
  const clean = String(token || '')
  if (!TOKEN_RE.test(clean)) return
  const dir = importsDir()
  for (const suffix of ['.tar.gz', '.json', '.extract']) {
    try { fs.rmSync(path.join(dir, clean + suffix), { recursive: true, force: true }) } catch { /* best effort */ }
  }
}
