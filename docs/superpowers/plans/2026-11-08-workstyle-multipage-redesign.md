# dsh-workstyle Multi-Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前单一全宽面板拆成运行台、工作方式包、蒸馏审阅、度量和分发五个可独立进入的页面，同时保持现有工作方式注入、作用域和导出能力可验证。

**Architecture:** 在 `client.js` 内增加基于 hash 的轻量路由和共享 `EnvironmentContext`，页面用独立渲染函数消费共享状态；不引入前端构建链。Host 继续复用现有作用域/注入/度量接口，只增加包详情、报告历史、导出历史和带项目快照导出所需的最小接口。每个阶段先扩展无浏览器渲染或 smoke 测试，再实现最小功能并运行回归。

**Tech Stack:** 纯 ESM Node.js host、DeepSeek Harness Web slot、原生 CSS-in-JS、现有 React shim、Node `assert` 测试、Chrome headless/真实 Harness 截图验证。

**Spec:** `docs/superpowers/specs/2026-11-08-workstyle-multipage-redesign-design.md`

## Global Constraints

- 现有后端接口和数据模型保持兼容；只补页面实际需要的最小接口。
- 默认页面是 `/run` 当前环境运行台。
- 包内参考资源只读；项目级叠层是主要编辑面。
- 所有编辑成功后必须刷新 scope、inject 并展示新的指纹。
- 度量只使用可复算代理指标，不推断模型是否遵守规则。
- 琥珀是唯一品牌强调色；蓝灰只表示会话层或外部来源；警示红只表示实际错误或阻塞。
- 系统中文无衬线用于界面文字；等宽字体只用于指纹、id、路径、命令和注入文本。
- 所有页面必须覆盖浅色、深色、键盘焦点、空状态、错误状态和 `prefers-reduced-motion`。
- 不写入 `pack/reference`，不做跨设备同步、团队在线协作、LLM 合规判断或自动冲突合并。
- 仓库当前已有未提交改动；执行任务时不得 reset、clean、checkout 覆盖这些改动。

---

## File Map

| File | Responsibility |
| --- | --- |
| `client.js` | 轻量路由、共享环境上下文、一级导航、五个页面渲染函数、视觉 token 与页面交互。保留现有 React shim 兼容写法。 |
| `index.js` | 新增包详情、报告历史、导出历史读取路由；扩展带项目快照导出参数；保持现有工具、命令和路由行为。 |
| `lib/export.js` | 支持可选 `project.workstyle.json` 作用域快照，保持默认包导出结构不变。 |
| `lib/scope.js` | 提供可序列化的项目快照，并保证快照读取不写入包目录。只在现有接口不足时调整。 |
| `test/panel-render.mjs` | 路由、共享上下文、每页内容、编辑回填、错误/空态、主题和焦点属性测试。 |
| `test/smoke.mjs` | 新增读取路由、带项目快照导出、历史数据和隐私/只读约束测试。 |
| `test/multipage-render.mjs` | 如 `panel-render.mjs` 继续膨胀，创建独立的多页面渲染夹具；复用现有 React shim 但不复制 host 逻辑。 |
| `docs/verification/` | 保存真实 Harness 重启后的各页面浅色/深色截图与验证说明。 |

---

### Task 1: Add the route and shared environment contract

**Files:**
- Modify: `client.js:954-1057,1491-1608,1937-2024`
- Modify: `test/panel-render.mjs:267-550`
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: existing `status`, `scope`, `inject`, `metrics` payloads and the current `props.cwd`, `props.sessionId`.
- Produces: `readRoute() -> { page: 'run'|'packs'|'pack'|'distill'|'metrics'|'distribute', packId?: string }`, `navigate(route)`, and a shared `environment` object containing `{ status, scope, inject, metrics, report, cwd, sessionId, loading, error }` for all page renderers.

- [ ] **Step 1: Add failing route assertions to the panel test.**

Add a memory `location` shim before importing `client.js`, then assert the cold start renders the run page and semantic navigation links:

```js
const route = { hash: '#/run' }
globalThis.location = route

afterBootText = textOf(view)
ok(afterBootText.includes('运行台'), 'default route renders the run page')
ok(findHost(view, (node) => node.type === 'nav'), 'primary navigation is semantic')
ok(findHost(view, (node) => node.type === 'a' && node.props.href === '#/packs'), 'packs link uses a stable route')
```

