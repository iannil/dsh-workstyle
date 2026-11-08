# dsh-workstyle · 工作方式即代码

把一个人的工作方式（规则、技能、预设、模板）打包成可安装、可版本化、可度量的 DeepSeek Harness 插件。

> Work style as code: package a person's working habits — rules, skills, presets, templates — into an installable, versionable, measurable DSH plugin.

## 它解决什么

技能包解决「会不会」，本插件解决「像不像你」。

- **像你**：把从真实会话里提炼的规则注入系统提示，模型按你的方式工作（先方案、证据优先、验证后才宣称完成、中文短句）。
- **能复制**：工作方式是一个 `workstyle.json` 包，可导出、提交、安装。同事装上就获得同一套工作方式。
- **可度量**：内置采纳指标（先方案率、改完验证率、未验证宣称完成率；只统计可复算的代理指标，不推断模型是否遵守规则），能看到「像不像」是否在变好。

## 安装

从市场 / GitHub 源码安装（推荐，装完重启 DeepSeek Harness）：

```sh
dsh plugin --profile <你的 profile> add github:iannil/dsh-workstyle
```

本地开发安装（改代码即时生效）：

1. 将本目录放到任意路径，例如 `~/Code/zhurong/dsh-workstyle`。
2. 在 DeepSeek Harness 中安装该目录为插件（插件管理器 → 从本地目录安装）。
3. 重启后，侧边栏出现「工作方式」入口。

> 本地 link 安装的插件需要重启 Harness 才会加载新的 JS；装完看首屏状态带与页脚 `home v5` 即成功。

## 3 分钟上手

装完并重启后，按这三步确认「已经生效」，不必先读完整手册：

1. **打开侧边栏「工作方式」**，看状态带是否有「注入中 N」和一串指纹。有指纹 = 规则已进系统提示。页脚应出现 `home v5`。
2. **新开一个对话**，说一句真实需求（例如「帮我给这个项目加登录」）。正常时应先给可评审方案（目标 / 改动点 / 验收），而不是直接改代码。
3. **回到面板点「载入预览」**，核对真实注入文本；与指纹不一致就点刷新。首次打开会看到可关闭的「3 分钟上手」提示，点「知道了」后不再出现。

之后若要蒸馏、采纳、导出或改作用域，再看下一节「使用」。

## 使用

- 侧边栏面板是**工作方式环境**（不是控制台）：
  - **状态带**：一行说清这轮载入了什么——注入中几条规则、全局/项目/会话各贡献多少、技能启用数、当前预设、注入文本指纹、最近蒸馏时间；
  - **待办条**：蒸馏建议待审、规则缺证据、作用域冲突、未验证宣称，带数字，点击跳转；
  - **① 载入预览**：系统提示里真实的那一段（同样的 `renderRules()` 输出）+ `sha256` 前 12 位指纹 + 字符数，可展开全文、可复制；
  - **② 有效规则**：每行带作用域徽标（全局 / 项目 / 会话），停用项显示「被覆盖 · 会话」而不是消失；项目层规则可新建、编辑、移除；
  - **③ 预设与组装**：规则 > 预设（组合） > 技能 > 模板；预设卡一键切换，下方页签看规则/技能/模板；
  - **④ 度量**：规则命中、先方案率、验证率、蒸馏覆盖，每个都写出分母与算法；**不出现遵守率或违反率**；
  - **⑤ 分发**：导出包 + 作用域快照、导出包（仅包）、复制安装命令。
  - 页脚构建标记 `home v5`，可用来确认新面板已加载。
- 三层作用域：全局（`$DSH_HOME/workstyle/`）→ 项目（`<cwd>/.dsh/workstyle.json`）→ 会话（`$DSH_HOME/workstyle/sessions/<id>.json`）。
- 停用项只影响系统提示与技能候选，不写入导出包。
- 命令：`/workstyle status | apply <pack> | distill | adopt <id|all> | undo <id> | on <id> | off <id> | export`
- Agent 工具（8）：`workstyle_status`、`workstyle_list`、`workstyle_apply`、`workstyle_distill`、`workstyle_evidence`、`workstyle_adopt`、`workstyle_toggle`、`workstyle_export`
- HTTP 路由（17 项注册）：`/api/dsh-workstyle/{status,pack,reports,exports,evidence,apply,distill,adopt,unadopt,toggle,export,scope,inject,metrics,rule,preset}`

## 蒸馏 → 采纳 → 导出

1. `workstyle_distill`（或面板「蒸馏证据」）扫描本机会话，产出聚合报告与建议规则，写入 `$DSH_HOME/workstyle/reports/`。
2. `workstyle_adopt` / 面板勾选，把建议规则并入当前包；命令 `/workstyle undo <id>` 撤销（无独立 `workstyle_unadopt` 工具）。
3. `workstyle_export` 生成 `$DSH_HOME/workstyle/exports/<pack>-<version>-<时间戳>.tar.gz`：
   - `workstyle.json`：合并采纳规则后的有效包；
   - `manifest.json`：导出清单（规则数、技能数、文件列表、来源）；
   - `README-EXPORT.md`：接收方安装说明；
   - `skills/**`：技能文件原样。
4. 接收方解压后 `/workstyle apply /path/to/extracted` 即可获得同一套工作方式。

## 内置参考 Pack

`pack/reference/` 附带一个 FDE 工程工作方式包：

- 7 条规则：先方案后实现、证据优先、验证后才宣称完成、中文短句先结论、产物化、范围守卫、本地隐私。
- 40 个技能，来自 [iannil/skills](https://github.com/iannil/skills)（MIT），commit `b75ace6`，已随包附带许可证。

## Pack 格式

```json
{
  "id": "fde-engineering",
  "displayName": "FDE 工程工作方式",
  "version": "0.1.0",
  "rules": [{ "id": "plan-first", "title": "先方案后实现", "text": "…", "evidence": "…" }],
  "skills": { "dir": "skills", "source": "…", "license": "MIT" },
  "measures": [{ "id": "plan-first-rate", "title": "先方案率", "definition": "…" }]
}
```

Pack 放在插件 `pack/<id>/` 或 `$DSH_HOME/workstyle/packs/<id>/`；技能放 `skills/<name>/SKILL.md`。

## 隐私

- 只读取本机已有会话记录，不联网、不上传。
- `distill` 只输出聚合统计（数量、比例、关键词计数），不保存 prompt 原文。
- 状态与报告存于 `$DSH_HOME/workstyle/`。

## 开发

无运行时依赖，纯 ESM。Host 侧 `index.js` + `lib/`（`pack.js` 包模型、`distill.js` 蒸馏、`export.js` tar.gz 导出），Web 面板 `client.js`，清单 `cordis.patch.yml`。

```bash
node test/smoke.mjs        # 146 项冒烟检查：工具 / 路由 / 命令 / 启停 / 采纳与撤销 / 导出 tar 往返
node test/panel-render.mjs # 115 项面板渲染检查：状态/搜索/筛选/启停/折叠/分发/构建标记、无营销文案
node test/multipage-render.mjs # 97 项多页路由渲染检查：导航/分发/蒸馏/度量/缺失包恢复
```

系统未装 Node 时可用 Harness 自带运行时：

```bash
ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" test/smoke.mjs
ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" test/panel-render.mjs
```

数据目录：`$DSH_HOME/workstyle/`（`state.json` 状态与采纳记录、`overrides.json` 本地启停、`reports/` 蒸馏报告、`exports/` 导出包）。

## 许可

本插件 MIT。内置参考技能包来自 iannil/skills，MIT，见 `pack/reference/skills-LICENSE`。
