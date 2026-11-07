---
name: fde-job
description: >
  【强触发 / Strong trigger】"从零做一个 X" / "build X from scratch" + 完整项目 + 尚无 CONTEXT.md —— 普通开发用这句话即可稳定进入本技能完成无人值守全链路构建。
  ROUTING RULE: 当用户要"从零一气呵成做完整个项目"且尚无蓝图时，本技能是唯一入口；orchestrator/architect/fde-init-project 应让位。
  AI项目全自动构建引擎 — 从零开始自动完成整个项目构建。
  输入简单的需求描述和项目背景，自动执行：
  项目脚手架 → 架构设计 → 多功能编排开发 → 集成验收 → 部署配置生成。
  支持 --auto（摘要）和 --silent（精简输出），模式不改变授权范围。
  TRIGGERS: 用户说"帮我从零做一个""全自动构建""帮我搭建一个完整的"
  "automate project building""full project from scratch""build project auto"
  "做一个完整的""全链路开发""自动从头到尾做一个"
  也触发于：用户在 architect 或 fde-init-project 完成后说"继续""自动做下去"。
  比 fde-orchestrator 更高一级——orchestrator 管项目内功能编排，
  job 管技能间编排（含脚手架和架构设计阶段）。
metadata:
  compatibility: "agent, bash, write, edit, read"
---

# fde-job — AI 项目全自动构建引擎 / AI Project Auto-Build Engine

> **来源声明**: 本 skill 的方法论来源于《基于实现规划的 AI 辅助编程实战》。更多内容请访问 [zhurongshuo.com]。
>
> **Source**: The methodology of this skill originates from "AI-Assisted Programming Practice Based on Implementation Planning". Visit [zhurongshuo.com] for more context.
>
> **参考架构**: superpowers `subagent-driven-development`、`writing-plans`、`verification-before-completion`

---

## 🎯 核心理念 / Core Philosophy

如果把 AI 编码项目比作建一栋楼：

| 角色 | 对应技能 | 职责 |
|------|---------|------|
| **业主** | 用户 | 说"我要一栋楼" |
| **总包工头** | fde-job | 管整个工程从头到尾：先叫测绘队→再叫设计院→再安排施工→最后验收交付 |
| **包工头** | fde-orchestrator | 管施工进度、协调各队、检查质量 |
| **施工队长** | fde-workflow | 带一队人砌一堵墙 |
| **监理** | fde-inspector | 验收每堵墙是否符合图纸 |
| **顾问** | fde-advisor | 出问题了给建议 |

**orchestrator 管项目内功能编排。fde-job 管技能间编排，还管脚手架搭建和架构设计。**

> **orchestrator orchestrates features. fde-job orchestrates skills — and handles scaffolding and architecture too.**

### 三条核心原则

#### 原则一：阶段即子代理 / Phases Are Sub-Agents

每个阶段（Phase）作为一个独立的子代理通过 Agent 工具执行。主会话只做两件事：
1. **读取 job.state.json** — 确定当前阶段
2. **调度子代理** — 启动下一阶段，收集结果

子代理的上下文干净——只包含当前阶段所需的最少信息。这防止了长对话中的质量衰减。

#### 原则二：状态即文件 / State Is Files

所有进度状态写入文件系统，不活在对话上下文中：
- `.agents/job.state.json` — 机器可读的完整项目状态（跨技能、跨会话）
- `.agents/job.progress.md` — 人类可读的追加式进度账本
- `REQUIREMENTS.md` — 需求文档（Phase 1 写入，Phase 2/3 读取）
- `CONTEXT.md` — 项目蓝图（Phase 2 写入，Phase 3/4 读取）
- `FRONTEND-DESIGN.md` — 前端设计文档（Phase 3 写入，Phase 4 读取）

即使整个对话上下文丢失，从这些文件也能完全恢复项目进度。

#### 原则三：诊断修复并保留目标

所有 mode 下都在既有授权内推进：失败先定位实现、环境或验收器原因，修复后复验。必需产物或证据缺失保持未完成，依赖任务不能越过门禁；独立任务可继续。固定失败次数不触发重建、范围降级或强制用户兜底。

在现有 CONTEXT.md / REQUIREMENTS.md 维护简短委托约定：成果、完成标准及来源、不可妥协项、已授权取舍、决策权限。每阶段读取该引用并传递任务差量；checkpoint 复用摘要记录引用、未解问题、已尝试及结果和下一动作，不建新账本。只对真实价值取舍或授权缺口升级，附事实、已尝试、推荐及代价和仍可继续的任务。