Add one interaction assertion for clicking the metrics link and verify the old run-only body is absent.

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `node test/panel-render.mjs`

Expected: FAIL because the current panel has only the four internal tabs and no hash route or primary `nav`.

- [ ] **Step 3: Implement the minimal route helpers and context loader.**

Add pure helpers near the existing `getJson` function:

```js
const ROUTES = new Set(['run', 'packs', 'pack', 'distill', 'metrics', 'distribute'])
const readRoute = () => {
  const raw = typeof location !== 'undefined' ? String(location.hash || '') : '#/run'
  const [, page = 'run', packId] = raw.match(/^#\/?([^/]+)?(?:\/(.*))?$/) || []
  return ROUTES.has(page) ? { page, packId: packId || undefined } : { page: 'run' }
}
const routeHash = (page, packId) => '#/' + page + (packId ? '/' + encodeURIComponent(packId) : '')
```

Use `window.addEventListener('hashchange', ...)` when available; in the shim, expose a `navigate()` callback that updates `location.hash` and state. Keep `#/run` as the fallback for an empty or unknown hash.

- [ ] **Step 4: Move environment loading behind one shared refresh contract.**

Replace page-specific direct reads with a single `loadEnvironment()` result. It must preserve the previous successful `scope` and `inject` when a refresh fails, set `error` to a readable message, and expose `refreshEnvironment()` to every page. Keep status loading separate so an unavailable environment route does not erase the active pack status.

- [ ] **Step 5: Add the persistent shell and route-aware tab semantics.**

Render:

```text
main shell
├─ nav aria-label="工作方式"
├─ EnvironmentContextBar
├─ page body selected by readRoute()
└─ footer
```

Use `<a href="#/run">` for navigation and `aria-current="page"` for the active item. Keep the existing four tab labels only inside the relevant pages where they still describe a local task; do not render all page bodies simultaneously.

- [ ] **Step 6: Run the focused and existing panel tests.**

Run: `node test/panel-render.mjs`

Expected: the new route assertions and all existing assertions pass, or existing tab assertions are updated only where the page ownership deliberately moved.

- [ ] **Step 7: Commit the route foundation.**

```bash
git add client.js test/panel-render.mjs
git commit -m "feat(panel): add multi-page route shell"
```

---

### Task 2: Add the minimal host reads and scoped export contract

**Files:**
- Modify: `index.js:79-87,467-490,856-1104`
- Modify: `lib/export.js:145-231`
- Modify: `lib/scope.js` only if a serializable snapshot helper is needed
- Modify: `test/smoke.mjs:216-418`
- Test: `test/smoke.mjs`

**Interfaces:**
- Consumes: existing `loadAllPacks()`, `scopeFor()`, `readLatestReport()`, `exportPack()` and `$DSH_HOME/workstyle/{reports,exports}`.
- Produces: `GET /api/dsh-workstyle/pack?id=<id>`, `GET /api/dsh-workstyle/reports`, `GET /api/dsh-workstyle/exports`, and `POST /api/dsh-workstyle/export` accepting `{ pack?, withProject?: boolean, cwd?: string }`. Existing request shapes remain valid.

- [ ] **Step 1: Write failing smoke tests for the new reads.**

Add tests that use the existing temporary `DSH_HOME` and project directory:

```js
const packDetail = await callRoute('/api/dsh-workstyle/pack?id=fde-engineering')
ok(packDetail.status === 200 && packDetail.data.pack.id === 'fde-engineering', 'GET /pack returns a pack detail')
ok(Array.isArray(packDetail.data.pack.rules), 'pack detail includes rules')

const reportList = await callRoute('/api/dsh-workstyle/reports')
ok(reportList.status === 200 && Array.isArray(reportList.data.reports), 'GET /reports returns report metadata only')

const exportList = await callRoute('/api/dsh-workstyle/exports')
ok(exportList.status === 200 && Array.isArray(exportList.data.exports), 'GET /exports returns export metadata')
```

Add a scoped export call and assert the archive contains `project.workstyle.json` while a default export does not.

- [ ] **Step 2: Run smoke and verify the new assertions fail.**

