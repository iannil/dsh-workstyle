# 使用手册 · dsh-workstyle

> 面板细节、命令全集、Agent 工具与 HTTP 路由。想先跑起来看 [README](../README.md#3-分钟上手)。

## 1. 面板：工作方式环境

侧边栏「工作方式」不是控制台，是**这轮工作方式的环境视图**——能看到载入了什么、按哪个作用域、想用什么套件、有没有真的改变行为。

| 区块 | 内容 |
| --- | --- |
| **状态带** | 一行说清这轮载入了什么：注入中几条规则、全局/项目/会话各贡献多少、技能启用数、当前预设、注入文本指纹、最近蒸馏时间 |
| **待办条** | 蒸馏建议待审、规则缺证据、作用域冲突、未验证宣称，带数字，点击跳转 |
| **① 载入预览** | 系统提示里真实的那一段（与后端同一个 `renderRules()` 输出）+ `sha256` 前 12 位指纹 + 字符数；可展开全文、可复制 |
| **② 有效规则** | 每行带作用域徽标（全局 / 项目 / 会话）；停用项显示「被覆盖 · 会话」而不是消失；项目层规则可新建、编辑、移除 |
| **③ 预设与组装** | 规则 > 预设（组合） > 技能 > 模板；预设卡一键切换，下方页签看规则 / 技能 / 模板 |
| **④ 度量** | 规则命中、先方案率、验证率、蒸馏覆盖，每个都写出分母与算法；**不出现遵守率或违反率** |
| **⑤ 分发** | 导出包 + 作用域快照、导出包（仅包）、复制安装命令 |

页脚构建标记 `home v5`，可用来确认新面板已加载。

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

## 5. HTTP 路由（17 项注册）

`/api/dsh-workstyle/` 下：

```text
status  pack  reports  exports  evidence
apply   distill  adopt  unadopt  toggle
export  scope(GET)  scope(PUT)  inject  metrics
rule    preset
```

## 6. 蒸馏 → 采纳 → 导出

1. `workstyle_distill`（或面板「蒸馏证据」）扫描本机会话，产出聚合报告与建议规则，写入 `$DSH_HOME/workstyle/reports/`。
2. `workstyle_adopt` / 面板勾选，把建议规则并入当前包；命令 `/workstyle undo <id>` 撤销。
3. `workstyle_export` 生成 `$DSH_HOME/workstyle/exports/<pack>-<version>-<时间戳>.tar.gz`：
   - `workstyle.json`：合并采纳规则后的有效包；
   - `manifest.json`：导出清单（规则数、技能数、文件列表、来源）；
   - `README-EXPORT.md`：接收方安装说明；
   - `skills/**`：技能文件原样。
4. 接收方解压后 `/workstyle apply /path/to/extracted` 即可获得同一套工作方式。

## 7. 数据目录

`$DSH_HOME/workstyle/`：

| 文件 | 内容 |
| --- | --- |
| `state.json` | 状态与采纳记录 |
| `overrides.json` | 本机启停 |
| `reports/` | 蒸馏报告 |
| `exports/` | 导出包 |
| `packs/` | 用户自建 pack |
| `sessions/` | 会话层作用域 |
