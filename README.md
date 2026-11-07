# dsh-workstyle · 工作方式即代码

把一个人的工作方式（规则、技能、预设、模板）打包成可安装、可版本化、可度量的 DeepSeek Harness 插件。

> Work style as code: package a person's working habits — rules, skills, presets, templates — into an installable, versionable, measurable DSH plugin.

## 它解决什么

技能包解决「会不会」，本插件解决「像不像你」。

- **像你**：把从真实会话里提炼的规则注入系统提示，模型按你的方式工作（先方案、证据优先、验证后才宣称完成、中文短句）。
- **能复制**：工作方式是一个 `workstyle.json` 包，可导出、提交、安装。同事装上就获得同一套工作方式。
- **可度量**：内置采纳指标（先方案率、改完验证率、规则遵守度），能看到「像不像」是否在变好。

## 安装

1. 将本目录放到任意路径，例如 `~/Code/zhurong/dsh-workstyle`。
2. 在 DeepSeek Harness 中安装该目录为插件（插件管理器 → 从本地目录安装）。
3. 重启或等待 HMR 后，侧边栏出现「工作方式」入口。

## 使用

- 侧边栏面板：查看当前生效的 Pack、规则、技能与采纳证据。
- 命令：`/workstyle status | apply <pack> | distill`
- Agent 工具：`workstyle_status`、`workstyle_list`、`workstyle_apply`、`workstyle_distill`、`workstyle_evidence`

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

无运行时依赖，纯 ESM。Host 侧 `index.js` + `lib/`，Web 面板 `client.js`，清单 `cordis.patch.yml`。

## 许可

本插件 MIT。内置参考技能包来自 iannil/skills，MIT，见 `pack/reference/skills-LICENSE`。
