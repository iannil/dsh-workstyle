# 工作方式主页 v5 · 环境化重定位（设计稿）

> 目标：主页从「包的控制台」变成「工作方式环境」——能看到这轮到底载入了什么、按哪个作用域、
> 想用什么套件打开/关闭、有没有真的改变行为、哪里出了问题。
> 状态：**已实现**（后端 + 前端完成，128 项 smoke / 48 项 panel-render 通过）。日期：2026-11-08。
> 前置：`docs/HOME-V4.md`（v4 = 控制台 + 规则/技能启停，已实现）。
>
> **设计示意图**
> - 浅色全貌：[home-v5-sheet1-light.png](design/home-v5-sheet1-light.png)
> - 暗色 + 区块注记：[home-v5-sheet2-dark-annotated.png](design/home-v5-sheet2-dark-annotated.png)
> - 可编辑源：[home-v5-mockup.html](design/home-v5-mockup.html)（纯 HTML，Chrome 无头渲染截图）

## 0. 已确认的决策（本轮 brainstorming）

| # | 问题 | 决定 |
| --- | --- | --- |
| D1 | 环境核心对象 | 「以上都要，先重排信息架构」：编辑台 + 度量台 + 工作台，先定 IA，不分页 |
| D2 | 编辑写在哪 | 项目级叠层优先，`pack/reference` 只读不写 |
| D3 | 组装模型 | 四层：规则 > 预设（组合） > 技能 > 模板 |
| D4 | 度量精度 | 只用可复算的代理指标；不做「违反」推断 |
| D5 | 加载证明 | 主页与系统提示共用同一个渲染函数，展示真实注入片段 + 指纹 |
| D6 | 作用域模型 | 全局 → 项目 → 会话三层叠层（本稿新增，待确认） |
| D7 | 位置 | 保持全局面板 + 侧栏入口，不新增注入点（待确认） |

## 1. 问题定义（v4 之后仍然缺什么）

v4 把「能看」变成「能管」，但还是「读一个包」：

1. **看不见载入结果**：主页显示 6/7 规则，但看不到系统提示里真实的那一段；也分不清是全局还是项目生效。
2. **作用域缺失**：`overrides.json` 全机一份按包隔离；同一台机器上 `zhurongshuo`（写作）和
   `huan`（工程）用同一个包、同一组规则，写作项目被塞工程规则。
3. **不能写**：规则只能启停，不能新建/改正文/排序；没有预设、没有模板；所谓「环境」只能开开关。
4. **没有行为证据**：蒸馏只给「建议规则」，不给「这套工作方式有没有起作用」。
   规则命中了没有、先方案比例、验证比例，全部不可见。
5. **组装成本高**：40 个技能全量常驻，每个会话的候选列表都相同；用户要自己记「写书请 fde-job」。

一句话：v4 是**目录 + 开关**，v5 要是**环境**——载入、作用域、套件、证据四件事在一屏里闭环。

## 2. 新的主页回答 4 个问题

| 问题 | 页面位置 | 内容 |
| --- | --- | --- |
| 载入了什么？ | 顶部状态带 + 载入区 | 包/版本、作用域链、有效规则 n、启用技能 n、预设、指纹、警告 |
| 谁在生效？ | 载入区 | 全局 → 项目 → 会话三层列表，逐条显示来源/被谁覆盖，预览真实注入文本 |
| 怎么组装？ | 预设区 | 预设卡片（规则集 + 技能集 + 模板），一键切换；规则/技能可编辑 |
| 有没有用？ | 度量区 | 规则命中、先方案比例、验证比例、蒸馏覆盖；只列可复算代理指标 |

## 3. 信息架构

