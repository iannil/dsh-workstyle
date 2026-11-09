# 使用手册 · dsh-workstyle

> 面板细节、命令全集、Agent 工具与 HTTP 路由。想先跑起来看 [README](../README.md#3-分钟上手)。

## 1. 面板：八个页面

侧边栏「工作方式」不是控制台，是**这轮工作方式的环境视图**——能看到载入了什么、按哪个作用域、想用什么套件、有没有真的改变行为。面板按页面组织，地址栏 `#/` 后即路径。

| 路径 | 用途 |
| --- | --- |
| `#/overview` | 首屏：状态带（注入中 N 条、各层贡献、技能数、当前预设、注入指纹、最近蒸馏时间）、待办条、载入预览（与系统提示同一份 `renderRules()` 输出 + `sha256` 前 12 位）、运行态卡片与包切换 |
| `#/pack` | 包列表：切换、新建、从目录导入、删除进回收站、回收站列出与恢复 |
| `#/pack/<id>` | 包详情：规则 / 技能 / 预设 / 模板，标注「只读」还是可写；可写包可重命名、删除 |
| `#/rules` | 有效规则：按作用域筛选，编辑 / 移除 / 恢复；每行标出「将写入」哪个落点；规则来自内置包时改的是覆盖层 |
| `#/presets` | 预设与组装：一键切换，编辑器按白名单勾选规则；复制、删除、屏蔽随包分发的预设并恢复，被会话占用时提示 |
| `#/skills` | 技能：搜索、按启用状态筛选、逐条启停 |
| `#/distill` | 蒸馏证据：最近一次报告、建议规则逐条采纳 / 忽略 |
| `#/metrics` | 度量：规则命中、先方案率、验证率、蒸馏覆盖，每个都写出分母与算法；**不出现遵守率或违反率** |
| `#/distribute` | 导出包 + 作用域快照、复制安装命令、修订历史（列出快照，可回滚） |

`#/pack` 与 `#/pack/<id>` 是同一条路由的两种视图（列表 / 详情），其余各一条，共 8 条路由。页脚构建标记 `home v5`，可用来确认新面板已加载。旧地址 `#/run` 落到 `#/metrics`，`#/packs` 落到 `#/overview`（带包 id 时落到 `#/pack/<id>`）。

## 2. 三层作用域

| 层 | 位置 | 典型用途 |
| --- | --- | --- |
| 全局 | `$DSH_HOME/workstyle/` | 跨项目通用的工作习惯 |
| 项目 | `<cwd>/.dsh/workstyle.json` | 跟着仓库走的约定，可提交给同事 |
| 会话 | `$DSH_HOME/workstyle/sessions/<id>.json` | 一次性实验，结束即弃 |

叠层顺序：全局 → 项目 → 会话，后层覆盖前层。停用项只影响系统提示与技能候选，不写入导出包。

## 3. 命令

```text
/workstyle status               # 当前注入了什么、指纹、作用域贡献
/workstyle apply <pack>         # 切换到某个 pack（id 或绝对目录）
/workstyle distill              # 扫描本机会话，产出聚合报告与建议规则
/workstyle adopt <id|all>       # 把建议规则并入当前包
/workstyle undo <id>            # 撤销某条已采纳规则
/workstyle on <id>              # 启用某条规则 / 某个技能
/workstyle off <id>             # 停用（只影响本机，不改包文件）
/workstyle export               # 导出 tar.gz 包
```

## 4. Agent 工具（8 个）

| 工具 | 作用 |
| --- | --- |
| `workstyle_status` | 读取当前生效规则、作用域、指纹 |
| `workstyle_list` | 列出可用 pack 与其规则 / 技能 |
| `workstyle_apply` | 切换到指定 pack |
| `workstyle_distill` | 扫描本机会话，产出聚合报告 |
| `workstyle_evidence` | 读取最近一次蒸馏的聚合证据 |
| `workstyle_adopt` | 采纳建议规则（`all` 或规则 id） |
| `workstyle_toggle` | 启停单条规则或技能 |
| `workstyle_export` | 导出可分发包 |

没有独立的 `workstyle_unadopt`——撤销走命令 `/workstyle undo <id>`。

## 5. HTTP 路由（17 个路径 / 20 项注册）

`/api/dsh-workstyle/` 下。`pack`、`scope`、`revisions` 各挂 GET + POST，因此是 17 个路径、20 项注册（smoke 断言的也是路径数）。

```text
status(GET)  pack(GET)  pack(POST)  reports(GET)  exports(GET)  evidence(GET)
apply(POST)  distill(POST)  adopt(POST)  unadopt(POST)  toggle(POST)
scope(GET)  scope(POST)  inject(GET)  metrics(GET)
rule(POST)  preset(POST)
revisions(GET)  revisions(POST)  export(POST)
```

## 6. 管理与落点

每个实体只有一个落点，避免「改了但不知道写进哪」。

| 实体 | 写入位置 | 说明 |
| --- | --- | --- |
| **pack** | `packs/<id>/`（用户包） | `POST /pack` 的动作：`apply` / `create` / `duplicate` / `rename` / `delete` / `restore` / `import` |
| **rule** | `POST /rule` 的 `target` 四选一 | `overlay`：本机 `state.json` 的 `rulePatches` / `ruleRemovals`，内置包与用户包都可用，不动 `pack/`；`pack`：直接改用户 JSON 包的 `workstyle.json`；`project`：`<cwd>/.dsh/workstyle.json`；`session`：`sessions/<id>.json` |
| **preset** | 覆盖层 `state.presets` 或用户包清单 | `POST /preset` 的动作：`save` / `use` / `delete` / `block` / `unblock` / `duplicate` |
| **template** | 随预设与包清单走 | 无独立路由，导出时原样带走 |
| **skill** | `skills/<name>/` | 只读分发；启停记在 `overrides.json` 与各层 `disabledSkills` |

规则移除是墓碑：`ruleRemovals` 记 id，规则仍在 `/scope` 里以 `removed: true` 出现（面板显示「已移除」），`POST /rule {target:'overlay', action:'restore'}` 抹掉墓碑即恢复注入。

**预设是白名单**。`preset.rules` 列出的规则才参与注入；没列出的规则仍然可见，标 `outsidePreset`，不注入也不计入注入数。`rules: []` 表示不限制。被屏蔽的预设不出现在 `scope.presets`，只在 `scope.blockedPresets` 里列出，效果等同没有预设；删除正被某个会话使用的预设会被拒绝（`400`），确认后带 `force: true` 才执行。

## 7. 回滚

写入前先快照，是这一层唯一的「后悔药」。

- **快照位置**：`$DSH_HOME/workstyle/revisions/<文件哈希前 10 位>/<时间戳>.json`，索引在 `revisions/index.json`。
- **保留上限**：每个文件最近 **20** 份，超出按最旧淘汰；同一毫秒的多次写入用 `-1` / `-2` 后缀区分，不会互相覆盖。
- **接口**：`GET /revisions`（可选 `?file=<绝对路径>` 过滤）列出 `{id, at, bytes, reason, file}`；`POST /revisions {action:'restore', id}` 恢复，恢复本身也先快照，且不会被这次写入挤掉。
- **谁被快照**：`state.json`（覆盖层：规则补丁 / 墓碑 / 预设 / 采纳记录）与用户包清单 `workstyle.json`；包的 create / duplicate / rename 和规则、预设的改包写入都走同一条 `commit()` 路径。
- **谁不被快照**：项目文件 `<cwd>/.dsh/workstyle.json`（跟着仓库走，由 git 负责历史，`POST /rule {target:'project'}` 返回 `revision: null`）与会话文件 `sessions/<id>.json`（一次性实验，重写即覆盖）。

## 8. 蒸馏 → 采纳 → 导出

1. `workstyle_distill`（或面板「蒸馏证据」）扫描本机会话，产出聚合报告与建议规则，写入 `$DSH_HOME/workstyle/reports/`。
2. `workstyle_adopt` / 面板勾选，把建议规则并入当前包；命令 `/workstyle undo <id>` 撤销。
3. `workstyle_export` 生成 `$DSH_HOME/workstyle/exports/<pack>-v<版本>-<时间戳>.tar.gz`：
   - `workstyle.json`：**有效视图**——覆盖层补丁已应用、被移除的规则已剔除、被屏蔽的预设已剔除，本机预设 / 模板与采纳规则一并带上；
   - `manifest.json`：导出清单（规则数、技能数、文件列表、来源），并记录 `overlay:{patched, added, removed}`；
   - `README-EXPORT.md`：接收方安装说明；
   - `skills/**`：技能文件原样。
4. 接收方解压后 `/workstyle apply /path/to/extracted` 即可获得同一套工作方式。

## 9. 数据目录

`$DSH_HOME/workstyle/`：

| 文件 | 内容 |
| --- | --- |
| `state.json` | 当前包、`adoptions`、本机 `presets` / `templates`、覆盖层 `rulePatches` / `ruleRemovals` / `presetBlocked` |
| `overrides.json` | 本机启停 |
| `reports/` | 蒸馏报告 |
| `exports/` | 导出包 |
| `packs/` | 用户自建 / 导入的包 |
| `trash/` | 被删除的包（`<id>-<时间戳>/`），可恢复，不自动清理 |
| `revisions/` | 写盘前快照，每个文件 20 份 |
| `sessions/` | 会话层作用域，不自动清理 |

## 10. 已知限制

以下都是当前行为的准确描述，不是待办承诺。

1. **会话预设不进实时系统提示。** 实时系统提示段落只组装工作区作用域（`scopeFor({})`），宿主组装上下文时拿不到会话身份；所以在 `/scope?session=` 与 `/inject?session=` 里能看到会话选的预设生效，但模型收到的那段提示不变。
2. **预设编辑器只改规则成员。** 预设里的 `skills` / `templates` 原样保留，面板不提供增删技能或模板的勾选。
3. **可写性靠路径推断。** 面板用「包目录是否位于 `workstyle/packs/` 之下」判断可写，没有独立的权限清单；把包放在别处即视为只读。
4. **导出不跟随符号链接。** 导出遍历技能目录时跳过符号链接文件（防止链接环），因此 `rc-text-assistant` 的 `philosophy-corpus.md`（指向 `rc-philosophy-advisor` 的符号链接）不会进入导出包。
5. **`trash/` 与 `sessions/` 不做垃圾回收。** 删除的包与会话作用域文件一直保留，需要时手动清理。
