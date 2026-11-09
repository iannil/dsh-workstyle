# 工作包 / 规则 / 预设的管理设计

日期：2026-11-09
状态：已与用户确认（brainstorming 五问 + 两节设计均「同意」）

## 1. 目标

把面板从「看得见」升级为「改得动、讲得清、退得回」：

- **改得动**：包、规则、预设、模板都有真实写入路径，不再只有只读展示。
- **讲得清**：每个实体写到哪里、覆盖了谁、为什么没进系统提示，面板一眼可见。
- **退得回**：本机层每次写入前留快照，最近 20 份可一键恢复。

非目标（本轮不做）：技能文件编辑、tar.gz 直接导入、跨设备同步、diff 视图、多进程文件锁、`renderRules` / `inject-text` 的渲染逻辑改动。

## 2. 现状与问题（证据）

1. **面板三个「新建」只有规则是真的。** `client.js:2401` 预设页的「+ 新建预设」调用 `setEditing({ id: '', title: '', text: '' })`，打开的是规则编辑器（`client.js:2401` → 规则编辑弹层 `client.js:2239-2258`）。文案 `presetNew`（`client.js:247`）因此误导。
2. **预设的 `rules` 在注入链路里没被消费。** `/preset` save 已经能存 `rules / skills / templates`（`index.js:1196-1210`），但 `lib/scope.js` 只用预设成员的技能算 `rank / inPreset`，`composeScope` 不按预设过滤规则。用户切换预设后看不到任何规则变化。
3. **包不可写。** 内置包目录只读（`lib/scope.js:8` 注释：`pack directory stays read-only: nothing here writes into pack/`），没有任何「本机覆盖」入口。`mergeRules`（`index.js:199`）用 `new Set(pack.rules.map(id))` 过滤采纳规则，**已存在的规则 id 无法被采纳规则覆盖**，所以编辑内置规则必须引入新机制。
4. **导出丢预设与模板。** `lib/export.js` 全文没有 `preset` / `template` 字样，`exportPack` 写出的 `workstyle.json` 只有 `rules` 与 `skills`，导出的包不完整。
5. **没有回滚。** 所有写入是单次原子写，写坏没有历史。
6. **`/rule` 只能写项目层**，且强制要求已存在的 `body.cwd`（`index.js:1150` 起）；`/pack` 只有 `apply` 一个动作。

## 3. 三层落点模型

| 层 | 位置 | 性质 |
| --- | --- | --- |
| 包层 · 内置 | `<plugin>/pack/<id>/` | 只读，永不修改 |
| 包层 · 自建/导入 | `$DSH_HOME/workstyle/packs/<id>/` | 可写，直接改包文件 |
| 本机覆盖层 | `$DSH_HOME/workstyle/state.json`、`overrides.json` | 对所有包生效，可快照回滚 |
| 项目 / 会话层 | `<cwd>/.dsh/workstyle.json`、会话 scope 文件 | 可写，交给 git，不拍快照 |

原则：越靠近用户，优先级越高；内置包永不落地新内容；覆盖层改动在导出时合并进产物。

## 4. 实体 × 落点矩阵

| 实体 | 内置包 | 自建包 | 项目层 | 会话层 |
| --- | --- | --- | --- | --- |
| pack | 只读 | 直接写文件；可新建 / 复制 / 重命名 / 删除 / 导入 | — | — |
| rule | 覆盖层（patch / removal） | 直接写 `workstyle.json` | 直接写文件（现有） | 直接写文件（现有） |
| preset | 覆盖层（local override / 屏蔽） | 直接写 `workstyle.json` | 只记录「选用哪个预设」 | 同左 |
| template | 只读（现状），导出时合并覆盖层 | 只读 | — | — |
| skill | 只读，只能启停 | 只读 | 只能启停 | 只能启停 |

## 5. 覆盖层数据模型

`state.json` 新增三个键，缺省视为空，与现存 `adoptions / presets / templates` 并存：

```jsonc
{
  "rulePatches":   { "<packId>": { "<ruleId>": { "title": "…", "text": "…" } } },
  "ruleRemovals":  { "<packId>": ["<ruleId>"] },
  "presetBlocked": { "<packId>": ["<presetId>"] }
}
```

