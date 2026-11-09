# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.0] - 2026-11-09

公开市场：面板新增 `#/market`，浏览 `market/registry.json`，预览规则 / 技能后走既有的 preview → apply 安装。归档由 CI 构建并上传到滚动 `market` Release，仓库只存文本源；注册表钉 `sha256`。默认离线，打开市场或主动安装时才联网。默认 FDE 包已从 `pack/` 迁入市场源目录，全新安装仍自动装好；市场检测到新版本时提示更新，下载与替换需人工确认。

### 新增

- **市场页** — 浏览 / 搜索 / 查看规则与技能名 / 预览后安装；内置包与已安装包有标记；离线时用最近缓存并标「可能已过期」。
- **`GET /market`** — 拉取并校验注册表，缓存到 `$DSH_HOME/workstyle/market.json`（10 分钟 TTL，`?refresh=1` 强制刷新）；拉取失败回退缓存并带 `stale:true`，无缓存返回空目录，不 500。`DSH_WORKSTYLE_MARKET_URL` 可指向私有注册表。
- **`market/` 源目录与构建脚本** — `market/packs/<id>/` 存 `workstyle.json` + `skills/*.md`；`scripts/build-market.mjs` 校验命名空间 id / semver / 摘要 / URL，生成确定性 `tar.gz` 并写回注册表（`--write` / `--check` / `--verify-remote`）。
- **CI** — `.github/workflows/market.yml` 在 PR 上跑 `--check`，合入 main 后构建并上传到滚动 `market` Release，再回读校验摘要。

### 变更

- 面板从八个页面增至九个；HTTP 从 19 个路径 / 22 个处理函数增至 **20 个路径 / 23 个处理函数**（20 条 exact 路由）。
- 隐私表述改为「默认离线；只有打开市场、主动安装或粘贴分享链接时才访问对应 HTTPS 地址，不上传」。

### 默认包与更新

- **默认包迁入市场源** — `pack/reference/` → `market/packs/fde-engineering/`；`package.json` 的 `files` 改为携带 `market/packs/`。
- **首次启动本地安装** — `ensureDefaultPack()` 在全新 profile（无 `state.json`）或 0.2.x 旧 profile（有 state、无市场标记）时把本地快照复制到 `$DSH_HOME/workstyle/packs/<id>/` 并设为当前包，不联网；删掉后重启不会自动重装。
- **市场包只读** — 安装来源记在 `state.marketPacks`；规则 / 预设的包内写入与重命名被拒绝，删除 / 恢复保留托管标记；编辑落覆盖层。
- **手动确认更新** — `GET /market` 按 semver 返回 `installedVersion` / `canUpdate`；面板显示「可更新 vX → vY」，确认后用 `replace:true` + `market:true` 安装，旧包进 `trash/`。

### 文档

- 新增 [market/README.md](market/README.md)（贡献与发布流程）；README / USAGE / PLAN 同步市场行为、路由数与已知边界。

## [0.2.0] - 2026-11-09

分享面：包可以带摘要下载、复制分享信息，也可以用归档或带 `#sha256` 的链接导入；每次安装前先看清单，再显式确认。手动导出 / 导入仍然可用。

### 新增

- **导出带摘要** — `workstyle_export`、`/export` 与 `/workstyle export` 返回 `sha256`；面板导出结果展示摘要，并提供「下载 tar.gz」「复制分享信息」「复制路径」。最近导出每行也可直接下载。
- **下载路由** — `GET /exports/download?file=<basename>` 只接受 `exports/` 下的 `.tar.gz` 基名，返回 `content-disposition: attachment`，不暴露任意路径。
- **归档导入** — 面板「导入包」支持目录 / `.tar.gz` / 分享链接三种来源；归档与链接先 `POST /import {action:'preview'}`，展示包 id、版本、作者、许可、规则 / 技能数、`sha256` 与来源，再「仅导入」或「导入并应用」。
- **链接安装** — `/workstyle import <url|file> [--yes] [--as <id>] [--replace] [--no-apply]`；URL 必须带 `#sha256=<64hex>`，无 `--yes` 只预览不安装。命令与面板都走同一条 preview → apply 路径。
- **安全边界** — 下载 20 MB / 解压 100 MB / 5000 条目上限；gzip 与 tar 校验和、路径穿越、绝对路径、符号链接 / 硬链接、重复条目、`skills.dir` 越界全部拒绝；临时归档存 `imports/`，15 分钟懒清理。
- **冲突可恢复** — 同 id 返回 409；面板可「覆盖」（旧包移入 `trash/`）或「另存为」新 id；内置包同 id 永远拒绝覆盖。没有新增自动应用工具，安装只发生在人确认之后。

