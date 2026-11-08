# dsh-workstyle 面板 UI 全面优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `client.js` 的全部面板页面重构为 Notion 式明亮文档感设计 + 左侧栏分组信息架构。

**Architecture:** 单文件 `client.js` 内做三层改造：语义 token 层（浅/深双主题）→ 共享组件层（Card/Chip/EmptyState/LoadingState/ErrorState/Sidebar）→ 各页面换皮与路由重排。HTTP 路由、`index.js` 数据形态、渲染分层逻辑不动。

**Tech Stack:** 原生 ESM + `React.createElement`（无构建步骤，宿主 `window.__ModuleLoader__` 加载）；测试为 `test/panel-render.mjs`（React shim，Node >= 20）。

**Spec:** `docs/superpowers/specs/2026-11-08-panel-ui-refresh-design.md`

## Global Constraints

- 不引入任何新依赖、不加构建步骤；仍是宿主 module loader 单文件加载
- 旧品牌色 `INK='#14171C'`、`PAPER='#F4F0E8'`、`SURFACE='#FBF9F5'`、`AMBER='#E3A660'`、`AMBER_DARK='#95550F'`、`BLUE_GRAY='#47739A'`、`ERROR='#A44A3F'` 只允许出现在 token 定义处；完成后 grep 全文不得在其他行出现
- 语义 token（spec §2）：`bg #FFFFFF`、`surface #F7F6F3`、`sel #EFEDEA`、`border #EDECE9`、`ink #37352F`、`ink2 #787774`、`ink3 #9B9A97`、`accent #37352F`、`danger #EB5757`、`ok #2E9E5B`；深色主题为同 token 反色版，跟随现有 `--dsw-alias-*` 探测（`client.js:41`）
- 所有数据区显式三态：loading / empty / error，复用共享组件
- 保留既有 a11y：tablist/tabpanel、aria-current、focus-visible；侧栏加 aria-label
- 每个 Task 完成后必须 `node test/panel-render.mjs` 通过再 commit（本机 node 路径 `/Users/rong.zhu/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node`）
- spec §7：包详情区（约 `client.js:2335-2362`）只换皮不拆逻辑；`client.js` 不拆文件，用分区注释组织

## 页面路由映射（所有 Task 共用）

| 旧 route.page | 新 route.page | 页面 |
|---|---|---|
| packs（首屏） | `overview` | 概览（包切换器 + 数字卡 + 快捷动作） |
| pack（包详情） | `pack`（保留） | 状态轨 + 包详情 tab |
| — | `rules` | 规则（作用域 chip 筛选） |
| — | `presets` | 预设 |
| — | `skills` | 技能 |
| distill | `distill` | 蒸馏审查 |
| metrics + run | `metrics` | 指标与运行（合并） |
| distribute | `distribute` | 分发 |

hash 兼容：`routeHash()` 对旧值 `run` 重写到 `metrics`，`packs` 重写到 `overview`。

---

### Task 1: 语义 token 层（浅/深双主题）

**Files:**
- Modify: `client.js:15-23`（品牌 token 定义处）及 `client.js:518` 起的 `S` 样式对象、`client.js:2588` 起的 `--dsw-color-*` root 变量
- Test: `test/panel-render.mjs`（文件尾部追加断言）

**Interfaces:**
- Produces: 常量 `TOKENS`（形状 `{ light: {...}, dark: {...} }`，键为 `bg, surface, sel, border, ink, ink2, ink3, accent, danger, ok`）与函数 `resolvedTheme(): 'light'|'dark'`（沿用 `client.js:39-45` 的 probe 探测逻辑）；后续所有 Task 的样式只从 `T = TOKENS[resolvedTheme()]` 取值。

- [ ] **Step 1: 写失败测试**（`test/panel-render.mjs` 尾部、现有断言之后）

```js
// --- semantic tokens (Notion refresh) ---
const src = fs.readFileSync(path.join(root, 'client.js'), 'utf8')
const tokenDef = src.match(/const TOKENS = \{[\s\S]*?\n\}/)
assert.ok(tokenDef, 'TOKENS map must exist in client.js')
for (const key of ['bg','surface','sel','border','ink','ink2','ink3','accent','danger','ok']) {
  assert.ok(tokenDef[0].includes(key), 'token missing: ' + key)
}
const legacyOutside = src.replace(tokenDef[0], '')
for (const hex of ['#14171C','#F4F0E8','#FBF9F5','#E3A660','#95550F','#47739A','#A44A3F']) {
  assert.ok(!legacyOutside.includes(hex), 'legacy color leaked outside TOKENS: ' + hex)
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node test/panel-render.mjs`
Expected: FAIL `TOKENS map must exist in client.js`

