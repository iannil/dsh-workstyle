#!/usr/bin/env node
/**
 * Build the public marketplace from `market/packs/<id>/`.
 *
 * Each pack directory is the source of truth. The script validates it, builds
 * a deterministic `.tar.gz` (fixed mtimes, sorted entries), hashes the bytes
 * and writes the matching entry into `market/registry.json`.
 *
 *   node scripts/build-market.mjs --check   # CI: registry must match sources
 *   node scripts/build-market.mjs --write   # rebuild registry + .market-dist/
 *
 * The archive is uploaded to the rolling `market` GitHub release by the
 * workflow; only the text sources and `registry.json` are committed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { tarGz } from '../lib/export.js'
import { sha256 } from '../lib/import.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const PACKS_DIR = path.resolve(ROOT, option('--packs', path.join('market', 'packs')))
const REGISTRY_FILE = path.resolve(ROOT, option('--registry', path.join('market', 'registry.json')))
const SCHEMA = 'dsh-workstyle/market@1'
const RELEASE_TAG = 'market'
const MAX_EXTRACTED_BYTES = 10 * 1024 * 1024
const MAX_ENTRIES = 2000
const SKIP_NAMES = new Set(['.git', 'node_modules', '.DS_Store'])
const ID_RE = /^[a-z0-9][a-z0-9-]{0,48}$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

const mode = args.includes('--write')
  ? 'write'
  : args.includes('--verify-remote')
    ? 'verify-remote'
    : 'check'
const distDir = path.resolve(ROOT, option('--dist', '.market-dist'))
const repo = String(option('--repo', process.env.GITHUB_REPOSITORY || 'iannil/dsh-workstyle')).trim()

function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] && !args[index + 1].startsWith('--') ? args[index + 1] : fallback
}

function fail(where, message) {
  const error = new Error(where + ': ' + message)
  error.where = where
  throw error
}

function requireString(manifest, key, id) {
  const value = manifest[key]
  if (typeof value !== 'string' || !value.trim()) fail(id, 'workstyle.json "' + key + '" is required')
  return value.trim()
}

function walk(root, rel, out) {
  const abs = path.join(root, rel)
  for (const name of fs.readdirSync(abs).sort()) {
    if (SKIP_NAMES.has(name)) continue
    const relPath = rel ? rel + '/' + name : name
    const full = path.join(root, relPath)
    const stat = fs.lstatSync(full)
    if (stat.isSymbolicLink()) {
      /* Follow links that stay inside the pack (the FDE skills use one to
         share a reference file); never let a pack point outside its root. */
      let target
      try { target = fs.realpathSync(full) } catch { fail(relPath, 'symbolic link target is missing') }
      if (target !== root && !target.startsWith(root + path.sep)) fail(relPath, 'symbolic links must stay inside the pack')
      const targetStat = fs.statSync(target)
      if (!targetStat.isFile()) fail(relPath, 'symbolic links must point to a file')
      out.push({ name: relPath, data: fs.readFileSync(target), mtime: 0 })
      continue
    }
    if (stat.isDirectory()) {
      out.push({ name: relPath + '/', dir: true, mtime: 0 })
      walk(root, relPath, out)
    } else if (stat.isFile()) {
      out.push({ name: relPath, data: fs.readFileSync(full), mtime: 0 })
    }
  }
}

function archiveUrl(id, version) {
  return 'https://github.com/' + repo + '/releases/download/' + RELEASE_TAG + '/' + id + '-' + version + '.tar.gz'
}

function buildPack(id) {
  const dir = path.join(PACKS_DIR, id)
  const manifestPath = path.join(dir, 'workstyle.json')
  if (!fs.existsSync(manifestPath)) fail(id, 'workstyle.json is required')
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    fail(id, 'workstyle.json is not valid JSON')
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail(id, 'workstyle.json must be an object')

  if (!ID_RE.test(id)) fail(id, 'directory name must match ' + ID_RE)
  if (!id.includes('-')) fail(id, 'pack id must be namespaced, e.g. author-pack')
  if (manifest.id !== id) fail(id, 'workstyle.json id "' + manifest.id + '" must equal the directory name')
  const version = requireString(manifest, 'version', id)
  if (!SEMVER_RE.test(version)) fail(id, 'version must be semver: ' + version)
  const displayName = String(manifest.displayName || manifest.name || '').trim()
  if (!displayName) fail(id, 'displayName (or name) is required')
  const author = requireString(manifest, 'author', id)
  const license = requireString(manifest, 'license', id)
  const description = requireString(manifest, 'description', id)
  if (description.length > 500) fail(id, 'description must be at most 500 characters')

  const rules = Array.isArray(manifest.rules) ? manifest.rules : []
  for (const [index, rule] of rules.entries()) {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) fail(id, 'rules[' + index + '] must be an object')
    if (typeof rule.text !== 'string' || !rule.text.trim()) fail(id, 'rules[' + index + '].text is required')
  }

  const skillsDir = manifest.skills && typeof manifest.skills === 'object' && manifest.skills.dir
    ? String(manifest.skills.dir)
    : 'skills'
  if (skillsDir !== 'skills') fail(id, 'market packs must use skills/ (skills.dir must be "skills")')

  const entries = []
  walk(dir, '', entries)
  if (entries.length > MAX_ENTRIES) fail(id, 'more than ' + MAX_ENTRIES + ' entries')
  const extracted = entries.reduce((total, entry) => total + (entry.dir ? 0 : entry.data.length), 0)
  if (extracted > MAX_EXTRACTED_BYTES) fail(id, 'expands beyond ' + MAX_EXTRACTED_BYTES + ' bytes')
  const skillFiles = entries.filter((entry) => /^skills\/[^/]+\/SKILL\.md$/.test(entry.name))
  if (!rules.length && !skillFiles.length) fail(id, 'a pack needs at least one rule or one skill')

  const archive = tarGz(entries)
  return {
    entries: entries.length,
    extracted,
    archive,
    entry: {
      id,
      version,
      displayName,
      author,
      license,
      description,
      categories: Array.isArray(manifest.categories)
        ? manifest.categories.filter((category) => typeof category === 'string' && category.trim()).map((category) => category.trim())
        : [],
      rules: rules.length,
      skills: skillFiles.length,
      sha256: sha256(archive),
      url: archiveUrl(id, version),
      ...(manifest.minPluginVersion ? { minPluginVersion: String(manifest.minPluginVersion) } : {}),
    },
  }
}

