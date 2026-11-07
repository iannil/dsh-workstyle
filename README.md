# dsh-workstyle · 工作方式即代码

把一个人的工作方式（规则、技能、预设、模板）打包成可安装、可版本化、可度量的 DeepSeek Harness 插件。

> Work style as code: package a person's working habits — rules, skills, presets, templates — into an installable, versionable, measurable DSH plugin.

![工作方式面板](docs/verification/panel-v2-top.png)

## 它解决什么

技能包解决「会不会」，本插件解决「像不像你」。

- **像你**：把从真实会话里提炼的规则注入系统提示，模型按你的方式工作（先方案、证据优先、验证后才宣称完成、中文短句）。
- **能复制**：工作方式是一个 `workstyle.json` 包，可导出、提交、安装。同事装上就获得同一套工作方式。
- **可度量**：内置采纳指标（先方案率、改完验证率、规则遵守度），能看到「像不像」是否在变好。

## 安装

从市场 / GitHub 源码安装（推荐，装完重启 DeepSeek Harness）：

```sh
dsh plugin --profile <你的 profile> add github:iannil/dsh-workstyle
```

本地开发安装（改代码即时生效）：

1. 将本目录放到任意路径，例如 `~/Code/zhurong/dsh-workstyle`。
2. 在 DeepSeek Harness 中安装该目录为插件（插件管理器 → 从本地目录安装）。
3. 重启后，侧边栏出现「工作方式」入口。

> 本地 link 安装的插件需要重启 Harness 才会加载新的 JS；装完在面板里能看到「当前生效」区即成功。

## 使用

- 侧边栏面板：
  - 顶部「当前生效」区：包名、版本、规则/技能数、包目录与最近蒸馏时间，右上角可直接切换包；
  - 「规则」区按编号列出规则全文与本地证据，蒸馏采纳的规则带「蒸馏采纳」标记，可随时「撤销」；
  - 「蒸馏建议」区列出 `distill` 产出的建议规则（含置信度与证据），勾选后「采纳选中 / 全部采纳」写入当前包（进入系统提示、随包导出）；
  - 「技能」区展示内置技能（默认展示 12 个，可展开全部）；
  - 「本地证据源」区展示 Claude Code / Codex / DSH / Pi 的真实会话计数与采样情况；
  - 工具栏「导出包」一键生成可分发的 `.tar.gz`。
- 命令：`/workstyle status | apply <pack> | distill | adopt <id|all> | undo <id> | export`
- Agent 工具：`workstyle_status`、`workstyle_list`、`workstyle_apply`、`workstyle_distill`、`workstyle_evidence`、`workstyle_adopt`、`workstyle_export`
- HTTP 路由：`/api/dsh-workstyle/{status,evidence,apply,distill,adopt,unadopt,export}`

## 蒸馏 → 采纳 → 导出

1. `workstyle_distill`（或面板「蒸馏证据」）扫描本机会话，产出聚合报告与建议规则，写入 `$DSH_HOME/workstyle/reports/`。
2. `workstyle_adopt` / 面板勾选，把建议规则并入当前包；`workstyle_unadopt`（命令 `/workstyle undo <id>`）撤销。
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
node test/smoke.mjs   # 58 项冒烟检查：7 工具 / 7 路由 / 命令 / 采纳与撤销 / 导出 tar 往返
```

系统未装 Node 时可用 Harness 自带运行时：

```bash
ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" test/smoke.mjs
```

数据目录：`$DSH_HOME/workstyle/`（`state.json` 状态与采纳记录、`reports/` 蒸馏报告、`exports/` 导出包）。

## 许可

本插件 MIT。内置参考技能包来自 iannil/skills，MIT，见 `pack/reference/skills-LICENSE`。
