# 方案评审：dsh-workstyle 内部市场 + PR 分享

> 评审对象（用户原话）：「1 dsh-workstyle增加内部市场；2 允许通过提交pr到 dsh-workstyle git repo 的方式，将自己的工作方式分享给安装插件的其他人。先评估上面这个方案是否足够好」
>
> 评审依据：本仓 `index.js`、`lib/*.js`、`client.js`、`docs/PLAN.md`、`docs/USAGE.md`、`README.md`、`test/` 的真实实现。评审日：2026-11-09。

## 结论

**方向对，但作为「方案」还不够。** 这两条只定义了「一个市场」的名词和「一种贡献路径（PR）」，没有定义市场的**数据源、信任模型、更新语义、离线降级、治理责任**。按现状直接实现，三处必然返工：隐私承诺与联网冲突、装完即过期（无更新）、PR 评审变成无限责任。

建议先拍板 3 个决策（见文末），再按「路线 A（MVP）」落地；把 registry URL 做成配置项，A 天然可扩展成企业内网版 B。

## 一、现状事实（决定方案边界）

已经存在的分享能力，比方案描述的意识到的更完整：

| 能力 | 位置 | 事实 |
| --- | --- | --- |
| 导出可分发包 | `lib/export.js:181-277` | ustar+gzip，无依赖；`workstyle.json` 是有效视图（覆盖层应用后），带 `manifest.json`、`README-EXPORT.md`、`skills/**` |
| 带摘要链接导入 | `lib/import.js:53-70`、`index.js:720-780` | 链接必须带 `#sha256=<64hex>`；先 preview 清单，再人工 confirm |
| 归档安全边界 | `lib/import.js:24-28,170-232` | 20 MB 下载 / 100 MB 解压 / 5000 条目；拒绝路径穿越、绝对路径、符号链接/硬链接、重复条目、非 gzip |
| 冲突可恢复 | `index.js:823-825,859-868` | 同 id 返回 409；覆盖旧包移入 `trash/`；内置 id 永远拒绝 |
| 运行期联网点 | `index.js:742`、`lib/import.js:76-120` | **唯一**联网点是导入时的 `downloadArchive` |
| 离线/隐私承诺 | `README.md:109`、`docs/USAGE.md:145` | 「除主动粘贴分享链接外不联网、不上传」「不托管包、不做公共 registry」 |
| 包 id 规则 | `lib/manage.js:23` | `^[a-z0-9][a-z0-9-]{0,48}$`，**无命名空间** |
| 面板路由 | `client.js:1556` | 固定 8 页，**没有市场页** |
| 插件配置面 | `index.js:301`、`cordis.patch.yml` | `apply(ctx)` 无配置读取，`config: {}`，**registry URL 无处可配** |
| 包的实质风险面 | `index.js:913-960`、`lib/pack.js:233-249` | rules 直接进系统提示；skills 以 text + `resourceBase`（目录）注册——市场包是**行为供应链**，不是纯数据 |

## 二、方案拆成两个部件，各回答什么

1. **内部市场** = 发现 + 安装 +（隐含）更新 + 治理。
2. **PR 到 repo** = 贡献 + 策展。

「PR 到 repo」只回答「包怎么进来」，**不回答**：字节从哪来、怎么校验、怎么更新、怎么下架、谁对内容负责。这两条不能互相替代。

## 三、关键缺口（按严重度）

1. **「内部市场」定义歧义（阻断）。** 是「插件内置的公开市场（同一 repo 的 `market/`）」还是「公司内部私有 registry」？前者公开托管，后者需要可配置 URL。两种的信任、托管、隐私结论相反。必须先拍板。
2. **与隐私承诺冲突（高）。** `README.md:109` / `docs/USAGE.md:145` 明说「不联网、不做公共 registry」。加市场必须改文案，并把「默认离线、仅在打开市场/主动安装时联网」做成实现与测试，否则文档与行为不一致。
3. **无更新语义（高）。** 现有导入是「替换不是合并」（`docs/PLAN.md:106`、`index.js:815-880`）。市场必须定义：版本比较、有新版本提示、更新前 diff（规则增/删/改）、失败回滚。缺这层，市场=装完即过期。
4. **信任模型只有 sha256，不够（高）。** `sha256` 只证明「字节 == registry 声明的字节」，不证明「reviewer 看过」。registry 与包同仓时，仓库被改可同时改两者。需要 provenance 标签（official / community）、审核 rubric、撤下流程。
5. **PR 作为唯一入口门槛过高且不可持续（中高）。** 非 GitHub 用户被排除；维护者要为任意规则/技能文本背书；包更新=再提一次 PR；插件 repo 会因技能资源膨胀。建议独立 market repo、或 GitHub Releases 托管归档 + 预填 issue/PR 模板。
6. **无命名空间 → id 冲突（中）。** `checkPackId` 只允许 `[a-z0-9-]`（`lib/manage.js:23`）。两个作者都叫 `fde` 就撞。需要 `author-pack` 约定或 `namespace` 字段。
7. **发现/规模（中）。** >20 个包后需要分类、搜索、排序、更新时间等信号；平铺目录不可用。
8. **治理/法务（中）。** 每包 license、第三方技能许可、DCO/CLA、下架与举报、内容红线（不得含密钥/外泄指令/prompt injection）。
9. **离线/内网（中）。** 拉取失败要降级到缓存 + 手动导入；内网私有 registry 要支持。
10. **测试与 CI（中）。** 仓库有 4 套约 919 断言（`README.md:118-122`）。市场必须加 registry schema 校验、fetch mock、安装/更新/回滚/离线测试，以及 PR 的 CI 校验器。
11. **版本耦合（低-中）。** 同 repo 的 market 改动合并即对所有装插件的人生效（无插件 release）：新鲜，但未经充分 review 的内容即时分发；可接受，但要有保护分支。
12. **安全渲染（低，已满足）。** `client.js` 无 `dangerouslySetInnerHTML`（grep 无命中）。市场描述按纯文本渲染即可，保持现状。