function buildMarket() {
  const ids = fs.existsSync(PACKS_DIR)
    ? fs.readdirSync(PACKS_DIR)
      .filter((name) => !SKIP_NAMES.has(name) && !name.startsWith('.'))
      .filter((name) => fs.statSync(path.join(PACKS_DIR, name)).isDirectory())
      .sort()
    : []
  const packs = []
  const archives = new Map()
  for (const id of ids) {
    const built = buildPack(id)
    packs.push(built.entry)
    archives.set(id + '-' + built.entry.version + '.tar.gz', built.archive)
    console.log(
      '  ' + id + ' v' + built.entry.version +
      '  rules=' + built.entry.rules + ' skills=' + built.entry.skills +
      '  ' + built.entry.sha256.slice(0, 12) + '…  (' + built.entries + ' entries, ' + built.archive.length + ' bytes)',
    )
  }
  return { registry: { schema: SCHEMA, packs }, archives }
}

function readCommitted() {
  if (!fs.existsSync(REGISTRY_FILE)) fail('market/registry.json', 'is missing; run --write')
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'))
  } catch {
    fail('market/registry.json', 'is not valid JSON')
  }
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

async function verifyRemote(registry) {
  let failures = 0
  for (const entry of registry.packs) {
    let ok = false
    for (let attempt = 1; attempt <= 5 && !ok; attempt += 1) {
      try {
        const response = await fetch(entry.url, { redirect: 'follow' })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const digest = sha256(Buffer.from(await response.arrayBuffer()))
        if (digest !== entry.sha256) throw new Error('sha256 ' + digest + ' does not match registry')
        ok = true
      } catch (error) {
        if (attempt === 5) {
          console.error('fail  ' + entry.id + ' ' + entry.url + ': ' + (error && error.message ? error.message : String(error)))
          failures += 1
        } else {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
        }
      }
    }
    if (ok) console.log('ok  ' + entry.id + ' ' + entry.version + ' ' + entry.sha256.slice(0, 12) + '…')
  }
  if (failures) process.exitCode = 1
}

async function main() {
  console.log('market: ' + repo)
  const { registry, archives } = buildMarket()

  if (mode === 'verify-remote') {
    await verifyRemote(registry)
    return
  }

  if (mode === 'check') {
    const committed = readCommitted()
    if (same(committed, registry)) {
      console.log('ok  market/registry.json matches ' + registry.packs.length + ' pack(s)')
      return
    }
    const committedById = new Map((Array.isArray(committed.packs) ? committed.packs : []).map((entry) => [entry.id, entry]))
    const generatedById = new Map(registry.packs.map((entry) => [entry.id, entry]))
    for (const id of new Set([...committedById.keys(), ...generatedById.keys()])) {
      const before = committedById.get(id)
      const after = generatedById.get(id)
      if (!before) { console.error('fail  missing from registry: ' + id); continue }
      if (!after) { console.error('fail  no source pack for registry entry: ' + id); continue }
      if (!same(before, after)) {
        console.error('fail  stale registry entry: ' + id)
        for (const key of ['version', 'sha256', 'url', 'rules', 'skills']) {
          if (!same(before[key], after[key])) console.error('        ' + key + ': ' + before[key] + ' -> ' + after[key])
        }
      }
    }
    if (!same(committed.schema, registry.schema)) console.error('fail  schema: ' + committed.schema + ' -> ' + registry.schema)
    console.error('\nrun `node scripts/build-market.mjs --write` and commit market/registry.json')
    process.exitCode = 1
    return
  }

  fs.mkdirSync(distDir, { recursive: true })
  for (const [name, bytes] of archives) {
    fs.writeFileSync(path.join(distDir, name), bytes)
  }
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2) + '\n')
  console.log('wrote  ' + path.relative(ROOT, REGISTRY_FILE) + ' (' + registry.packs.length + ' pack(s))')
  console.log('wrote  ' + path.relative(ROOT, distDir) + '/ (' + archives.size + ' archive(s))')
}

try {
  await main()
} catch (error) {
  console.error('fail  ' + (error && error.message ? error.message : String(error)))
  process.exitCode = 1
}
