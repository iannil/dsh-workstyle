/**
 * Unit tests for the shared write layer.
 * Run: node test/manage.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-manage-'))
process.env.DSH_HOME = home

const {
  REVISION_KEEP, applyRuleOverlay, blockPreset, checkPackId, commit, isUserPack,
  listRevisions, patchOverlay, removeOverlay, resolveWrite, restore,
} = await import('../lib/manage.js')
const { statePath } = await import('../lib/pack.js')

let checks = 0
const ok = (cond, label) => { checks++; assert.ok(cond, label); console.log('  ✓ ' + label) }

const target = path.join(home, 'workstyle', 'scratch.json')

/* first write has nothing to snapshot */
const first = commit(target, { n: 1 }, { reason: 'test-first' })
ok(first.revision === null, 'first write records no revision')
ok(JSON.parse(fs.readFileSync(target, 'utf8')).n === 1, 'first write lands on disk')

/* second write snapshots the previous content */
const second = commit(target, { n: 2 }, { reason: 'test-second' })
ok(!!second.revision && second.revision.bytes > 0, 'second write snapshots the old file')
const listed = listRevisions(target)
ok(listed.length === 1 && listed[0].reason === 'test-second', 'revision index lists the snapshot')

/* restore puts the old bytes back and snapshots the current ones */
const back = restore(second.revision.id)
ok(JSON.parse(fs.readFileSync(target, 'utf8')).n === 1, 'restore brings the previous content back')
ok(listRevisions(target).length === 2, 'restore itself is reversible')
ok(back.file === path.resolve(target), 'restore reports the file it wrote')

/* keep only the newest REVISION_KEEP revisions */
for (let i = 0; i < REVISION_KEEP + 5; i++) commit(target, { n: 100 + i }, { reason: 'churn' })
ok(listRevisions(target).length === REVISION_KEEP, 'revision list is capped at ' + REVISION_KEEP)
const dirs = fs.readdirSync(path.join(home, 'workstyle', 'revisions')).filter((n) => n !== 'index.json')
const keptFiles = dirs.flatMap((d) => fs.readdirSync(path.join(home, 'workstyle', 'revisions', d)).filter((n) => n.endsWith('.json')))
ok(keptFiles.length === REVISION_KEEP, 'snapshot files beyond the cap are pruned')

/* overlay helpers are pure */
let state = {}
state = patchOverlay(state, 'fde-engineering', 'plan-first', { title: '改标题', text: '改正文', id: 'hack' })
ok(state.rulePatches['fde-engineering']['plan-first'].title === '改标题', 'patch stores the title')
ok(!('id' in state.rulePatches['fde-engineering']['plan-first']), 'patch ignores non-whitelisted fields')
state = removeOverlay(state, 'fde-engineering', 'plan-first')
ok(state.ruleRemovals['fde-engineering'].includes('plan-first'), 'remove records the id')
ok(!!state.rulePatches['fde-engineering']['plan-first'], 'remove keeps the patch for later restore')
state = blockPreset(state, 'fde-engineering', 'writing', true)
ok(state.presetBlocked['fde-engineering'].includes('writing'), 'block records the preset id')

const overlayRules = applyRuleOverlay(
  [{ id: 'a', title: 'A', text: 'a' }, { id: 'b', title: 'B', text: 'b' }],
  { patches: { b: { title: 'B2' } }, removed: ['a'] },
)
ok(overlayRules.length === 1 && overlayRules[0].title === 'B2', 'applyRuleOverlay patches then removes')

/* ids and locations */
assert.throws(() => checkPackId('Bad Id'), /pack id/, 'checkPackId rejects spaces and capitals')
ok(checkPackId('my-pack') === 'my-pack', 'checkPackId accepts lowercase ids')
ok(isUserPack({ dir: path.join(home, 'workstyle', 'packs', 'x') }), 'user packs are writable')
ok(!isUserPack({ dir: path.join(home, '..', 'app', 'pack', 'reference') }), 'bundled packs are not user packs')
ok(resolveWrite({ entity: 'rule', pack: { dir: path.join(home, 'workstyle', 'packs', 'x') } }).scope === 'pack', 'user pack rules write to the pack file')
ok(resolveWrite({ entity: 'rule', pack: { dir: '/tmp/app/pack/reference' } }).scope === 'overlay', 'bundled pack rules write to the overlay')
ok(resolveWrite({ entity: 'project-rule', cwd: home }).scope === 'project', 'project rules write to the project file')
ok(resolveWrite({ entity: 'preset' }).file === statePath(), 'preset overlay writes to state.json')

fs.rmSync(home, { recursive: true, force: true })
console.log('\nALL ' + checks + ' CHECKS PASSED')
