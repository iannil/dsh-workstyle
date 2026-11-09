# 工作包 / 规则 / 预设管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让面板真正能增删改工作包、规则、预设，并把每次本机写入都变成可回滚的修订。

**Architecture:** 一个共享写入层 `lib/manage.js` 统一决定「写到哪个文件 + 写前快照 + 原子写 + 回滚」；`lib/scope.js` 负责分层合并，新增预设白名单过滤与「谁关掉了它」的原因标注；`index.js` 的 `/rule` `/preset` `/pack` `/revisions` 路由只做参数校验与调度；`client.js` 在现有四个页面内补齐编辑入口。

**Tech Stack:** Node.js >= 20，纯 ESM，零运行时依赖，`node:test` 不用（沿用现有自写断言），React（宿主注入的 `React.createElement`）。

**Spec:** `docs/superpowers/specs/2026-11-09-workstyle-management-design.md`

## Global Constraints

- 纯 ESM，零运行时依赖；**不新增任何 npm 包**。
- 内置包目录 `pack/` **只读**，任何写入都不得落在该目录下。
- 所有本机落盘必须经 `writeJsonAtomic`（`lib/pack.js:60`），写入前必须有快照（项目层除外，交给 git）。
- 用户数据一律落在 `$DSH_HOME/workstyle/`（`state.json`、`packs/<id>/`、`revisions/`、`trash/`）。
- UI 文案走 `client.js` 内的 `zh` / `en` 两个字典（约 `client.js:150-520`），新 key 必须两边都加。
- 本机 `node` 不在 PATH：`export NODE=/Users/rong.zhu/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`，所有测试命令以 `$NODE` 为前缀。
- 测试基线：`test/smoke.mjs` 146 项、`test/panel-render.mjs` 120 项、`test/multipage-render.mjs` 97 项，改动后只能增不能减。

---

## 文件结构

| 文件 | 责任 | 动作 |
| --- | --- | --- |
| `lib/manage.js` | 落点解析、快照、修订索引、回滚、覆盖层纯函数 | 新建 |
| `lib/scope.js` | 分层合并；新增预设白名单、removed 规则、blocked 预设 | 修改 |
| `index.js` | 覆盖层读写、`refreshPacks`、路由扩展、`writable` 元数据 | 修改 |
| `lib/export.js` | 导出时合并覆盖层，带上 presets / templates | 修改 |
| `client.js` | 规则 / 预设 / 包 / 分发四页交互 | 修改 |
| `test/manage.mjs` | 写入层单测 | 新建 |
| `test/smoke.mjs` | 路由级集成断言 | 修改 |
| `docs/USAGE.md` | 新概念（落点、预设白名单、回滚） | 修改 |
| `README.md` | 一句话管理能力 | 修改 |

---

### Task 1: 共享写入层 `lib/manage.js`

**Files:**
- Create: `lib/manage.js`
- Test: `test/manage.mjs`

**Interfaces:**
- Consumes: `statePath()`, `workstyleHome()`, `writeJsonAtomic()` from `lib/pack.js`；`projectFilePath()`, `sessionFilePath()` from `lib/scope.js`。
- Produces:
  - `REVISION_KEEP = 20`
  - `revisionsDir(): string`、`trashDir(): string`、`userPacksDir(): string`
  - `checkPackId(id: string): string`
  - `isUserPack(pack): boolean`
  - `snapshot(file: string, reason?: string): {id, at, bytes, reason} | null`
  - `commit(file: string, value, opts?: {reason?: string}): {revision, bytes}`
  - `listRevisions(file?: string): Array<{id, at, bytes, reason, key, path}>`
  - `restore(id: string): {file, revision, restored}`
  - `resolveWrite({entity, pack, cwd, sessionId}): {scope: 'overlay'|'pack'|'project'|'session', file, label}`
  - `applyRuleOverlay(rules, {patches, removed}): rules[]`
  - `patchOverlay(state, packId, ruleId, patch): state`、`removeOverlay(state, packId, ruleId): state`、`restoreOverlay(state, packId, ruleId): state`
  - `blockPreset(state, packId, presetId, blocked): state`

- [ ] **Step 1: 写失败测试 `test/manage.mjs`**

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `$NODE test/manage.mjs`
Expected: FAIL — `Cannot find module '../lib/manage.js'`

- [ ] **Step 3: 实现 `lib/manage.js`**

```js
/**
 * Shared write layer for pack / rule / preset edits.
 *
 * One place decides where a change lands (bundled pack → overlay, user pack →
 * pack file, project/session → their scope file), snapshots the file before
 * writing, and records a revision so the panel can roll back.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { statePath, workstyleHome, writeJsonAtomic } from './pack.js'
import { projectFilePath, sessionFilePath } from './scope.js'

export const REVISION_KEEP = 20

export function revisionsDir() { return path.join(workstyleHome(), 'revisions') }
export function trashDir() { return path.join(workstyleHome(), 'trash') }
export function userPacksDir() { return path.join(workstyleHome(), 'packs') }

export function checkPackId(id) {
  const value = typeof id === 'string' ? id.trim() : ''
  if (!value) throw new Error('pack id is required')
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/.test(value)) {
    throw new Error('pack id must be lowercase letters, digits and dashes: ' + value)
  }
  return value
}

export function isUserPack(pack) {
  if (!pack || typeof pack.dir !== 'string') return false
  const root = path.resolve(userPacksDir())
  const dir = path.resolve(pack.dir)
  return dir === root || dir.startsWith(root + path.sep)
}

function keyOf(file) {
  return crypto.createHash('sha1').update(path.resolve(file)).digest('hex').slice(0, 10)
}

function readIndex() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(revisionsDir(), 'index.json'), 'utf8'))
    return parsed && parsed.files ? parsed : { version: 1, files: {} }
  } catch {
    return { version: 1, files: {} }
  }
}

function writeIndex(index) {
  fs.mkdirSync(revisionsDir(), { recursive: true })
  writeJsonAtomic(path.join(revisionsDir(), 'index.json'), index)
}

/** Copy the current bytes of `file` into the revision store. Returns null when the file does not exist yet. */
export function snapshot(file, reason = 'write') {
  const target = path.resolve(file)
  let stat
  try { stat = fs.statSync(target) } catch { return null }
  if (!stat.isFile()) return null
  const key = keyOf(target)
  const dir = path.join(revisionsDir(), key)
  fs.mkdirSync(dir, { recursive: true })
  const at = new Date().toISOString()
  const ts = at.replace(/[:.]/g, '-')
  const data = fs.readFileSync(target)
  const tmp = path.join(dir, ts + '.json.tmp')
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, path.join(dir, ts + '.json'))

  const index = readIndex()
  const entry = index.files[key] || { path: target, entries: [] }
  entry.path = target
  entry.entries.unshift({ id: key + '-' + ts, at, bytes: data.length, reason, ts })
  entry.entries = entry.entries.slice(0, REVISION_KEEP)
  index.files[key] = entry
  writeIndex(index)

  const keep = new Set(entry.entries.map((row) => row.ts + '.json'))
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.json.tmp')) { try { fs.unlinkSync(path.join(dir, name)) } catch { /* raced */ } continue }
    if (name.endsWith('.json') && !keep.has(name)) { try { fs.unlinkSync(path.join(dir, name)) } catch { /* raced */ } }
  }
  return { id: key + '-' + ts, at, bytes: data.length, reason }
}

export function commit(file, value, { reason = 'write' } = {}) {
  const target = path.resolve(file)
  const revision = snapshot(target, reason)
  writeJsonAtomic(target, value)
  return { revision, bytes: fs.statSync(target).size }
}

export function listRevisions(file) {
  const index = readIndex()
  const only = file ? keyOf(file) : null
  const rows = []
  for (const [key, entry] of Object.entries(index.files)) {
    if (only && key !== only) continue
    for (const item of entry.entries) rows.push({ ...item, key, path: entry.path })
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

export function restore(id) {
  const index = readIndex()
  for (const [key, entry] of Object.entries(index.files)) {
    const item = entry.entries.find((row) => row.id === id)
    if (!item) continue
    const source = path.join(revisionsDir(), key, item.ts + '.json')
    if (!fs.existsSync(source)) throw new Error('revision file is missing: ' + id)
    const revision = snapshot(entry.path, 'restore:' + id)
    const tmp = entry.path + '.' + process.pid + '.restore'
    fs.writeFileSync(tmp, fs.readFileSync(source))
    fs.renameSync(tmp, entry.path)
    return { file: entry.path, revision, restored: item }
  }
  throw new Error('unknown revision: ' + id)
}

export function resolveWrite({ entity, pack, cwd, sessionId }) {
  if (entity === 'rule' || entity === 'preset') {
    if (isUserPack(pack)) {
      return { scope: 'pack', file: path.join(pack.dir, 'workstyle.json'), label: 'pack file ' + pack.id }
    }
    return { scope: 'overlay', file: statePath(), label: 'overlay (state.json)' }
  }
  if (entity === 'project-rule') {
    const file = projectFilePath(cwd)
    if (!file) throw new Error('cwd is required for a project rule')
    return { scope: 'project', file, label: 'project scope' }
  }
  if (entity === 'session-rule') {
    const file = sessionFilePath(sessionId)
    if (!file) throw new Error('sessionId is required for a session rule')
    return { scope: 'session', file, label: 'session scope' }
  }
  throw new Error('unknown entity: ' + entity)
}

/* ---- overlay helpers (pure: take and return a state object) ---- */

export function patchOverlay(state, packId, ruleId, patch) {
  const patches = { ...(state.rulePatches || {}) }
  const forPack = { ...(patches[packId] || {}) }
  const next = { ...(forPack[ruleId] || {}) }
  if (patch && typeof patch.title === 'string' && patch.title.trim()) next.title = patch.title.trim()
  if (patch && typeof patch.text === 'string' && patch.text.trim()) next.text = patch.text.trim()
  if (!Object.keys(next).length) return state
  forPack[ruleId] = next
  patches[packId] = forPack
  return { ...state, rulePatches: patches }
}

export function removeOverlay(state, packId, ruleId) {
  const removals = { ...(state.ruleRemovals || {}) }
  const list = Array.isArray(removals[packId]) ? removals[packId] : []
  if (list.includes(ruleId)) return state
  removals[packId] = [...list, ruleId]
  return { ...state, ruleRemovals: removals }
}

export function restoreOverlay(state, packId, ruleId) {
  if (!state.ruleRemovals || !Array.isArray(state.ruleRemovals[packId])) return state
  const next = state.ruleRemovals[packId].filter((id) => id !== ruleId)
  const removals = { ...state.ruleRemovals }
  if (next.length) removals[packId] = next
  else delete removals[packId]
  return { ...state, ruleRemovals: removals }
}

export function blockPreset(state, packId, presetId, blocked) {
  const all = { ...(state.presetBlocked || {}) }
  const list = Array.isArray(all[packId]) ? all[packId] : []
  const next = blocked ? [...new Set([...list, presetId])] : list.filter((id) => id !== presetId)
  if (next.length) all[packId] = next
  else delete all[packId]
  return { ...state, presetBlocked: all }
}

export function applyRuleOverlay(rules, { patches = {}, removed = [] } = {}) {
  return rules
    .map((rule) => (patches[rule.id] ? { ...rule, ...patches[rule.id] } : rule))
    .filter((rule) => !removed.includes(rule.id))
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `$NODE test/manage.mjs`
Expected: PASS，`ALL 22 CHECKS PASSED`（数字以实际为准）

- [ ] **Step 5: 提交**

```bash
git add lib/manage.js test/manage.mjs
git commit -m "feat(manage): shared write layer with revision snapshots"
```

---

### Task 2: `lib/scope.js` 预设白名单 + removed 规则 + blocked 预设

**Files:**
- Modify: `lib/scope.js:243-355`
- Test: `test/smoke.mjs`

**Interfaces:**
- Consumes: 无新增依赖。
- Produces: `composeScope` 新增入参 `removedRules: Rule[]`、`blockedPresets: string[]`；输出规则新增可选字段 `removed: true`、`outsidePreset: string`；`counts` 新增 `removed`、`outsidePreset` 两个计数。

- [ ] **Step 1: 写失败测试（追加到 `test/smoke.mjs` 的 cleanup 之前）**

```js
/* ---------------- preset whitelist, removals, blocked presets ---------------- */