---

## 完成状态与发布交接

分别记录已实现、已验收、已发布与线上已确认。部署配置生成不等于部署完成，发布命令成功不等于线上生效。复用项目已有状态结构，未知验收结果保留为未完成；旧状态协议不支持新枚举时在报告中保留详细结论，不写入未经支持的状态值。

用户已授权版本发布时，使用可用的 `fde-release` 处理产物、插件、镜像及下游依赖；无该技能时按项目发布流程完成。普通开发不自动扩大到远程发布。验收依据、命令、配置和结果传给发布步骤，只有版本或风险变化时补验。

mode 仅控制输出详略，不自动授权提交、stash、删除、重置、缩减范围或发布。用户已明确授权的动作不重复确认。

## 🚦 触发条件 / When to Trigger

**必须触发**此 skill 当以下条件满足：

**直接触发：**
- 用户说"帮我从零做一个[项目]"、"全自动构建"
- "帮我搭建一个完整的[项目]"、"做一个完整的[系统]"
- "全链路开发"、"自动从头到尾做一个"
- "automate project building"、"full project from scratch"
- "build project auto"、"build everything from zero"

**链式触发（来自其他技能）：**
- fde-architect 完成蓝图后，用户说"继续"、"自动做下去"
- fde-init-project 完成后，用户说"继续"、"接下来自动化"
- 检测到 CONTEXT.md 中存在未完成的里程碑，用户说"自动做完"

**不触发**（这些交给 orchestrator 或 workflow）：
- "帮我实现这个功能"、"写一个 API"（单功能开发）
- "启动项目"、"开始开发"（已有蓝图下的多功能开发 → orchestrator）

**触发优先级**：
1. 用户描述了一个完整的项目想法但没有任何代码和蓝图 → 触发 fde-job
2. 已经有 CONTEXT.md 且用户说"全部自动完成" → 触发 orchestrator
3. 只有单个功能需求 → 直接触发 fde-workflow

---

## 🏃 快速执行 / Quick Start

触发 fde-job 后，**首要行动**是调用 Workflow 脚本执行适用阶段：

```javascript
Workflow({
  scriptPath: "skills/fde-job/run.wf.js",
  args: {
    requirements: "<用户的需求描述>",
    mode: "auto",              // normal | auto | silent
    projectName: "<项目名>",
    skip_requirements: false,  // 简单项目设为 true
    skip_frontend: false,      // 无前端界面时设为 true
    skip_poc: false,           // 跳过 POC 阶段（默认 false；无前端自动跳过）
    stop_at_poc: false,        // 工程停在 POC，不进入正式实现
  }
})
```

> **这是 fde-job 的主执行路径。** 所有阶段（init → requirements → architect → frontend → orchestrate → integrate → deploy → report）
> 在 Workflow 引擎中自动推进。详情参见 `skills/fde-job/references/engine.md`。
>
> 如果 Workflow 工具不可用，回退到下方"手动子代理调度"模式。

### 快速路演

```
用户: "帮我做一个博客系统"
        │
        ▼
fde-job: Workflow({ scriptPath: "skills/fde-job/run.wf.js", args: { requirements: "...", mode: "auto" }})
        │
        ▼ 按依赖推进适用阶段
        │
    🎉 输出: 交付成果 + 实际验收及未完成报告
```

### 恢复已中断的项目

如果项目中途中断，先读取 checkpoint 和委托约定并核对产物。development 未完成时交 orchestrator 恢复里程碑；设计或收尾阶段才重调 Workflow：

```javascript
// 自动检测 .agents/job.state.json 并恢复进度
Workflow({
  scriptPath: "skills/fde-job/run.wf.js",
  args: { requirements: "...", mode: "auto", projectName: "...", skip_requirements: false, skip_frontend: false }
})
```

仅跳过证据仍适用的已完成阶段。保留已有 skip_* / stop_at_poc 决定，恢复不扩大原任务。

---

## ⚙️ 模式选择 / Mode Selection

通过 `--mode`（Workflow 为 `args.mode`）控制输出详略，默认 normal。已授权执行或继续不再逐阶段确认。

| 模式 | 输出 | 异常时行为 |
|:----:|------|------------|
| normal | 展示计划、阶段进展及结果 | 在授权内诊断、修复、复验；真实取舍/授权缺口才升级 |
| auto | 关键进展及结果摘要 | 同 normal |
| silent | 简短结果与必要阻塞信息，保留证据 | 同 normal |

