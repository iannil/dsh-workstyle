# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.1] - 2026-11-09

管理面：包可以建 / 改 / 删 / 还原，改动能落到明确的位置，写坏了能回滚。未做覆盖层改动时，注入文本与导出内容与 0.1.0 相同；导出会剔除被覆盖层移除的规则与屏蔽的预设。

### 新增

- **包生命周期** — `POST /pack` 支持 `apply` / `create` / `duplicate` / `rename` / `delete` / `restore` / `import`；用户包装在 `$DSH_HOME/workstyle/packs/<id>/`。删除是移动到 `trash/<id>-<时间戳>/`，`GET /pack`（不带 `id`）列出回收站并可恢复。内置包只读；用户 YAML 包只能手工改文件，复制与重命名会拒绝（删除仍可用）。
- **规则的四个落点** — `POST /rule` 接受 `target: 'overlay' | 'pack' | 'project' | 'session'`。`overlay` 写本机 `state.json` 的 `rulePatches` / `ruleRemovals`，对内置包与用户包都可用且不动 `pack/`；`pack` 直接写用户 JSON 包清单；`project` 写 `<cwd>/.dsh/workstyle.json`；`session` 写 `sessions/<id>.json`。移除是墓碑（`removed: true`），`action: 'restore'` 恢复。
- **预设** — `POST /preset` 支持 `save` / `use` / `delete` / `block` / `unblock` / `duplicate`；`use` 把预设写到项目层（带 `cwd`）或会话层（带 `sessionId`）。`preset.rules` 是白名单：未列出的规则仍可见、标 `outsidePreset`、不注入；空 `rules` 表示不限制。被屏蔽的预设从 `scope.presets` 移出、记入 `blockedPresets`。删除正被会话使用的预设需 `force: true`。
- **修订与回滚** — 覆盖层与用户包清单写入前快照到 `$DSH_HOME/workstyle/revisions/`，每文件保留 20 份；`GET /revisions` 列出、`POST /revisions {action:'restore', id}` 恢复。项目文件不进快照，由 git 负责历史。
- **覆盖层感知导出** — 导出包携带有效视图：补丁已应用、被移除的规则与屏蔽的预设已剔除、本机预设 / 模板与采纳记录一并包含；`manifest.json` 记录 `overlay: {patched, added, removed}`。
- **面板管理页** — `#/pack` 列表支持新建 / 导入 / 回收站恢复；`#/pack/<id>` 区分只读与可写；`#/rules` 跨作用域编辑 / 移除 / 恢复并标出写入位置；`#/presets` 提供白名单编辑器、复制、删除、强制删除、屏蔽与恢复；`#/distribute` 增加修订历史与一键回滚。

### 修复

- 会话层选择的预设现在真正参与组装：`/scope?session=` 与 `/inject?session=` 里选的预设开始生效（此前被忽略，只回落到项目层或工作区）。实时系统提示仍只组装工作区作用域，见 `docs/USAGE.md`「已知限制」。
- 恢复「最旧一份保留修订」不再返回 500 并删掉该行：恢复前先读取字节，并用 `pin` 阻止本次写入把目标修订挤出保留窗口。
- 全新安装的第一次覆盖层写入不再丢基线：`writeOverlay` 在快照前先确保 `state.json` 存在，第一次改动也能在「修订历史」回滚（此前首次编辑记录不到 revision，README 的上手演示因此落空）。

### 文档

- README 增加管理回环的上手检查、内置包只读与快照回滚两条能力说明、数据目录表。
- `docs/USAGE.md` 改为按路由介绍面板，新增「管理与落点」「回滚」「已知限制」三节，路由计数更正为 17 个路径 / 20 项注册。
- `docs/PLAN.md` 记录管理面的四条定论与验收证据。

### 未实现

- 设计稿 §10 的「撤销上一次」按钮与「补丁失效」清理、§11 的导入符号链接 / `..` 拒绝没有落地：回滚统一走「修订历史」，导入只校验「绝对路径、目录存在、含清单、id 不冲突」。下一版修复或收口，详见 spec 的「实现状态（2026-11-09）」。
