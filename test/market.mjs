/**
 * dsh-workstyle market test — no harness required.
 *
 * Exercises the market registry validator, the network/cache/stale fallback in
 * `lib/market.js`, and `scripts/build-market.mjs` determinism, all against a
 * throwaway DSH_HOME and a local HTTP server. No real GitHub traffic.
 *
 * Run: node test/market.mjs
 */
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-market-'))
process.env.DSH_HOME = home

const {
  CACHE_TTL_MS,
  MARKET_SCHEMA,
  marketCachePath,
  normalizeRegistry,
  readCache,
  readMarket,
} = await import(path.join(root, 'lib/market.js'))

let checked = 0
function ok(condition, label, detail) {
  checked += 1
  if (!condition) {
    console.error('✗ ' + label + (detail ? ' — ' + detail : ''))
    process.exit(1)
  }
  console.log('  ✓ ' + label)
}

function rejects(fn, field, pattern, label) {
  let error = null
  try {
    fn()
  } catch (caught) {
    error = caught
  }
  const detail = error ? (error.field || '') + ' / ' + error.message : 'no error'
  ok(error !== null, label, detail)
  if (error === null) return
  if (field) ok(error.field === field, label + ' → field ' + field, detail)
  if (pattern) ok(pattern.test(error.message), label + ' → message ' + pattern, detail)
}

function entry(overrides = {}) {
  return {
    id: 'demo-review',
    version: '0.1.0',
    displayName: 'Demo Review',
    author: 'demo',
    license: 'MIT',
    description: 'Review before shipping.',
    categories: ['review'],
    rules: 1,
    skills: 1,
    sha256: '6b00cd063c3a479fd911aa6dac8c6382584243b60f5b7512956ea9f113a1001a',
    url: 'https://example.com/demo-review-0.1.0.tar.gz',
    ...overrides,
  }
}

function registry(packs) {
  return { schema: MARKET_SCHEMA, packs }
}

/* ----------------------------- validation ------------------------------ */

console.log('validation:')
const valid = normalizeRegistry(registry([entry()]))
ok(valid.packs.length === 1 && valid.packs[0].id === 'demo-review', 'valid registry normalizes')
ok(valid.packs[0].categories[0] === 'review' && valid.packs[0].rules === 1, 'categories and counts survive')

rejects(() => normalizeRegistry({ packs: [] }), 'schema', /market@1/, 'missing schema is refused')
rejects(() => normalizeRegistry({ schema: 'nope', packs: [] }), 'schema', /market@1/, 'wrong schema is refused')
rejects(() => normalizeRegistry(registry([entry({ id: 'plain' })])), 'packs[0].id', /namespaced/, 'id without a namespace dash is refused')
rejects(() => normalizeRegistry(registry([entry({ id: 'Bad_ID' })])), 'packs[0].id', /match/, 'malformed id is refused')
rejects(() => normalizeRegistry(registry([entry({ version: 'v1' })])), 'packs[0].version', /semver/, 'non-semver version is refused')
rejects(() => normalizeRegistry(registry([entry({ sha256: 'abc' })])), 'packs[0].sha256', /64 hex/, 'short sha256 is refused')
rejects(() => normalizeRegistry(registry([entry({ sha256: undefined })])), 'packs[0].sha256', /required|string/, 'missing sha256 is refused')
rejects(() => normalizeRegistry(registry([entry({ url: 'ftp://example.com/x.tgz' })])), 'packs[0].url', /http/, 'non-http url is refused')
rejects(() => normalizeRegistry(registry([entry({ url: 'https://example.com/x.tgz#sha256=abc' })])), 'packs[0].url', /fragment/, 'url with a fragment is refused')
rejects(() => normalizeRegistry(registry([entry({ url: 'https://user:pass@example.com/x.tgz' })])), 'packs[0].url', /credentials/, 'url with credentials is refused')
rejects(() => normalizeRegistry(registry([entry(), entry()])), 'packs[1].id', /duplicates/, 'duplicate ids are refused')
rejects(() => normalizeRegistry(registry(Array.from({ length: 501 }, (_, i) => entry({ id: 'p-' + i })))), 'packs', /500/, 'more than 500 packs is refused')