const whitelistSave = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'save', preset: { id: 'smoke-slice', title: '情境切片', rules: ['plan-first'], skills: [], templates: [] } },
})
ok(whitelistSave.status === 200, 'preset save accepts a rule whitelist')

const useWhitelist = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'use', preset: 'smoke-slice', cwd: projectDir },
})
ok(useWhitelist.status === 200, 'whitelist preset can be selected')

const sliced = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir))
const slicedRules = sliced.data.rules
ok(slicedRules.find((rule) => rule.id === 'plan-first').enabled === true, 'whitelisted rule is injected')
ok(slicedRules.filter((rule) => rule.id !== 'plan-first').every((rule) => rule.outsidePreset === 'smoke-slice' || rule.disabledBy),
  'every other rule names the preset that excluded it')
ok(sliced.data.activePreset && sliced.data.activePreset.id === 'smoke-slice', 'activePreset is reported')

const slicedInject = await callRoute('/api/dsh-workstyle/inject?cwd=' + encodeURIComponent(projectDir))
ok(slicedInject.data.counts.injected === 1, 'only the whitelisted rule reaches the prompt')

/* session force-enable pulls an excluded rule back in */
await callRoute('/api/dsh-workstyle/scope', {
  method: 'POST',
  body: { layer: 'session', sessionId: 'smoke-slice-session', patch: { enabledRules: ['smoke-plan'] } },
})
const forcedBack = await callRoute('/api/dsh-workstyle/scope?cwd=' + encodeURIComponent(projectDir) + '&session=smoke-slice-session')
ok(forcedBack.data.rules.find((rule) => rule.id === 'smoke-plan').enabled === true, 'session force-enable beats the preset whitelist')

await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'use', preset: 'smoke-slice', cwd: projectDir } })
```

- [ ] **Step 2: 运行确认失败**

Run: `$NODE test/smoke.mjs`
Expected: FAIL — `only the whitelisted rule reaches the prompt`（当前预设不影响规则）

- [ ] **Step 3: 修改 `lib/scope.js`**

在 `composeScope` 参数表加两项：

```js
  removedRules = [],
  blockedPresets = [],
```

把预设解析从第 311 行上移到规则循环之前，并改成过滤后的列表：

```js
  const presets = listPresets(packPresets).filter((preset) => !blockedPresets.includes(preset.id))
  const effectivePresetId = presetId || project.preset || (typeof readState().activePreset === 'string' ? readState().activePreset : null)
  const activePreset = effectivePresetId ? presets.find((preset) => preset.id === effectivePresetId) || null : null
  const memberSkills = activePreset ? new Set(activePreset.skills) : null
  const memberRules = activePreset && activePreset.rules.length ? new Set(activePreset.rules) : null
```

规则循环改为：

```js
  for (const entry of entries.values()) {
    let enabled = forcedOn.has(entry.id) ? true : !disabled.has(entry.id)
    const disabledBy = enabled ? null : disabled.get(entry.id)
    let outsidePreset = null
    if (enabled && memberRules && !memberRules.has(entry.id)) {
      enabled = false
      outsidePreset = activePreset.id
    }
    rules.push({
      id: entry.id,
      title: entry.title,
      text: entry.text,
      evidence: entry.evidence || '',
      severity: entry.severity || 'medium',
      ...(Array.isArray(entry.measures) && entry.measures.length ? { measures: entry.measures } : {}),
      origin: entry.origin,
      textScope: entry.textScope,
      ...(entry.shadowed.length ? { shadowed: entry.shadowed } : {}),
      enabled,
      ...(disabledBy ? { disabledBy } : {}),
      ...(outsidePreset ? { outsidePreset } : {}),
    })
  }
  for (const rule of removedRules) {
    if (!rule || entries.has(rule.id)) continue
    rules.push({
      id: rule.id,
      title: rule.title,
      text: rule.text,
      evidence: rule.evidence || '',
      severity: rule.severity || 'medium',
      origin: 'pack',
      textScope: 'workspace',
      removed: true,
      enabled: false,
    })
  }
```

删除原来第 311-314 行的重复预设解析，并在 `counts` 里补：

```js
      removed: rules.filter((rule) => rule.removed).length,
      outsidePreset: rules.filter((rule) => rule.outsidePreset).length,
```

- [ ] **Step 4: 运行确认通过**

Run: `$NODE test/smoke.mjs`
Expected: PASS（新断言通过；此时 `/scope` 尚未传 `removedRules`，默认 `[]` 不影响旧行为）

- [ ] **Step 5: 提交**

```bash
git add lib/scope.js test/smoke.mjs
git commit -m "feat(scope): preset rule whitelist and outsidePreset reasons"
```

---

### Task 3: `index.js` 覆盖层应用 + `refreshPacks` + `writable` 元数据

**Files:**
- Modify: `index.js:1-40`（imports）、`index.js:316-352`（scopeFor）、`index.js:355-455`（buildStatus 附近）

**Interfaces:**
- Consumes: Task 1 的 `applyRuleOverlay`、`patchOverlay`、`removeOverlay`、`restoreOverlay`、`blockPreset`、`resolveWrite`、`isUserPack`、`snapshot`、`listRevisions`、`restore`。
- Produces（供 Task 4-8 使用，全部是 `apply(ctx)` 内闭包）：
  - `packOverlay(packId?): {patches, removed, blockedPresets}`
  - `baseRulesFor(pack?): Rule[]`（包规则 + 采纳）
  - `allActiveRules(): Rule[]`（叠加 patch、减去 removal）
  - `removedRulesFor(pack?): Rule[]`
  - `writeOverlay(patch, reason): void`（先 snapshot 再 writeState）
  - `refreshPacks(): {ok, activePackId}`

- [ ] **Step 1: 写失败测试（追加到 `test/smoke.mjs`）**

```js
/* ---------------- overlay: patch a bundled rule without touching the pack ---------------- */

const packFile = path.join(root, 'pack', 'reference', 'workstyle.json')
const packBefore = fs.readFileSync(packFile, 'utf8')
const originalRule = (await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first')

const patchRes = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', rule: { id: 'plan-first', title: '先方案（本机改）', text: '本机覆盖后的正文。' } },
})
ok(patchRes.status === 200, 'patching a bundled rule succeeds')
ok(fs.readFileSync(packFile, 'utf8') === packBefore, 'the bundled pack file is untouched')
const patched = (await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first')
ok(patched.text === '本机覆盖后的正文。', 'the effective rule uses the patched text')

const removed = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', rule: { id: 'plan-first' }, remove: true },
})
ok(removed.status === 200, 'removing a bundled rule succeeds')
const afterRemove = await callRoute('/api/dsh-workstyle/scope')
ok(afterRemove.data.rules.find((rule) => rule.id === 'plan-first').removed === true, 'removed rule stays visible with removed: true')
ok(!afterRemove.data.counts.injected || afterRemove.data.rules.find((rule) => rule.id === 'plan-first').enabled === false, 'removed rule is not injected')
ok(fs.readFileSync(packFile, 'utf8') === packBefore, 'the bundled pack file is still untouched')