Run: `node test/smoke.mjs`

Expected: the existing checks pass up to the new route assertions; the new routes return 404 or the archive lacks the project snapshot.

- [ ] **Step 3: Implement read-only pack, report, and export listing helpers.**

Add helpers that return metadata only:

```js
function listReportMetadata() { /* sorted generatedAt desc; no report prompt text */ }
function listExportMetadata() { /* sorted mtime desc; file, bytes, modifiedAt only */ }
```

`GET /pack` must select by id or absolute directory using the same validation path as `workstyle_apply`, but it must not change `active` or write state. Return `packSummary()` plus normalized rules, presets, templates and skills needed by the package detail page.

`GET /reports` must never return raw prompt data. Return generated time, source availability, suggestion count and report file name only.

- [ ] **Step 4: Extend `exportPack()` with an optional project snapshot entry.**

Add an optional `projectSnapshot` object to the options contract. When supplied, add a UTF-8 `project.workstyle.json` entry and include `scope: 'project'` plus the snapshot file in `manifest.json`. The default call path must produce the same archive entries as before.

- [ ] **Step 5: Extend the host export handler.**

When `withProject` is true, require `cwd`, read the project scope with `readProjectScope(cwd)`, and pass a sanitized snapshot to `exportPack()`. Reject missing `cwd` with HTTP 400. Never copy arbitrary files and never write under `pack/reference`.

- [ ] **Step 6: Run smoke and inspect archive contents.**

Run: `node test/smoke.mjs`

Expected: all existing checks plus new route, metadata privacy, default export, and scoped export checks pass.

- [ ] **Step 7: Commit the host contract.**

```bash
git add index.js lib/export.js lib/scope.js test/smoke.mjs
git commit -m "feat(host): expose multipage pack and export data"
```

---

### Task 3: Build the `/run` environment page

**Files:**
- Modify: `client.js` in the page render section after the route shell
- Modify: `test/panel-render.mjs` or create `test/multipage-render.mjs`
- Test: focused panel render test

**Interfaces:**
- Consumes: shared `environment`, `navigate`, `refreshEnvironment`, and existing preset action.
- Produces: `RunPage({ environment, onNavigate, onRefresh, onUsePreset })` with status rail, actionable todo bar, injection proof, and quick preset switch.

- [ ] **Step 1: Add failing `/run` page assertions.**

Assert the page contains the current project, scope counts, fingerprint, real injected markdown, and links to the three actionable destinations:

```js
ok(text.includes('当前环境'), 'run page names the current environment')
ok(text.includes('sha256 '), 'run page shows the inject fingerprint')
ok(text.includes('## 工作方式'), 'run page shows the real injected text')
ok(text.includes('#/distill'), 'run page links pending distillation work')
ok(text.includes('#/metrics'), 'run page links metric work')
```

- [ ] **Step 2: Run the test and verify it fails.**

Run: `node test/panel-render.mjs`

Expected: FAIL because the current page still renders the v5 tab shell and does not have `/run` navigation targets.

- [ ] **Step 3: Implement `RunPage` using existing v5 blocks.**

Move the status rail, todo bar, onboarding tip, inject block, and preset cards into one renderer. Keep the run page free of the full rule and skill lists. Todo buttons must call `navigate('#/distill')`, `navigate('#/packs/<activePack>')`, or `navigate('#/metrics')` according to the item.

- [ ] **Step 4: Preserve onboarding and injection proof behavior.**

Keep `dsw-workstyle:onboarding-v1`, the one-time dismissal, exact injected text, fingerprint, character count, source counts and copy action. The run page must show the previous successful fingerprint if a refresh failed and expose a retry button.

- [ ] **Step 5: Verify keyboard and reduced-motion behavior.**

