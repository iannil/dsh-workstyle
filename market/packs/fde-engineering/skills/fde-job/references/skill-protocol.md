# Skill Protocol — 标准化技能间调用协议

> 定义所有 fde-* 系列技能的标准输入/输出参数协议，
> 确保技能之间可程序化组合、自动编排。
>
> 协议版本: 1.0
> 兼容性: fde-job >= 2.0, fde-orchestrator >= 2.0

---

## 设计原则

1. **每个技能的输出 = 下一个技能的输入** — 各技能按职责读取并更新文件，保留已有信息
2. **结构化数据 > 自然语言** — 技能间传递 JSON 格式的 Schema，不依赖自然语言摘要
3. **文件即管道** — 技能间的数据传递通过文件系统（`project-metadata.json`），不通过对话历史
4. **向后兼容** — 新增字段不能破坏已有消费方

---

## 协议概览

```
  User (输入: requirements)
    │
    ▼
  fde-init-project ──输出──► project-metadata.json ──► fde-architect
                                                          │
                                                          ▼
                                                   CONTEXT.md
                                                      │
                                                      ▼
                                              fde-orchestrator
                                                      │
                                                      ▼
                                            .agents/progress.json
                                                      │
                                                      ▼
                                              fde-workflow × N
```

---

## 1. fde-init-project → 其输出

fde-init-project 完成后，必须输出 `project-metadata.json` 到项目根目录。

### 输出 Schema: `project-metadata.json`

```json
{
  "project": {
    "name": "string — 项目名",
    "description": "string — 一句话描述",
    "type": "api-server | cli-tool | library | web-app | desktop-app | mobile-app | other",
    "language": "string — 主要语言 (python | rust | go | typescript | java | ...)",
    "framework": "string — 主要框架 (fastapi | actix-web | gin | nextjs | spring-boot | ...)",
    "package_manager": "string — 包管理器 (pip | cargo | npm | go-mod | maven | ...)",
    "database": "string | null — 数据库 (sqlite | postgresql | mysql | mongodb | null)",
    "has_frontend": "boolean — 是否有前端界面",
    "frontend_framework": "string | null — 前端框架 (react | vue | nextjs | null)",
    "deployment": {
      "type": "local | docker | serverless | cloud-vm",
      "ci_cd": "github-actions | gitlab-ci | manual | none",
      "docker": "boolean — 是否需要 Docker"
    },
    "testing": {
      "framework": "string — 测试框架名",
      "types": ["unit", "integration", "e2e"]
    },
    "license": "string — MIT | Apache-2.0 | GPL-3.0 | ...",
    "features": ["string — 用户描述的核心功能列表"]
  },
  "progress_file": ".agents/job.state.json",
  "blueprint_file": "CONTEXT.md"
}
```

### 必须遵守的规则

1. fde-init-project **必须**在文件树生成结束后写入 `project-metadata.json`
2. 下次读取时直接解析 JSON，不再从文件树推断
3. 如果用户手动修改了技术栈，需同步更新此文件

---

## 2. fde-architect → 其输出

architect 完成后，蓝图（CONTEXT.md）已经写入并验证；提交仅在已有授权时执行。此外还必须输出或更新：

### 输出文件: `project-metadata.json`（更新）

architect 在 fde-init-project 输出的基础上补充以下字段：

```json
{
  "project": { "...原有字段..." },
  "architect": {
    "blueprint_commit": "string — 有对应提交时记录 hash；未提交按现有 schema 的可选规则省略",
    "milestones": [
      {
        "id": "M1",
        "name": "string — 里程碑名",
        "description": "string — 描述",
        "dependencies": ["string — 依赖的里程碑 ID"],
        "type": "data-model | business-logic | api | cross-cutting | frontend | integration",
        "estimated_files": "number",
        "estimated_lines": "number",
        "acceptance_criteria": ["string — 验收项列表"]
      }
    ],
    "glossary_terms": [
      {
        "term_cn": "中文术语",
        "term_en": "English Term",
        "definition": "一句话定义",
        "boundary": "不属于什么"
      }
    ],
    "frontend_direction": {
      "has_frontend": "boolean",
      "design_defined": "boolean",
      "design_vibe": "string | null — 设计基调描述",
      "primary_color": "string | null",
      "typography_heading": "string | null",
      "typography_body": "string | null"
    },
    "adr_count": "number — ADR 数量"
  }
}
```

