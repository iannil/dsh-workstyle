# 安装后 3 分钟上手 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让新装插件的用户在约 3 分钟内「感到行为变了」——面板一眼证明已注入，新开对话能感知先方案/证据优先，Agent 能接住「怎么用」。

**Architecture:** 三件套、零新路由：① 面板首次出现可关闭的 3 步 tip（localStorage）；② Agent `workstyle_status` 描述 + 对话话术指向 tip；③ README 在「使用」前加「3 分钟上手」。不改 pack/reference，不做 modal tour，不占首屏长文（遵守 HOME-V5）。

**Tech Stack:** 现有 `client.js`（React shim + locale）、`index.js`（工具注册）、`README.md`、`test/panel-render.mjs`（无浏览器渲染断言）。

---

## File map

| File | Responsibility |
|------|----------------|
| `client.js` | locale 文案、`onboardingTip` 组件、插入点（todoBar 后）、localStorage `dsw-workstyle:onboarding-v1` |
| `index.js` | 丰富 `workstyle_status` description，让 Agent 知道如何回答「怎么用」 |
| `README.md` | 「安装」后、「使用」前新增「3 分钟上手」 |
| `docs/HOME-V5.md` | 补一小节「首次引导」验收，避免与「无介绍段落」冲突 |
| `test/panel-render.mjs` | 首次 tip 出现 / 关闭后消失 / 不引入营销文案 |

**Out of scope:** 新 HTTP 路由、modal 多步 tour、营销 eyebrow/副标题、改 pack/reference、新手 ops todo 混入现有 todoBar。

---

## Task 1: Panel first-run tip（locale + UI + storage）

**Files:**
- Modify: `client.js`（locale zh/en、tip 组件、布局插入）
- Test: `test/panel-render.mjs`

- [ ] **Step 1: 写失败测试（tip 应出现）**

在 `test/panel-render.mjs` 的 v5 environment 断言块末尾（约 line 390，todoLabels 断言之后）加入：

```js
/* first-run onboarding tip */
ok(text.includes('3 分钟上手'), 'first-run tip heading is visible on cold start')
ok(text.includes('看注入指纹'), 'tip step 1 points at the fingerprint')
ok(text.includes('新开对话'), 'tip step 2 asks for a new chat proof')
const dismiss = button(view, '知道了')
ok(!!dismiss, 'tip has a dismiss button')
```

并在文件顶部 React shim 附近给 `window.localStorage` 一个内存实现（当前没有）：

```js
const memoryStore = Object.create(null)
globalThis.window.localStorage = {
  getItem(key) { return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null },
  setItem(key, value) { memoryStore[key] = String(value) },
  removeItem(key) { delete memoryStore[key] },
}
```

注意：现有代码在 `onTab` 里已写 `window.localStorage.setItem('dsw-workstyle:tab', …)`，没有 storage 时被 try/catch 吞掉。加了 shim 后 tab 持久化也会生效，不影响断言。

- [ ] **Step 2: 跑测试，确认失败**

```sh
node test/panel-render.mjs
```

预期：失败于 `first-run tip heading is visible on cold start`（或同类）。

- [ ] **Step 3: 加 locale 键（zh + en）**

在 `client.js` zh 块（约 line 219，`envUnavailable` 后）追加：

```js
onboardingTitle: '3 分钟上手',
onboardingStep1: '① 看状态带的注入指纹——有指纹就说明规则已进系统提示',
onboardingStep2: '② 新开一个对话，说「帮我加个登录」——应先出方案再动代码',
onboardingStep3: '③ 面板「载入预览」可核对真实注入文本；随时可关本提示',
onboardingDismiss: '知道了',
onboardingDismissed: '已关闭上手提示',
```

在 en 块对应位置（约 `envUnavailable` 英文之后，或 v5 environment 段尾）追加：

```js
onboardingTitle: '3-minute start',
onboardingStep1: '① Check the status-rail fingerprint — if it shows, rules are in the system prompt',
onboardingStep2: '② Open a new chat and ask to “add login” — expect a plan before code',
onboardingStep3: '③ “Loaded text” shows the exact inject; dismiss this tip any time',
onboardingDismiss: 'Got it',
onboardingDismissed: 'Onboarding tip dismissed',
```

