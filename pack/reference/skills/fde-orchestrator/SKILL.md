---
name: fde-orchestrator
description: >
  AI项目编排引擎 — 基于"实现规划"方法论，接收完整的项目蓝图（CONTEXT.md），
  自动分解为功能级任务，按依赖顺序逐一调用 fde-workflow 执行，
  管理跨功能集成验收、上下文重置和进度持久化。
  比 fde-workflow 更进一步：workflow 管一个功能，orchestrator 管整个项目。
  ROUTING RULE: 若用户要"从零做一个完整项目"且尚无 CONTEXT.md 蓝图，请改触发 fde-job（它负责脚手架+架构+全链路）。本技能仅在蓝图已就绪时接管多功能编排。
  TRIGGERS: 用户说"开始做这个项目""完整实现""启动项目""全功能开发"
  "build the whole project""全部实现""把所有功能做完""项目整体开发"
  "start the project""implement everything" — 当蓝图（CONTEXT.md）已就绪，
  且用户表达的是完成多个功能/整个项目的意图时触发。
  也触发于：用户刚完成 architect 设计后说"开始做吧""开始开发"。
  此 skill 应比 fde-workflow 优先触发当有多个功能需要实现时。
metadata:
  compatibility: "bash, write, edit, read"
---

# fde-orchestrator — AI 项目编排引擎 / AI Project Orchestrator

> **来源声明**: 本 skill 的方法论来源于《基于实现规划的 AI 辅助编程实战》。更多内容请访问 [zhurongshuo.com]。
>
> **Source**: The methodology of this skill originates from "AI-Assisted Programming Practice Based on Implementation Planning". Visit [zhurongshuo.com] for more context.

---

## 🎯 核心理念 / Core Philosophy

如果把 AI 编码比作盖楼：

| 角色 | 对应技能 | 职责 |
|------|---------|------|
| **建筑师** | fde-architect | 画好设计图纸（蓝图） |
| **包工头** | fde-orchestrator | 安排施工进度、协调各队、检查质量 |
| **施工队长** | fde-workflow | 带一小队人砌一堵墙 |
| **监理** | fde-inspector | 验收每堵墙是否符合图纸 |
| **顾问** | fde-advisor | 出问题了给建议 |

**fde-workflow 擅长盖一堵墙。fde-orchestrator 擅长盖整栋楼。**

> **fde-workflow builds one feature. fde-orchestrator builds the whole project.**

### 三条核心原则

#### 原则一：功能即任务 / Features Are Tasks

对 orchestrator 来说，最小的执行单元不是"代码行"或"文件"，而是**一个完整的功能**。每个功能由 fde-workflow 以"全自动工作流"的方式完成。

Orchestrator 只问三个问题：
1. 这个功能依赖哪些前置功能？（**依赖排序**）
2. 这个功能验收通过了吗？（**质量门禁**）
3. 这个功能完成后，整体项目集成测试通过吗？（**集成验证**）

#### 原则二：进度即状态 / Progress Is State

Orchestrator 管理跨会话的项目状态。每次上下文重置后，能从持久化记录中恢复进度。

进度状态机：
```
待办(TODO) → 进行中(IN_PROGRESS) → 已完成(DONE)
                                    ↘ 阻塞(BLOCKED)
```

关键规则：**功能验收与必需集成验证均通过才能标记 DONE。结果缺失或证据不适用属于未验证；修复后复验。DONE 不要求已提交。**

#### 原则三：集成即红线 / Integration Is the Red Line

每个功能单独验收通过后，orchestrator 必须做**跨功能集成检查**：
- 功能 A 的 API 输出是否能被功能 B 正确消费？
- 功能 A 新增的数据模型是否和功能 B 的兼容？
- 整体测试是否通过？

**单个功能没问题 ≠ 整个系统没问题。**

---

## 🚦 触发条件 / When to Trigger

**必须触发**此 skill 当以下条件满足：

**直接触发：**
- 用户说"开始做这个项目"、"完整实现"、"启动项目"
- "把所有功能都做了"、"项目整体开发"
- "build the whole project"、"start the project"
- "implement everything"、"complete all features"
- "全功能开发"、"全部实现"

**链式触发（来自其他技能）：**
- fde-architect 完成蓝图后，用户说"开始做吧"、"开始开发"
- CONTEXT.md 已存在且包含多个未完成的里程碑，用户说"继续"、"接着做"

**不触发**（这些交给 workflow）：
- "实现登录功能"（单个功能的实现）
- "帮我写一个 API"（单个操作）

**触发优先级判断**：

```
1. 检查 CONTEXT.md 是否存在且含多个里程碑
2. 检查是否有多个未完成的功能（里程碑 > 1）
3. 如果只有一个未完成的功能 → 直接转 fde-workflow
4. 如果有多个未完成的功能 → 触发 orchestrator
```

---