### 变更

- HTTP 路由从 17 个路径增至 **19 个路径 / 22 个处理函数**（同路径 GET/POST 合并为一条 exact 路由，见「修复」）；面板仍是八个页面，导入预览在包页内完成。
- `workstyle.json` 的 `id` 在「另存为」时同步重写，包内技能目录原样保留。

### 修复

- **同路径 GET/POST 注册丢失** — `connection.fetch` 按路径名保存唯一一条 exact Fetch 路由并按 `methods` 分派；把 `GET /pack` 与 `POST /pack` 分开注册时，第二次注册抛 `connection: exact Fetch route "…" is already registered`，而插件里的 try/catch 把它吞掉了，于是 `POST /pack`、`POST /scope`、`POST /revisions` 三个写路由在激活时静默缺失。面板点「复制」「切换包」「保存环境」「回滚修订」都会落到共享 `/api` 处理器的纯文本 404 `not found`，再被 `JSON.parse` 报成 `Unexpected token 'o', "not found" is not valid JSON`。现在同一路径的处理器按方法累积，注册时合并成一条带全部 `methods` 的路由（共 19 个路径 / 19 条 exact 路由）。
- 面板的 `call` / `postJson` 不再无条件 `response.json()`：响应体不是 JSON 时改为抛出 `HTTP <status> <body>`，缺路由这类问题直接显示状态码与原文，而不是 JSON 语法错误。
- 归档导入不再只接受已解压目录：`.tar.gz` 与 HTTPS 链接都能走同一条校验路径；目录导入语义不变。
- 工作包页的包卡片标题与 `id · v…` 行不再显示浏览器默认链接蓝：卡片是 `<a>`，原来没写 `color`，子元素只设字号字重，于是两层都继承 UA 链接色 `#0000EE`；现在卡片显式用 `var(--dsw-alias-label-primary)`，深浅主题一致。

### 文档

- README / `docs/USAGE.md` 补充分享与导入流程、路由、数据目录 `imports/`、导入的安全边界与已知限制；`docs/PLAN.md` 记录分享面定论。

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
- 区块标题去掉残留的 ①②③ 序号：面板拆成多个路由后「载入预览」成了概览页上孤立的 ①，有效规则与预设也已移入包详情页；首次引导 tip 的三步序号保留。
- 面板所有页面的间距统一到 4px 网格：新增共享 `Page` / `Section` 壳（页内 16px 栈、区块标题到正文 12px），包页改用 `PageHead`，并清掉筛选行、列表行、卡片网格与空态上的补偿性 padding / margin。

### 文档

- README 增加管理回环的上手检查、内置包只读与快照回滚两条能力说明、数据目录表。
- `docs/USAGE.md` 改为按路由介绍面板，新增「管理与落点」「回滚」「已知限制」三节，路由计数更正为 17 个路径 / 20 项注册。
- `docs/PLAN.md` 记录管理面的四条定论与验收证据。

### 未实现

- 设计稿 §10 的「撤销上一次」按钮与「补丁失效」清理、§11 的导入符号链接 / `..` 拒绝没有落地：回滚统一走「修订历史」，导入只校验「绝对路径、目录存在、含清单、id 不冲突」。下一版修复或收口，详见 spec 的「实现状态（2026-11-09）」。