- **patch 字段白名单**：只允许 `title`、`text`；`id` / `source` 不可改，保证引用稳定。
- **adoptions 与 patch 的关系**：`adoptions` 是「新增规则」，`rulePatches` 是「改包内已有规则」。两者可以同时存在；应用顺序为先 `mergeRules`（包规则 + 采纳），再叠加 patch，再减去 removal。因此被采纳的规则也能被 patch。
- **removal 是软移除**：不改包文件，面板显示「已移除 · 本机」并提供恢复。
- **presetBlocked**：屏蔽**包自带**的预设（不删文件，只屏蔽），面板提供恢复；不作用于 `state.presets` 里的本机预设。
- **`overrides.json` 不变**：启停仍然走 `disabledRules / disabledSkills`，与 patch 正交。
- **无迁移脚本**：缺键即空，回读时用 `?? {}` 兜底。

### 导出时的合并顺序

`exportPack` 的入参 `rules` 改为调用方传入的「有效规则」：`包规则 + adoptions → 叠加 patches → 减去 removals`；`workstyle.json` 增加 `presets`（应用 `presetBlocked` 后）与 `templates`（含覆盖层）。导出侧的 `manifest.json` 记录 `overlay: { patched, added, removed, presets, templates }` 计数，便于核对。

## 6. 生效优先级与可见性

规则从收集到注入，后写者赢：

1. **收集**：`包规则 + adoptions + 项目规则`（同 id 后者覆盖）→ 叠加 `rulePatches` → 减去 `ruleRemovals`。
2. 全局停用（`overrides.json`）→ `disabledBy: 'workspace'`。
3. 项目停用（`.dsh/workstyle.json` 的 `disabledRules`）→ `disabledBy: 'project'`。
4. **预设排除**：当前预设的 `rules` 非空时，不在其中的规则标 `outsidePreset: '<presetId>'`，不注入。
5. 会话停用 → `disabledBy: 'session'`。
6. **会话强制启用**：最高优先级，可把第 4 步被排除的规则拉回。

判定顺序即上表顺序，每一步命中就记录原因；一条规则最终只有三种终态之一：`enabled`、`disabledBy`、`outsidePreset`。面板对三态用不同色 chip。

补充规则：

- `preset.rules` 为空数组或缺省 = 不限制，行为与现状一致。
- **技能不隐藏，只排序**：预设内技能 `rank` 前移并标 `inPreset`，预设外技能仍在技能目录中。理由是技能按需触发，隐藏会让模型找不到。这是有意的不对称，需写进 `docs/USAGE.md`。
- 被 `presetBlocked` 屏蔽的预设不出现在选择器里，但设置页可恢复。

## 7. 共享写入层 `lib/manage.js`（新文件）

```js
resolveWrite({ entity, packId, ruleId, presetId, target, cwd, sessionId })
  → { scope: 'overlay' | 'pack' | 'project' | 'session', file, label, readOnly? }

commit(file, value, { reason })
  → { revision: { id, at, bytes } | null, bytes }

restore(revisionId)
  → { file, revision }
```

- **快照**：`commit` 先把改动前的文件复制到 `$DSH_HOME/workstyle/revisions/<sha1(file).slice(0,10)>/<ISO ts>.json`，索引 `revisions/index.json`：

  ```jsonc
  { "version": 1,
    "files": { "<hash>": { "path": "/abs/file", "label": "state.json",
      "entries": [{ "id": "<hash>/<ts>", "at": "…", "bytes": 123, "reason": "rule-edit" }] } } }
  ```

  每个文件保留最近 20 条，超出裁剪最旧。`restore` 前也先快照当前内容，所以「回滚」本身还能再回滚。
- **原子写**：复用 `lib/pack.js` 的 `writeJsonAtomic`。
- **写后重载**：`index.js` 的 `packs` / `active` 是 `apply()` 时缓存的，任何包文件写入后必须调 `refreshPacks()`：重新 `loadAllPacks()`，若原 active 已不存在则回落到第一个可用包。
- **项目文件不快照**（按决定交给 git），但仍原子写，`revision` 返回 `null`。
- **并发**：进程内单写入队列（promise chain）串行化，last-write-wins；响应带 `updatedAt`，不做跨进程文件锁。
- **路径约束**：所有写入目标必须落在 `$DSH_HOME/workstyle/`、包目录白名单或调用方显式给出的 `cwd` 之下；拒绝 `..` 与符号链接逃逸。