## ⚙️ 模式选择 / Mode Selection

`--mode` 仅控制输出详略，默认 normal。用户已授权执行或继续时直接推进，模式不改变权限。

| 模式 | 输出 |
|:----:|------|
| normal | 计划、里程碑进展与验证结果 |
| auto | 关键进展与结果摘要 |
| silent | 简短结果和必要阻塞说明，保留验证证据 |

各模式都诊断、修复并复验必需失败项，继续不受影响的任务；不能自动缩需求、仅保留 happy path 或跳过后宣称完成。普通开发不授权提交、stash、破坏性重置或发布。

启动与恢复均读取 CONTEXT.md / REQUIREMENTS.md 的简短委托约定：成果、完成标准及来源、不可妥协项、授权取舍、决策权限。委托只传引用与差量。checkpoint 复用现有摘要/next_action 保存该引用、未解问题、已尝试及结果和下一动作，不建新账本。

---

## 🏗️ 编排工作流 / Orchestration Workflow

```mermaid
graph TD
    START["加载项目蓝图<br/>Load CONTEXT.md"] --> A
    
    subgraph "阶段一：编排规划 / Phase 1: Plan"
        A["① 解析功能依赖图<br/>Parse feature DAG"] --> B["② 制定执行顺序<br/>Determine execution order"]
        B --> C["③ 创建进度跟踪器<br/>Create progress tracker"]
        C --> D["④ 说明计划并按已有授权推进"]
    end
    
    subgraph "阶段二：逐功能执行 / Phase 2: Execute"
        D --> E{"还有下一个功能？<br/>Next feature?"}
        E -->|"✅ 有"| F["⑤ 加载功能上下文<br/>Load feature context"]
        F --> G["⑥ 调用 fde-workflow<br/>Invoke workflow"]
        G --> H{"workflow 结果？<br/>Result?"}
        H -->|"✅ 成功"| I["⑦ 跨功能集成验收<br/>Integration check"]
        H -->|"❌ 失败"| J["⑧ 记录阻塞原因<br/>Log block reason"]
        J --> K["诊断与定向修复；真实取舍/授权缺口才升级"]
        K -->|"调整后重试"| G
        K -->|"独立任务可继续，阻塞项仍未完成"| E
        I -->|"✅ 集成通过"| L["⑨ 标记完成 & 更新进度<br/>Mark done & update progress"]
        I -->|"❌ 集成失败"| M["记录集成问题<br/>Log integration issue"]
        M --> K
        L --> N{"对话健康度检查<br/>Context health check"}
        N -->|"🟢 正常"| E
        N -->|"🟡 对话过长"| O["⑩ 保存工作树与交接上下文"]
        O --> P["恢复进度<br/>Restore progress"]
        P --> E
    end
    
    E -->|"❌ 没有"| Q["阶段三：收尾 / Phase 3: Finalize"]
    Q --> R["⑪ 项目集成测试<br/>Full integration test"]
    R -->|"通过"| S["⑫ 实际交付报告"]
    R -->|"失败或缺证据"| K
```

---

## 📁 跨技能进度持久化 / Cross-Skill Progress Persistence

### 双文件方案

orchestrator 新增对 `.agents/job.state.json` 的支持，用于跨技能、跨会话的进度追踪。

#### 文件 1：`.agents/job.state.json` — 机器可读完整状态

```json
{
  "project": "<project_name>",
  "job_version": "2.0",
  "mode": "auto",
  "phases": {
    "init": { "status": "DONE" },
    "architect": { "status": "DONE" },
    "development": {
      "status": "IN_PROGRESS",
      "skill": "fde-orchestrator",
      "features": {
        "M1": { "name": "...", "status": "DONE", "commits": "abc..def", "rebuild_count": 0, "degraded": false },
        "M2": { "name": "...", "status": "IN_PROGRESS" }
      }
    },
    "finalize": { "status": "TODO" },
    "deploy": { "status": "TODO" }
  },
  "checkpoint": {
    "last_commit": "def456",
    "last_phase": "development",
    "next_action": "continue milestone M2",
    "session_summary": "CONTEXT.md 委托约定；M1 已验收；M2 未解问题及已尝试见其摘要，下一步补验；工作树保留。"
  }
}
```

**状态值**：`TODO` / `IN_PROGRESS` / `DONE` / `BLOCKED` / `SKIPPED`

#### 文件 2：`.agents/job.progress.md` — 人类可读追加账本

追加格式，每行一个事件：
```
[10:25] ✅ M1: data-model — commits abc..def, 3 files, 2 tests
```

#### 与现有 progress.json 的兼容

- `job.state.json` **新增**，覆盖完整生命周期
- `progress.json` **保留**，内容被 `job.state.json.development.features` 吸收
- **检测优先级**：`job.state.json` → `progress.json` → 从用户问起

### 跨会话恢复流程