---

## 🏗️ 八阶段编排工作流 / 8-Phase Orchestration Workflow

```mermaid
graph TD
    A[用户请求与委托约定] --> B[初始化与需求设计]
    B --> C{必需产物已验证?}
    C -->|是| D[按依赖编排里程碑]
    C -->|否| F[诊断与定向修复]
    D --> E[单功能与跨功能验收]
    E -->|失败或缺证据| F
    F --> G{已有授权内可推进?}
    G -->|是| B2[修复或补证据并复验原失败项]
    B2 --> C2{对应验收通过?}
    C2 -->|否| F
    C2 -->|是| D
    G -->|真实取舍或授权缺口| H[保存未完成及升级说明; 继续独立任务]
    E -->|全部必需项通过| I[适用部署配置与验证]
    I --> J[报告实际交付状态]
```

### 阶段总览 / Phase Overview

| 阶段 | 调用技能/职责 | 输入 → 输出 | 失败处理 |
|------|---------------|-------------|----------|
| init | fde-init-project | 请求 → 脚手架 + metadata | 修复；保护已有文件，未完成则阻塞依赖 |
| requirements | fde-requirements | 请求/metadata → REQUIREMENTS.md | 补齐原要求，不降级最小需求 |
| architect | fde-architect | 需求 → CONTEXT.md | 修复蓝图，不用骨架冒充完成 |
| frontend | fde-frontend-architect | 需求/蓝图 → FRONTEND-DESIGN.md | 适用时修复设计，无前端才不适用 |
| poc | fde-poc | 设计 → POC 与清单 | 保留 skip_poc/stop_at_poc 决定，不因失败缩范围 |
| development | orchestrator + workflow | 蓝图/设计 → 代码 | 定向修复，里程碑级恢复 |
| run gate | 运行验证 | 代码 → build/test 证据 | 失败修复复验；缺结果为未验证 |
| integration | 集成验收 | 代码 → 集成证据 | 所有必需缺陷无论数量进入修复复验 |
| deploy | 部署配置 | 约定方案 → 配置及验证 | 必需配置未通过保持未完成；实际发布另按已有授权 |
| report | 报告 | 所有证据 → 实际状态 | 有未完成项不能宣称整个项目完成 |

具体阶段键及参数以当前执行器为准，详见 references/engine.md。

### 三文档体系 / Three-Document System

fde-job 在 Phase 1-3 构建三份核心文档，串联整个构建流程：

```
REQUIREMENTS.md   ← Phase 1 (需求分析)
    ↓ 架构师读取
CONTEXT.md         ← Phase 2 (架构蓝图)
    ↓ 前端架构师读取
FRONTEND-DESIGN.md ← Phase 3 (前端设计)
    ↓ 编排器/工作流读取
工程代码
```

**可选 POC 阶段（Phase 3.5）**：在 frontend 之后、orchestrate 之前，`fde-poc` 可生成高保真纯前端 POC，产出 `POC-MANIFEST.md`（供 Phase 4 演进消费）与 `POC-FIDELITY.md`。默认对有前端的项目生成（`skip_poc=false`）；`stop_at_poc=true` 时工程停在 POC；`skip_poc=true` 或无前端时跳过。Phase 4 orchestrate 读取 `POC-MANIFEST.md` 时做**演进**（替换 mock 层）而非重建。

**各文档职责**：
- **REQUIREMENTS.md**: 回答"要做什么"——角色旅程、功能清单、状态机、验收条件
- **CONTEXT.md**: 回答"怎么做"——技术栈、数据模型、API 契约、架构模式、里程碑
- **FRONTEND-DESIGN.md**: 回答"前端长什么样"——页面树、组件树、状态管理、UI 状态机

**阶段适用性**：简单项目可省独立需求分析阶段，但要求仍须完整写入蓝图；无前端才省前端设计。阶段跳过不能删除成果或验收要求。

**可选增强 — Phase 5 生产就绪检查**：
若交付约定要求生产就绪且项目是服务端/Web 应用，各 mode 均执行适用检查。
读取 `fde-init-project/references/production-readiness.md` 按项目类型运行检查清单，
必需未通过项修复复验，仍未通过则保持未完成；可选改进才列建议。
纯 CLI/库项目自动跳过此步骤。

---

## 🤖 执行模式选择 / Execution Mode

fde-job 提供两种执行模式。**Workflow 脚本是默认推荐的主执行路径。**

### 模式 A（推荐）：Workflow 脚本自动执行