const restoredRule = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'fde-engineering', action: 'restore', rule: { id: 'plan-first' } },
})
ok(restoredRule.status === 200, 'restoring a removed rule succeeds')
ok((await callRoute('/api/dsh-workstyle/scope')).data.rules.find((rule) => rule.id === 'plan-first').removed !== true, 'restored rule is back in the list')
```

- [ ] **Step 2: 运行确认失败**

Run: `$NODE test/smoke.mjs`
Expected: FAIL — `patching a bundled rule succeeds`（`/rule` 只认 cwd → 400）

- [ ] **Step 3: 修改 `index.js` 的覆盖层与 scopeFor**

imports 增加：

```js
import {
  applyRuleOverlay, blockPreset, checkPackId, isUserPack, listRevisions,
  patchOverlay, removeOverlay, resolveWrite, restore as restoreRevision,
  restoreOverlay, snapshot, trashDir, userPacksDir,
} from './lib/manage.js'
```

`apply(ctx)` 内，替换 `allActiveRules` 定义（原第 ~330 行附近）：

```js
  const packOverlay = (packId) => {
    const state = readState()
    const id = packId || active.id
    return {
      patches: (state.rulePatches && state.rulePatches[id]) || {},
      removed: (state.ruleRemovals && state.ruleRemovals[id]) || [],
      blockedPresets: (state.presetBlocked && state.presetBlocked[id]) || [],
    }
  }

  const baseRulesFor = (pack) => mergeRules(pack || active, adoptedRulesFor((pack || active).id))

  const allActiveRules = () => applyRuleOverlay(baseRulesFor(), packOverlay())

  const removedRulesFor = (pack) => {
    const target = pack || active
    const { removed } = packOverlay(target.id)
    if (!removed.length) return []
    return baseRulesFor(target).filter((rule) => removed.includes(rule.id)).map((rule) => ({ ...rule, removed: true }))
  }

  const writeOverlay = (patch, reason) => {
    snapshot(statePath(), reason)
    writeState(patch)
  }

  const refreshPacks = () => {
    const next = loadAllPacks()
    if (!next.length) return { ok: false, error: 'no packs found' }
    packs = next
    active = next.find((pack) => pack.id === active.id) || next[0]
    try { skillControl?.invalidate() } catch { /* provider may be gone */ }
    return { ok: true, activePackId: active.id }
  }
```

`scopeFor` 增加 removed/blocked 入参与 `writable`：

```js
  const writableFor = (rule, cwd) => {
    if (rule.origin === 'project') return { scope: 'project', packId: active.id, file: projectFilePath(cwd) }
    if (isUserPack(active)) return { scope: 'pack', packId: active.id, file: path.join(active.dir, 'workstyle.json') }
    return { scope: 'overlay', packId: active.id, file: statePath() }
  }

  const scopeFor = (input) => {
    const { cwd, sessionId } = resolveContext(input)
    const { blockedPresets } = packOverlay()
    const composed = composeScope({
      baseRules: allActiveRules(),
      allSkills: active.skillList || [],
      packPresets: active.presets || [],
      packTemplates: active.templates || [],
      removedRules: removedRulesFor(),
      blockedPresets,
      cwd,
      sessionId,
      disabledGlobal: [...disabledFor(active.id).rules],
      disabledGlobalSkills: [...disabledFor(active.id).skills],
      presetId: input && typeof input.preset === 'string' ? input.preset : undefined,
    })
    return {
      ...resolveContext(input),
      ...composed,
      rules: composed.rules.map((rule) => ({ ...rule, writable: writableFor(rule, cwd) })),
    }
  }
```

`buildStatus` 里 `allActiveRules()` 已自动带 patch；无需改动。

- [ ] **Step 4: 运行确认通过（Task 4 的路由尚未存在，此步用临时手段验证）**

先只跑既有测试确认无回归：

Run: `$NODE test/smoke.mjs`
Expected: FAIL 在新断言处（`/rule` target 未实现）——这是预期的，说明 Task 3 不单独可验收，与 Task 4 合并提交。

- [ ] **Step 5: 不单独提交**

Task 3 与 Task 4 一起提交（`/rule` 是它的验收面）。

---

### Task 4: `POST /rule` 支持三种落点 + remove/restore

**Files:**
- Modify: `index.js` 的 `/rule` 路由（原 `index.js:1150-1180`）

**Interfaces:**
- Consumes: Task 3 的 `packOverlay`、`baseRulesFor`、`writeOverlay`、`refreshPacks`、`resolveWrite`。
- Produces: 请求体 `{target?: 'pack'|'project'|'session', packId?, cwd?, sessionId?, rule:{id,title?,text?}, remove?:true, action?:'restore'}`；响应 `{saved, id, scope, revision}`。

- [ ] **Step 1: 写失败测试**

Task 3 的 Step 1 已覆盖（`/rule` target/remove/restore）。再补一条包文件落点断言：

```js
/* ---------------- editing a user pack writes the pack file ---------------- */

const userPackDir = path.join(home, 'workstyle', 'packs', 'smoke-pack')
fs.mkdirSync(path.join(userPackDir, 'skills'), { recursive: true })
fs.writeFileSync(path.join(userPackDir, 'workstyle.json'), JSON.stringify({
  id: 'smoke-pack', name: 'smoke-pack', displayName: 'Smoke Pack', version: '0.1.0',
  rules: [{ id: 'smoke-owned', title: '包内规则', text: '原始正文。' }],
}, null, 2) + '\n')

const applyUserPack = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'apply', pack: 'smoke-pack' } })
ok(applyUserPack.status === 200, 'user pack can be applied')

const userPackEdit = await callRoute('/api/dsh-workstyle/rule', {
  method: 'POST',
  body: { target: 'pack', packId: 'smoke-pack', rule: { id: 'smoke-owned', title: '包内规则', text: '直接写入包文件。' } },
})
ok(userPackEdit.status === 200, 'editing a user pack rule succeeds')
const userPackManifest = JSON.parse(fs.readFileSync(path.join(userPackDir, 'workstyle.json'), 'utf8'))
ok(userPackManifest.rules.find((rule) => rule.id === 'smoke-owned').text === '直接写入包文件。', 'user pack edits land in the pack file')
ok(userPackEdit.data.revision && userPackEdit.data.revision.id, 'user pack edit returns a revision')

await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'apply', pack: 'fde-engineering' } })
```

- [ ] **Step 2: 运行确认失败**

Run: `$NODE test/smoke.mjs`
Expected: FAIL — `editing a user pack rule succeeds`（404/400）

- [ ] **Step 3: 重写 `/rule` 路由**

```js
      register({
        path: ROUTE_BASE + '/rule',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = (await readJsonBody(request)) || {}
          const raw = body.rule && typeof body.rule === 'object' ? body.rule : {}
          const id = typeof raw.id === 'string' ? raw.id.trim() : ''
          if (!id) return jsonResponse({ error: 'rule.id is required' }, 400)
          const target = body.target === 'pack' ? 'pack' : body.target === 'session' ? 'session' : 'project'

          try {
            if (target === 'project') {
              if (!body.cwd) return jsonResponse({ error: 'cwd is required' }, 400)
              if (!fs.statSync(body.cwd).isDirectory()) return jsonResponse({ error: 'cwd must be an existing directory' }, 400)
              if (body.action === 'restore') return jsonResponse({ error: 'project rules have no restore' }, 400)
              const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : id
              const current = readProjectScope(body.cwd)
              const nextRules = current.rules.filter((item) => item.id !== id)
              if (body.remove !== true) {
                if (typeof raw.text !== 'string' || !raw.text.trim()) {
                  return jsonResponse({ error: 'rule.text is required to save a rule' }, 400)
                }
                nextRules.push({ ...raw, id, title, text: raw.text.trim() })
              }
              writeProjectScope(body.cwd, { rules: nextRules })
              return jsonResponse({ saved: body.remove === true ? 'removed' : 'rule', id, revision: null, scope: scopeFor({ cwd: body.cwd }) })
            }

            if (target === 'session') {
              if (!body.sessionId) return jsonResponse({ error: 'sessionId is required' }, 400)
              const current = readSessionScope(body.sessionId)
              writeSessionScope(body.sessionId, {
                enabledRules: body.remove === true || body.action === 'restore'
                  ? current.enabledRules.filter((ruleId) => ruleId !== id)
                  : [...new Set([...current.enabledRules, id])],
                disabledRules: body.remove === true
                  ? [...new Set([...current.disabledRules, id])]
                  : current.disabledRules.filter((ruleId) => ruleId !== id),
              })
              return jsonResponse({ saved: body.remove === true ? 'disabled' : 'enabled', id, revision: null, scope: scopeFor({ sessionId: body.sessionId }) })
            }

            /* target === 'pack' */
            const targetPack = packs.find((pack) => pack.id === (body.packId || active.id))
            if (!targetPack) return jsonResponse({ error: 'unknown pack: ' + (body.packId || active.id) }, 404)
            const known = baseRulesFor(targetPack).find((rule) => rule.id === id)
            if (!known && body.action !== 'restore') return jsonResponse({ error: 'unknown rule: ' + id }, 404)
            const write = resolveWrite({ entity: 'rule', pack: targetPack })

            if (write.scope === 'overlay') {
              const state = readState()
              if (body.action === 'restore') {
                writeOverlay(restoreOverlay(state, targetPack.id, id), 'rule-restore:' + id)
                return jsonResponse({ saved: 'restored', id, revision: null, scope: scopeFor({}) })
              }
              if (body.remove === true) {
                writeOverlay(removeOverlay(state, targetPack.id, id), 'rule-remove:' + id)
                return jsonResponse({ saved: 'removed', id, revision: null, scope: scopeFor({}) })
              }
              if (typeof raw.text !== 'string' || !raw.text.trim()) {
                return jsonResponse({ error: 'rule.text is required to save a rule' }, 400)
              }
              const next = patchOverlay(state, targetPack.id, id, { title: raw.title, text: raw.text })
              writeOverlay(next, 'rule-patch:' + id)
              return jsonResponse({ saved: 'rule', id, revision: null, scope: scopeFor({}) })
            }

            /* user pack: edit workstyle.json in place */
            const file = write.file
            const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
            const rules = Array.isArray(manifest.rules) ? [...manifest.rules] : []
            const index = rules.findIndex((rule) => rule && rule.id === id)
            if (body.remove === true) {
              if (index >= 0) rules.splice(index, 1)
            } else if (index >= 0) {
              rules[index] = { ...rules[index], title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : rules[index].title, text: raw.text.trim() }
            } else {
              rules.push({ id, title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : id, text: raw.text.trim() })
            }
            const result = commit(file, { ...manifest, rules }, { reason: 'rule:' + id })
            refreshPacks()
            return jsonResponse({ saved: body.remove === true ? 'removed' : 'rule', id, revision: result.revision, scope: scopeFor({}) })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
```

同时 imports 补 `commit`。

- [ ] **Step 4: 运行确认通过**

Run: `$NODE test/smoke.mjs`
Expected: PASS，且 `patched` / `removed` / `restored` / `userPackEdit` 四组断言全过

- [ ] **Step 5: 提交**

```bash
git add index.js test/smoke.mjs
git commit -m "feat(api): rule route writes overlay, pack file or scope layer"
```

---

### Task 5: `POST /preset` 支持 target / delete / block / duplicate

**Files:**
- Modify: `index.js` 的 `/preset` 路由（原 `index.js:1180-1215`）

**Interfaces:**
- Consumes: Task 3 的 `writeOverlay`、`refreshPacks`、`resolveWrite`、`blockPreset`。
- Produces: `action: 'save'|'use'|'delete'|'duplicate'|'block'|'unblock'`；`save` 接受 `target: 'overlay'|'pack'` 与 `packId`；`use` 拒绝被屏蔽的预设（400）。

- [ ] **Step 1: 写失败测试**

```js
/* ---------------- preset lifecycle ---------------- */

const duplicate = await callRoute('/api/dsh-workstyle/preset', {
  method: 'POST',
  body: { action: 'duplicate', preset: 'smoke-slice', newId: 'smoke-slice-copy' },
})
ok(duplicate.status === 200, 'preset duplicate succeeds')
const afterDuplicate = (await callRoute('/api/dsh-workstyle/scope')).data.presets
ok(afterDuplicate.some((preset) => preset.id === 'smoke-slice-copy'), 'duplicated preset is listed')

const delPreset = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'delete', preset: 'smoke-slice-copy' } })
ok(delPreset.status === 200 && delPreset.data.removed === 'local', 'local preset delete removes it')
ok(!(await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'smoke-slice-copy'), 'deleted local preset is gone')

