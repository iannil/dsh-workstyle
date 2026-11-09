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

/* regression: a full ring must still be able to restore its OLDEST revision.
 * snapshot() caps + prunes before the caller reads the bytes, so restoring the
 * oldest row used to delete that row's file, throw ENOENT and destroy the row. */
const revSource = (row) => path.join(home, 'workstyle', 'revisions', row.key, row.ts + '.json')
const seedRing = (name) => {
  const file = path.join(home, 'workstyle', name + '.json')
  for (let i = 1; i <= REVISION_KEEP + 1; i++) commit(file, { n: i, ring: name }, { reason: 'ring-' + i })
  return file
}

const oldestFile = seedRing('ring-oldest')
ok(listRevisions(oldestFile).length === REVISION_KEEP, 'ring is full before the oldest restore')
const oldestRing = listRevisions(oldestFile)
const oldestRow = oldestRing[oldestRing.length - 1]
const oldestBytes = fs.readFileSync(revSource(oldestRow))
ok(JSON.parse(oldestBytes).n === 1, 'the oldest row holds the first content')

const backOldest = restore(oldestRow.id)
ok(JSON.parse(fs.readFileSync(oldestFile, 'utf8')).n === 1, 'restoring the oldest retained revision lands its bytes')
ok(fs.readFileSync(oldestFile).equals(oldestBytes), 'the restored file is byte-identical to the snapshot')
const afterOldest = listRevisions(oldestFile)
ok(afterOldest.length === REVISION_KEEP, 'revision list stays capped at ' + REVISION_KEEP + ' after restoring the oldest')
ok(afterOldest.some((row) => row.id === oldestRow.id), 'the restored oldest revision is still listed')
ok(!!backOldest.revision, 'the overwritten bytes are snapshotted (restore stays reversible)')
const oldestDirFiles = fs.readdirSync(path.join(home, 'workstyle', 'revisions', oldestRow.key)).filter((n) => n.endsWith('.json'))
ok(oldestDirFiles.length === REVISION_KEEP, 'snapshot files stay pruned to the cap after restoring the oldest')

/* the same row must still work on retry (the bug made it a 404) */
restore(oldestRow.id)
ok(JSON.parse(fs.readFileSync(oldestFile, 'utf8')).n === 1, 'the restored row can be restored again')
ok(listRevisions(oldestFile).some((row) => row.id === oldestRow.id) && listRevisions(oldestFile).length === REVISION_KEEP, 'the row survives a retry and the ring is still capped')

/* newest-first case on its own file */
const newestFile = seedRing('ring-newest')
const newestRing = listRevisions(newestFile)
const newestRow2 = newestRing[0]
ok(JSON.parse(fs.readFileSync(revSource(newestRow2))).n === 20, 'the newest row holds the last snapshotted content')
const backNewest = restore(newestRow2.id)
ok(JSON.parse(fs.readFileSync(newestFile, 'utf8')).n === 20, 'restoring the newest retained revision lands its bytes')
const afterNewest = listRevisions(newestFile)
ok(afterNewest.length === REVISION_KEEP, 'revision list stays capped after restoring the newest')
ok(afterNewest.some((row) => row.id === newestRow2.id), 'the restored newest revision is still listed')
ok(!!backNewest.revision, 'restoring the newest also snapshots the overwritten bytes')

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