## 8. 包生命周期

| 动作 | 行为 |
| --- | --- |
| create | 建 `$DSH_HOME/workstyle/packs/<id>/`：`workstyle.json`（version `0.1.0`、rules/presets/templates 为空）+ `skills/` 空目录 + `README.md` 骨架 |
| duplicate | 内置包 → 复制到用户目录（保留 license / author）；自建包 → `<id>-copy` |
| rename | 只改 `displayName`；id 与目录名不变（id 是引用键） |
| delete | 移入 `$DSH_HOME/workstyle/trash/<id>-<ts>/`；删除激活包时自动切换 |
| restore | 从 trash 移回，`refreshPacks()` |
| import | 接受**目录路径**，校验 `id / version / rules`；id 冲突返回 400 且不自动改名 |

包 id 规则：沿用 `checkPresetId` 的正则 `/^[a-z0-9][a-z0-9-]{0,48}$/`（`lib/scope.js:222`）。现状 `loadPackAt` 是 `manifest.id || basename(dir)`，不做校验（`lib/pack.js:96`），新建 / 复制 / 导入时需新增校验。tar.gz 直读列 P2（`lib/export.js` 只有 ustar 写入端，无解析器）；v1 面板对导出的 `.tar.gz` 给出 `tar -xzf` 复制命令。

## 9. HTTP 路由变更

| 路由 | 现在 | 变更 |
| --- | --- | --- |
| `POST /rule` | 只写项目层，强制 cwd | 增加 `target: 'pack' | 'project' | 'session'`；`target=pack` 时 `packId` 必填，由 `resolveWrite` 决定 overlay 或包文件；增加 `action: 'remove' | 'restore'`；不传 target 保持旧行为 |
| `POST /preset` | `save` / `use` | 增加 `delete` / `duplicate` / `block` / `unblock`；`save` 增加 `target`，内置包写 `state.presets`，自建包写文件；`use` 遇到被屏蔽的预设返回 400 |
| `POST /pack` | 仅 `apply` | 增加 `create` / `duplicate` / `rename` / `delete` / `restore` / `import` |
| `GET /revisions` | 无 | 修订列表，支持 `?file=` 过滤 |
| `POST /revisions` | 无 | `{ action: 'restore', id }` |
| `GET /status`、`GET /scope` | 无写入元数据 | 每条规则附 `writable: { scope, packId, file }`、`outsidePreset`、`disabledBy`；预设附 `blocked` |

## 10. 面板改动

不新增顶级导航页，改现有页面：

- **包列表（`#/pack`）**：顶部 `+ 新建包` / `导入包`；卡片菜单 激活 / 复制 / 重命名 / 删除；回收站折叠区可恢复。
- **包详情（`#/pack/<id>`）**：内置包顶部黄条「只读包。编辑会保存到本机覆盖层，不改包文件。」；自建包显示「改动直接写入 `<path>`」。
- **规则页**：每行 编辑 / 移除；移除后灰显 + `恢复`；编辑弹层底部常驻落点行（`将写入：本机覆盖层 (state.json)` / `包文件 (…/workstyle.json)`）；`不在当前预设` chip + `加入当前预设`；三态 chip 着色区分；patch 指向已不存在的规则 id 时标「补丁失效」并提供清理。
- **预设页**：卡片 使用 / 编辑 / 复制 / 删除（内置 → 屏蔽，可恢复）；编辑弹层字段 `id`（新建可填，编辑只读）、`title`、`description`、规则 / 技能 / 模板多选，实时显示「包含 N/M 条规则」与悬空引用红字警告。修掉 `client.js:2401` 的按钮错接。
- **分发页**：新增「版本与回滚」小节，列最近修订（时间 / 文件 / 原因 / 字节），一键回滚；编辑弹层内提供「撤销上一次」。

## 11. 错误处理