通过 Workflow 工具执行适用阶段。各阶段子代理在 Workflow 引擎管理下自动推进，
无需手动调度。

**使用方式**：
```javascript
Workflow({
  scriptPath: "skills/fde-job/run.wf.js",
  args: {
    requirements: "做一个博客系统，CRUD 功能，Python FastAPI + SQLite",
    mode: "auto",              // normal | auto | silent
    projectName: "blog-system",
    skip_requirements: false,  // 简单项目设为 true
    skip_frontend: true,       // 无前端界面时设为 true
  }
})
```

**关键特性**：
- **标准协议**：Phase 0 写入 `project-metadata.json`，Phase 1 写入 `REQUIREMENTS.md`，Phase 2 写入 `CONTEXT.md`，Phase 3 写入 `FRONTEND-DESIGN.md`。所有阶段通过文件传递结构化数据，不靠自然语言摘要
- **自动恢复**：重启时自动检测 `.agents/job.state.json`，跳过已完成阶段
- **独立任务继续**：继续独立任务，必需失败项保持未完成，不静默删减范围
- **最终报告**：所有阶段完成后自动生成完整报告

详情参见 `references/engine.md`。

### 模式 B（回退）：手动子代理调度

当 Workflow 工具不可用时，可以在主会话中手动调度各阶段：

```
fde-job（主会话）
  │  读取 .agents/job.state.json → 确定当前阶段
  │
  ├── [Agent] Phase 0: fde-init-project
  │     └── → 写入文件树 + project-metadata.json
  │
  ├── [Agent] Phase 1: fde-requirements
  │     └── → 写入 REQUIREMENTS.md
  │
  ├── [Agent] Phase 2: fde-architect
  │     └── → 写入 CONTEXT.md + ADRs + 更新 project-metadata.json
  │
  ├── [Agent] Phase 3: fde-frontend-architect
  │     └── → 写入 FRONTEND-DESIGN.md
  │
  ├── [Agent] Phase 4: fde-orchestrator
  │   │  读取 CONTEXT.md + FRONTEND-DESIGN.md + job.state.json
  │   │
  │   ├── [Agent] fde-workflow "M1"
  │   ├── [Agent] fde-workflow "M2"
  │   ├── [Agent] fde-workflow "M3"
  │   │
  │   └── → 更新 CONTEXT.md + job.state.json + progress.json
  │
  ├── [Agent] Phase 5: 集成测试
  │     └── → 写入测试报告
  │
  ├── [Agent] Phase 6: 部署配置
  │     └── → 写入 Dockerfile/CI 配置
  │
  └── [Agent] Phase 7: 最终报告
        └── → 输出完成报告
```

### 子代理约束条件

1. **边界明确** — 每个子代理的工作范围严格限制在一个阶段或一个里程碑内
2. **上下文干净** — 子代理只包含当前任务所需的最少信息，不继承主会话的对话历史
3. **标准协议传递** — 子代理之间的状态通过文件传递（`project-metadata.json` → `REQUIREMENTS.md` → `CONTEXT.md` → `FRONTEND-DESIGN.md` → `job.state.json`），不通过对话参数传递
4. **简短状态码** — 子代理返回以下三种状态之一，不携带大量文本：
   - `DONE` — 全部必需成果与验收完成（可未提交）
   - `DONE_WITH_CONCERNS` — 必需项均通过，仅有非阻塞备注
   - `BLOCKED` — 无法继续

---

## 失败恢复

先定位失败类型，在已有授权内修正后复验。阶段产物缺失或必需验收失败时，其依赖阶段不能被标记完成；可继续不受影响的工作。不能靠最小骨架、跳过必需功能或测试失败后降级范围宣称项目完成。

保护工作树、未提交改动与数据，不因失败次数自动重建或重置。旧执行器的 DOES_NOT_RUN 表示运行门禁未通过，需在报告区分真实运行失败与证据不足；不得将其直接当成所有功能不可用。

对执行器返回的降级、跳过、空返回或缺失结果必须核对原请求和证据，缺失项保持未完成。发布按前述授权和验收交接规则执行，不从自动模式推导许可。

---

## 🔄 跨会话恢复 / Cross-Session Recovery

### 恢复流程