All todo actions must be links or buttons with visible `:focus-visible`; route transitions must not rely on animation. Ensure the existing scoped CSS keeps `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 6: Run tests.**

Run: `node test/panel-render.mjs`

Expected: run page, onboarding, injection identity, keyboard attributes and existing regression checks pass.

- [ ] **Step 7: Commit the run page.**

```bash
git add client.js test/panel-render.mjs test/multipage-render.mjs
git commit -m "feat(panel): add current environment run page"
```

---

### Task 4: Build `/packs` and `/packs/:id` with project rule editing

**Files:**
- Modify: `client.js` package page and editor sections
- Modify: `test/multipage-render.mjs`
- Test: `test/multipage-render.mjs`

**Interfaces:**
- Consumes: `GET /status`, `GET /pack`, `GET /scope`, `POST /apply`, `POST /toggle`, `POST /rule`, `POST /preset`.
- Produces: `PacksPage({ packs, activePackId, onNavigate, onApply })` and `PackDetailPage({ packId, environment, onRuleSave, onRuleRemove, onToggle, onUsePreset })`.

- [ ] **Step 1: Add failing package list and detail tests.**

Cover both a built-in pack and a missing pack:

```js
ok(text.includes('工作方式包'), 'packs page has a package heading')
ok(text.includes('FDE 工程工作方式'), 'packs page lists the active package')
ok(text.includes('只读'), 'built-in package resources are marked read-only')
ok(text.includes('项目叠层'), 'pack detail exposes the project layer')
```

For a missing `packId`, assert a recoverable message and a link back to `#/packs`.

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `node test/multipage-render.mjs`

Expected: FAIL because the current panel has no package list/detail routes.

- [ ] **Step 3: Implement `PacksPage`.**

Render each status pack with display name, version, source, rule count, skill count, active state and a semantic link to `#/packs/<id>`. The active pack gets an explicit text state; do not use color alone.

- [ ] **Step 4: Implement `PackDetailPage` and load non-active details.**

On route entry, fetch `/pack?id=...`; use the shared scope only for the active context. Render local tabs for rules, skills, presets and templates. Package resources remain read-only; only project-origin rules expose edit/remove actions.

- [ ] **Step 5: Migrate the rule editor without changing its write contract.**

Keep `{ cwd, rule }` for save and `{ cwd, rule: { id }, remove: true }` for remove. Validate non-empty id/title/text before posting. After success call `refreshEnvironment()` and navigate to `#/run` with a notice containing the changed rule id and new fingerprint.

- [ ] **Step 6: Migrate preset use and add explicit preset save UI only where needed.**

Use the existing `POST /preset` `action: 'use'` contract for switching. If adding a new preset form, post `{ action: 'save', preset: { id, title, description, rules, skills, templates } }`; do not mutate bundled pack files.

- [ ] **Step 7: Verify override visibility.**

Keep disabled rules visible with the layer that disabled them (`项目覆盖` or `会话停用`) and show scope badges plus source text. A project rule must remain visible after refresh and must not appear in another temporary project fixture.

- [ ] **Step 8: Run panel and smoke tests.**

Run: `node test/multipage-render.mjs && node test/smoke.mjs`

Expected: package navigation, read-only boundaries, project rule persistence, preset switching and fingerprint refresh pass.

- [ ] **Step 9: Commit package pages.**

```bash
git add client.js test/multipage-render.mjs test/smoke.mjs
git commit -m "feat(panel): add workstyle package pages"
```

---

### Task 5: Build `/distill` and `/metrics` as independent pages

**Files:**
- Modify: `client.js` distill and metrics renderers
- Modify: `test/multipage-render.mjs`
- Modify: `test/smoke.mjs` only for any new history query assertions
- Test: `test/multipage-render.mjs`

**Interfaces:**
- Consumes: `GET /evidence`, `POST /distill`, `POST /adopt`, `POST /unadopt`, `GET /metrics`, `GET /reports`.
- Produces: `DistillPage({ report, onDistill, selected, onAdopt, onUnadopt })` and `MetricsPage({ metrics, reports, onRefresh, onDistill })`.

- [ ] **Step 1: Add failing distill and metrics page assertions.**

```js
ok(text.includes('蒸馏审阅'), 'distill page has an explicit heading')
ok(text.includes('本地数据') && text.includes('不保存 prompt 原文'), 'distill page states privacy boundary')
ok(text.includes('规则命中') && text.includes('先方案率'), 'metrics page renders proxy metrics')
ok(text.includes('公式') && text.includes('分母'), 'metrics page shows metric definitions')
ok(!text.includes('遵守率') && !text.includes('违反率'), 'metrics page avoids unsupported compliance claims')
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `node test/multipage-render.mjs`

Expected: FAIL because distillation and metrics are currently nested under the old internal tabs.

- [ ] **Step 3: Implement `DistillPage`.**

Render source availability, last generated time, scan action, pending suggestions, handled suggestions, selection checkboxes and adopt/revoke actions. After distill or adopt, refresh status, report and environment; preserve selected state only when the server rejects the operation.

- [ ] **Step 4: Implement `MetricsPage`.**

Render four metric cards with value, unit, formula, denominator, time window, baseline delta when available, caveat and source availability. The empty state must link to `#/distill` and offer the same `onDistill` action.