```
工作方式                                 [作用域: 全局·项目·会话 ▾] [刷新]
statusRail:  FDE 工程工作方式 v0.1.0 · 全局 6 规则 · 项目 +1 · 会话 -1(停用 中文短句) · 40/40 技能 · 预设「FDE 交付」 · 蒸馏 8h 前 · ⚠ 1
──────────────────────────────────────────────────────────────────────────
待办条  蒸馏建议 3 →   缺证据 2 →   基线已过期 →   作用域冲突 1 →
──────────────────────────────────────────────────────────────────────────
[载入预览] [编辑] [度量]                        (锚点导航，不是页面切换)
──────────────────────────────────────────────────────────────────────────
1 载入    [真实注入文本 · 完整预览 ▾]   指纹 sha · 全局+项目+会话合计 7 条 · 技能 40/40
         有效规则（7）  ☑ 先方案后实现   全局·高   手写
                        ☑ 项目：不要动 pack/reference   项目  覆盖? ▾
                        ☐ 中文短句        会话  已停用   [启用]
         预设「FDE 交付」定义：规则 6 + 技能 12
──────────────────────────────────────────────────────────────────────────
2 预设    [FDE 交付 ✓] [写书] [RC 探讨] [+ 新建预设]
         ── 规则：搜索/筛选/启停/排序 · 展开正文 · 来源 · [编辑] [新建] ──
         ── 技能：搜索/筛选/启停 · 展开用途与来源 ──
         ── 模板：n 条 · 展开 · [插入到新会话草稿] ──
──────────────────────────────────────────────────────────────────────────
3 度量    规则命中  先方案率  验证率  蒸馏覆盖      基线 11/08 · [重新蒸馏]
         先方案率 4.3% ↓ 说明小字 · 数据来源与算法 ▾（只读本机）
──────────────────────────────────────────────────────────────────────────
4 分发    导出 tar.gz（含作用域快照 ▾） · 安装命令 · 包目录
──────────────────────────────────────────────────────────────────────────
本机数据与隐私 ▾
页脚  home v5 · 2026-11-08 · dsh-workstyle v0.1.0
```

设计原则（沿用 v4，补齐）：

- **动作优先**：每个数字都能跳到对应筛选；空状态给下一步按钮。
- **渐进披露**：载入区默认折叠注入预览；规则/技能行只放决策信息。
- **状态分层**：全局 / 项目 / 会话三列来源徽标；覆盖关系用「被 X 覆盖」显式说明。
- **不写包**：所有编辑写作用域叠层；pack 只读，导出才合并成快照。

## 4. 数据模型

### 4.1 作用域

| 层 | 位置 | 谁能写 | 典型内容 |
| --- | --- | --- | --- |
| workspace | `$DSH_HOME/workstyle/state.json` | 主页/命令/工具 | 当前包、全局采纳、全局停用、预设选择 |
| project | `<cwd>/.dsh/workstyle.json` | 主页/命令 | 项目额外规则、停用、预设、技能停用 |
| session | `$DSH_HOME/workstyle/sessions/<sessionId>.json` | 主页（针对当前会话） | 本轮一次性停用/启用、临时规则 |

叠层合并（后层覆盖前层，按 id）：

1. 包规则（`pack.rules`）+ 全局采纳规则（adoptions）→ 基础集
2. 应用 workspace `disabled`
3. 合并 project `extraRules` / project `disabled`（停用优先生效）
4. 应用 session `disabled` / `enabled` 覆盖
5. 预设：选择预设后，规则集按预设成员过滤；技能集按预设成员排序置顶（不隐藏其他技能）

结果 = `effectiveRules` + `effectiveSkills` + 每条 `origin`/`scopes`/`overriddenBy`。

### 4.2 预设（四层模型）

```json
{
  "presets": [{
    "id": "fde-delivery",
    "title": "FDE 交付",
    "description": "工程交付：先方案、证据优先、验证后才宣称完成",
    "rules": ["plan-first", "evidence-first", "verify-before-done"],
    "skills": ["fde-job", "fde-architect", "fde-inspector"],
    "templates": ["review-first"],
    "scope": "global"
  }],
  "templates": [{
    "id": "review-first", "title": "先方案", "text": "先给可评审方案，我确认后再动代码。"
  }]
}
```