```
新对话 → 检测 .agents/job.state.json
  ├── 存在 → 读取 → 报告当前进度 → 恢复执行
  │   ├── init: 未完成 → 诊断现有脚手架后补齐
  │   ├── requirements: 未完成 → 接续 requirements
  │   ├── architect: 未完成 → 接续 architect
  │   ├── frontend: 未完成 → 接续 frontend
  │   ├── development: 未完成 → 恢复 orchestrator
  │   │   ├── 读取 checkpoint.next_action
  │   │   ├── git log 验证当前 commit
  │   │   └── 从下一个 TODO 里程碑继续
  │   └── finalize 等待中 → 执行集成测试
  └── 不存在 → 回退 .agents/progress.json
       └── 也不存在 → 回退 CONTEXT.md
            └── CONTEXT.md 也没有 → 从用户确认需求
```

### 恢复报告模板

```markdown
## 🔄 项目进度恢复 / Project Recovery

检测到 job.state.json，从持久化文件恢复项目进度：

**项目**: [名称]
**阶段**: [当前阶段名]
**完成进度**: [N/N 里程碑完成]
**上次验证的 commit**: [hash]（[message]）

### 已完成
1. ✅ 阶段 0: init — [时间]
2. ✅ 阶段 1: architect — [时间]
3. ✅ M1: [名称] — [时间]

### 未完成/未验证
4. M2: [名称] — [缺失项、尝试及下一动作]

### 待完成
5. [ ] M3: [名称]

### 恢复操作
1. git 状态验证: [hash] ✅
2. 测试运行: [N/N 通过] ✅
3. 从 M3 继续...
```

---

## 📁 进度持久化 / Progress Persistence

### 三文件方案

fde-job 使用三文件方案来追踪跨技能、跨会话的项目进度。

#### 文件 1：`project-metadata.json` — 技能间标准协议文件（新增）

用于 fde-init-project → fde-requirements → fde-architect → fde-orchestrator 之间的结构化数据传递。
由 fde-init-project（Phase 0）创建，architect（Phase 2）补充，orchestrator（Phase 4）消费。

- **Schema 定义**：`references/project-metadata.schema.json`
- **协议文档**：`references/skill-protocol.md`

#### 文件 2：`.agents/job.state.json` — 机器可读完整状态

```json
{
  "project": "blog-system",
  "job_version": "2.0",
  "mode": "auto",
  "phases": {
    "init": {
      "status": "DONE",
      "skill": "fde-init-project",
      "started_at": "2026-07-13T10:00:00Z",
      "completed_at": "2026-07-13T10:02:30Z",
      "result": {
        "project_dir": "/path/to/blog",
        "tech_stack": "python/fastapi/sqlite",
        "project_type": "web-app"
      },
      "errors": []
    },
    "architect": {
      "status": "DONE",
      "skill": "fde-architect",
      "started_at": "2026-07-13T10:02:31Z",
      "completed_at": "2026-07-13T10:15:00Z",
      "result": {
        "blueprint_commit": "abc123",
        "milestone_count": 6,
        "vocabulary_terms": 12
      },
      "errors": []
    },
    "development": {
      "status": "IN_PROGRESS",
      "skill": "fde-orchestrator",
      "started_at": "2026-07-13T10:15:01Z",
      "features": {
        "M1": {
          "name": "data-model",
          "status": "DONE",
          "dependencies": [],
          "commits": "abc123..def456",
          "rebuild_count": 0,
          "degraded": false,
          "integration_issues": [],
          "completed_at": "2026-07-13T10:25:00Z",
          "summary": "Created 3 models + migration"
        },
        "M2": {
          "name": "article-crud",
          "status": "IN_PROGRESS",
          "dependencies": ["M1"],
          "commits": null,
          "rebuild_count": 1,
          "degraded": false,
          "integration_issues": [],
          "completed_at": null,
          "summary": null
        }
      },
      "errors": []
    },
    "finalize": { "status": "TODO" },
    "deploy": { "status": "TODO" }
  },
  "checkpoint": {
    "last_commit": "def456",
    "last_phase": "development",
    "next_action": "continue milestone M2 (article-crud) — fixing failing test",
    "session_summary": "CONTEXT.md 委托约定；M1 已验收，M2 测试失败。已修正参数仍失败，下一步定位依赖；工作树改动保留。"
  }
}
```

**状态值定义**：

| 状态 | 含义 |
|:----:|------|
| `TODO` | 未开始 |
| `IN_PROGRESS` | 正在执行 |
| `DONE` | 必需成果与验收均完成，可未提交 |
| `BLOCKED` | 阻塞，无法继续 |
| `SKIPPED` | 明确不适用或已有授权排除；不计作原需求完成 |