- [ ] **Step 5: Add report history without exposing report bodies.**

Use `/reports` to show generated time, available sources and suggestion count. Do not render prompt text or include raw report payload in page state beyond the selected current report needed for suggestion review.

- [ ] **Step 6: Run tests.**

Run: `node test/multipage-render.mjs && node test/smoke.mjs`

Expected: distill review, adoption, metrics formulas, no-compliance wording and privacy checks pass.

- [ ] **Step 7: Commit the analysis pages.**

```bash
git add client.js test/multipage-render.mjs test/smoke.mjs
git commit -m "feat(panel): add distill review and metrics pages"
```

---

### Task 6: Build `/distribute` and export history

**Files:**
- Modify: `client.js` distribution renderer
- Modify: `index.js` export handler only if Task 2 leaves a narrow gap
- Modify: `test/multipage-render.mjs`
- Modify: `test/smoke.mjs`
- Test: `test/multipage-render.mjs`

**Interfaces:**
- Consumes: `POST /export`, `GET /exports`, current `cwd`, active pack and project scope.
- Produces: `DistributionPage({ exports, cwd, onExport, onCopy })` with two explicit export actions, install command, project snapshot explanation and export history.

- [ ] **Step 1: Add failing distribution page assertions.**

```js
ok(text.includes('导出包 + 作用域快照'), 'distribution page offers scoped export')
ok(text.includes('导出包（仅包）'), 'distribution page offers pack-only export')
ok(text.includes('复制安装命令'), 'distribution page offers install command copy')
ok(text.includes('最近导出'), 'distribution page lists export history')
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `node test/multipage-render.mjs`

Expected: FAIL because distribution is currently embedded in the v5 tab and has no history list.

- [ ] **Step 3: Implement explicit export actions.**

Call `{ withProject: true, cwd }` for the scoped action and `{ withProject: false }` for pack-only. Disable both actions while an export is active. On success show archive path, file count, byte count and a copy path action; on failure keep the selected action available for retry.

- [ ] **Step 4: Render export history safely.**

Fetch `/exports`, display file name, modified time, bytes and pack id/version. Never render arbitrary file contents. If there are no exports, show the install command and the next action.

- [ ] **Step 5: Verify default and scoped export semantics end to end.**

Run: `node test/multipage-render.mjs && node test/smoke.mjs`

Expected: pack-only archives omit project snapshots; scoped archives include `project.workstyle.json`; neither writes to `pack/reference`.

- [ ] **Step 6: Commit distribution page.**

```bash
git add client.js index.js test/multipage-render.mjs test/smoke.mjs
git commit -m "feat(panel): add distribution page and export history"
```

---

### Task 7: Finish shared states, visual system, and accessibility

**Files:**
- Modify: `client.js:16-62,423-906` and page renderers
- Modify: `test/multipage-render.mjs`
- Test: `test/multipage-render.mjs`

**Interfaces:**
- Consumes: all page renderers and shared route/context state.
- Produces: one token set for light/dark themes, shared `Loading`, `EmptyState`, `ErrorState`, `Notice`, `EnvironmentContextBar`, and consistent focus/reduced-motion behavior.

- [ ] **Step 1: Add failing state and accessibility assertions.**

Use a fixture with failed `/scope` and an empty report, then assert:

```js
ok(text.includes('重试'), 'route failure offers retry')
ok(text.includes('尚未蒸馏'), 'metrics empty state explains its next action')
ok(findHost(view, (node) => node.props && node.props['aria-current'] === 'page'), 'active navigation is announced')
ok(text.includes('当前环境'), 'shared context remains visible on every page')
```

Add a dark-mode fixture and assert the root includes the same semantic labels and a focus-visible rule in the scoped stylesheet.

- [ ] **Step 2: Run the test and verify it fails for each missing state.**

Run: `node test/multipage-render.mjs`

Expected: FAIL on at least one missing shared state or accessibility assertion before implementation.

- [ ] **Step 3: Implement shared visual tokens.**

Replace page-specific duplicate colors with named constants matching the spec: `#14171C`, `#F4F0E8`, `#FBF9F5`, amber `#95550F/#E3A660`, blue-gray `#47739A`, error `#A44A3F`. Keep rules, skills, pack cards and metrics on the same left edge and use container radius 12/control radius 8.