## 四、推荐路线

**A（推荐，MVP）：同 repo `market/` + registry + CI 校验 + 面板 `#/market`，安装复用现有 preview → confirm → import 管线。**

- v1 不做自动更新，只在已装包版本落后时显示「有新版本」，更新 = 再走一次导入并 preview diff。
- 手动导入仍是兜底，离线可用。
- 归档放 GitHub Releases（或独立分支），`market/` 只放 `registry.json`，避免插件安装包膨胀。
- registry URL 做成插件配置项，A 天然支持企业内网版 B。

**B（企业/内部）：registry URL 指向私有 git，其余同 A。** 适合「内部市场」的字面含义。

推荐先 A，并用配置项预留 B。

## 五、验收标准（可评审）

- [ ] `GET /market` 返回校验后的 registry，带缓存；fetch 失败返回 cached + `stale` 标记，不抛 500。
- [ ] 面板 `#/market`：列表 / 详情 / 搜索；安装走现有 `POST /import` preview→apply，不新增自动应用工具。
- [ ] registry 校验：命名空间 id、semver、`sha256` 64hex、http(s) URL、非空 license、rules/skills 计数、大小上限；非法条目拒绝并指出字段。
- [ ] 安装冲突 409；覆盖进 `trash/`；内置 id 拒绝。
- [ ] 版本比较：已装 < registry 时显示「可更新」；更新前展示规则增/删/改。
- [ ] 离线：无网络时市场页用缓存，手动导入仍可用。
- [ ] 隐私文案同步更新 `README.md` / `docs/USAGE.md` / `CHANGELOG.md`。
- [ ] 四套测试全过 + 新增 market 测试；`git status --short pack/` 为空。
- [ ] `CONTRIBUTING.md` 提交清单 + CI 校验器（PR 必过）。

## 六、待拍板（3 个决策）

1. **「内部市场」是公开内置市场，还是公司内部私有 registry？**（决定 URL / 托管 / 隐私文案）
2. **包归档放哪：同 repo `market/`、独立 repo、还是 GitHub Releases？**（决定 repo 膨胀与更新路径）
3. **v1 是否要「更新」能力，还是先只做「发现 + 安装」，更新留到 v2？**（决定是否先定义版本比较与 diff）

## 七、风险

- **供应链**：规则直接进系统提示，技能目录可带资源/脚本。市场 = 行为供应链，必须人工确认 + provenance + 撤下流程。
- **维护成本**：PR 评审是长期人力，不是一次性功能。
- **隐私承诺**：改文案容易，把「默认离线」做成实现与测试难。

## 八、决策记录（2026-11-09）

1. **公开内置市场**（不是公司私有 registry）；注册表 URL 可配置，必要时可指向私有地址。
2. **归档放 GitHub Releases**（滚动 `market` tag），仓库只存文本源；不把 `tar.gz` 提交进主仓库。
3. **v1 不做更新**：只做发现 + 安装，装完即止；版本比较与 diff 留到 v2。2026-11-09 追加：v2 已加 semver 检查与手动确认更新（下载 / 替换必须人点「更新」），仍不做自动升级，也不做内容 diff。
4. **贡献入口是 PR 到本仓库** `market/packs/<id>/`；`scripts/build-market.mjs --check` 由 CI 强制执行；`market/README.md` 即提交清单。
5. 上面 checklist 的「版本比较」一项按第 3 条取消；「`CONTRIBUTING.md`」落在 `market/README.md`。
6. **默认包随市场走**：`pack/reference/` 迁入 `market/packs/fde-engineering/`，全新 profile 用插件内本地快照自动安装；市场包只读，改动落覆盖层。
