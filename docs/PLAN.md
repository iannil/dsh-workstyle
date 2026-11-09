# dsh-workstyle 方案与路线图

> 本文是产品方案的可追溯版本，防止跨会话丢失。最后更新：2026-11-09（管理面：包生命周期 / 覆盖层 / 预设白名单 / 修订回滚）。

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
- 路由（17 个路径 / 20 项注册）：`/api/dsh-workstyle/{status,pack,reports,exports,evidence,apply,distill,adopt,unadopt,toggle,export,scope,inject,metrics,rule,preset,revisions}`；`pack`、`scope`、`revisions` 各挂 GET + POST。
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

### 2026-11-09 管理面（已实现）

管理面的四条定论，后续改动以此为据：

1. **内置包只读，改动落覆盖层。** 编辑内置包规则写 `state.json` 的 `rulePatches` / `ruleRemovals`，不写 `pack/`；面板据此区分「只读 / 可写」，升级插件不丢本地改动。
2. **预设的 `rules` 是白名单。** 未列出的规则仍可见（`outsidePreset`）但不注入；`rules: []` 表示不限制；屏蔽预设等价于没有预设。
3. **本地快照回滚。** 覆盖层与用户包清单写前快照到 `revisions/`，每文件保留 20 份，`GET/POST /revisions` 列出与恢复；项目文件交给 git，不进快照。
4. **显式路由优先于共享写入器。** 包生命周期、规则、预设各自一条路由（`/pack`、`/rule`、`/preset`），落点由 `resolveWrite` 与 `target` 决定并在响应里回报，不做隐式推断。

同期修掉两个缺陷：会话层 `preset` 之前不参与组装（选了不生效）；恢复最旧一份保留修订会 500 并顺带删掉该行（快照淘汰与恢复自写冲突，现用 `pin` 保护）。

验收证据（2026-11-09，`feat/workstyle-management`）：`test/smoke.mjs` 447 项、`test/panel-render.mjs` 291 项、`test/multipage-render.mjs` 97 项、`test/manage.mjs` 37 项全过；`git status --short pack/` 为空，内置包文件未被管理操作改写。

## 隐私约束

- 默认离线：只读本机已有会话与日志；只有打开 `#/market`、主动安装市场包或粘贴分享链接时才访问对应 HTTPS 地址，不上传。
- 蒸馏只输出聚合统计（数量、比例、关键词计数），不落盘 prompt 原文。
- 状态、报告、导出包全部留在 `$DSH_HOME/workstyle/`。

## 验证方式

- 六套，共 1004 项：`test/smoke.mjs` 502（工具 / 路由 / 命令 / 启停 / 采纳与撤销 / 包生命周期 / 预设白名单 / 修订与回滚 / 导出 tar 往返 / 市场降级 / 市场包删除恢复与更新）、`test/panel-render.mjs` 293（渲染、搜索、筛选、折叠、分发、构建标记、无营销文案、样式作用域）、`test/multipage-render.mjs` 97（多页路由与导航、蒸馏、度量、缺失包恢复）、`test/manage.mjs` 37（快照保留上限、恢复、写盘落点）、`test/market.mjs` 61（注册表校验 / 缓存 TTL / stale 回退 / 构建确定性 / 篡改检测）、`test/bootstrap.mjs` 14（默认包本地快照安装 / 幂等 / 删除后不重装 / 0.2.x 迁移 / 离线）。
- 隔离实例：`dsh --profile web --patch <patch.yml>` + 临时 `DSH_HOME`，Chrome headless CDP 截图验证面板。
- 真实环境：重启 DeepSeek Harness 后实测面板与工具（本地 link 安装的插件必须重启才加载）。


### 2026-11-09 分享面（已实现，0.2.0）