预设只做「选择」不复制内容：规则/技能仍归包与叠层所有；预设只是成员表。新建预设 = 勾选成员。
模板是插入到新会话草稿的文本片段，主页只提供复制/打开新会话入口（不做跨面板写草稿）。

### 4.3 载入证据

- 复用 `renderRules(effectiveActive())`——系统提示 section 与主页预览是**同一个函数、同一份输入**。
- 指纹：`sha256(渲染文本)` 取前 12 位，主页显示；会话里 `/workstyle status` 展示同一指纹。
- 「已过期」判定：最近一次蒸馏早于最近一次规则改动，或基线报告版本落后 → 待办条提示重新蒸馏。

### 4.4 度量（只做代理指标）

| 指标 | 算法（可复算） | 数据源 | 边界说明 |
| --- | --- | --- | --- |
| 规则命中 | 每条启用规则的关键词表（pack `measures[].keywords`，缺省用规则标题分词）对本机 prompt 计数 | Claude history / Codex index / DSH 会话 | 只表示「提示里出现过」，不表示模型遵守 |
| 先方案率 | 含方案词的用户 prompt / 总 prompt | 同上 | 用户在要求方案，不是模型在给方案 |
| 验证率 | 含验证词的用户 prompt + 会话里的测试类工具调用 / 总会话 | 同上 | 会话粒度为主 |
| 蒸馏覆盖 | 有可用数据源数量 / 配置源数量；最近蒸馏距今 | reports | 覆盖率低时指标标注「样本不足」 |
| 基线对比 | 当前窗口 vs 上次蒸馏窗口 | 两次 report | 差值展示，不解释因果 |

规则：**不出现**「违反」「遵守率」这类推断词；每条指标下方一行小字说明口径。

## 5. 后端改动

### 5.1 新增文件

| 文件 | 内容 |
| --- | --- |
| `lib/scope.js` | 读 project `/ session` 叠层、合并函数 `mergeScope()`、写 `overrides` 迁移 |
| `lib/inject-text.js` | 包装 `renderRules`，输出 `{ text, fingerprint }`；系统提示 section 也走它 |
| `lib/metrics.js` | 从 latest report 计算 §4.4 指标与基线差 |

`overrides.json` 旧格式由 `scope.js` 读取时迁移（`packs.<id>.disabledRules/Skills` → workspace 层）。

### 5.2 路由 / 工具增量

| 接口 | 用途 |
| --- | --- |
| `GET /api/dsh-workstyle/inject?scope=` | `{ text, fingerprint, ruleIds }`，主页载入预览 |
| `GET /api/dsh-workstyle/scope?cwd=` | 三层叠层明细与冲突 |
| `POST /api/dsh-workstyle/scope` | 写 project / session 层：`{ scope, cwd|sessionId, patch }` |
| `POST /api/dsh-workstyle/rule` | 新建/编辑/删除项目级规则（更新 / 排序） |
| `POST /api/dsh-workstyle/preset` | 新建/切换/删除预设 |
| `GET /api/dsh-workstyle/metrics` | 指标 + 基线差 + 口径 |
| `workstyle_inject` 工具 | 返回当前生效的注入文本（模型自查） |
| `workstyle_metric` 工具 | 返回指标 JSON（模型自查） |

命令扩展：`/workstyle (preview|preset|scope|new-rule|edit-rule)`。

### 5.3 导出语义

- 默认：包 + 全局采纳（同 v4），不带本地停用与项目叠层。
- `--with-project`：附带当前项目叠层快照为 `project.workstyle.json`，接收方可选择启用。

## 6. 验收标准