/* --------------------------- network + cache --------------------------- */

console.log('network + cache:')
let requests = 0
let served = registry([entry()])
const server = http.createServer((req, res) => {
  requests += 1
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(served))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const url = 'http://127.0.0.1:' + server.address().port + '/registry.json'

const first = await readMarket({ url })
ok(first.source === 'network' && first.stale === false, 'first read fetches from the network')
ok(first.catalog.packs.length === 1 && first.catalog.packs[0].id === 'demo-review', 'network catalog is validated')
ok(requests === 1, 'exactly one HTTP request')
ok(fs.existsSync(marketCachePath()), 'catalog is cached under DSH_HOME/workstyle')
ok(readCache() !== null && readCache().url === url, 'cache round-trips through readCache')

const second = await readMarket({ url, now: first.fetchedAt + 1000 })
ok(second.source === 'cache' && second.stale === false, 'second read inside the TTL uses the cache')
ok(requests === 1, 'fresh cache performs no HTTP request')

const forced = await readMarket({ url, force: true, now: first.fetchedAt + 1000 })
ok(forced.source === 'network' && requests === 2, 'force bypasses a fresh cache')

server.closeAllConnections()
await new Promise((resolve) => server.close(resolve))
const stale = await readMarket({ url, now: forced.fetchedAt + CACHE_TTL_MS + 1 })
ok(stale.source === 'cache' && stale.stale === true, 'failed fetch falls back to the cached catalog')
ok(stale.catalog.packs.length === 1, 'stale fallback keeps the catalog')
ok(typeof stale.error === 'string' && stale.error.length > 0, 'stale fallback reports the error')
ok(requests === 2, 'stale read attempted the (closed) network without a server hit')

fs.rmSync(marketCachePath())
const empty = await readMarket({ url })
ok(empty.source === 'none' && empty.stale === true, 'no cache + unreachable host reports source=none')
ok(empty.catalog.schema === MARKET_SCHEMA && empty.catalog.packs.length === 0, 'no cache yields an empty catalog')
ok(typeof empty.error === 'string', 'no cache reports the error')

/* --------------------------- build determinism ------------------------- */

console.log('build-market:')
const dist = path.join(home, 'dist')
const registryPath = path.join(home, 'registry.json')
const build = (args) =>
  execFileSync(process.execPath, [path.join(root, 'scripts/build-market.mjs'), ...args], {
    cwd: root,
    encoding: 'utf8',
  })
const write = () =>
  build([
    '--write',
    '--packs', 'test/fixtures/market/packs',
    '--registry', registryPath,
    '--dist', dist,
    '--repo', 'test/repo',
  ])

write()
const firstRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const firstSha = firstRegistry.packs[0].sha256
ok(firstRegistry.packs.length === 1, 'build --write emits one pack')
ok(firstRegistry.packs[0].id === 'demo-review', 'registry carries the fixture id')
ok(firstRegistry.packs[0].url === 'https://github.com/test/repo/releases/download/market/demo-review-0.1.0.tar.gz', 'registry pins the release url')
ok(fs.existsSync(path.join(dist, 'demo-review-0.1.0.tar.gz')), 'archive lands in the dist directory')

write()
const secondSha = JSON.parse(fs.readFileSync(registryPath, 'utf8')).packs[0].sha256
ok(firstSha === secondSha, 'two builds produce identical sha256')

const checkOk = build(['--check', '--packs', 'test/fixtures/market/packs', '--registry', registryPath, '--repo', 'test/repo'])
ok(checkOk === '' || !/mismatch/i.test(checkOk), '--check accepts the committed registry')

const tampered = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
tampered.packs[0].sha256 = '0'.repeat(64)
fs.writeFileSync(registryPath, JSON.stringify(tampered, null, 2) + '\n')
let failed = false
try {
  build(['--check', '--packs', 'test/fixtures/market/packs', '--registry', registryPath, '--repo', 'test/repo'])
} catch (error) {
  failed = true
  ok(/sha256|mismatch/i.test(String(error.stdout || '') + String(error.stderr || '')), '--check reports the sha256 mismatch')
}
ok(failed, '--check exits non-zero on a tampered registry')

console.log('\nALL ' + checked + ' CHECKS PASSED')
