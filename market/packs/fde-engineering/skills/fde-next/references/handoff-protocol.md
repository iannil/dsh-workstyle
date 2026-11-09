# fde-next 交接协议 / Handoff Protocol

`detectResumePoint` 返回的判决里有 `handoff` 字段，决定 fde-next 怎么把控制权交给下游。本文逐种 handoff 给出确切指令。交接前按 mode 输出主技能的状态诊断报告；已有执行/继续授权直接交接，各模式仅输出详略不同。交接时把同一 `--mode` 透传给下游。

## 通用前置

1. 读取判决（`node skills/fde-next/references/detect-resume.js [dir]` 或照 SKILL.md 决策表手判）。
2. 校验 `git rev-parse HEAD` 与 `job.state.json.checkpoint.last_commit`：偏差先核对工作树、产物和验证适用性，不因 HEAD 不同自动询问或重跑。
3. 继承 CONTEXT.md / REQUIREMENTS.md 的短委托约定引用（成果、完成标准及来源、不可妥协项、授权取舍、决策权限）及 checkpoint 的未解问题、已尝试、下一动作。只读并转交，不建新账本。
4. 按 mode 输出详略直接交接。只对真实价值取舍/授权缺口升级，给事实、已尝试、推荐及代价、需要决定的事项和仍可继续任务。普通继续不授权 commit/stash/发布，也不重新确认已授权动作。

## reinvoke-job-workflow（场景 1a / 1c / 6a / 7）

重调 `fde-job` 的 Workflow，**复用它已有的阶段跳过与自愈**，不在 fde-next 里重做。

- **1a/1c（接续型）**：判决里的 `reconstructed_args` 已从 `job.state.json` + `project-metadata.json` 重建好（mode/projectName/requirements/skip_*）。
- **6a/7（全新型）**：`reconstructed_args.requirements` 为空——**先从用户本次输入补全 requirements**；若用户没给，按 auto/silent 交由 fde-job 问最少问题。开工前若需求文本明显是纯后端/CLI，可把 `skip_frontend`/`skip_poc` 设 true（参照 `fde-job/references/detection-logic.js` 的 `detectComplexity`）。

调用形式：

```javascript
Workflow({
  scriptPath: "skills/fde-job/run.wf.js",
  args: {
    requirements: "<reconstructed_args.requirements 或用户输入>",
    mode: "<reconstructed_args.mode>",
    projectName: "<reconstructed_args.projectName>",
    skip_requirements: <bool>,
    skip_frontend: <bool>,
    skip_poc: <bool>,
    stop_at_poc: <保留已有约定的布尔值>,
  }
})
```

Workflow 工具不可用时，退回 fde-job 的"手动子代理调度"模式，按相同 args 启动。

## route-orchestrator（场景 1b / 2 / 3）

把控制权交给 `fde-orchestrator` 的恢复流程。**不要重调 fde-job 的 Workflow**——job 在 development 阶段会把里程碑状态初始化为全 TODO 重跑已完成里程碑，orchestrator 才有里程碑级恢复（读 `.agents/progress.json`）。

启动指令（向 orchestrator 下发）：

```markdown
继续项目 [名称] 的开发。蓝图：CONTEXT.md（当前目录）。从下一个 TODO 里程碑继续：
读取 .agents/progress.json（或 job.state.json.development.features）确定断点；
核对工作树与已有验收的适用性，补必要测试基线；从未完成任务及必需集成缺陷接续 workflow。
继承 [委托约定章节引用]、[未解问题/已尝试/下一动作]。缺结果为未验证，修复后复验，不按失败次数重建或删减需求。
[有 CONTEXT-MAP.md 时] 这是多模块项目，按 CONTEXT-MAP.md 的开发顺序编排。
```

## route-architect（场景 4）

仅有 `REQUIREMENTS.md`，路由 `fde-architect` 产出 `CONTEXT.md`：

```markdown
读取当前目录的 REQUIREMENTS.md，生成完整 CONTEXT.md 蓝图（系统概览/技术栈/数据模型/API 契约/里程碑依赖树/词汇表）。
完成后交回 fde-next（或直接由 orchestrator 接续开发）。
```

## route-architect-reverse（场景 6b）

零 fde* 产物且代码体量大（外来项目）。遵守"无蓝图不开工"——**先逆向建模，再继续**，不在无蓝图代码上直接开干。

```markdown
这是已有大量代码但无 fde* 产物的外来项目。执行逆向分析：
1. 扫描现有文件结构与代码，推断技术栈、数据模型、API、模块边界。
2. 生成 REQUIREMENTS.md（从代码反推的角色/功能/状态机）与 CONTEXT.md（既有代码作为地基）。
3. 诚实标注哪些是"明示/observed"、哪些是"推断/inferred"、哪些是"缺口/gap"（先检查可取得证据，真实取舍/授权缺口才问用户）。
完成后交回 fde-next，按场景 3 路由 orchestrator 接续开发。
```

## route-requirements（场景 5）

只有 `project-metadata.json`（脚手架已就绪），路由 `fde-requirements` 做需求拆解（产出 REQUIREMENTS.md）。若项目明显简单（单功能/CRUD），可直接路由 `fde-architect` 一步出 CONTEXT.md。

## report-complete（场景 1d）

`job.state.json` 全阶段 DONE 只是候选。核对约定范围、产物、必需验收与当前代码；缺证据交 fde-qa，真实缺陷交 workflow/orchestrator 修复并复验。全部必需项已满足才报告完成，可未提交；发布与线上确认另按证据记录。

## report-blocked（场景 1e）

某阶段 BLOCKED：携带根因、已尝试、证据与下一动作交对应技能诊断修复，必要时 advisor 辅助。所有必需集成缺陷无论数量都修复复验，独立任务继续。只有真实价值取舍或授权缺口才升级；不自动等待用户兜底，不以跳过或 happy path 冒充完成。

## 参数重建对照表（reconstructed_args）

| 参数 | 接续型(1a/1c)来源 | 全新型(6a/7)来源/兜底 |
|:--|:--|:--|
| mode | jobState.mode | 用户指定 / normal |
| projectName | jobState.project → metadata.project.name → cwdName | 同左兜底链 |
| requirements | metadata.project.description + features 拼接 | 用户本次输入 / 空（交 job 询问） |
| skip_requirements / skip_frontend / skip_poc | metadata 的 skip_*/has_frontend | 默认 false（交 job 自检测） |
| stop_at_poc | 从现有请求/约定恢复，不擅自扩大 POC 范围 | 用户请求决定；未要求停 POC 时 false |

参数重建是候选：若检测器未恢复 stop_at_poc 等既有决定，由调度方在传入前按约定校正，不能把默认值当作用户新授权。无需新增判决 schema 字段。