- [ ] **Step 4: 实现 tip 组件与插入**

在 `Panel` 内、`todoBar` 定义之后（约 line 1537 附近），加：

```js
const ONBOARDING_KEY = 'dsw-workstyle:onboarding-v1'
const [onboardingOpen, setOnboardingOpen] = useState(() => {
  try { return window.localStorage.getItem(ONBOARDING_KEY) !== 'done' } catch (err) { return true }
})
const dismissOnboarding = () => {
  try { window.localStorage.setItem(ONBOARDING_KEY, 'done') } catch (err) { /* tests / private mode */ }
  setOnboardingOpen(false)
  setNotice(t('onboardingDismissed'))
}
const onboardingTip = onboardingOpen ? h('div', {
  role: 'note',
  'data-testid': 'dsw-onboarding',
  style: {
    margin: '8px 0 0',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid color-mix(in srgb, var(--dsh-fg, #111) 12%, transparent)',
    background: 'color-mix(in srgb, var(--dsh-fg, #111) 4%, transparent)',
    display: 'grid',
    gap: 6,
  },
}, 
  h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('onboardingTitle')),
  h('div', { style: { fontSize: 12, lineHeight: 1.5 } }, t('onboardingStep1')),
  h('div', { style: { fontSize: 12, lineHeight: 1.5 } }, t('onboardingStep2')),
  h('div', { style: { fontSize: 12, lineHeight: 1.5 } }, t('onboardingStep3')),
  h('div', { style: { display: 'flex', justifyContent: 'flex-end' } },
    h('button', { type: 'button', style: S.button, onClick: dismissOnboarding }, t('onboardingDismiss'))),
) : null
```

在 return 树里，`todoBar` 与 banners 之间插入：

```js
statusRail,
todoBar,
onboardingTip,
error ? …
```

约束：
- 不写 eyebrow / 副标题 / pack description。
- tip 可一键关掉；关掉后刷新不再出现（localStorage `done`）。
- 文案短句，中文默认。

- [ ] **Step 5: 写关闭后消失的测试**

同文件追加：

```js
view = await act(() => dismiss.props.onClick())
text = textOf(view)
ok(!text.includes('3 分钟上手'), 'dismissing the tip hides it')
ok(memoryStore['dsw-workstyle:onboarding-v1'] === 'done', 'dismiss writes onboarding-v1=done')

/* remount with storage already done */
stateStore.length = 0
effectRan.length = 0
view = await settle()
text = textOf(view)
ok(!text.includes('3 分钟上手'), 'tip stays hidden after remount when storage says done')
```

同时保留原有「无营销文案」断言：确保 tip 不含「工作方式即代码」类宣传句（标题「3 分钟上手」允许）。

- [ ] **Step 6: 跑测试通过**

```sh
node test/panel-render.mjs
```

预期：全部 ✓。

- [ ] **Step 7: Commit**

```sh
git add client.js test/panel-render.mjs
git commit -m "feat(panel): one-time 3-minute onboarding tip after todo bar"
```

---

## Task 2: Agent 接住「怎么用」

**Files:**
- Modify: `index.js`（`workstyle_status` description）
- Optional verify: 手工或现有 smoke（无专用单测则靠描述 diff）

- [ ] **Step 1: 改 `workstyle_status` 描述**

`index.js` 约 line 586–588，把：

```js
description: 'Show the active dsh-workstyle pack: rules, skills, sources and the latest distillation report.',
```

换成：

```js
description: 'Show the active dsh-workstyle pack: rules, skills, sources and the latest distillation report. When the user asks how to use workstyle / 怎么用 / 如何上手 after install, answer in ≤8 short Chinese lines: (1) open sidebar 工作方式 and check status-rail fingerprint, (2) open a new chat and try a feature request to feel plan-first, (3) use 载入预览 to verify inject text; point them to the panel tip and README「3 分钟上手」. Do not dump the full handbook unless they ask.',
```

不新增工具、不新增路由。

- [ ] **Step 2: 冒烟确认工具仍注册**

```sh
node -e "import('./index.js').then(()=>console.log('ok')).catch(e=>{console.error(e);process.exit(1)})"
```

