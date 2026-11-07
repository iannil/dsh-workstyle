# dsh-workstyle 方案与路线图

> 本文是产品方案的可追溯版本，防止跨会话丢失。最后更新：2026-11-08（P1 完成时）。

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

规模化度量看「规则遵守度」：先方案率、改完验证率、未验证宣称完成率、第 1 周 vs 第 4 周趋势（P2 看板）。

## 架构

| 层 | 位置 | 说明 |
| --- | --- | --- |
| Host | `index.js` + `lib/` | 系统提示规则段、skills provider、工具、命令、HTTP 路由 |
| Web | `client.js` | 侧栏入口 + `main` 槽面板（Pack / 规则 / 蒸馏建议 / 技能） |
| 包 | `pack/<id>/`、`$DSH_HOME/workstyle/packs/<id>/` | `workstyle.json` + `skills/**` |
| 蒸馏 | `lib/distill.js` | 只读扫描 Claude Code / Codex / DSH / Pi，只存聚合统计 |
| 导出 | `lib/export.js` | 无依赖 ustar + gzip，导出包可直接分发 |

- 规则注入：`ctx.systemPrompt.section('dsh-workstyle.rules', …)`，文本 = 有效包（含采纳规则）渲染结果。
- 技能：`ctx.skills.registerProvider`，`source: 'bundled'`。
- 工具：`workstyle_status / list / apply / distill / evidence / adopt / export`。
- 命令：`/workstyle status | apply | distill | adopt | undo | export`。
- 路由：`/api/dsh-workstyle/{status,evidence,apply,distill,adopt,unadopt,export}`。
- 持久化：`$DSH_HOME/workstyle/state.json`（当前包 + `adoptions[packId]`）、`reports/`、`exports/`。
- 上架元数据（P3）：`dsh.bundle` + `category: workflow` + PNG 图标 + `screenshots.json`。

## 里程碑

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| P0 | 引擎 + 内置参考包 + `status` / `apply`，插件可装、面板可渲染、工具可用 | ✅ 2026-11-08（commit 9831a62） |
| P1 | 蒸馏器 + 审阅 UI（勾选采纳） + `export` 导出包 | ✅ 代码完成，待重启后真实环境复验 |
| P2 | 采纳看板（先方案率 / 验证率趋势）、报告导出、预设注册、项目模板 `init` | ⬜ |
| P3 | npm 发布、图标 / 截图 / 双语 README、插件市场 PR | ⬜ |

## 隐私约束

- 只读本机已有会话与日志，不联网、不上传。
- 蒸馏只输出聚合统计（数量、比例、关键词计数），不落盘 prompt 原文。
- 状态、报告、导出包全部留在 `$DSH_HOME/workstyle/`。

## 验证方式

- `test/smoke.mjs`：58 项检查（7 工具 / 7 路由 / 命令 / 采纳与撤销 / 导出 tar 往返 / lossless JSON）。
- 隔离实例：`dsh --profile web --patch <patch.yml>` + 临时 `DSH_HOME`，Chrome headless CDP 截图验证面板。
- 真实环境：重启 DeepSeek Harness 后实测面板与工具（本地 link 安装的插件必须重启才加载）。