当 orchestrator 检测到 job.state.json 存在时，执行恢复流程：

1. **读取 job.state.json** → 确定当前阶段和下一个动作
2. **验证 git 状态** → 运行 `git log --oneline -3`，与 `checkpoint.last_commit` 比对
3. **运行测试** → 确认现有代码的状态正常
4. **读取 CONTEXT.md** → 获取最新的蓝图状态
5. **生成恢复报告** → 展示当前进度和下一个动作

**恢复报告模板**：

```markdown
## 🔄 项目进度恢复 / Project Recovery

检测到 job.state.json，从持久化文件恢复进度：

**项目**: [名称]
**阶段**: development（M1 完成，M2 待开始）
**上次验证的 commit**: [hash]

### 已完成
1. ✅ M1: data-model — 3 files, 2 tests

### 待完成
2. [ ] M2: article-crud

### 恢复操作
1. git 状态验证: [hash] matches ✅
2. 测试运行: [N/N 通过] ✅
3. 从 M2 继续...
```

---

## 阶段一：编排规划 / Phase 1: Orchestration Plan

### 第一步：解析功能依赖图 / Parse Feature DAG

从 CONTEXT.md 中提取"已固化的结构里程碑"列表和技术栈信息。

```markdown
## 📋 项目全景分析 / Project Analysis

**项目**: [从 CONTEXT.md 读取]
**技术栈**: [从 CONTEXT.md 读取]

### 词汇表检查 / Glossary Check

在开始编排前，先检查 CONTEXT.md 词汇表是否完整可用：

- [ ] 词汇表章节存在，核心术语已定义
- [ ] 所有里程碑的名称与词汇表术语一致（名称中使用的业务名词在词汇表中都有定义）
- [ ] 跨里程碑的相同概念使用了相同的术语

如果词汇表缺失或不完整，**建议先调用 fde-architect 补全词汇表后再编排**。

### 设计方向检查 / Design Direction Check

如果项目包含前端里程碑，检查设计方向是否已确立：

- [ ] CONTEXT.md 包含"前端设计方向"章节
- [ ] 设计基调、色彩、排版已定义
- [ ] 所有前端里程碑的计划与设计方向不冲突

如果缺少设计方向但有前端功能，**建议先调用 fde-architect 补充设计方向**。前端代码在缺少设计纲领的情况下编写，后续一半以上的 CSS 需要重写。

### 多模块检查 / Multi-Module Check

在解析功能依赖图之前，检查是否存在 `CONTEXT-MAP.md`：

- [ ] 如果存在 → 这是多模块项目。按 CONTEXT-MAP.md 中定义的"开发顺序"字段确定模块执行顺序
- [ ] 如果不存在 → 单模块项目，正常解析 CONTEXT.md 中的里程碑

**多模块编排流程**（仅当 CONTEXT-MAP.md 存在时）：
1. 读取 CONTEXT-MAP.md，获取模块列表和依赖关系
2. 按依赖顺序逐个模块编排（每个模块执行完整的 orchestrator 流程）
3. 跨模块集成测试在最后一个模块完成后执行
4. 最终报告汇总所有模块的完成状态

### 里程碑清单 / Milestone List

提取 CONTEXT.md 中的里程碑，构建依赖关系图：

| # | 里程碑 | 描述 | 术语对齐 | 依赖 | 状态 |
|:-:|--------|------|:--------:|:----:|:----:|
| M1 | [名称] | [描述] | 术语已定义 | 无 | [ ] / [✅] |
| M2 | [名称] | [描述] | 术语已定义 | M1 | [ ] / [✅] |
| M3 | [名称] | [描述] | ⚠️ 新术语"Refund"未在词汇表中 | M1 | [ ] / [✅] |
| ... | ... | ... | ... | ... | ... |

### 依赖图

```mermaid
graph LR
    M1 --> M2
    M1 --> M3
    M2 --> M4
    M3 --> M4
```

### 已完成 / Already Done
- [里程碑列表] — 已完成的里程碑（CONTEXT.md 中标记为 ✅ 的）

### 待完成 / Pending
- [里程碑列表] — 需要执行的里程碑
```

### 第二步：制定执行顺序 / Determine Execution Order

基于依赖图确定执行序列。**拓扑排序**——只有所有依赖完成后才能执行当前功能。

**并行预判**（可选）：如果有独立的里程碑分支（如 M2 和 M3 都只依赖 M1），可以并行调用两个 workflow。但要保守——只在依赖路径完全没有交叉时才并行。

**执行序列输出**：

```
批次 1（可并行）: M1
批次 2（依赖 M1）: M2 → M3（无交叉依赖，可并行）
批次 3（依赖 M2, M3）: M4
批次 4（依赖 M4）: M5
```

### 第三步：创建进度跟踪器 / Create Progress Tracker

创建一个 `.agents/progress.json` 文件用于跨会话进度持久化。这个文件是 orchestrator 在上下文重置后的"锚点"——它记录了一切在重置后恢复所需的信息。