- 400：未知 id、id 冲突、非法包 id、删除只读（内置）包、导入目录校验失败、目标路径越界。
- 快照失败即中止写入，不写半截文件。
- 导入时拒绝符号链接与 `..`，只允许绝对路径且必须存在。
- 写入后 `refreshPacks` 失败不回滚已写内容，但返回错误并在响应里带 `reload: 'failed'`，面板提示重启插件。

## 12. 测试与验收

1. 编辑内置规则 → `state.json` 出现 `rulePatches`，包文件内容哈希不变，`/inject` 文本与指纹变化。
2. 移除内置规则 → 系统提示不含该规则；`恢复` 后文本回来。
3. 新建自建包 → 目录与 `workstyle.json` 存在，出现在 `/status.packs`，可 `apply`。
4. 删除激活包 → 自动切换、目录进 trash、`restore` 恢复。
5. 预设白名单 → 新建预设只含规则 A；激活后 `/inject` 只含 A，B 标 `outsidePreset`；会话强制启用能把 B 拉回。
6. 回滚 → 两次编辑产生 2 条 revision，恢复到第 1 条后内容与首次指纹一致。
7. 导入目录成功；id 冲突 400。
8. `node test/smoke.mjs`、`node test/panel-render.mjs`、`node test/multipage-render.mjs` 全绿，且 1–7 各有断言。

## 13. 风险

- **预设过滤是行为变更。** 内置包 `pack/reference/workstyle.json` 现有 7 条规则、3 个预设，预设自带 `rules`：`fde-delivery` 5/7、`writing` 3/7、`rc-discussion` 3/7。升级后首次激活这些预设，系统提示会真的少掉 2–4 条规则。缓解：预设编辑器与选择器显示「包含 N/M 条规则」；`docs/USAGE.md` 明确写出变化；`rules: []` 的预设行为不变。
- **`client.js` 已 2921 行**，改动集中在规则 / 预设 / 包三处，不做顺手重构，避免与 UI 分支冲突。
- **`index.js` 内存态**：包文件写入必须配 `refreshPacks()`，否则面板显示与实际不一致；测试要覆盖「写完立刻读 status」。
- **内置包升级冲突**：用户对内置规则的 patch 按 id 绑定；包升级若删掉某 id，patch 变成悬空，面板需标「补丁失效」而不是静默丢弃。

## 14. 改动清单

- 新增：`lib/manage.js`（写入层 + 快照 + revisions）。
- 修改：`index.js`（`/rule` `/preset` `/pack` `/revisions` 路由、`refreshPacks`、status/scope 元数据）、`lib/scope.js`（预设过滤 + 可见性原因）、`lib/export.js`（合并覆盖层、导出 presets/templates）、`client.js`（包 / 规则 / 预设三页与回滚区）、`docs/USAGE.md`（新概念与行为变更）、`README.md`（管理能力一句话）。
- 测试：`test/smoke.mjs` 扩展；必要时新增 `test/manage.mjs`。

## 实现状态（2026-11-09）

本节记录上面哪些条目没有落地、以及为什么，避免下一位读者把设想当成约束验收。正文决定保持原样，不在此修改。

- **§10「撤销上一次」**：未实现。回滚统一走 `#/distribute` 的「修订历史」：列快照 id、一键恢复，回滚本身也会留下一条新快照，可反向回去。编辑弹层不另设入口，避免两套撤销语义。
- **§10「补丁失效」清理**：未实现。patch 指向已不存在的规则 id 时不会被应用（组装只认当前规则 id），但面板既不标「补丁失效」也不提供清理按钮；悬空 patch 留在 `state.json` 里，等包升级换回该 id，或由用户直接改覆盖层。风险低：它不注入任何文本。
- **§11 导入拒绝符号链接与 `..`**：未实现。`POST /pack {action: 'import'}` 目前只校验「绝对路径且是存在的目录、含 `workstyle.json`/`workstyle.yaml`、id 不冲突、不复制进自身子目录」，随后整目录复制；没有 `realpath` 越界检查，也没有跳过符号链接。留待后续版本补上或改成显式确认的安全导入。
- 其余条目（§12 的 1–8 项）已实现并有断言，证据见 `test/smoke.mjs`、`test/panel-render.mjs` 与 `.superpowers/sdd/2026-11-09-workstyle-management/review-final.md`。