若该入口依赖 Harness 注入而不宜直接 import，则改为：

```sh
grep -n "3 分钟上手\|how to use workstyle" index.js
node test/smoke.mjs
```

预期：描述已更新；smoke 通过（若 smoke 与本改动无关失败，只记录，不在本任务修无关项）。

- [ ] **Step 3: Commit**

```sh
git add index.js
git commit -m "feat(agent): teach workstyle_status how to answer first-run how-to"
```

---

## Task 3: README「3 分钟上手」

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在「安装」与「使用」之间插入章节**

位置：`## 安装` 段落后、`## 使用` 之前（约 line 29–31）。插入：

```markdown
## 3 分钟上手

装完并重启后，按这三步确认「已经生效」，不必先读完整手册：

1. **打开侧边栏「工作方式」**，看状态带是否有「注入中 N」和一串指纹。有指纹 = 规则已进系统提示。页脚应出现 `home v5`。
2. **新开一个对话**，说一句真实需求（例如「帮我给这个项目加登录」）。正常时应先给可评审方案（目标 / 改动点 / 验收），而不是直接改代码。
3. **回到面板点「载入预览」**，核对真实注入文本；与指纹不一致就点刷新。首次打开会看到可关闭的「3 分钟上手」提示，点「知道了」后不再出现。

之后若要蒸馏、采纳、导出或改作用域，再看下一节「使用」。
```

- [ ] **Step 2: 目视检查**

确认：
- 「安装」→「3 分钟上手」→「使用」顺序正确；
- 不重复粘贴整份面板 IA；
- 与面板 tip 三步语义一致（指纹 → 新对话感知 → 载入预览 / 可关）。

- [ ] **Step 3: Commit**

```sh
git add README.md
git commit -m "docs: add 3-minute quickstart before full usage section"
```

---

## Task 4: HOME-V5 补「首次引导」验收（防回退）

**Files:**
- Modify: `docs/HOME-V5.md`

- [ ] **Step 1: 在验收标准段追加条目**

找到 `docs/HOME-V5.md` 的验收 / Acceptance 小节（约 line 179–184 一带「≤2 clicks」「无介绍段落」附近），追加：

```markdown
- **首次引导**：冷启动可在待办条下看到一次性「3 分钟上手」tip（指纹 → 新对话试一句 → 载入预览）；点「知道了」后写入 `localStorage dsw-workstyle:onboarding-v1=done`，刷新不再出现。tip 不算首屏介绍段落，禁止加 eyebrow / 营销副文。
```

- [ ] **Step 2: Commit**

```sh
git add docs/HOME-V5.md
git commit -m "docs(home-v5): accept one-time onboarding tip under todo bar"
```

---

## Task 5: 端到端自检与收尾

- [ ] **Step 1: 跑面板测试**

```sh
node test/panel-render.mjs
```

预期：全绿，含 tip 出现 / 关闭 / remount 隐藏。

- [ ] **Step 2: 跑 smoke（若存在）**

```sh
node test/smoke.mjs
```

- [ ] **Step 3: 对照验收清单**

| 验收项 | 证据 |
|--------|------|
| 冷启动可见 tip | panel-render 断言 |
| 关闭后持久隐藏 | localStorage + remount 断言 |
| 无营销长文 / 无 modal | 代码审查 + 原有 no-marketing 断言仍过 |
| Agent 能答「怎么用」 | `workstyle_status` description 含三步 |
| README 有 3 分钟路径 | 章节存在且在「使用」前 |
| HOME-V5 不冲突 | 验收条写明 tip ≠ 介绍段落 |

- [ ] **Step 4: 若工作区干净则无需再 commit；否则补一个 chore commit**

```sh
git status
```

---

## Self-review

1. **Spec coverage:** 面板 tip ✓、感知证明（指纹+新对话文案）✓、Agent 话术 ✓、README ✓；非目标（modal/新路由/改 pack）未引入。
2. **Placeholders:** 无 TBD；测试与文案均为可粘贴片段。
3. **Consistency:** storage key 统一 `dsw-workstyle:onboarding-v1`；按钮文案 zh「知道了」/ en「Got it」与测试一致。