**进度文件必须在每次功能完成、每次上下文重置前更新**。不允许跳过更新。

```json
{
  "project": "[项目名]",
  "blueprint_version": "1.0",
  "progress": {
    "total_features": 5,
    "completed": 0,
    "blocked": 0
  },
  "checkpoint": {
    "last_git_commit_hash": "[从 git rev-parse HEAD 获取]",
    "last_git_commit_message": "[最近的 commit message]",
    "last_verified_commit_hash": "[上次通过验收的 commit hash]"
  },
  "features": {
    "M1": {
      "name": "[里程碑名称]",
      "status": "TODO",
      "dependencies": [],
      "workflow_result": null,
      "integration_issues": [],
      "completed_at": null,
      "summary": null
    },
    "M2": {
      "name": "[里程碑名称]",
      "status": "TODO",
      "dependencies": ["M1"],
      "workflow_result": null,
      "integration_issues": [],
      "completed_at": null,
      "summary": null
    }
  },
  "context": {
    "last_session_date": "[日期]",
    "last_session_summary": "上一次对话完成了 [功能X]，还剩下 [功能Y, Z] 待完成。注：对话约 18 轮时重置，AI 输出质量开始下降。",
    "total_rounds": 0,
    "last_feature": null,
    "next_action": "启动 [下一个功能名] 的 fde-workflow"
  }
}
```

**状态值**：
- `TODO` — 未开始
- `IN_PROGRESS` — 正在执行
- `DONE` — 已完成并通过集成验收
- `BLOCKED` — 必需项未完成或证据不足，需诊断接续；不自动等同用户介入
- `SKIPPED` — 用户选择跳过

### 第四步：说明计划并推进

按 mode 的详略展示执行批次、依赖和风险，已授权开发直接进入首个可执行任务。只有计划涉及真正的价值取舍或授权缺口才升级：给出事实、已尝试、推荐方案及代价、具体待决定事项、仍可继续任务；不要将“是否开始/继续”作为固定门禁。

---

## 阶段二：逐功能执行 / Phase 2: Execute Features

### 第五步：加载功能上下文 / Load Feature Context

在启动 fde-workflow 之前，准备该功能的专属上下文：

1. **检查依赖是否已全部完成** — 如果有依赖未完成，跳过该功能（标记为 BLOCKED）
2. **加载 CONTEXT.md** — 确保蓝图是最新的
3. **准备功能描述** — 从蓝图提取该里程碑的具体描述
4. **检查进度持久化** — 如果是恢复的会话，从 progress.json 加载最新状态

### 第六步：调用 fde-workflow / Invoke Workflow

向 fde-workflow 下发指令，格式如下：

```markdown
## fde-workflow 启动指令 / Workflow Launch Command

**功能**: [里程碑名称]
**蓝图文件**: CONTEXT.md（当前目录）

### 功能描述

[从蓝图复制的里程碑描述和验收重点]

### 约束条件

1. 请遵循工程方法论的标准六步流程
2. 验收标准已在蓝图中定义，请对照执行
3. 不可触碰的地基：
   - [来自蓝图的红线列表]
4. 完成后更新 CONTEXT.md 与验收证据；有明确提交授权才提交，否则保留工作树
5. 委托约定：[CONTEXT.md / REQUIREMENTS.md 章节引用]；继承成果、完成标准来源、不可妥协项、授权取舍和决策权限
6. 返回实际成果、验证结果、未解问题、已尝试及下一动作；缺结果是未验证
```

**执行方式**（按可用性优先级）：
1. **子 Agent 执行** — 使用 Agent 工具创建子代理运行 workflow，主会话保持干净
2. **工作区隔离** — 对高复杂度功能，使用 git worktree 隔离开发
3. **当前会话** — 如果功能很小且对话健康，直接在对话中执行

**默认串行**；只有满足下方并行条件时才并行，分别指定文件边界并统一集成验收。

### 第七步：跨功能集成验收 / Cross-Feature Integration Check

fde-workflow 完成单个功能后，orchestrator 不能只是"哦好，下一个"。必须做跨功能检查。

**检查清单**：