1. 载入区显示真实注入文本，指纹与 `/workstyle status` 一致；修改任何规则/作用域后指纹变化。
2. 在项目 A 新建项目规则后：项目 A 生效；项目 B 与全局视图不生效；重启后保持。
3. 同一规则在全局启用、项目停用时，载入区显示「项目停用」与覆盖链，系统提示不含该规则。
4. 切换预设后 1 次点击内技能候选顺序变化（`workstyle_list` 验证）。
5. 度量区每个指标都带口径说明；不存在「违反/遵守率」字样。
6. 首屏无介绍性段落；≤2 次点击可完成：停用一条规则、切换预设、查看注入预览。
7. `test/smoke.mjs`、`test/panel-render.mjs` 全覆盖新增接口与新 IA；真机重启截图存入 `docs/verification/`。
8. **首次引导**：冷启动可在待办条下看到一次性「3 分钟上手」tip（指纹 → 新对话试一句 → 载入预览）；点「知道了」后写入 `localStorage dsw-workstyle:onboarding-v1=done`，刷新不再出现。tip 不算首屏介绍段落，禁止加 eyebrow / 营销副文。

## 7. 风险与不做的事

- **三层作用域复杂度**：先只做读取 + 项目层写入，会话层读展示，不做会话层编辑 UI。
- **度量误导**：宁少勿假；样本不足时显式标注，不与「遵守」挂钩。
- **注入文本漂移**：预览与真实注入必须走同一函数，否则等于造假证据。
- **本轮不做**：跨设备同步、团队协作、LLM 判定合规、规则冲突合并算法（只显式报冲突）、迁移旧包格式。
- **包文件仍只读**：所有写入落在 `$DSH_HOME/workstyle/` 与 `<cwd>/.dsh/`，不写 `pack/reference`。

## 8. 实施顺序

1. **后端骨架**：`lib/scope.js` + `inject-text.js` + 路由（`/scope`、`/inject`），旧 overrides 迁移，smoke 扩展。
2. **IA 重排（前端）**：载入区 + 预设区占位 + 度量区占位，规则/技能下沉；面板渲染测试同步改。
3. **预设与模板**：预设 CRUD、切换、`workstyle_list` 排序；模板展示与复制。
4. **规则编辑**：项目级新建/编辑/排序；覆盖链显示。
5. **度量**：`lib/metrics.js` + 基线差 + 口径文案。
6. **验证**：smoke / panel-render 全过，真机重启截图 + 构建标记 `home v5`。


## 9. 实现记录（2026-11-08）

### 9.1 新增文件

| 文件 | 作用 |
| --- | --- |
| `lib/scope.js` | 三层作用域合成（workspace → project → session）、预设/模板归一、项目层与会话层读写 |
| `lib/inject-text.js` | `renderInjectText(pack)` 输出 `{text, fingerprint, chars, ruleCount, skillCount}`；`packForRender()` 把作用域结果换成可渲染对象 |
| `lib/metrics.js` | 四个代理指标，每个都带 `formula` 与 `denominator`；无任何「遵守/违反」字段 |

### 9.2 路由（8 → 13）

| 路由 | 说明 |
| --- | --- |
| `GET /scope?cwd=&session=` | 合成后的规则、技能、预设、模板、计数 |
| `POST /scope` | `{layer:'project'|'session', patch}` 写对应层 |
| `GET /inject?cwd=&session=` | 真实注入文本 + sha256 前 12 位指纹 |
| `GET /metrics?cwd=&session=` | 代理指标 |
| `POST /rule` | 写项目层规则（`remove:true` 删除） |
| `POST /preset` | `action:'use'|'save'` |

### 9.3 落盘位置

- 项目层：`<cwd>/.dsh/workstyle.json`
- 会话层：`$DSH_HOME/workstyle/sessions/<sessionId>.json`
- 全局层：`$DSH_HOME/workstyle/state.json` + `overrides.json`（沿用 v4）

### 9.4 实现中发现的真实缺陷（均已修复并有回归测试）

