# FDE 工程工作方式（参考包）

这是 `dsh-workstyle` 自带的参考 pack：一套可安装、可版本化、可度量的工作方式。

## 组成

- **规则（rules）**：7 条，来自对本机会话数据的蒸馏，见 `workstyle.json`。安装后以 system prompt 段注入，任何模型都会先读到。
- **技能（skills）**：40 个 SKILL.md，来自 [iannil/skills](https://github.com/iannil/skills)（MIT，commit `b75ace6`），覆盖 FDE 流程、需求/架构/验收、写作与 RC 方法。
- **度量（measures）**：先方案率、改完验证率、未验证宣称完成率、规则遵守度。

## 使用

```bash
# 查看状态
dsh-workstyle status
# 应用某个 pack（默认 fde-engineering）
dsh-workstyle apply fde-engineering
# 从本机会话蒸馏新证据
dsh-workstyle distill
```

或在 DSH Web 的侧边栏打开「工作方式」面板。

## 复制给同事

1. 把 pack 目录（`workstyle.json` + `skills/`）打包进任何 npm 包或 GitHub Release；
2. 同事安装 `dsh-workstyle` 后，把 pack 放到 `$DSH_HOME/workstyle/packs/<id>/` 或通过 `workstyle_apply` 指定路径；
3. 规则随 prompt 注入，技能随 `skills` provider 出现，度量随会话增长。

## 隐私

- 默认只读本机数据、不联网、不上传；只有打开市场、主动安装或粘贴分享链接时才访问 GitHub / 对应下载地址；
- 蒸馏只保存聚合统计与规则证据，不保存 prompt 原文；
- 参考包 MIT，署名见 `LICENSE` 与 `skills-LICENSE`。