```markdown
## 🔗 跨功能集成验收 / Integration Check

**新完成功能**: [里程碑名称]
**依赖的功能**: [依赖列表]
**被依赖的功能**（受影响）: [列表]

### 1️⃣ API 兼容性检查

| 检查项 | 预期 | 实际 | 结果 |
|--------|------|------|:----:|
| 新增 API 路径是否按蓝图定义 | [路径] | [实际路径] | ✅/❌ |
| 已有 API 响应格式是否变化 | [格式] | [实际格式] | ✅/❌ |
| 新功能调用的依赖 API 是否可用 | [是] | [是] | ✅/❌ |

### 2️⃣ 数据模型兼容性检查

| 检查项 | 结果 |
|--------|:----:|
| 是否修改了其他功能的底层表结构 | ✅ 无 / ❌ [详情] |
| 新增表是否与其他功能已有表有命名冲突 | ✅ 无 / ❌ [详情] |
| 数据库迁移脚本是否可安全回滚 | ✅ / ❌ |

### 3️⃣ 术语一致性检查

| 检查项 | 结果 | 说明 |
|--------|:----:|------|
| 新功能引入的命名是否遵循词汇表？ | ✅ 合规 / ⚠️ 不一致 | [如应使用 Order，实际使用了 Trade] |
| 新功能是否引入了未定义的领域概念？ | ✅ 无 / 📝 新概念: [术语] | [建议补充到词汇表] |
| 跨功能是否存在同义术语混用？ | ✅ 一致 / ⚠️ 混用 | [如 M2 用 Customer，M3 用 Client] |

**行动**:
- ⚠️ 发现不一致：记录到 integration_issues，在启动下一个功能前先统一术语
- 新概念：按现有需求补齐词汇表；只有业务含义存在真实取舍才向用户升级。

### 4️⃣ 项目级红线检查

| 红线 | 结果 |
|------|:----:|
| [红线1] | ✅/❌ |
| [红线2] | ✅/❌ |

### 5️⃣ 项目编译/构建检查

```bash
# 运行编译检查
[项目相关命令，如 go build / npm run build / cargo check]
```

### 6️⃣ 项目测试运行

```bash
# 运行所有测试
[项目测试命令]
```

| 检查项 | 结果 |
|--------|:----:|
| 新增功能测试是否全部通过？ | ✅ / ❌ |
| 已有功能测试是否被破坏？ | ✅ 无破坏 / ❌ [测试数] |
| 总体测试数 | 通过 N / 总 N |

### 判断

| 结果 | 行动 |
|:----:|------|
| ✅ 全部通过 | 进入第九步（标记完成） |
| 必需项失败（不论大小/数量） | 记录根因、修复并复验失败项及受影响集成范围；未通过前不标 DONE |
| 缺少/过期/无法解析的验证结果 | 保持非完成并记录未验证，补证据；实际缺陷继续修复复验 |
| 非必需优化建议 | 明确不影响完成标准后记录建议，不混入必需缺陷 |
```

### 第八步：记录阻塞原因 / Log Block Reason

若 workflow 返回失败、无有效结果或集成未通过，先分类为实现缺陷、环境问题或验收器问题。每次重试带新证据或具体修正；无进展时换诊断路径、细分任务或交 advisor，不按失败次数自动重建或要求用户兜底。

1. 在现有 issues/summary 中记录未完成项、证据、已尝试及结果和下一动作。
2. 在授权内修复后复验原失败项及受影响范围；全部必需集成缺陷都进入修复队列，包括仅 1–3 个问题。
3. 不能推进的任务保留 BLOCKED，继续独立任务。阻塞不等于跳过或完成。
4. 只有真实价值取舍或授权缺口才询问用户，附事实、已尝试、推荐及代价、需要决定的具体事项及仍可继续任务。mode 不改变此规则。

### 级联取消逻辑 / Cascade Cancel Logic

当一个里程碑被标记为 `BLOCKED` 或 `SKIPPED` 后，自动执行以下级联处理（参考 `fde-orchestrator/references/cascade-failure.md`）：

1. **识别受影响的下游** — 扫描依赖图，找出所有直接或间接依赖本里程碑的任务
2. **按依赖类型处理**：
   - **hard 依赖**（默认）→ 自动标记为 `BLOCKED`（在原因中标记 cascade），记录根因里程碑 ID
   - **soft 依赖** → 保留 `TODO` 状态，标注"上游 [里程碑ID] 已阻塞"
3. **更新依赖树状态** — 在 progress.json / job.state.json 中标记所有级联阻塞的任务
4. **生成级联摘要**（追加到当前错误报告末尾）：

```markdown
### 级联影响 / Cascade Impact

[BLOCKED/SKIPPED 里程碑] ─[hard/soft]──→ [受影响里程碑] → [受影响里程碑状态]

**总计**: N 个里程碑受级联影响
```

**依赖调整**：必须先证明替代方案满足依赖契约。改变产品范围需已有授权；仅修改 hard/soft 标签不能让缺失依赖变为可用。上游修复后逐项复核其他依赖和自身失败再解除级联阻塞。

### 第九步：标记完成 & 更新进度 / Mark Done & Update Progress

功能通过集成验收后，**立即更新进度文件**——这是跨会话恢复的关键：

