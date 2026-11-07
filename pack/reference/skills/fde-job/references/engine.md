# fde-job 执行引擎参考 / Execution Engine Reference

`run.wf.js` 通过 Workflow 的 `agent()` / `phase()` / `log()` 编排阶段。参数和状态以当前脚本及 `project-metadata.schema.json` 为准，技能间语义见 [skill-protocol.md](skill-protocol.md)。本页不新增状态枚举或必填 JSON 字段。

## 执行与授权

用户已要求执行或继续时，在已有授权内自动推进；`normal` / `auto` / `silent` 只控制输出详略。技术修复、补证据、集成复验无需逐阶段确认；提交、stash、破坏性重置、缩减需求和发布不能从 mode 或普通开发请求推导授权。

每次委托读取 `CONTEXT.md` / `REQUIREMENTS.md` 中的简短委托约定：成果、完成标准及来源、不可妥协项、已授权取舍、可自主决定与需升级的事项。尚无文档时先从用户请求整理，文档创建后落入现有文档，不另建账本。

## 调用

```javascript
Workflow({
  scriptPath: "skills/fde-job/run.wf.js",
  args: {
    requirements: "做一个博客系统，支持文章 CRUD，Python FastAPI + SQLite",
    mode: "auto", // normal（默认）| auto | silent：仅沟通详略
    projectName: "blog-system"
  }
})
```

Workflow 是推荐入口；工具不可用时按同样的约定手动调度子代理。不能因执行器返回空结果、降级产物或已结束就认定交付完成。

| 模式 | 输出 | 失败处理（权限一致） |
|:----:|------|--------------------|
| normal | 计划、阶段进展和结果 | 诊断、修复、复验；真实取舍或授权缺口才升级 |
| auto | 关键进展和结果摘要 | 同上 |
| silent | 简短结果与必要阻塞信息；证据仍需保留 | 同上 |

## 阶段与产物

阶段名称映射以当前执行器为准，勿以文档中的顺序编号重写状态。

| 阶段 | 输入 → 输出 | 验收与恢复 |
|------|-------------|------------|
| init | 用户请求 → 脚手架、project-metadata.json | 修复初始化错误，保护已有文件；缺失必需产物时阻塞依赖阶段 |
| requirements | 请求、metadata → REQUIREMENTS.md | 简单项目可省独立分析阶段，但所有要求仍落入 CONTEXT；失败不能缩成最小需求 |
| architect | 需求、metadata → CONTEXT.md、适用 ADR、metadata 更新 | 核对全部约束；骨架蓝图不能代替完整设计 |
| frontend | 需求、蓝图 → FRONTEND-DESIGN.md | 无前端可不适用；设计失败需修复，不自动替换为最小设计 |
| poc | 前端设计 → POC、POC-MANIFEST.md、POC-FIDELITY.md | 尊重 skip_poc / stop_at_poc 的已有决定；POC 不证明正式后端与真实集成完成 |
| development | 蓝图、设计、POC → 各里程碑代码与进度 | 由 orchestrator 按依赖推进，workflow 交付单功能；失败定向修复 |
| run gate | 当前代码 → 实际 build/test 证据 | 缺结果为未验证；失败修复后重跑受影响检查 |
| integration / finalize | 功能产物 → 跨功能、端到端及约定质量验收 | 每一个必需缺陷都进入修复与复验，不按数量或严重程度豁免 |
| deploy | 已约定部署方案 → 配置及适用验证 | 配置生成与实际发布分别记录；实际发布需要已有授权 |
| report | 当前证据 → 实际交付报告 | 区分已实现、已验收、未完成、已发布与线上已确认 |

复杂度检测的单一真源是 `references/detection-logic.js`，显式 `args.skip_*` 优先。自动检测只是阶段适用性候选；不能据此删去用户明示要求。有前端的 POC 默认策略与参数见主技能。跨阶段结构化信息通过 `project-metadata.json`，需求和授权通过现有文档引用传递。

## 运行与集成门禁

1. 从项目原生配置（Makefile、package.json、pyproject.toml、Cargo.toml、go.mod 等）确定命令；必要时参考 `references/build-commands.json`。
2. 实际执行 build/test，并按需求和风险委托 fde-qa 验证集成及关键用户链路；无 UI 时使用适用的黑盒验证。覆盖率使用项目约定，不新增统一百分比。
3. 记录命令、环境、代码版本或工作树差异、结果和证据位置。空返回、无法解析、缺报告或过期证据都不能默认成功。
4. 定位实现、环境或验收器问题，修复后重新验收原失败项及受影响范围。每次尝试应有新证据或具体改变。
5. 固定重试预算只限制一轮执行，耗尽后重新诊断、拆任务或交接，不触发重建、缩成 happy path、跳过必需项或自动要求用户兜底。无有效下一步时保存未完成状态并推进独立任务。

旧状态 `DOES_NOT_RUN` 表示门禁未通过，报告须区分实际运行失败和未取得证据；不据此声称所有功能都不可用。协议不支持 UNVERIFIED 等细分值时，用已有非完成状态，原因写入现有 summary / issues / errors。

生产就绪检查由交付约定决定，所有 mode 相同。必需项失败阻止对应完成结论；可选优化可列建议。部署配置可包括 Dockerfile、compose、CI 和 `.env.example`，按项目实际需要生成并验证；不凭配置存在宣称可部署或已上线。

## 恢复与 checkpoint

先读取 job.state.json → progress.json → CONTEXT.md 的候选状态，再核对工作树、实际产物和验收证据；读取顺序不是可信度排序。用户当前决定优先，HEAD 变化本身不需要确认。

- DONE：有适用证据才跳过；结果缺失或与当前代码不符则补验，发现缺陷则修复复验。
- BLOCKED：继承根因、已尝试方案和下一动作，在现有授权内诊断接续；只将真正的价值取舍或授权缺口交用户。
- development 未完成：交 orchestrator 恢复里程碑，不重新初始化已完成队列。
- 设计或收尾未完成：确认不会覆盖已有产物后重调 job；保留已有 skip_* 和 stop_at_poc 决定。

checkpoint 复用现有 session_summary / next_action（progress 的 context 摘要亦可）：写入委托约定的文档章节引用、未解问题、尝试及结果、下一动作与仍可继续任务。记录未提交文件和验证范围；commit hash 是定位信息，不是完成条件。没有提交授权时保留工作树，不为恢复而 commit 或 stash。

升级说明应包含：事实与证据、已尝试及失败原因、推荐方案及代价、具体需要用户决定的事项、等待期间仍可继续的任务。无需用户价值判断的工程问题由执行链继续处理。

## 扩展与兼容

新增阶段时同步当前执行器的阶段声明，复用现有结果协议。消费结果先检查结构和必需证据，缺失时保持非完成；禁止 `result?.status || 'DONE'` 这样的成功兜底。不能只依赖子代理自报 DONE，修复后由负责验收的步骤重新检查。

新增字段前核对 schema 与消费者；无法兼容的详细信息放现有摘要/问题字段或文档，不凭本页发明字段。`job.state.json` 和 `progress.json` 的不同字段路径、大小写与版本由各自消费者负责，不直接互相覆盖。