- [ ] **Step 3: 实现**——`client.js:15-23` 替换为：

```js
const TOKENS = {
  light: { bg:'#FFFFFF', surface:'#F7F6F3', sel:'#EFEDEA', border:'#EDECE9',
           ink:'#37352F', ink2:'#787774', ink3:'#9B9A97', accent:'#37352F',
           danger:'#EB5757', ok:'#2E9E5B' },
  dark:  { bg:'#191919', surface:'#202020', sel:'#2C2C2C', border:'#313131',
           ink:'#E9E9E7', ink2:'#9B9B98', ink3:'#6F6F6C', accent:'#E9E9E7',
           danger:'#E5484D', ok:'#4CB782' },
}
```

保留 `luminance()`；删除七个旧色常量；`S` 样式对象与 root CSS 变量改为从 `T` 取值；深色探测命中时 `T = TOKENS.dark`。逐处替换 `S` 中引用旧常量的行（`INK`→`T.ink`、`PAPER`→`T.bg`、`SURFACE`→`T.surface`、`AMBER/AMBER_DARK`→`T.accent`、`BLUE_GRAY`→`T.ink2`、`ERROR`→`T.danger`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node test/panel-render.mjs`
Expected: PASS（含既有全部断言）

- [ ] **Step 5: Commit**

```bash
git add client.js test/panel-render.mjs
git commit -m "refactor(panel): semantic token layer with light/dark themes"
```

---

### Task 2: 共享状态组件（Card / Chip / 三态升级）

**Files:**
- Modify: `client.js:1008-1065`（`Section/Tile/Loading/EmptyState/ErrorState/Notice` 区域）
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: Task 1 的 `T`
- Produces:
  - `function Card({ value, label, tone })` — `tone` ∈ `'ink'|'danger'`，渲染轻边框数字卡（`border:1px solid T.border; border-radius:6px; padding:12px`，value 字号 20/700，色 `tone==='danger' ? T.danger : T.ink`）
  - `function Chip({ label, count, on, onClick })` — 圆角胶囊筛选 chip，`on` 时底色 `T.sel` 文字 `T.ink`，否则文字 `T.ink2` 边框 `T.border`
  - `function EmptyState({ noun, primary, source })` — 渲染居中文案 `暂无 {noun}，{primary} 或 {source}`，primary/source 为可点击 `linkButton`
  - `Loading/ErrorState` 保留现有签名，仅换 token 色

- [ ] **Step 1: 写失败测试**

```js
// --- shared state components ---
assert.ok(/function Card\(/.test(src), 'Card component missing')
assert.ok(/function Chip\(/.test(src), 'Chip component missing')
assert.ok(/暂无/.test(src.match(/function EmptyState\([\s\S]*?\n\}/)?.[0] || ''), 'EmptyState must render 暂无文案')
```

- [ ] **Step 2: 跑测试确认失败** — Run: `node test/panel-render.mjs`；Expected: FAIL `Card component missing`
- [ ] **Step 3: 实现**（按上方 Interfaces 逐个实现，替换旧 `Tile` 的使用点为 `Card`，`Tile` 删除）
- [ ] **Step 4: 跑测试确认通过** — Run: `node test/panel-render.mjs`；Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(panel): Card/Chip/EmptyState shared components"`

---

### Task 3: Sidebar + 路由重排

**Files:**
- Modify: `client.js:1608-1630`（`pageLinks`/`primaryNav`）、`route.page` 判定处 `client.js:2509-2517`、`routeHash()`
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: Task 1 `T`、Task 2 组件
- Produces:
  - `const NAV_GROUPS = [ ['状态',[['overview','概览'],['pack','状态轨']]], ['内容',[['rules','规则'],['presets','预设'],['skills','技能']]], ['维护',[['distill','蒸馏审查'],['metrics','指标与运行'],['distribute','分发']] ] ]`（label 走 `t()`，新增 locale key 见 Task 8）
  - `function Sidebar({ route, navigate })` — 渲染 `<nav aria-label>` + 三组 + 组标题（`T.ink3` 10px 大写）+ 选中项底 `T.sel`
  - `routeHash(page)` 兼容旧值：`run→metrics`、`packs→overview`
  - `pageBody`（`client.js:2509`）按上表路由映射分发；原 run 页内容并入 metrics 页下半区，原 packs 首屏内容并入 overview 页

- [ ] **Step 1: 写失败测试**

```js
// --- sidebar IA ---
assert.ok(/const NAV_GROUPS = \[/.test(src), 'NAV_GROUPS missing')
assert.ok(/function Sidebar\(/.test(src), 'Sidebar component missing')
assert.ok(src.includes("'run': 'metrics'") || src.includes("run: 'metrics'"), 'legacy run→metrics alias missing')
assert.ok(src.includes('overview'), 'overview route missing')
```

- [ ] **Step 2: 跑测试确认失败** — Run: `node test/panel-render.mjs`；Expected: FAIL `NAV_GROUPS missing`
- [ ] **Step 3: 实现**——`pageLinks` 换为 `NAV_GROUPS` + `Sidebar`；`pageBody` 的 `route.page === 'run'` 分支删掉（run 内容块改为 metrics 页的一个 Section）；`route.page === 'packs'` 改为 `overview`；`routeHash()` 顶部加 `if (page === 'run') return routeHash('metrics')`、`packs→overview` 同理
- [ ] **Step 4: 跑测试确认通过**；并人工核对 `Panel` 渲染输出中 nav 存在 aria-label
- [ ] **Step 5: Commit** — `git commit -m "feat(panel): sidebar IA with grouped nav and legacy route aliases"`

---

### Task 4: 概览页

**Files:**
- Modify: `client.js` overview 分支（Task 3 引入的 `overview` case，内容取自原 packs 首屏）
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: `T`、`Card`、`Sidebar`、现有 `status/env/report` 数据
- Produces: overview 页结构 = 页头（标题「概览」+ 右上包切换器 `切换包 ▾`）+ 指纹行（包名 · 版本 · 指纹 code 样式）+ 三张 `Card`（生效规则 / 待审查建议 / 技能数）+ 快捷动作行（编辑规则、载入预览、蒸馏一次，均为 `linkButton`）

- [ ] **Step 1: 写失败测试**

```js
// --- overview page ---
const overview = src.match(/route\.page === 'overview'[\s\S]*?(?=\n      : )/)
assert.ok(overview && /切换包|t\('packSwitch'\)/.test(overview[0]), 'overview pack switcher missing')
assert.ok(overview && (overview[0].match(/Card\(/g) || []).length >= 3, 'overview needs >=3 stat cards')
```

- [ ] **Step 2: 确认失败** — Run: `node test/panel-render.mjs`；Expected: FAIL
- [ ] **Step 3: 实现**（按 Interfaces 结构组装；数字取自现有 `status.rules`、`suggestions.length`、skills count 的同一数据源，不得新增请求）
- [ ] **Step 4: 确认通过** — Run: `node test/panel-render.mjs`；Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(panel): overview page with pack switcher and stat cards"`

---

### Task 5: 规则页（作用域 chip 筛选）

**Files:**
- Modify: `client.js` rules case（新增页；数据复用现有 rules 渲染逻辑 `client.js:1900-2100` 一带与编辑态 `setEditing`）
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: `T`、`Chip`、`EmptyState`、现有规则行/编辑表单
- Produces: 新 state `const [scopeFilter, setScopeFilter] = useState('all')`；chips = `[['all',全部],['workspace',...],['session',...],['disabled',已停用]]`，计数来自现有规则数组按 `rule.scope` 与 `rule.disabled` 统计；列表按 filter 过滤；空列表渲染 `EmptyState({ noun:'规则', primary:'+ 新规则', source:'蒸馏生成' })`

- [ ] **Step 1: 写失败测试**

```js
// --- rules page ---
assert.ok(/scopeFilter/.test(src), 'scopeFilter state missing')
const rulesCase = src.match(/route\.page === 'rules'[\s\S]*?(?=\n      : )/)
assert.ok(rulesCase && /EmptyState\(/.test(rulesCase[0]), 'rules empty state missing')
```

- [ ] **Step 2: 确认失败** — Run: `node test/panel-render.mjs`；Expected: FAIL
- [ ] **Step 3: 实现**（编辑表单与启停逻辑原样搬运到本页，只换样式为文档感列表卡）
- [ ] **Step 4: 确认通过**；追加行为断言：用 shim 渲染 rules 页空数据时输出包含「暂无」
- [ ] **Step 5: Commit** — `git commit -m "feat(panel): rules page with scope chips and empty state"`

---

### Task 6: 预设页 + 技能页

**Files:**
- Modify: `client.js` presets/skills case（内容取自现有包详情里的 presets 区 `client.js:2111-2230` 与 skills 区 `client.js:1780-1830`）
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: `T`、`Chip`、`EmptyState`、现有 preset 卡片与 skill 列表渲染
- Produces: `presets` 页 = 现有预设卡片区独立成页（新建预设按钮右上）；`skills` 页 = 技能列表 + 计数，行样式统一为文档列表（名称 600 / 描述 `T.ink2` 两行截断）

- [ ] **Step 1: 写失败测试**

```js
assert.ok(/route\.page === 'presets'/.test(src), 'presets route missing')
assert.ok(/route\.page === 'skills'/.test(src), 'skills route missing')
```

- [ ] **Step 2: 确认失败**；Expected: FAIL `presets route missing`
- [ ] **Step 3: 实现**（两页均为纯搬运 + 换皮；预设编辑/模板预览交互逻辑不改）
- [ ] **Step 4: 确认通过** — Run: `node test/panel-render.mjs`；Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(panel): standalone presets and skills pages"`

---

### Task 7: 蒸馏审查 / 指标与运行 / 分发 换皮

**Files:**
- Modify: `client.js` distill case（原 `route.page === 'distill'`，`client.js:2426-2500` 一带）、metrics case（合并原 run 页 `client.js:2511` 的 runBody）、distribute case
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: `T`、`Card`、`EmptyState`
- Produces: 三页均换 token 色与文档排版；metrics 页 = 上半区现有指标卡（改用 `Card`）+ 下半区原 runBody（标题「运行」Section）；页内逻辑（采纳/驳回建议、蒸馏触发、运行操作）零改动

- [ ] **Step 1: 写失败测试**

```js
assert.ok(!/route\.page === 'run'/.test(src), 'standalone run page must be merged into metrics')
```

- [ ] **Step 2: 确认失败**；Expected: FAIL（`'run'` 仍存在）
- [ ] **Step 3: 实现**——删除 run 路由分支，runBody 移入 metrics；distill/distribute 按现有结构换 token 与排版
- [ ] **Step 4: 确认通过** — Run: `node test/panel-render.mjs`；Expected: PASS
- [ ] **Step 5: Commit** — `git commit -m "refactor(panel): reskin distill/metrics/distribute, merge run into metrics"`

---

### Task 8: 包详情 tab 换皮 + locale 收尾

**Files:**
- Modify: `client.js:2335-2362`（pack 详情 tab，只换 `S` 引用为 token，tab 结构/aria 不动）；`locale/zh.json`、`locale/en.json`（新增 key：`navOverview/navRules/navPresets/navSkills/navDistillReview/navMetrics/navDistribute/navGroupState/navGroupContent/navGroupMaintain/packSwitch/quickActions` 等 Task 3-7 中 `t()` 引用到的全部新 key）
- Test: `test/panel-render.mjs`

**Interfaces:**
- Consumes: Task 1-7 全部产出
- Produces: 完整 locale 覆盖（无 `t()` 缺 key 回退裸 key）

- [ ] **Step 1: 写失败测试**

```js
// --- locale coverage ---
const zh = JSON.parse(fs.readFileSync(path.join(root, 'locale/zh.json'), 'utf8'))
const used = [...src.matchAll(/t\('([a-zA-Z0-9]+)'\)/g)].map(m => m[1])
const missing = [...new Set(used)].filter(k => !(k in zh))
assert.deepEqual(missing, [], 'missing locale keys: ' + missing.join(','))
```

- [ ] **Step 2: 确认失败**（新 key 未入 locale）；Expected: FAIL 列出缺失 key
- [ ] **Step 3: 实现**——补 `locale/zh.json` 与 `locale/en.json`（中英对照，中文以本计划与 spec 用词为准）；pack 详情区 `S` 换 token
- [ ] **Step 4: 确认通过 + 全量收尾**

Run: `node test/panel-render.mjs && node test/smoke.mjs`
Expected: 全部 PASS；再跑 `grep -n "#14171C\|#F4F0E8\|#FBF9F5\|#E3A660\|#95550F\|#47739A\|#A44A3F" client.js` 确认仅命中 TOKENS 定义区

- [ ] **Step 5: Commit**

```bash
git add client.js locale/zh.json locale/en.json test/panel-render.mjs
git commit -m "feat(panel): pack detail reskin and full locale coverage"
```

---

## Self-Review 记录

- Spec coverage：token（T1）、共享组件三态（T2）、IA/侧栏（T3）、概览（T4）、规则 chip（T5）、预设/技能（T6）、蒸馏/指标运行/分发（T7）、包详情换皮 + 深色主题验证与 a11y 随 T1/T3 落地、验收标准 grep 检查在 T8 Step 4——无缺口
- Placeholder：无 TBD/类「参考 Task N」表述；各页任务均给出结构或断言级实现说明
- 类型一致性：`route.page` 新值统一 `overview/rules/presets/skills/distill/metrics/distribute/pack`；`Card({value,label,tone})`、`Chip({label,count,on,onClick})`、`EmptyState({noun,primary,source})` 各任务签名一致