1. **更新 progress.json** — 标记为 DONE，记录完成时间、变更摘要、当前 git commit hash（从 `git rev-parse HEAD` 获取）、以及 `last_session_summary`（简要描述本轮对话做了什么、遇到什么问题、建议下一步怎么做）
2. **更新 CONTEXT.md** — 将该功能在"已固化的结构里程碑"中标记为 `[✅]`
3. **更新 checkpoint** — 对已提交且验证过的版本记录 `last_verified_commit_hash`；工作树验证另在现有摘要记录差异范围与证据，不把旧 HEAD 当作新改动已验证。继承委托约定引用、未解问题、尝试与下一动作
4. **输出进度摘要**：

```markdown
## ✅ 功能完成 / Feature Complete

**功能**: [名称] | **状态**: ✅ 通过集成验收
**变更**: +N / -M 行
**workflow 内部重建次数**: N
**集成验收**: ✅ 通过

### 进度更新

`[████░░░░░░] 2/5 完成`

**已完成**:
1. ✅ [功能1]
2. ✅ [功能2] ← 刚完成

**进行中（下一个）**:
3. [ ] [功能3]

**待完成**:
4. [ ] [功能4]
5. [ ] [功能5]
```

### 第十步：保存与接续上下文 / Save & Resume Context

对话健康度检查发生在每个功能完成后。基于检查结果决定是否重置上下文。

各模式都先保存工作树和接续记录。上下文交接不以提交、stash 或全部验收通过为前提；未完成状态如实保留。轮数只是诊断信号，不自动触发重建。

**健康度检查标准**（与 fde-advisor 一致）：

| 指标 | 🟢 健康 | 🟡 注意 | 🔴 需要重置 |
|------|---------|---------|------------|
| 对话轮数 | <10 轮 | 10-20 轮 | >20 轮 |
| AI 质量 | 输出稳定 | 偶有偏差 | 开始兜圈子 |
| 功能完成数 | <3 个功能 | 3-5 个功能 | >5 个功能 |

**重置步骤**：

```markdown
## 🔄 上下文重置 / Context Reset

当前对话已进行 [N] 轮，已完成 [N] 个功能。建议重置上下文以保持 AI 输出质量。

### 重置前保存

已有提交授权时提交本轮文件；否则保存工作树与接续记录，不要求为重置对话而新增提交授权。

```bash
git add -- <已审查且属于本轮的文件路径>
git commit -m "feat: [刚完成的功能名] — [描述]"
```

### 词汇表同步

重置前确保 CONTEXT.md 的词汇表已同步：
- 新引入的术语已添加
- 有冲突的定义已解决
- 跨功能的术语用法已统一

这样下一个对话加载蓝图时，所有领域概念都是一致的。

### 重置后恢复

新对话开启后，加载以下文件即可恢复项目上下文：

1. **CONTEXT.md** — 项目蓝图（已更新到最新，含词汇表）
2. **progress.json** — 进度跟踪器（`.agents/progress.json`）
3. 然后调用 orchestrator 并告知："继续项目 [名称] 的开发，下一个功能是 [功能名]"

### 项目级提交纪律

每次上下文交接前必须记录：
- [ ] 当前功能验收结论与证据（含未完成/未验证）
- [ ] 集成验收结论、未解决项及下一动作
- [ ] CONTEXT.md 已更新
- [ ] progress.json 已更新
- [ ] 工作树记录核对：本轮改动与用户原有改动分开记录；已授权的提交只含本轮审查文件

**纪律**: 不允许把接续或保存动作当作验收通过。**验收与未完成状态如实保存；对话接续不以提交为前提。**
```

---

## 阶段三：收尾 / Phase 3: Finalize

### 第十一步：项目集成测试 / Full Integration Test

所有功能完成后，执行全项目级别的整体验证：

1. **编译/构建检查** — 确认整个项目可构建
2. **全面测试运行** — 运行项目的所有测试
3. **全 API 端点检查** — 确认所有接口可访问
4. **完整的集成场景测试** — 按用户主流场景从头跑到尾

```markdown
## 🧪 全项目集成测试 / Full Integration Test

### 1️⃣ 编译检查 / Build Check

```bash
[编译命令]
```

结果: ✅ / ❌

### 2️⃣ 测试运行 / Test Run

```bash
[测试命令]
```

结果: ✅ / ❌
通过: N/N 测试

### 3️⃣ 端到端场景 / E2E Scenario

**场景**: [核心用户场景描述]

| 步骤 | 操作 | 预期结果 | 实际结果 |
|:----:|------|---------|:--------:|
| 1 | [操作] | [预期] | ✅/❌ |
| 2 | [操作] | [预期] | ✅/❌ |
| ... | ... | ... | ... |

### 集成状态: ✅ 全部通过 / ⚠️ 有小问题 / 🔴 严重问题
```

### 第十二步：最终报告 / Final Report

输出实际交付报告；必需项未完成不得使用项目完成结论：

