# dsh-workstyle 方案与路线图

> 本文是产品方案的可追溯版本，防止跨会话丢失。最后更新：2026-11-08（面板改为操作台）。

## 定位

**工作方式即代码（Work style as code）**：把一个人的工作方式——规则、技能、预设、模板——打包成可安装、可版本化、可度量的 DeepSeek Harness 插件。技能包解决「会不会」，本插件解决「像不像你」。

## 三个决策（1A / 2A / 3A）

用户确认（原话："1A 2A 3A"）：

- **1A 平台型**：任何人可用它打包、分发自己的工作方式；我们附带的 FDE 参考包只是"样例"。
- **2A 内容取向**：工程 FDE 为主，写作 / RC 等作为可选 pack。
- **3A 分发**：参考包随插件公开上架，MIT，含 40 个 skills（来源 iannil/skills，署名保留）。

## 核心闭环

```
distill（读本机会话，出聚合报告与建议规则）
   → review（面板勾选建议规则）
   → adopt（并入当前 pack，进入系统提示）
   → export（tar.gz：包 + 技能 + 清单 + 安装说明）
   → 同事 apply（同一套规则与技能）
```

规模化度量用可复算的代理指标（先方案率、改完验证率、未验证宣称完成率、第 1 周 vs 第 4 周趋势，P2 看板）；指标只描述可观察信号，不推断模型是否遵守规则。

## 架构

| 层 | 位置 | 说明 |
| --- | --- | --- |
| Host | `index.js` + `lib/` | 系统提示规则段、skills provider、工具、命令、HTTP 路由 |
| Web | `client.js` | 侧栏入口 + `main` 槽控制台（状态 / 待审 / 规则与技能启停 / 分发 / 证据） |
| 包 | `pack/<id>/`、`$DSH_HOME/workstyle/packs/<id>/` | `workstyle.json` + `skills/**` |
| 蒸馏 | `lib/distill.js` | 只读扫描 Claude Code / Codex / DSH / Pi，只存聚合统计 |
| 导出 | `lib/export.js` | 无依赖 ustar + gzip，导出包可直接分发 |

- 规则注入：`ctx.systemPrompt.section('dsh-workstyle.rules', …)`，文本 = 有效包（含采纳规则）渲染结果。
- 技能：`ctx.skills.registerProvider`，`source: 'bundled'`。
- 工具（8）：`workstyle_status / list / apply / distill / evidence / adopt / toggle / export`。
- 命令：`/workstyle status | apply | distill | adopt | undo | on <id> | off <id> | export`。
- 路由（17 项注册）：`/api/dsh-workstyle/{status,pack,reports,exports,evidence,apply,distill,adopt,unadopt,toggle,export,scope,inject,metrics,rule,preset}`。
- 持久化：`$DSH_HOME/workstyle/state.json`（当前包 + `adoptions[packId]`）、`overrides.json`（按包存停用规则/技能）、`reports/`、`exports/`。
- 上架元数据（P3）：`dsh.bundle` + `category: workflow` + PNG 图标 + `screenshots.json`。

## 里程碑

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| P0 | 引擎 + 内置参考包 + `status` / `apply`，插件可装、面板可渲染、工具可用 | ✅ 2026-11-08（commit 9831a62） |
| P1 | 蒸馏器 + 审阅 UI（勾选采纳） + `export` 导出包 | ✅ 代码完成，待重启后真实环境复验 |
| P2 | 采纳看板（先方案率 / 验证率趋势）、报告导出、预设注册、项目模板 `init` | ◐ 前三项已实现（metrics 代理指标 + `/metrics`、`/export` tar.gz、`/preset`）；`init` 模板未实现 |
| P3 | npm 发布、图标 / 截图 / 双语 README、插件市场 PR | ⬜ |

2026-11-08 面板 v3（纯前端）：去掉营销 eyebrow / 副标题 / pack description / 常显证据，首屏改为状态行 + 四格运行态 + 待审建议置顶；规则默认折叠、技能改紧凑 chips、证据与来源默认折叠。后端未动，`test/panel-render.mjs` 17 项渲染检查覆盖。

2026-11-08 面板 v4（控制台 + 启停）：

- 首屏 = 状态行 → 主行动 → 四格运行态 → 待审建议 → 规则 → 技能 → 分发 → 证据（折叠）→ 页脚构建标记 `home v4 · 2026-11-08`。
- 规则/技能均可搜索、按启用状态筛选、逐条勾选启停；规则另有「蒸馏采纳」「缺证据」筛选与全部展开。
- 后端新增 `overrides.json` 持久化停用项、`workstyle_toggle` 工具、`POST /toggle` 路由、`/workstyle on|off` 命令；status 增 `summary` 与每项 `enabled` / `origin`。
- 导出不携带本地停用；采纳规则时清掉其停用记录，撤销时一并清理。
- 样式：`#dsw-root` 作用域样式表统一 hover / focus-visible / 自定义勾选框 / 减少动画；主按钮、品牌标跟随主题 token；筛选 chip 不换行不裁剪；已处理建议默认折叠。
- 验证：`test/smoke.mjs` 82 项、`test/panel-render.mjs` 44 项全过；真机页脚出现 `home v4` 即确认新面板已加载。

2026-11-08 面板视觉 taste pass（控制台场景）：

- Design read：DSH 产品控制台，面向工程用户，calm utilitarian 语言，沿用 DSH token + 原生 CSS，不引入营销页设计系统。
- Dials：VARIANCE 4 / MOTION 3 / DENSITY 6。只保留 hover、focus、状态切换反馈，不做滚动编排。
- 应用：取消全站 uppercase tracking 微标签；section 标签改 11.5/600，tile 标签改 10.5/550；状态行去掉装饰点、改用 1px 分隔线并移除重复的 pack 名；缺失值统一 `-`；隐私与通知去掉点链；placeholder 对比度补齐。
- 不套用：design-taste-frontend 中面向 landing / portfolio 的规则（hero、logo wall、图片策略、marquee、section 节奏）不适用于 dashboard/admin 面板；只取 anti-slop 的排版、对比度、交互态、主题与形状纪律。
- 形状规则：容器 12、控件 8、胶囊 999、徽标 999（badge 当前为胶囊）；圆角不再临时混用。
- 2026-11-08 间距/对齐修正：统一一条左缘（标题、section、规则、技能、评审同一条线）；标题 26、规则题 14、正文 13/1.7、技能名 12.5；规则行 50px、技能行 42px；区块间距 36；全量评审状态折进 section header，减少一段沉底摘要。

## 隐私约束

- 只读本机已有会话与日志，不联网、不上传。
- 蒸馏只输出聚合统计（数量、比例、关键词计数），不落盘 prompt 原文。
- 状态、报告、导出包全部留在 `$DSH_HOME/workstyle/`。

## 验证方式

- `test/smoke.mjs`：146 项检查（工具 / 路由 / 命令 / 规则与技能启停 / 采纳与撤销 / 导出 tar 往返 / lossless JSON）；另有 panel-render 115 项、multipage-render 97 项。
- `test/panel-render.mjs`：44 项渲染检查（状态、搜索、筛选、启停、折叠/展开、分发、构建标记、无营销文案、样式作用域）。
- 隔离实例：`dsh --profile web --patch <patch.yml>` + 临时 `DSH_HOME`，Chrome headless CDP 截图验证面板。
- 真实环境：重启 DeepSeek Harness 后实测面板与工具（本地 link 安装的插件必须重启才加载）。
