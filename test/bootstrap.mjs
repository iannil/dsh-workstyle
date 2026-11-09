/**
 * Default-pack bootstrap test — no harness required.
 *
 * The default FDE pack now lives in `market/packs/` (reviewable like any
 * market entry) instead of `pack/`. A fresh profile must still come up with a
 * working pack, without network access, and a pack the user deleted must stay
 * deleted across restarts.
 *
 * Run: node test/bootstrap.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname))
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-bootstrap-'))
process.env.DSH_HOME = home
process.env.DSH_WORKSTYLE_MARKET_URL = 'http://127.0.0.1:1/registry.json'

let checks = 0
function ok(condition, label) {
  checks += 1
  assert.ok(condition, label)
  console.log('  ✓ ' + label)
}

/* Boot must be offline: fail loudly if anything tries to fetch. */
const realFetch = globalThis.fetch
globalThis.fetch = () => { throw new Error('bootstrap must not use the network') }

const { apply } = await import(path.join(root, 'index.js'))
const { readState } = await import(path.join(root, 'lib/pack.js'))
const { loadPackAt, listSkills } = await import(path.join(root, 'lib/pack.js'))

function mockCtx() {
  return {
    effect(fn) { return fn() },
    systemPrompt: { getSectionOrder() { return 10 }, section() { return () => {} } },
    skills: { registerProvider() { return () => {} } },
    tools: { register() { return () => {} } },
    commands: { register() { return () => {} } },
    connection: { fetch: { register() { return () => {} } } },
    inject(services, callback) { callback(this) },
  }
}

const packDir = path.join(home, 'workstyle', 'packs', 'fde-engineering')
const stateFile = path.join(home, 'workstyle', 'state.json')

console.log('fresh profile:')
ok(!fs.existsSync(stateFile), 'a fresh DSH_HOME has no state.json')
apply(mockCtx())
ok(fs.existsSync(path.join(packDir, 'workstyle.json')), 'the default pack is copied from the bundled snapshot')
const installed = loadPackAt(packDir)
ok(installed && installed.id === 'fde-engineering', 'the copied directory loads as the FDE pack')
ok(installed && installed.version === '0.1.0', 'the copied pack keeps its version')
ok(installed && installed.rules.length === 7, 'the default pack ships 7 rules')
ok(listSkills(installed).length === 40, 'the default pack ships 40 skills')
const state = readState()
ok(state.activePack === 'fde-engineering', 'the default pack is set active')
ok(state.marketPacks && state.marketPacks['fde-engineering']
  && state.marketPacks['fde-engineering'].version === '0.1.0',
'the default pack is marked as market-managed')

console.log('restart:')
const manifestBefore = fs.readFileSync(path.join(packDir, 'workstyle.json'), 'utf8')
apply(mockCtx())
ok(fs.readFileSync(path.join(packDir, 'workstyle.json'), 'utf8') === manifestBefore,
  'a second boot does not rewrite the installed pack')
ok(readState().activePack === 'fde-engineering', 'a second boot keeps the same active pack')

console.log('user deleted the pack:')
fs.rmSync(packDir, { recursive: true, force: true })
apply(mockCtx())
ok(!fs.existsSync(packDir), 'a deleted default pack is not reinstalled on restart')

console.log('0.2.x profile (state.json without marketPacks):')
const legacyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-legacy-'))
fs.mkdirSync(path.join(legacyHome, 'workstyle'), { recursive: true })
fs.writeFileSync(path.join(legacyHome, 'workstyle', 'state.json'),
  JSON.stringify({ activePack: 'custom-pack', rulePatches: {} }) + '\n')
process.env.DSH_HOME = legacyHome
apply(mockCtx())
const legacyPackDir = path.join(legacyHome, 'workstyle', 'packs', 'fde-engineering')
ok(fs.existsSync(path.join(legacyPackDir, 'workstyle.json')), 'a 0.2.x profile gets the default pack once')
const legacyState = readState()
ok(legacyState.marketPacks && legacyState.marketPacks['fde-engineering']
  && legacyState.marketPacks['fde-engineering'].source === 'migration',
'the migrated pack is marked as market-managed')
ok(legacyState.activePack === 'custom-pack', 'migration keeps the profile\'s chosen active pack')

globalThis.fetch = realFetch
console.log('\nALL ' + checks + ' CHECKS PASSED')