```markdown
# 项目交付报告 / Delivery Report

**结论**：[已完成 / 未完成 / 未验证及原因]

**项目**: [项目名]
**总功能数**: N
**总变更**: +N / -M 行
**总耗时**: N 轮对话
**总重建次数**: N

## 完成清单

| # | 功能 | 状态 | 重建次数 | 集成问题 |
|:-:|------|:----:|:--------:|:--------:|
| 1 | [功能名] | ✅ | N | 无 |
| 2 | [功能名] | ✅ | N | 无 |
| ... | ... | ... | ... | ... |

**完成率**: [N/N] (N%)

## 项目结构 / Project Structure

```
[最终的项目目录树]
```

## 创建的文件 / Files Created

- `[路径]` — [说明]
- ...

## 📖 词汇表最终审计 / Glossary Final Audit

**术语总数**: N

| 术语 | 定义 | 跨功能一致性 | 代码覆盖率 |
|------|------|:-----------:|:----------:|
| [术语] | [定义] | ✅ 所有功能一致 | ✅ 代码中使用标准命名 |
| [术语] | [定义] | ⚠️ M2 和 M3 命名不一致 | 待统一 |
| ... | ... | ... | ... |

**审计结论**: [✅ 术语体系完整/⚠️ 部分术语待统一/🔴 需要整体术语重构]

## 🎨 前端设计一致性审计 / Frontend Design Audit

> 仅适用于包含前端的项目。

| 检查项 | 结果 |
|--------|:----:|
| 设计方向是否贯穿所有前端功能？ | ✅ 一致 / ⚠️ 部分偏离 / ❌ 未遵循 |
| 前端色彩是否按蓝图色板执行？ | ✅ 一致 / ⚠️ 有偏离 |
| 排版是否按蓝图定义执行？ | ✅ 一致 / ⚠️ 有偏离 |
| 整体视觉风格是否统一？ | ✅ 统一 / ⚠️ 部分不统一 |

**建议**: [如果发现不一致，给出修复建议]

## 📄 文档完整性审计 / Documentation Audit

| 文件 | 状态 | 说明 |
|------|:----:|------|
| README.md | ✅ 已更新 / ⚠️ 需要更新 / ❌ 缺失 | 项目安装/运行/功能介绍 |
| CHANGELOG.md | ✅ 已更新 / ⚠️ 需要更新 / ❌ 缺失 | 各功能的变更记录 |
| API 文档 | ✅ 已生成 / ⚠️ 部分缺失 / ❌ 未生成 | 接口定义与使用说明 |
| CONTEXT.md | ✅ 已同步 | 蓝图与代码一致 |
| docs/adr/ | ✅ 完整 / ⚠️ 部分决策未记录 | 架构决策记录 |

**审计结论**: [✅ 文档完整 / ⚠️ 部分缺失 / 🔴 严重缺失]

## 🚀 部署审计 / Deployment Audit

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| Dockerfile | ✅ 已生成 / ❌ 未生成 / ➖ 不需要 | [路径/说明] |
| docker-compose.yml | ✅ 已生成 / ❌ 未生成 / ➖ 不需要 | [路径/说明] |
| CI/CD 配置 | ✅ 已生成 / ❌ 未生成 / ➖ 不需要 | [如 .github/workflows/] |
| 部署方案在蓝图中定义 | ✅ 已定义 / ❌ 未定义 | 部署方案完整性 |
| 构建验证 | ✅ 构建成功 / ❌ 构建失败 / ➖ 未验证 | [编译/构建结果] |

**审计结论**: [✅ 可部署 / ⚠️ 需要修复 / ➖ 无需部署配置 / 📝 建议补充部署方案]

## 未完成 / Not Done

- [如果有跳过的功能或已知问题，列在这里]

## 建议的后续工作

1. **[建议1]** — [说明]
2. **[建议2]** — [说明]

## 最后提醒

1. **CONTEXT.md（含词汇表）已更新到最新状态** — 随时可以开始新功能
2. **验收与提交状态**：[实际结果与证据；未提交是合法交付状态]
3. **文档状态**：[适用文档的实际更新/未完成情况]
4. **部署配置状态**：[实际生成与验证情况；生成不代表发布]
4. **progress.json 已记录最终状态**
5. `docs/adr/` 目录记录了关键架构决策
6. **[如适用] 运行 `[部署命令]` 启动服务**
```

---

## 📁 进度持久化 / Progress Persistence

### progress.json 结构

```
.agents/
├── progress.json    # orchestrator 进度跟踪
├── CONTEXT.md       # 项目蓝图（由 architect 创建，workflow 更新）
```

### 恢复流程 / Recovery Flow

当检测到上下文重置后（用户说"继续"、"接着做"、"恢复进度"）：