const blockBuiltin = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'block', preset: 'writing', packId: 'fde-engineering' } })
ok(blockBuiltin.status === 200 && blockBuiltin.data.removed === 'blocked', 'bundled preset delete becomes a block')
ok(!(await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'writing'), 'blocked preset is hidden')

const useBlocked = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'use', preset: 'writing', cwd: projectDir } })
ok(useBlocked.status === 400, 'using a blocked preset is rejected')

const unblock = await callRoute('/api/dsh-workstyle/preset', { method: 'POST', body: { action: 'unblock', preset: 'writing', packId: 'fde-engineering' } })
ok(unblock.status === 200, 'unblock restores the bundled preset')
ok((await callRoute('/api/dsh-workstyle/scope')).data.presets.some((preset) => preset.id === 'writing'), 'unblocked preset is listed again')
```

- [ ] **Step 2: 运行确认失败**

Run: `$NODE test/smoke.mjs`
Expected: FAIL — `preset duplicate succeeds`（当前只接受 save/use）

- [ ] **Step 3: 重写 `/preset` 路由**

```js
      register({
        path: ROUTE_BASE + '/preset',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = (await readJsonBody(request)) || {}
          const action = typeof body.action === 'string' ? body.action : 'save'
          const packId = typeof body.packId === 'string' && body.packId ? body.packId : active.id
          try {
            const targetPack = packs.find((pack) => pack.id === packId) || null

            if (action === 'use') {
              const presetId = checkPresetId(body.preset)
              if (!body.cwd && !body.sessionId) return jsonResponse({ error: 'cwd or sessionId is required to switch preset' }, 400)
              const { blockedPresets } = packOverlay()
              if (blockedPresets.includes(presetId)) return jsonResponse({ error: 'preset is blocked: ' + presetId }, 400)
              const known = listPresets(active.presets).find((preset) => preset.id === presetId)
              if (!known) return jsonResponse({ error: 'unknown preset: ' + presetId }, 404)
              if (body.cwd) writeProjectScope(body.cwd, { preset: presetId })
              else writeSessionScope(body.sessionId, { preset: presetId })
              return jsonResponse({ used: presetId, scope: scopeFor({ cwd: body.cwd, sessionId: body.sessionId }) })
            }

            if (action === 'save') {
              const preset = body.preset && typeof body.preset === 'object' ? body.preset : {}
              const presetId = checkPresetId(preset.id)
              const normalized = {
                id: presetId,
                title: typeof preset.title === 'string' && preset.title.trim() ? preset.title.trim() : presetId,
                description: typeof preset.description === 'string' ? preset.description : '',
                rules: Array.isArray(preset.rules) ? preset.rules.filter((r) => typeof r === 'string') : [],
                skills: Array.isArray(preset.skills) ? preset.skills.filter((s) => typeof s === 'string') : [],
                templates: Array.isArray(preset.templates) ? preset.templates.filter((t) => typeof t === 'string') : [],
              }
              if (!targetPack) return jsonResponse({ error: 'unknown pack: ' + packId }, 404)
              const write = resolveWrite({ entity: 'preset', pack: targetPack })
              if (write.scope === 'overlay') {
                const state = readState()
                const list = Array.isArray(state.presets) ? state.presets.filter((item) => item && item.id !== presetId) : []
                list.push(normalized)
                writeOverlay({ presets: list }, 'preset-save:' + presetId)
                return jsonResponse({ saved: presetId, presets: list })
              }
              const manifest = JSON.parse(fs.readFileSync(write.file, 'utf8'))
              const list = Array.isArray(manifest.presets) ? manifest.presets.filter((item) => item && item.id !== presetId) : []
              list.push(normalized)
              const result = commit(write.file, { ...manifest, presets: list }, { reason: 'preset-save:' + presetId })
              refreshPacks()
              return jsonResponse({ saved: presetId, revision: result.revision, presets: list })
            }

            if (action === 'delete' || action === 'block') {
              const presetId = checkPresetId(body.preset)
              if (!targetPack) return jsonResponse({ error: 'unknown pack: ' + packId }, 404)
              const write = resolveWrite({ entity: 'preset', pack: targetPack })
              const shipped = (targetPack.presets || []).some((preset) => preset.id === presetId)

              /* 包自带预设不能删文件：内置包 → 屏蔽，自建包 → 改包文件 */
              if (action === 'block' || (write.scope === 'overlay' && shipped)) {
                writeOverlay(blockPreset(readState(), targetPack.id, presetId, true), 'preset-block:' + presetId)
                return jsonResponse({ removed: 'blocked', id: presetId })
              }
              if (write.scope === 'pack' && shipped) {
                const manifest = JSON.parse(fs.readFileSync(write.file, 'utf8'))
                const list = (Array.isArray(manifest.presets) ? manifest.presets : []).filter((item) => item && item.id !== presetId)
                const result = commit(write.file, { ...manifest, presets: list }, { reason: 'preset-delete:' + presetId })
                refreshPacks()
                return jsonResponse({ removed: 'pack', id: presetId, revision: result.revision })
              }
              const state = readState()
              const list = Array.isArray(state.presets) ? state.presets.filter((item) => item && item.id !== presetId) : []
              writeOverlay({ presets: list }, 'preset-delete:' + presetId)
              return jsonResponse({ removed: 'local', id: presetId })
            }

            if (action === 'unblock') {
              const presetId = checkPresetId(body.preset)
              writeOverlay(blockPreset(readState(), packId, presetId, false), 'preset-unblock:' + presetId)
              return jsonResponse({ restored: presetId })
            }

            if (action === 'duplicate') {
              const from = checkPresetId(body.preset)
              const newId = checkPresetId(body.newId || from + '-copy')
              const source = listPresets(active.presets).find((preset) => preset.id === from)
              if (!source) return jsonResponse({ error: 'unknown preset: ' + from }, 404)
              const state = readState()
              const list = Array.isArray(state.presets) ? state.presets.filter((item) => item && item.id !== newId) : []
              list.push({ ...source, id: newId, title: source.title + ' copy', builtin: false })
              writeOverlay({ presets: list }, 'preset-duplicate:' + newId)
              return jsonResponse({ saved: newId, from })
            }

            return jsonResponse({ error: "action must be 'save', 'use', 'delete', 'duplicate', 'block' or 'unblock'" }, 400)
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
```

`use` 分支的 `listPresets(active.presets)` 不包含 blocked；`packOverlay` 已能拿到 blocked 列表。

- [ ] **Step 4: 运行确认通过**

Run: `$NODE test/smoke.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add index.js test/smoke.mjs
git commit -m "feat(api): preset save/use/delete/block/duplicate"
```

---

### Task 6: `POST /pack` 生命周期（create / duplicate / rename / delete / restore / import）

**Files:**
- Modify: `index.js` 的 `/pack` 路由（原 `index.js:960-990` 附近的 apply 路由）

**Interfaces:**
- Consumes: Task 1 的 `checkPackId`、`userPacksDir`、`trashDir`；Task 3 的 `refreshPacks`。
- Produces: `{action: 'apply'|'create'|'duplicate'|'rename'|'delete'|'restore'|'import'}`，返回 `{action, packId, packs, activePackId}`。

- [ ] **Step 1: 写失败测试**

```js
/* ---------------- pack lifecycle ---------------- */

const created = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'create', id: 'smoke-created', displayName: '新建包' } })
ok(created.status === 200, 'pack create succeeds')
const createdManifest = JSON.parse(fs.readFileSync(path.join(home, 'workstyle', 'packs', 'smoke-created', 'workstyle.json'), 'utf8'))
ok(createdManifest.id === 'smoke-created' && createdManifest.rules.length === 0, 'created pack has an empty rule list')
ok((await callRoute('/api/dsh-workstyle/status')).data.packs.some((pack) => pack.id === 'smoke-created'), 'created pack shows up in status')