1. **手动导出仍是兜底，但不再是唯一路径。** 面板可从导出结果直接下载归档；包页支持目录 / `.tar.gz` / 带摘要链接三种导入。手动解压 + `workstyle_apply` 保持可用。
2. **摘要先于信任。** 导出返回 `sha256`；链接必须带 `#sha256`；归档与链接都先预览清单再 `confirm:true` 安装。插件不托管、不上传，也没有自动应用工具。
3. **导入是替换，不是合并。** 同 id 冲突返回 409，覆盖会把旧包移入 `trash/` 并可恢复；另存为会重写 `workstyle.json` 的 id；内置包 id 拒绝覆盖。
4. **边界写死在解析器里。** 20 MB 下载 / 100 MB 解压 / 5000 条目；拒绝路径穿越、绝对路径、符号链接 / 硬链接、重复条目与非 gzip 数据。

验收证据（2026-11-09）：`test/smoke.mjs` 491 项、`test/panel-render.mjs` 288 项、`test/multipage-render.mjs` 97 项、`test/manage.mjs` 37 项全过；`git status --short pack/` 为空。

### 2026-11-09 公开市场（0.3.0）

1. **目录是文本，归档在 Release。** `market/registry.json` 记录 id / 版本 / 作者 / 许可 / 规则与技能数 / `sha256` / 归档 URL；包源在 `market/packs/<id>/`（`workstyle.json` + `skills/*.md`）。`scripts/build-market.mjs` 生成确定性 `tar.gz`，CI 上传到滚动 `market` Release 并把摘要写回注册表；仓库和插件安装不背归档体积。
2. **市场只读渲染，安装复用既有路径。** `#/market` 浏览 / 搜索 / 预览规则与技能名，确认后走 `POST /import` 的 preview → apply；没有自动更新，也没有自动应用工具。
3. **在线可降级。** `GET /market` 缓存到 `$DSH_HOME/workstyle/market.json`（10 分钟 TTL，`?refresh=1` 强制刷新）；拉取失败回退缓存并标 `stale`，无缓存返回空目录，接口不 500。`DSH_WORKSTYLE_MARKET_URL` 可指向私有注册表。
4. **信任边界诚实。** `sha256` 只证明字节一致，不证明内容安全；规则会进系统提示、技能目录可带资源与脚本，所以合入 PR 仍需人工审查，安装仍需人确认；内置包 id 拒绝覆盖。
5. **贡献走 PR。** `market/README.md` 给出目录结构、`--write` 与 `--check`；CI 校验命名空间 id、semver、64 位 `sha256`、http(s) URL 且无凭据 / 无 fragment，`--check` 在注册表与源不一致时失败。

验收证据（2026-11-09）：`test/smoke.mjs` 499 项、`test/panel-render.mjs` 293 项、`test/multipage-render.mjs` 97 项、`test/manage.mjs` 37 项、`test/market.mjs` 61 项全过；`git status --short pack/` 为空。

### 2026-11-09 默认包迁移与更新（0.3.0）

1. **默认包从插件目录搬到市场源目录。** `pack/reference/` → `market/packs/fde-engineering/`，与其它市场包同构、可走 PR 审查。全新 profile 在 `state.json` 不存在时，把随插件分发的本地快照复制到 `$DSH_HOME/workstyle/packs/fde-engineering/` 并设为当前包；不联网，装完即可用。
2. **删除是用户的决定。** 引导只在「全新 profile」发生；一旦 `state.json` 存在就不再复制，删掉默认包重启也不会重装。
3. **市场包只读，改动落覆盖层。** 安装来源记在 `state.marketPacks`；规则 / 预设的包内写入、重命名被拒绝，删除 / 恢复保留托管标记；用户要改就写覆盖层，导出时照常带上。
4. **更新是「检查自动、执行手动」。** `GET /market` 用 semver 比较已安装版本与注册表版本，返回 `canUpdate` / `installedVersion`；面板显示「可更新 vX → vY」，用户确认后走 `POST /import` 的 `replace:true` + `market:true`，旧包移入 `trash/`，没有静默升级。

验收证据（2026-11-09）：`test/smoke.mjs` 502 项、`test/panel-render.mjs` 293 项、`test/multipage-render.mjs` 97 项、`test/manage.mjs` 37 项、`test/market.mjs` 61 项、`test/bootstrap.mjs` 14 项全过。