#### 文件 2：`.agents/job.progress.md` — 人类可读追加账本

```markdown
# Project: blog-system
# Mode: auto
# Started: 2026-07-13T10:00:00Z

## 2026-07-13

[10:02] ✅ Phase 0: init — scaffolded (python/fastapi/sqlite)
[10:08] ✅ Phase 1: requirements — REQUIREMENTS.md created
[10:15] ✅ Phase 2: architect — blueprint + 6 milestones + 12 terms
[10:20] ✅ Phase 3: frontend — FRONTEND-DESIGN.md created
[10:25] ✅ M1: data-model — commits abc123..def456, 3 files, 2 tests
[10:35] ✅ M2: article-crud — commits def456..ghi789, 5 files, 8 tests
[10:45] ⚠️ M3: author-auth — rebuild 1 (compilation error, auto-fixed)
[10:52] ✅ M3: author-auth — commits ghi789..jkl012, 4 files, 6 tests
```

### 与现有 progress.json 的兼容

- `job.state.json` **新增**，覆盖完整生命周期。其 `development.features` 结构兼容现有的 progress.json
- `.agents/progress.json` **保留**，由 orchestrator 向下兼容
- **检测优先级**：`job.state.json` → `progress.json` → `CONTEXT.md` → 从用户问起

---

## 📊 最终报告 / Final Report

执行结束或确实无法继续时输出报告；只有全部必需项验证通过才使用“完成”。

```markdown
# 项目交付报告 / Delivery Report

**结论**: [已完成 / 未完成 / 未验证及原因]

**项目**: [项目名]
**模式**: [normal / auto / silent]
**阶段状态**: [实际已验收/未完成/不适用数量]
**总里程碑**: [N/N] 
**总变更**: +N / -M 行
**总文件**: N 个

## 完成清单

| # | 阶段/里程碑 | 状态 | 说明 |
|:-:|------------|:----:|------|
| 0 | 项目初始化 | ✅ | [技术栈] |
| 1 | 需求分析 | ✅ | [N 个功能区域] |
| 2 | 架构设计 | ✅ | [N 个术语, N 个里程碑] |
| 3 | 前端设计 | ✅ | [N 个页面, N 个组件] |
| 4 | M1: [名称] | ✅ | N 文件, N 测试 |
| 4 | M2: [名称] | ✅ | N 文件, N 测试 |
| ... | ... | ... | ... |
| 5 | 集成测试 | ✅ | N/N 测试通过 |
| 6 | 部署配置 | ✅ | [Dockerfile/CI/...] |

## 未完成与已授权取舍

| 里程碑 | 事实与授权来源 | 修复/验收与下一动作 |
|--------|---------|---------|
| [名称] | [未通过项或明确授权的变更] | [已尝试、复验结果、下一动作] |

## 部署配置

- **Dockerfile**: [已生成 / 不需要]
- **CI/CD**: [已生成 / 不需要]
- **运行命令**: `[命令]`

## 建议的后续工作

1. [建议 1]
2. [建议 2]
```

---

## ⚠️ 边界情况 / Edge Cases

| 场景 | 处理方式 |
|------|---------|
| **job.state.json 不存在但 project-metadata.json 存在** | 回退到 metadata → 重建 job.state.json → 从 metadata 推断当前阶段 |
| **job.state.json 与 git 状态不一致** | 运行 `git log --oneline -3` 验证，核对产物/工作树/验证范围；真实取舍或授权缺口才询问 |
| **子代理超时** | 默认 10 分钟超时，超时后标记 BLOCKED |
| **同一项目重复启动** | 检测 job.state.json 存在，读取约定及 checkpoint 后直接恢复 |
| **用户中途说"暂停"** | 记录当前进度到 job.state.json + project-metadata.json，保留工作树（不自动 commit/stash），输出恢复指令 |
| **引擎在 --auto 模式下技术栈默认选择不符合预期** | 核对已定约束，普通实现选择自主修正；真实技术取舍才升级 |
| **用户提供了部分代码但没有 CONTEXT.md** | 先扫描现有代码（调用 fde-architect 的逆向分析模式）生成蓝图，再继续 |
| **用户说"不要部署配置"** | 遵守明确排除并记录，各 mode 不重新扩大范围 |
| **所有功能完成后还有集成问题堆积** | 全部必需问题进入修复复验；未解决不能报告项目完成 |
| **project-metadata.json 与 CONTEXT.md 不一致** | 以用户当前决定和代码证据校准，保留有效信息，更新冲突字段并记录原因 |