const dupPack = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'duplicate', from: 'smoke-created', id: 'smoke-created-copy' } })
ok(dupPack.status === 200, 'pack duplicate succeeds')
const renamed = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'rename', id: 'smoke-created-copy', displayName: '复制包' } })
ok(renamed.status === 200, 'pack rename succeeds')
const renamedManifest = JSON.parse(fs.readFileSync(path.join(home, 'workstyle', 'packs', 'smoke-created-copy', 'workstyle.json'), 'utf8'))
ok(renamedManifest.displayName === '复制包' && renamedManifest.id === 'smoke-created-copy', 'rename only touches displayName')

await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'apply', pack: 'smoke-created-copy' } })
const deleted = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'delete', id: 'smoke-created-copy' } })
ok(deleted.status === 200 && deleted.data.activePackId !== 'smoke-created-copy', 'deleting the active pack switches away')
ok(!(await callRoute('/api/dsh-workstyle/status')).data.packs.some((pack) => pack.id === 'smoke-created-copy'), 'deleted pack is gone from status')

const restoredPack = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'restore', id: 'smoke-created-copy' } })
ok(restoredPack.status === 200, 'pack restore succeeds')
ok((await callRoute('/api/dsh-workstyle/status')).data.packs.some((pack) => pack.id === 'smoke-created-copy'), 'restored pack is back')

/* import a directory, and reject an id clash */
const importSource = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-import-'))
fs.mkdirSync(path.join(importSource, 'skills'), { recursive: true })
fs.writeFileSync(path.join(importSource, 'workstyle.json'), JSON.stringify({
  id: 'smoke-imported', name: 'smoke-imported', displayName: 'Imported', version: '0.1.0',
  rules: [{ id: 'imported-rule', title: '导入规则', text: '导入正文。' }],
}, null, 2) + '\n')
const imported = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'import', path: importSource } })
ok(imported.status === 200, 'pack import from a directory succeeds')
ok((await callRoute('/api/dsh-workstyle/status')).data.packs.some((pack) => pack.id === 'smoke-imported'), 'imported pack is listed')
const clash = await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'import', path: importSource } })
ok(clash.status === 400, 'importing a duplicate id is rejected')
fs.rmSync(importSource, { recursive: true, force: true })

await callRoute('/api/dsh-workstyle/pack', { method: 'POST', body: { action: 'apply', pack: 'fde-engineering' } })
```

- [ ] **Step 2: 运行确认失败**

Run: `$NODE test/smoke.mjs`
Expected: FAIL — `pack create succeeds`（`action must be 'apply'`）

- [ ] **Step 3: 重写 `/pack` 路由**

```js
      register({
        path: ROUTE_BASE + '/pack',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = (await readJsonBody(request)) || {}
          const action = typeof body.action === 'string' ? body.action : 'apply'
          try {
            if (action === 'apply') {
              if (!body.pack) return jsonResponse({ error: 'pack is required' }, 400)
              const summary = applyPack(body.pack)
              return jsonResponse({ action, applied: summary, status: buildStatus() })
            }

            if (action === 'create') {
              const id = checkPackId(body.id)
              const dir = path.join(userPacksDir(), id)
              if (packs.some((pack) => pack.id === id) || fs.existsSync(dir)) return jsonResponse({ error: 'pack already exists: ' + id }, 400)
              fs.mkdirSync(path.join(dir, 'skills'), { recursive: true })
              const displayName = typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : id
              const manifest = {
                id, name: id, displayName, version: '0.1.0',
                description: '本机新建的工作方式包。',
                rules: [], presets: [], templates: [],
                skills: { dir: 'skills', count: 0 },
              }
              const result = commit(path.join(dir, 'workstyle.json'), manifest, { reason: 'pack-create:' + id })
              fs.writeFileSync(path.join(dir, 'README.md'), '# ' + displayName + '\n\n在这个包里添加规则、预设和技能。\n')
              refreshPacks()
              return jsonResponse({ action, packId: id, revision: result.revision, packs: packs.map(packSummary), activePackId: active.id })
            }

            if (action === 'duplicate') {
              const from = packetsFrom(body.from)
              const id = checkPackId(body.id || from + '-copy')
              const dir = path.join(userPacksDir(), id)
              if (packs.some((pack) => pack.id === id) || fs.existsSync(dir)) return jsonResponse({ error: 'pack already exists: ' + id }, 400)
              fs.mkdirSync(userPacksDir(), { recursive: true })
              fs.cpSync(from.dir, dir, { recursive: true })
              const manifestFile = path.join(dir, 'workstyle.json')
              if (!fs.existsSync(manifestFile)) return jsonResponse({ error: 'duplicated pack has no workstyle.json' }, 400)
              const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
              commit(manifestFile, { ...manifest, id, name: id, displayName: (manifest.displayName || manifest.name || from.id) + ' copy' }, { reason: 'pack-duplicate:' + id })
              refreshPacks()
              return jsonResponse({ action, packId: id, packs: packs.map(packSummary), activePackId: active.id })
            }

            if (action === 'rename') {
              const pack = packetsFrom(body.id)
              if (!isUserPack(pack)) return jsonResponse({ error: 'bundled packs are read-only: ' + pack.id }, 400)
              const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
              if (!displayName) return jsonResponse({ error: 'displayName is required' }, 400)
              const file = path.join(pack.dir, 'workstyle.json')
              if (!fs.existsSync(file)) return jsonResponse({ error: 'only json packs can be renamed: ' + pack.id }, 400)
              const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
              commit(file, { ...manifest, displayName }, { reason: 'pack-rename:' + pack.id })
              refreshPacks()
              return jsonResponse({ action, packId: pack.id, packs: packs.map(packSummary), activePackId: active.id })
            }

            if (action === 'delete') {
              const pack = packetsFrom(body.id)
              if (!isUserPack(pack)) return jsonResponse({ error: 'bundled packs cannot be deleted: ' + pack.id }, 400)
              fs.mkdirSync(trashDir(), { recursive: true })
              const stamp = new Date().toISOString().replace(/[:.]/g, '-')
              const dest = path.join(trashDir(), pack.id + '-' + stamp)
              fs.renameSync(pack.dir, dest)
              refreshPacks()
              return jsonResponse({ action, packId: pack.id, trash: dest, packs: packs.map(packSummary), activePackId: active.id })
            }

            if (action === 'restore') {
              const id = checkPackId(body.id)
              const root = trashDir()
              if (!fs.existsSync(root)) return jsonResponse({ error: 'trash is empty' }, 404)
              const entry = fs.readdirSync(root).filter((name) => name === id || name.startsWith(id + '-')).sort().pop()
              if (!entry) return jsonResponse({ error: 'no trashed pack: ' + id }, 404)
              const dest = path.join(userPacksDir(), id)
              if (fs.existsSync(dest)) return jsonResponse({ error: 'pack already exists: ' + id }, 400)
              fs.renameSync(path.join(root, entry), dest)
              refreshPacks()
              return jsonResponse({ action, packId: id, packs: packs.map(packSummary), activePackId: active.id })
            }

            if (action === 'import') {
              const source = typeof body.path === 'string' ? path.resolve(body.path) : ''
              if (!source || !valueIsDir(source)) return jsonResponse({ error: 'path must be an existing directory' }, 400)
              const loaded = loadPackAt(source)
              if (!loaded) return jsonResponse({ error: 'no workstyle.json or workstyle.yaml in ' + source }, 400)
              const id = checkPackId(loaded.id)
              const dest = path.join(userPacksDir(), id)
              if (packs.some((pack) => pack.id === id) || fs.existsSync(dest)) return jsonResponse({ error: 'pack already exists: ' + id }, 400)
              fs.mkdirSync(userPacksDir(), { recursive: true })
              fs.cpSync(source, dest, { recursive: true })
              refreshPacks()
              return jsonResponse({ action, packId: id, packs: packs.map(packSummary), activePackId: active.id })
            }

            return jsonResponse({ error: "action must be 'apply', 'create', 'duplicate', 'rename', 'delete', 'restore' or 'import'" }, 400)
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 400)
          }
        },
      })
```

辅助闭包放在 `apply(ctx)` 内（`applyPack` 之后）：

```js
  const valueIsDir = (value) => { try { return fs.statSync(value).isDirectory() } catch { return false } }

  const packetsFrom = (idOrDir) => {
    const value = typeof idOrDir === 'string' ? idOrDir.trim() : ''
    if (!value) throw new Error('pack id is required')
    const found = packs.find((pack) => pack.id === value)
    if (found) return found
    const byDir = loadPackAt(path.resolve(value))
    if (!byDir) throw new Error('unknown pack: ' + value)
    return byDir
  }