- [ ] **Step 4: Implement shared loading, empty and error states.**

Every page must render a short explanation and a next action. Error content must include the failed operation and retry target. Preserve stale successful environment data while showing a refresh error.

- [ ] **Step 5: Audit semantics and keyboard behavior.**

Use `nav`, `main`, headings in order, real links for routing, buttons for mutations, `aria-current`, `aria-selected` only for local tabs, `aria-expanded` for collapsible rows, and visible focus rings. Ensure every icon-only control has an accessible label.

- [ ] **Step 6: Run panel tests and perform a static wording audit.**

Run: `node test/multipage-render.mjs && node test/panel-render.mjs`

Also run: `grep -nE '遵守率|违反率|color:.*#fff|text-transform: uppercase' client.js`

Expected: no unsupported compliance labels; any uppercase or pure-white use must be limited to a justified icon/contrast context.

- [ ] **Step 7: Commit the visual and accessibility pass.**

```bash
git add client.js test/panel-render.mjs test/multipage-render.mjs
git commit -m "feat(panel): unify multipage states and accessibility"
```

---

### Task 8: Run full verification and real Harness review

**Files:**
- Modify: `docs/verification/README.md`
- Create: `docs/verification/multipage-run.png`
- Create: `docs/verification/multipage-packs.png`
- Create: `docs/verification/multipage-distill.png`
- Create: `docs/verification/multipage-metrics.png`
- Create: `docs/verification/multipage-distribute.png`
- Test: `test/smoke.mjs`, `test/panel-render.mjs`, `test/multipage-render.mjs`

**Interfaces:**
- Consumes: final client and host behavior plus the existing isolated Harness verification method.
- Produces: passing automated checks, real screenshots for each route, and a verification note with build marker and known limitations.

- [ ] **Step 1: Run all automated checks.**

Run: `npm run test:all && node test/multipage-render.mjs`

Expected: all existing smoke and panel checks plus all multipage checks pass.

- [ ] **Step 2: Run the isolated Harness host with a temporary data directory.**

Use the repository’s documented command pattern:

```bash
DSH_HOME="$(mktemp -d)" dsh --profile web --patch cordis.patch.yml
```

If the local Node runtime is unavailable, use the documented Electron-as-Node command for the test scripts. Keep the temporary `DSH_HOME` outside the repository.

- [ ] **Step 3: Verify the real route behavior.**

Open the plugin and visit `#/run`, `#/packs`, `#/packs/fde-engineering`, `#/distill`, `#/metrics`, and `#/distribute`. Confirm the shared environment context stays stable, the active route has `aria-current`, and refreshing each hash restores the same page.

- [ ] **Step 4: Verify write behavior in a temporary project.**

Create a temporary project directory, add a project rule from package detail, verify `.dsh/workstyle.json` appears there, verify the run page fingerprint changes, then verify another temporary project does not show that rule. Confirm `pack/reference/workstyle.json` has unchanged bytes.

- [ ] **Step 5: Capture screenshots in both themes.**

Capture at least the run, package detail, metrics and distribution pages at the existing 1440×1000 verification size. Capture one dark run page. Store files under `docs/verification/` with names matching the route and update `docs/verification/README.md` with the route, build marker and test command.

- [ ] **Step 6: Perform the final diff and repository safety check.**

Run:

```bash
git diff --check
git status --short
git diff --stat master...HEAD
```

Expected: no whitespace errors; pre-existing user changes remain present; only intended implementation and verification files are included in the final branch.

- [ ] **Step 7: Commit verification artifacts.**

```bash
git add client.js index.js lib/export.js lib/scope.js test/ docs/verification/
git commit -m "test: verify multi-page workstyle panel"
```