### 必须遵守的规则

1. architect 完成后必须更新 `project-metadata.json` 的 `architect` 部分
2. 里程碑的 ID 必须连续编号（M1, M2, M3...）
3. `dependencies` 只引用已定义的里程碑 ID

---

## 3. fde-orchestrator → 输入/输出

orchestrator 读取 `CONTEXT.md` + `project-metadata.json`，写入 `progress.json`。

### 输入文件

| 文件 | 用途 |
|------|------|
| `CONTEXT.md` | 蓝图定义（里程碑、词汇表、API 契约） |
| `project-metadata.json` | 技术栈、里程碑列表、验收标准 |

### 输出文件: `.agents/progress.json`

```json
{
  "project": "string — 项目名",
  "blueprint_version": "string — 蓝图版本",
  "progress": {
    "total_features": "number",
    "completed": "number",
    "blocked": "number",
    "skipped": "number"
  },
  "checkpoint": {
    "last_git_commit_hash": "string",
    "last_git_commit_message": "string",
    "last_verified_commit_hash": "string",
    "last_session_summary": "string — 上次对话摘要"
  },
  "features": {
    "M1": {
      "name": "string",
      "status": "todo | in_progress | done | blocked | skipped",
      "dependencies": ["string"],
      "rebuild_count": "number",
      "degraded": "boolean",
      "integration_issues": ["string"],
      "completed_at": "string | null — ISO 8601",
      "summary": "string | null",
      "commit_hash": "string | null",
      "files_changed": "number",
      "tests_passed": "number"
    }
  }
}
```

---

## 4. fde-workflow → 返回值协议

当 fde-workflow 被 orchestrator 调用时，其**返回值**必须遵循以下协议：

### 返回值 Schema

```json
{
  "status": "done | done_with_concerns | blocked",
  "summary": "string — 功能完成的简短摘要",
  "changes": {
    "files_created": "number",
    "files_modified": "number",
    "tests_passed": "number",
    "tests_total": "number",
    "commit_hash": "string | null",
    "rebuild_count": "number",
    "degraded": "boolean"
  },
  "issues": [
    {
      "severity": "warning | error",
      "description": "string",
      "file": "string | null",
      "resolved": "boolean"
    }
  ],
  "glossary_changes": {
    "new_terms": ["string — 新增术语"],
    "updated_terms": ["string — 更新术语"],
    "issues": ["string — 术语问题"]
  }
}
```

### 必须遵守的规则

1. **状态必须精确**：`done` = 全部必需成果和验收已满足；`done_with_concerns` = 必需项已满足但有非阻塞备注；`blocked` = 必需项失败、未验证或当前无法完成。部分可用、happy path 或未授权缩减范围不能算完成。
2. **所有字段必须填充**：即使为 0 / null / empty array
3. **commit_hash** 可为 null，包括 `done`；完成不以提交为前提。普通开发不授权 commit、stash 或发布。记录实际工作树与验证证据，不能拿旧 HEAD 冒充本轮提交。
4. 空返回、缺字段、解析失败或缺少必需证据均为未验证，使用既有非完成状态并在 summary/issues 说明。修复后重新验收失败项及受影响范围，不能只改状态。
5. `rebuild_count` / `degraded` 保留兼容用途，不触发重建或通过判定；SKIPPED 仅表示明确不适用或已有授权排除，不计作原需求完成。

---

## 5. fde-inspector → 返回值协议

inspector 验收后的返回值遵循以下协议：

### 返回值 Schema