```

注意：`loadPackAt` 需要从 `lib/pack.js` 的既有 import 里确认已导入（`index.js:15-19` 已导入 `loadPackAt`）。

- [ ] **Step 4: 运行确认通过**

Run: `$NODE test/smoke.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add index.js test/smoke.mjs
git commit -m "feat(api): pack create/duplicate/rename/delete/restore/import"
```

---

### Task 7: `GET/POST /revisions` 回滚路由

**Files:**
- Modify: `index.js`（新增两条 register）
- Modify: `test/smoke.mjs`（路由数断言 16 → 17，并加断言）

**Interfaces:**
- Consumes: Task 1 的 `listRevisions`、`restore`（别名 `restoreRevision`）、`revisionsDir`。
- Produces: `GET /revisions?file=` → `{revisions:[{id,at,bytes,reason,file}]}`；`POST /revisions {action:'restore', id}` → `{restored, file, revision}`。

- [ ] **Step 1: 写失败测试**

```js
/* ---------------- revisions ---------------- */

const revList = await callRoute('/api/dsh-workstyle/revisions')
ok(revList.status === 200 && Array.isArray(revList.data.revisions), 'GET /revisions lists snapshots')
const firstRev = revList.data.revisions.find((rev) => rev.reason && rev.reason.startsWith('preset-save:'))
ok(!!firstRev, 'preset edits leave revisions behind')

const restoreRev = await callRoute('/api/dsh-workstyle/revisions', { method: 'POST', body: { action: 'restore', id: firstRev.id } })
ok(restoreRev.status === 200, 'POST /revisions restores a snapshot')
ok(restoreRev.data.restored.file === firstRev.file, 'restore reports the file it wrote')
```

同时把既有断言改成 17：

```js
ok(registeredPaths.size === 17, '17 HTTP route paths registered (' + [...registeredPaths].length + ')')
```

- [ ] **Step 2: 运行确认失败**

Run: `$NODE test/smoke.mjs`
Expected: FAIL — `route missing: /api/dsh-workstyle/revisions`

- [ ] **Step 3: 新增路由**

```js
      register({
        path: ROUTE_BASE + '/revisions',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const query = new URL(request.url).searchParams
          const file = query.get('file') || undefined
          return jsonResponse({
            revisions: listRevisions(file).map((rev) => ({
              id: rev.id, at: rev.at, bytes: rev.bytes, reason: rev.reason, file: rev.path,
            })),
          })
        },
      })
      register({
        path: ROUTE_BASE + '/revisions',
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          const body = (await readJsonBody(request)) || {}
          if (body.action !== 'restore') return jsonResponse({ error: "action must be 'restore'" }, 400)
          const id = typeof body.id === 'string' ? body.id.trim() : ''
          if (!id) return jsonResponse({ error: 'id is required' }, 400)
          try {
            const out = restoreRevision(id)
            refreshPacks()
            return jsonResponse({ restored: { file: out.file, revision: out.revision }, status: buildStatus() })
          } catch (error) {
            return jsonResponse({ error: error && error.message ? error.message : String(error) }, 404)
          }
        },
      })
```

- [ ] **Step 4: 运行确认通过**

Run: `$NODE test/smoke.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add index.js test/smoke.mjs
git commit -m "feat(api): revision list and restore"
```

---

### Task 8: 导出合并覆盖层并带上 presets / templates

**Files:**
- Modify: `lib/export.js`（`exportPack` 头部与 `workstyle.json` 写入处）
- Modify: `index.js:547-575`（`exportActivePack`）
- Test: `test/smoke.mjs`

**Interfaces:**
- Consumes: 无新增。
- Produces: `exportPack({ pack, rules, presets = [], templates = [], destDir, now, projectSnapshot, overlay })`；`workstyle.json` 新增 `presets`、`templates` 字段；`manifest.json` 新增 `overlay` 计数。

- [ ] **Step 1: 写失败测试**

```js
/* ---------------- export keeps presets and templates ---------------- */