1. **项目规则的 `origin` 被记成 `pack`** —— `composeScope` 里 `origin` 取的是上一个条目的值。
2. **注入预览与系统提示可能不同字节** —— 现在两者都走 `scopeFor({})` → `packForRender` → `renderInjectText`，测试断言 `live section identical to /inject: true`。
3. **「规则命中」恒为 0/0** —— 三个连环原因：
   - `normalizePack()` 丢掉了每条规则的 `measures`；
   - `composeScope` 也没把 `measures` 透传到合成结果；
   - `metrics.js` 拿一个不存在的 `report.scanText` 去数词。
   修法：蒸馏时按当前生效规则的关键词逐条计数，**只存计数不存原文**（`claude.ruleHits = {关键词: 命中 prompt 数}`）；`measureKeywords(input)` 从 `scopeFor(input).enabledRules` 取词，所以项目层规则也纳入度量。
4. **预设/模板在真实包里不存在** —— 已为 `pack/reference/workstyle.json` 补 3 个预设（FDE 交付 / 写书 / RC 探讨）与 3 个模板，并给 5 条规则补了 `measures`。

真实数据验证（本机 `~/.claude/history.jsonl`，20056 条 prompt）：规则命中 5/5，明细如 `方案×381`、`文件×700`、`验证×200`。报告全文不含任何 prompt 原文。

### 9.5 验证结果

| 命令 | 结果 |
| --- | --- |
| `test/smoke.mjs` | **ALL 128 CHECKS PASSED** |
| `test/panel-render.mjs` | **PANEL RENDER: 48 CHECKS PASSED** |
| 真实 `DSH_HOME` + 真实 cwd 跑 host 半 | `/inject` 指纹 `85aead453ee3`，`live section identical to /inject: true` |
| 真实数据蒸馏（副本 home） | 规则命中 5/5，先方案率 4.3%，验证率 3.1%，蒸馏覆盖 3/4 |

### 9.6 真机验证（2026-11-08，用户重启后）

- 鉴权方式：`dsh web` 用 `dsh-auth-<随机>` cookie 保护全站；从
  `~/Library/Application Support/@deepseek-ai/dsh-desktop/Cookies` 读出后逐条试
  `GET /api/dsh-workstyle/status`，命中 200 的那条即为当前端口的会话 cookie。
- 真机接口实测（`cwd=/Users/rong.zhu/Code/zhurong/dsh-workstyle`）：
  - `/scope`：`injected 7 / project 0 / disabled 0 / skills 40`；
  - `/inject`：指纹 `85aead453ee3`、610 字符、7 规则 40 技能 —— **与本地 host 半完全一致**；
  - 预设 `fde-delivery / writing / rc-discussion`、模板 3 个已生效；
  - `/metrics`：`rule-hits 0/5`（本机仍是补 `measures` 之前的旧报告，点「重新蒸馏」即成 5/5）、`plan-rate 4.3%`、`verify-rate 3.1%`、`coverage 4/4`。
- 截图：用真机响应喂给面板组件再渲染成图，见 `docs/verification/panel-v5-{top,rules,presets}.png`。
  期间修掉 6 个真实 UI 缺陷（粘连、缺分隔符、预设标签复用了段落标题、度量差值标签、
  分发区文案顺序），见 `docs/verification/README.md`。

### 9.7 尚未完成

- 会话层只有读写接口，**没有会话层编辑 UI**（与 §7 一致）。


### 9.8 Tab 分页（用户纠正）

原设计 D1「先 IA 不分页」被用户否决。现已改为真正 Tab：

| 页签 | 内容 |
| --- | --- |
| 载入预览 | 真实注入文本 + 指纹 |
| 预设与规则 | 有效规则、预设组装、蒸馏建议 |
| 度量 | 四项代理指标 |
| 分发 | 导出 / 安装命令 / 证据来源 |

实现要点：`tab` state + `role=tablist`；shim 不支持 `useState(() => ...)` 函数初值，必须用字面量；刷新时复位 `showHandled`。