```json
{
  "verdict": "pass | needs_fix | rebuild",
  "summary": "string — 验收结论摘要",
  "signals": {
    "foundation_tampering": "clean | warning | critical",
    "over_engineering": "clean | warning | critical",
    "volume_control": "clean | warning | critical",
    "terminology_drift": "clean | warning | critical",
    "frontend_compliance": "clean | warning | skipped",
    "test_compliance": "compliant | insufficient | failed"
  },
  "acceptance_check": {
    "total": "number",
    "passed": "number",
    "failed": "number"
  },
  "issues": [
    {
      "severity": "critical | warning | info",
      "signal": "foundation | overengineer | volume | terminology | frontend | test",
      "file": "string | null",
      "line": "number | null",
      "description": "string",
      "recommendation": "string"
    }
  ],
  "changes_summary": {
    "total_files": "number",
    "total_additions": "number",
    "total_deletions": "number",
    "test_count": "number",
    "test_pass_count": "number"
  }
}
```

---

## 6. 通用执行上下文传递

每个 agent() 调用（无论是 Workflow 脚本还是手动调用）的标准入参结构：

```json
{
  "blueprint": "CONTEXT.md (by reading the file)",
  "project_metadata": "project-metadata.json (by reading the file)",
  "mode": "normal | auto | silent",
  "current_milestone": {
    "id": "M1",
    "name": "milestone name"
  }
}
```

这些信息通过文件引用传递给子代理；示例是语义上下文，不要求新增执行器参数。每个子代理启动时读取相应文件。

### 简短委托约定

在现有 `CONTEXT.md` 或 `REQUIREMENTS.md` 中维护一个短段落，已有内容直接引用：

- **成果**：本次要交付什么，范围边界是什么。
- **完成标准与来源**：用户请求、需求条目/蓝图章节及必需验证。
- **不可妥协项**：必须保留的行为、质量、兼容性及数据约束。
- **授权取舍**：用户已经允许的替代、排除项和条件；没有则明确没有。
- **决策权限**：可自主选择的实现细节，以及需要升级的价值取舍/授权缺口。

委托只传章节引用及任务差量，不复制整份蓝图，不建新大账本。已授权执行/继续不重复确认；mode 只影响输出详略，不扩权限。任务失败时先诊断修复并复验，必需集成缺陷无论数量都处理；不自动缩需求、仅做 happy path 或 skip 后宣称完成。

checkpoint 复用现有摘要和 next_action，继承约定引用、未解问题、已尝试及结果、下一动作、仍可继续的独立任务。保持原 schema/枚举/大小写；没有结构化槽位就写入现有摘要，不强加新字段。

只在真正价值取舍或授权缺口升级，并给出事实证据、已尝试、推荐方案及代价、需要决定的具体事项和仍可继续任务。固定失败次数不构成必须重建或用户兜底的依据。

inspector 的历史 `rebuild` 是诊断建议，不是删除/回滚许可；缺证据时不能输出 pass。当前消费者若没有 unverified 枚举，以既有非通过值配合 summary/issues 表达未验证，不私自扩 schema。

---

## 7. 协议合规检查清单

发布新技能或修改现有技能时，对照以下清单检查协议合规性：

- [ ] 技能的输出有标准 Schema（JSON 格式）
- [ ] 技能的输入有标准 Schema
- [ ] 输出文件写入磁盘（不通过对话传递）
- [ ] 消费方能通过文件名定位所需数据
- [ ] 所有状态码使用协议定义的标准值
- [ ] 新增字段不会破坏已有消费方

## 执行器阶段结果补充

当前 PHASE_RESULT 支持可选 `required_complete: boolean`。`DONE` 仍兼容；`DONE_WITH_CONCERNS` 只有显式 `required_complete: true` 才能表明必需项完成，且仍须核对证据。缺失/false 不能按成功推进。此字段不改变持久状态枚举，也不要求扩充 workflow 返回值的旧 schema。

恢复校验可返回 `recovery.milestones` 映射；每项提供 `verified: true`、summary 和与当前任务匹配的完整里程碑字段。只有与当前成果和验证相符的条目才能复用完成结论；缺失或未验证条目补验/修复。持久化仍沿用已有字段与枚举。