const exportWithPresets = await callRoute('/api/dsh-workstyle/export', { method: 'POST', body: {} })
ok(exportWithPresets.status === 200, 'export succeeds')
const exportExtract = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-workstyle-presets-'))
execFileSync('tar', ['-xzf', exportWithPresets.data.file, '-C', exportExtract])
const exportedManifest = JSON.parse(fs.readFileSync(path.join(exportExtract, 'workstyle.json'), 'utf8'))
ok(Array.isArray(exportedManifest.presets) && exportedManifest.presets.length === 3, 'exported pack keeps its presets')
ok(Array.isArray(exportedManifest.templates) && exportedManifest.templates.length === 3, 'exported pack keeps its templates')
const exportedMeta = JSON.parse(fs.readFileSync(path.join(exportExtract, 'manifest.json'), 'utf8'))
ok(exportedMeta.overlay && typeof exportedMeta.overlay.patched === 'number', 'manifest records overlay counts')
```

- [ ] **Step 2: 运行确认失败**

Run: `$NODE test/smoke.mjs`
Expected: FAIL — `exported pack keeps its presets`

- [ ] **Step 3: 修改 `lib/export.js`**

函数签名与 `workstyle.json` 内容：

```js
export function exportPack({ pack, rules, presets = [], templates = [], destDir, now, projectSnapshot, overlay }) {
```

在写 `workstyle.json` 的对象里加：

```js
    rules: rules.map(stripRule),
    presets: (presets || []).map(stripPreset),
    templates: (templates || []).map(stripTemplate),
```

新增两个纯函数（与 `stripRule` 并列）：

```js
function stripPreset(preset) {
  return {
    id: preset.id,
    title: preset.title || preset.id,
    description: preset.description || '',
    rules: Array.isArray(preset.rules) ? preset.rules : [],
    skills: Array.isArray(preset.skills) ? preset.skills : [],
    templates: Array.isArray(preset.templates) ? preset.templates : [],
  }
}

function stripTemplate(template) {
  return { id: template.id, title: template.title || template.id, text: template.text || '' }
}
```

`manifest.json` 里加：

```js
    overlay: {
      patched: overlay && overlay.patched || 0,
      added: overlay && overlay.added || 0,
      removed: overlay && overlay.removed || 0,
    },
```

- [ ] **Step 4: 修改 `exportActivePack`**

```js
  const exportActivePack = (idOrDir, projectSnapshot) => {
    let target = active
    if (idOrDir) {
      const found = findPack(idOrDir)
      if (!found.next) throw new Error('unknown pack: ' + idOrDir + ' (available: ' + found.packsNow.map((p) => p.id).join(', ') + ')')
      target = found.next
    }
    const overlay = packOverlay(target.id)
    const base = baseRulesFor(target)
    const rules = applyRuleOverlay(base, overlay)
    const presets = listPresets(target.presets).filter((preset) => !overlay.blockedPresets.includes(preset.id))
    const templates = listTemplates(target.templates)
    const out = exportPack({
      pack: { ...target, pluginVersion: VERSION },
      rules,
      presets,
      templates,
      overlay: {
        patched: Object.keys(overlay.patches).length,
        added: Math.max(0, base.length - (target.rules || []).length),
        removed: overlay.removed.length,
      },
      destDir: exportsDir(),
      ...(projectSnapshot ? { projectSnapshot } : {}),
    })
```

- [ ] **Step 5: 运行确认通过**

Run: `$NODE test/smoke.mjs && $NODE test/panel-render.mjs`
Expected: 两个都 PASS

- [ ] **Step 6: 提交**

```bash
git add lib/export.js index.js test/smoke.mjs
git commit -m "fix(export): merge overlay and ship presets/templates"
```

---

### Task 9: 面板规则页 —— 编辑 / 移除 / 恢复 / 落点 / 预设 chip

**Files:**
- Modify: `client.js`（字典约 `:150-520`；handler `:1710-1760`；规则卡片 `:2770-2810`；编辑器弹层 `:2229-2260`）

**Interfaces:**
- Consumes: `/rule`（target/remove/restore）、`/scope`（`writable` / `outsidePreset` / `removed`）。
- Produces: 无（UI 终态）。

- [ ] **Step 1: 字典加 key（zh 与 en 各一份）**

```js
      targetOverlay: '本机覆盖层（不改包文件）',
      targetPack: '包文件（直接写入）',
      targetProject: '项目层（.dsh/workstyle.json）',
      writeTarget: '将写入',
      outsidePreset: '不在当前预设',
      addToPreset: '加入当前预设',
      ruleRemoved: '已从本机移除',
      restoreRule: '恢复',
      removedTag: '已移除',
```

英文对应：

```js
      targetOverlay: 'Local overlay (pack file untouched)',
      targetPack: 'Pack file (written directly)',
      targetProject: 'Project layer (.dsh/workstyle.json)',
      writeTarget: 'Writes to',
      outsidePreset: 'Outside the current preset',
      addToPreset: 'Add to the current preset',
      ruleRemoved: 'Removed on this machine',
      restoreRule: 'Restore',
      removedTag: 'removed',
```

- [ ] **Step 2: 改 `onSaveRule` 支持 target**

```js
        const target = editing && editing.target ? editing.target : 'project'
        const body = target === 'project'
          ? { cwd, rule: normalized }
          : { target, packId: active.id, rule: normalized }
        return postJson('rule', body)
```

- [ ] **Step 3: 移除 / 恢复 handler**

```js
      const onRemoveRule = (rule) => {
        if (!requireCurrentContext() && !(rule && rule.writable && rule.writable.scope !== 'project')) return
        const cwd = env && env.scope ? env.scope.cwd : (session && session.cwd)
        const target = rule && rule.writable ? rule.writable.scope : 'project'
        const body = target === 'project'
          ? { cwd, rule: { id: rule.id }, remove: true }
          : { target, packId: active.id, rule: { id: rule.id }, remove: true }
        setBusy('rule'); setError(''); setNotice('')
        postJson('rule', body)
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'rule remove failed')
            return refreshEnvironment(rule.id, t('ruleRemoved'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onRestoreRule = (rule) => {
        const target = rule && rule.writable ? rule.writable.scope : 'overlay'
        setBusy('rule'); setError(''); setNotice('')
        postJson('rule', { target, packId: active.id, action: 'restore', rule: { id: rule.id } })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'rule restore failed')
            return refreshEnvironment(rule.id, t('restoreRule'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onAddToPreset = (ruleId) => {
        const preset = scopedPreset
        if (!preset) return
        setBusy('preset'); setError(''); setNotice('')
        postJson('preset', {
          action: 'save', packId: active.id,
          preset: { ...preset, rules: [...new Set([...(preset.rules || []), ruleId])] },
        })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'preset save failed')
            return refreshEnvironment(ruleId, t('addToPreset'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }
```

`scopedPreset` 在 `client.js:2067` 附近（`const sc = ...` 之后）加：

```js
      const scopedPreset = sc && sc.activePreset ? sc.activePreset : null
```

- [ ] **Step 4: 规则卡片按钮与 chip**

把 `client.js:2770-2810` 的按钮组替换为：

```js
                h('div', { style: { display: 'flex', gap: 8 } },
                  rule.removed
                    ? h('button', { style: S.linkButton, onClick: () => onRestoreRule(rule) }, t('restoreRule'))
                    : h('button', { style: S.linkButton, onClick: () => setEditing({ id: rule.id, title: rule.title, text: rule.text, existing: true, target: rule.writable ? rule.writable.scope : 'project' }) }, t('editRule')),
                  rule.removed
                    ? null
                    : h('button', { style: S.linkButton, onClick: () => onRemoveRule(rule) }, t('removeRule')))
```

状态标注区块改为：

```js
                  rule.removed
                    ? h('span', { style: S.overridden }, t('removedTag'))
                    : rule.enabled === false && rule.outsidePreset
                      ? h('span', { style: S.overridden }, t('outsidePreset') + ' · ' + rule.outsidePreset)
                      : rule.enabled === false && rule.disabledBy
                        ? h('span', { style: S.overridden }, t('disabledBy') + ' · ' + (rule.disabledBy === 'session' ? t('scopeSession') : rule.disabledBy === 'project' ? t('project') : t('scopeWorkspace')))
                        : null,
```

并在按钮组前加「加入当前预设」：

```js
                  rule.outsidePreset && scopedPreset
                    ? h('button', { style: S.linkButton, onClick: () => onAddToPreset(rule.id) }, t('addToPreset'))
                    : null,
```

- [ ] **Step 5: 同步第二处调用点**

`onRemoveRule` 有两个调用点：`client.js:2226`（包详情页规则行）与 `client.js:2790`（规则页），两处都从 `onRemoveRule(rule.id)` 改为 `onRemoveRule(rule)`；编辑按钮同理把 `writable.scope` 写进 `setEditing(...)`。

- [ ] **Step 6: 编辑器弹层落点行**

在 `client.js:2255` 的 textarea 之后、按钮行之前插入：

```js
              editing.target
                ? h('div', { style: S.hint }, t('writeTarget') + '：' + (editing.target === 'pack' ? t('targetPack') : editing.target === 'project' ? t('targetProject') : t('targetOverlay')))
                : null,
```

- [ ] **Step 7: 跑面板测试**

Run: `$NODE test/panel-render.mjs && $NODE test/multipage-render.mjs`
Expected: PASS（断言只增不减；若这两个测试断言了按钮文案，按新文案更新）

- [ ] **Step 8: 提交**

```bash
git add client.js
git commit -m "feat(panel): edit/remove/restore rules across scopes"
```

---

### Task 10: 面板预设页 —— 编辑器 / 删除 / 屏蔽 / 复制

**Files:**
- Modify: `client.js`（状态 `:1296-1300`；预设卡片 `:2283-2298`；presetsBody `:2392-2401`；新增 handler 与弹层）

**Interfaces:**
- Consumes: `/preset`（save with target / delete / block / duplicate / unblock）。
- Produces: 无。

- [ ] **Step 1: 加状态与字典**

```js
      const [presetEditing, setPresetEditing] = React.useState(null)
```

字典（zh）：

```js
      presetEdit: '编辑预设',
      presetDuplicate: '复制',
      presetDelete: '删除',
      presetBlocked: '已屏蔽',
      presetRestore: '恢复',
      presetIdLabel: '预设 id',
      presetTitleLabel: '标题',
      presetDescLabel: '说明',
      presetRuleCount: '包含规则',
      presetDangling: '这些 id 在当前包里不存在：',
      presetSave: '保存预设',
```

英文同名 key 加英文文案。

- [ ] **Step 2: handler**

```js
      const onSavePreset = (draft) => {
        if (!draft || !draft.id) { setError(t('presetIdLabel') + '不能为空'); return Promise.resolve() }
        setBusy('preset'); setError(''); setNotice('')
        return postJson('preset', {
          action: 'save',
          packId: active.id,
          target: draft.builtin ? 'overlay' : 'pack',
          preset: draft,
        })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'preset save failed')
            setPresetEditing(null)
            return refreshEnvironment(draft.id, t('presetSave'))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }

      const onPresetAction = (action, preset) => {
        setBusy('preset'); setError(''); setNotice('')
        const body = action === 'duplicate'
          ? { action, preset: preset.id, newId: preset.id + '-copy' }
          : { action, preset: preset.id, packId: active.id }
        return postJson('preset', body)
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'preset ' + action + ' failed')
            return refreshEnvironment(preset.id, data.removed === 'blocked' ? t('presetBlocked') : action)
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }
```

`delete` 对内置预设后端自动转成 block，前端不需要分支。

- [ ] **Step 3: 预设卡片加操作行**

在 `presetCards` 的 `h('button', ...)` 外层包一层容器（因为卡片本身是 button，不能嵌套 button）：

```js
      const presetCards = presets.map((preset) => h('div', {
        key: preset.id,
        style: { ...S.card, display: 'flex', flexDirection: 'column', gap: 8 },
      },
        h('button', {
          style: { ...S.presetCard(preset.id === activePresetId), padding: 0, background: 'transparent', border: 'none', textAlign: 'left' },
          onClick: () => onUsePreset(preset.id),
          title: preset.description || preset.id,
        },
          h('div', { style: S.presetTitleRow },
            h('span', { style: S.presetTitle }, preset.title),
            preset.id === activePresetId ? h('span', { style: S.badge }, t('presetCurrent')) : null),
          preset.description ? h('span', { style: S.presetDesc }, preset.description) : null,
          h('div', { style: S.presetCounts },
            h('span', null, t('presetRules') + ' ', h('span', { style: S.presetCountEm }, String(preset.rules.length))),
            h('span', null, t('presetSkills') + ' ', h('span', { style: S.presetCountEm }, String(preset.skills.length))),
            h('span', null, t('presetTemplates') + ' ', h('span', { style: S.presetCountEm }, String(preset.templates.length))))),
        h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
          h('button', { style: S.linkButton, onClick: () => setPresetEditing({ ...preset, existing: true }) }, t('presetEdit')),
          h('button', { style: S.linkButton, onClick: () => onPresetAction('duplicate', preset) }, t('presetDuplicate')),
          h('button', { style: S.linkButton, onClick: () => onPresetAction('delete', preset) }, t('presetDelete')))))
```

- [ ] **Step 4: 新增预设编辑弹层**

在 `presetsBody` 前定义 `presetEditor`，结构：

```js
      const presetEditor = presetEditing
        ? h('div', { role: 'dialog', 'aria-label': t('presetEdit'), style: { ...S.card, display: 'flex', flexDirection: 'column', gap: 8 } },
          h('div', { style: S.sectionLabel }, t('presetEdit')),
          h('label', { style: S.field }, t('presetIdLabel'),
            h('input', {
              style: S.input, value: presetEditing.id || '',
              disabled: !!presetEditing.existing,
              onChange: (event) => setPresetEditing({ ...presetEditing, id: event.target.value }),
            })),
          h('label', { style: S.field }, t('presetTitleLabel'),
            h('input', { style: S.input, value: presetEditing.title || '', onChange: (event) => setPresetEditing({ ...presetEditing, title: event.target.value }) })),
          h('label', { style: S.field }, t('presetDescLabel'),
            h('input', { style: S.input, value: presetEditing.description || '', onChange: (event) => setPresetEditing({ ...presetEditing, description: event.target.value }) })),
          h('div', { style: S.hint }, t('presetRuleCount') + ' ' + (presetEditing.rules || []).length + ' / ' + scopedRules.length),
          h('div', { style: { maxHeight: 220, overflow: 'auto', paddingTop: 6 } },
            scopedRules.map((rule) => h('label', { key: rule.id, style: { display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' } },
              h('input', {
                type: 'checkbox',
                checked: (presetEditing.rules || []).includes(rule.id),
                onChange: (event) => {
                  const current = presetEditing.rules || []
                  const rules = event.target.checked ? [...current, rule.id] : current.filter((id) => id !== rule.id)
                  setPresetEditing({ ...presetEditing, rules })
                },
              }),
              h('span', { style: S.ruleTitle }, rule.title)))),
          h('div', { style: S.hint }, (presetEditing.rules || []).filter((id) => !scopedRules.some((rule) => rule.id === id)).length
            ? t('presetDangling') + ' ' + (presetEditing.rules || []).filter((id) => !scopedRules.some((rule) => rule.id === id)).join(', ')
            : ''),
          h('div', { style: { display: 'flex', gap: 10, paddingTop: 10 } },
            h('button', { style: S.button, disabled: !!busy, onClick: () => onSavePreset(presetEditing) }, t('presetSave')),
            h('button', { style: S.linkButton, onClick: () => setPresetEditing(null) }, t('cancel'))))
        : null
```

`S.card`、`S.sectionLabel`、`S.field`、`S.input` 都是现有 token（`client.js:638`、`client.js:1064`、`client.js:815`），无需新增样式。

- [ ] **Step 5: 接上入口并修 bug**

- `presetsBody` 开头加 `presetEditor,`。
- `client.js:2401` 的「+ 新建预设」改为 `onClick: () => setPresetEditing({ id: '', title: '', description: '', rules: [], skills: [], templates: [] })`。
- `client.js:2396` 的 `presetsBlock` 同名按钮同样改。

- [ ] **Step 6: 跑面板测试**

Run: `$NODE test/panel-render.mjs && $NODE test/multipage-render.mjs`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add client.js
git commit -m "feat(panel): preset editor with delete/block/duplicate"
```

---

### Task 11: 面板包页生命周期 + 分发页回滚区

**Files:**
- Modify: `client.js`（包列表 `:2498-2510`；包详情头 `:2545-2550`；分发页 `:2552-2604`）

**Interfaces:**
- Consumes: `/pack` 六种动作、`/revisions`。
- Produces: 无。

- [ ] **Step 1: 字典**

```js
      packNew: '新建包',
      packImport: '导入包',
      packDuplicate: '复制',
      packRename: '重命名',
      packDelete: '删除',
      packRestore: '恢复',
      packTrash: '回收站',
      packReadonlyNote: '只读包。编辑会保存到本机覆盖层，不改包文件。',
      packWritableNote: '改动直接写入',
      packImportPath: '导入目录路径',
      revisionsTitle: '版本与回滚',
      revisionsEmpty: '还没有修订记录：编辑一次规则或预设就会产生快照。',
      revisionRestore: '回滚',
      revisionReason: '原因',
```

英文同名 key 加英文文案。

- [ ] **Step 2: handler**

```js
      const onPackAction = (action, payload) => {
        setBusy('pack'); setError(''); setNotice('')
        return postJson('pack', { action, ...payload })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'pack ' + action + ' failed')
            setPackReload((n) => n + 1)
            return loadEnv().then(() => setNotice(action + ' · ' + (data.packId || '')))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }
```

- [ ] **Step 3: 包列表加 `+ 新建包` / `导入包`**

在 `packListBody` 的 hint 行改为：

```js
      const packListBody = h('div', null,
        h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingTop: 8 } },
          h('span', { style: S.hint }, t('packHint')),
          h('button', { style: S.smallButton, onClick: () => setPackEditing({ mode: 'create', id: '', displayName: '' }) }, '+ ' + t('packNew')),
          h('button', { style: S.smallButton, onClick: () => setPackEditing({ mode: 'import', path: '' }) }, t('packImport'))),
        packGrid,
        packTrashBlock)
```

`packEditing` 状态与弹层：`mode: 'create'|'rename'|'import'`，分别对应 id/displayName 或 path 两个输入；保存时调 `onPackAction('create', {id, displayName})` / `('rename', {id, displayName})` / `('import', {path})`。

- [ ] **Step 4: 包详情只读提示 + 卡片操作**

在 `packDetailPageBody` 详情头之后插入：

```js
              h('div', { style: { paddingTop: 8 } },
                h('div', { style: S.hint }, selectedIsActive && !selectedPack.dir.includes('/workstyle/packs/')
                  ? t('packReadonlyNote')
                  : t('packWritableNote') + ' ' + (selectedPack.dir || ''))),
              h('div', { style: { display: 'flex', gap: 10, paddingTop: 8, flexWrap: 'wrap' } },
                selectedPack.id === active.id ? null : h('button', { style: S.linkButton, onClick: () => onPackAction('apply', { pack: selectedPack.id }) }, t('packSwitch')),
                h('button', { style: S.linkButton, onClick: () => setPackEditing({ mode: 'rename', id: selectedPack.id, displayName: selectedPack.displayName || selectedPack.id }) }, t('packRename')),
                h('button', { style: S.linkButton, onClick: () => onPackAction('duplicate', { from: selectedPack.id }) }, t('packDuplicate')),
                h('button', { style: S.linkButton, onClick: () => onPackAction('delete', { id: selectedPack.id }) }, t('packDelete'))),
```

- [ ] **Step 5: 分发页回滚区**

`DistributionPage` 增加 props `revisions`、`onRestoreRevision`，在导出历史之后加：

```js
          h('section', { style: S.section },
            h('div', { style: S.sectionHead }, h('span', { style: S.sectionLabel }, t('revisionsTitle')), h('span', { style: S.sectionCount }, String((revisions || []).length))),
            (revisions && revisions.length)
              ? h('div', null, revisions.slice(0, 20).map((rev) => h('div', {
                key: rev.id,
                style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + HAIRLINE },
              },
                h('span', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } },
                  h('span', { style: S.ruleTitle }, (rev.reason || '').replace(/^[^:]+:/, '')),
                  h('span', { style: S.hint }, rev.file + ' · ' + rev.at + ' · ' + rev.bytes + ' B')),
                h('button', { style: S.linkButton, onClick: () => onRestoreRevision(rev.id) }, t('revisionRestore')))))
              : h('div', { style: S.empty }, h('div', { style: S.hint }, t('revisionsEmpty'))))
```

`client.js` 里加 `onRestoreRevision`：

```js
      const onRestoreRevision = (id) => {
        setBusy('revision'); setError(''); setNotice('')
        postJson('revisions', { action: 'restore', id })
          .then(({ ok, data }) => {
            if (!ok) throw new Error(data && data.error ? data.error : 'restore failed')
            return loadEnv().then(() => setNotice(t('revisionRestore') + ' · ' + ((data.restored && data.restored.file) || '')))
          })
          .catch((err) => setError(String(err && err.message ? err.message : err)))
          .finally(() => setBusy(''))
      }
```

revisions 数据由 `const [revisions, setRevisions] = React.useState([])` 承载，在 `load()` 里与 `exports` 一起拉取：

```js
        getJson('revisions').then((result) => {
          if (result.ok && result.data && Array.isArray(result.data.revisions)) setRevisions(result.data.revisions)
          else setRevisions([])
        })
```

（与现有 `load()` 里读 `exports` 的写法一致：`getJson` + `result.ok`。）

分发页调用点 `client.js:2847` 的 `h(DistributionPage, {...})` 补两个 prop：

```js
                  revisions,
                  onRestoreRevision,
```

- [ ] **Step 6: 跑面板测试**

Run: `$NODE test/panel-render.mjs && $NODE test/multipage-render.mjs`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add client.js
git commit -m "feat(panel): pack lifecycle and revision rollback"
```

---

### Task 12: 文档、版本与全量验证

**Files:**
- Modify: `docs/USAGE.md`、`README.md`、`package.json`

- [ ] **Step 1: `docs/USAGE.md` 加四节**

1. 「改动写到哪里」表：内置包 → 覆盖层；自建包 → 包文件；项目 → `.dsh/workstyle.json`；会话 → 会话文件。
2. 「预设是场景切片」：`rules` 非空即白名单；`preset.rules` 为空才不限制；会话强制启用能拉回被排除的规则。
3. 「回滚」：`$DSH_HOME/workstyle/revisions/`，每文件留 20 份，面板分发页可回滚。
4. 「导出」：现在会带上预设与模板，并合并本机覆盖层。

- [ ] **Step 2: `README.md` 功能段加一行**

```markdown
- **管理**：包 / 规则 / 预设都能增删改，内置包只读、改动落本机覆盖层，每次写入可回滚。
```

- [ ] **Step 3: 版本号**

`package.json` 的 `version` 从 `0.1.0` 升到 `0.2.0`。

- [ ] **Step 4: 全量验证**

```bash
$NODE test/manage.mjs
$NODE test/smoke.mjs
$NODE test/panel-render.mjs
$NODE test/multipage-render.mjs
```

Expected: 四个全 PASS；记录每项的 `checks` 数并与基线对比（146 / 120 / 97，只增不减）。

- [ ] **Step 5: 手工冒烟（必须做，不能只看测试）**

在 DSH Web 面板里：

1. 规则页编辑一条内置规则 → 指纹变化 → 包文件 `git diff` 为空。
2. 移除后点恢复 → 文本回来。
3. 预设页新建一个只含 1 条规则的预设 → 激活 → 其他规则显示 `不在当前预设`。
4. 包页新建 → 复制 → 重命名 → 删除 → 回收站恢复。
5. 分发页看到修订列表，点回滚 → 指纹变化。

- [ ] **Step 6: 提交**

```bash
git add docs/USAGE.md README.md package.json
git commit -m "docs: pack/rule/preset management, overlay and rollback"
```

---

## 自检结论

- 规格覆盖：落点矩阵（Task 3/4/5/6）、覆盖层三键（Task 1/3）、优先级与可见性（Task 2）、写入层与快照（Task 1/7）、包生命周期（Task 6）、路由表（Task 4/5/6/7）、面板（Task 9/10/11）、导出（Task 8）、文档（Task 12）。
- 类型一致性：`writable: {scope, packId, file}` 在 Task 3 产出、Task 9/10/11 消费；`commit` 返回 `{revision, bytes}` 在 Task 1 定义、Task 4/5/6 使用；`applyRuleOverlay(rules, {patches, removed})` 在 Task 1 定义、Task 3/8 使用。
- 顺序约束：Task 1 → 3 → (4,5,6,7) → 8 → 9/10/11 → 12；Task 2 可与 Task 1 并行（互不依赖）。