```mermaid
graph TD
    A["检测到重建/新对话<br/>New session detected"] --> B["读取 progress.json<br/>Read progress"]
    B --> C["读取 CONTEXT.md<br/>Read blueprint"]
    C --> D["生成恢复报告<br/>Generate recovery report"]
    D --> E["显示当前状态<br/>Show current state"]
    E --> F{"有 BLOCKED 功能？<br/>Blocked features?"}
    F -->|"有"| G["继承根因与已尝试，按授权诊断修复"]
    F -->|"没有"| H["继续下一个 TODO 功能<br/>Continue next TODO"]
    G --> H
```

**恢复报告模板**：

```markdown
## 🔄 项目进度恢复 / Project Recovery

检测到新对话。已从持久化文件中恢复项目进度：

**项目**: [名称]
**完成进度**: N/N 个功能
**上次验证的代码节点**: [git commit hash]（`[commit message]`）
**上次对话摘要**: [从 progress.json context.last_session_summary 读取]

### 已完成

1. ✅ [功能1]
2. ✅ [功能2]

### 待完成

3. [ ] [功能3]
4. [ ] [功能4]

### 阻塞中（原因、尝试、下一动作）

5. ⛔ [功能5] — [阻塞原因]

### 恢复操作

1. **代码状态验证**: 运行 `git log --oneline -3` 确认当前处于正确的 commit
2. **测试验证**: 运行 `[测试命令]` 确认所有已有测试仍通过
3. 按既有授权从 **[下一个可执行任务]** 接续；真实取舍/授权缺口另列具体决定及代价
```

---

## 🧩 与 fde-workflow 的协作 / Collaboration with Workflow

### 职责边界

| 维度 | orchestrator | workflow |
|------|:-----------:|:--------:|
| 管理粒度 | **功能级**（整个登录功能） | **代码级**（数据模型 → API → 测试） |
| 蓝图使用 | 读取并分发 | 逐条对照执行 |
| 验收范围 | 跨功能集成 | 单功能内部 |
| 上下文管理 | 跨会话持久化 | 单会话内管理 |
| 失败处理 | 根因诊断、跨功能修复复验、继续独立任务 | 定向修复复验，不按次数重建 |
| 输出 | progress.json + 实际交付报告 | 工作树成果 + 验收证据 + 更新 CONTEXT.md |

### 调用关系

```
orchestrator（项目级管理）
  └── workflow（功能级执行，每个功能调用一次）
        ├── coach（引导流程，自动化内部使用）
        ├── inspector（验收，检查三大信号）
        └── advisor（重建时决策，workflow 内部判断）
```

### 并行策略

当依赖图允许时（两个功能无共同依赖冲突），orchestrator **可以**并行启动多个 workflow。但默认行为是**串行**——并行只适用于以下条件同时满足：

1. 两个功能的依赖都已全部完成
2. 两个功能修改的文件集合没有重叠
3. 项目不是用 git worktree 管理的（并行修改同一仓库可能冲突）

---

## ⚠️ 边界情况 / Edge Cases

| 场景 | 处理方式 |
|------|---------|
| **CONTEXT.md 不存在** | 不能启动编排。提示："没有找到 CONTEXT.md 蓝图。请先描述你的项目需求，让我调用 fde-architect 为你创建蓝图，然后再开始项目开发。" |
| **CONTEXT.md 中只有一个里程碑** | 直接交 workflow，继承现有执行授权与委托约定 |
| **用户中途说"先做那个功能"** | "当前按照依赖顺序在推进。如果要做 [功能X]，需要先完成它的前置依赖 [功能A, 功能B]。你可以选择：1) 加速完成前置依赖；2) 暂停当前序列，先做其他批次。" |
| **用户说"这个功能不需要了"** | 在 progress.json 中标记为 SKIPPED。从依赖图中移除。如果有功能依赖它，将它们也标记为 BLOCKED 并说明原因。 |
| **用户说"今天先到这"** | "好的，当前进度已保存。CONTEXT.md 和 progress.json 已更新。下次开始新对话时，加载这两个文件并说'继续项目开发'即可恢复。" 保留工作树与恢复记录，不自动 commit 或 stash。 |
| **workflow 连续失败** | 检查已有尝试与新证据，诊断实现/环境/验收器或蓝图问题后修复复验；仅真实取舍或权限缺口升级。 |
| **多个功能的集成问题堆积** | 所有必需 integration_issues 都进入修复复验队列，不设数量门槛；先处理阻塞依赖者，其余可合理批处理，完成报告前必须闭环。 |
| **项目完成但用户想加新功能** | "可以新增功能。请描述需求，我先更新 CONTEXT.md，然后追加到执行队列中。新功能将排在最后，不影响已完成的功能。" |
| **切换技术栈中途** | 先评估受影响范围、可复用成果及迁移代价；只就尚未授权的取舍提出具体决定。 用户确定范围变更后保留历史和工作树，评估可复用成果，更新受影响任务；不自动清空 progress.json。 |
| **用户直接提供完整 CONTEXT.md** | 跳过 architect 阶段，直接解析 CONTEXT.md 中的里程碑，进入编排规划阶段一。 |
