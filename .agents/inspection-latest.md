# dsh-workstyle 项目审计报告（2026-11-08）

- **范围**：index.js（host）、lib/（pack/distill/export/scope/metrics/inject-text）、client.js（web 面板）、cordis.patch.yml、locale/、docs/、README.md；基线 `git ca0307f`（含未提交工作区改动）。
- **依据**：只读代码审查 + 实测 `node test/{smoke,panel-render,multipage-render}.mjs`（146+115+97=358 项检查全部通过）+ 两个独立子代理深审。
- **判定**：**NEEDS_FIX**（存在有证据的缺陷，无安全级阻断；功能面整体健康）。

## 一、验证结果（实测）

| 测试 | 结果 |
|---|---|
| test/smoke.mjs | ALL 146 CHECKS PASSED |
| test/panel-render.mjs | PANEL RENDER: 115 CHECKS PASSED |
| test/multipage-render.mjs | MULTIPAGE RENDER: 97 CHECKS PASSED |

安全面：无命令注入（distill spawnSync 数组传参，lib/distill.js:139）；无 XSS/DOM 注入（client.js 全程 `h()` 文本节点，无 innerHTML）；session id 白名单清洗（lib/scope.js:120-122）。✅

## 二、已证实缺陷（按优先级）

### P1 高
1. **状态写入非原子 + 无并发保护**：`lib/pack.js:46-51` writeState、`lib/scope.js:35-38` writeJson、`index.js:244` overrides、`lib/distill.js:274-275` 报告、`lib/export.js:233-234` 导出归档均直接 `writeFileSync`，无 temp+rename。adopt/toggle/preset 的 HTTP 路由可并发触发 read-modify-write（lost update）；`readState`（pack.js:36-44）catch 后返回 `{}`，一次半截写即**静默清空全部 adoptions/presets**。adopt 还是两步写（state + overrides，index.js:495-501）非事务。
   **修复**：统一 temp-file + `fs.renameSync` 原子写；给 writeState 加简单互斥（串行化 promise 队列即可）。

### P2 隐私
2. **Codex thread_name 原文落盘**：`lib/distill.js:109-111` `threadNames = names.slice(-10)` 原样写进报告，违反 README:94「不保存 prompt 原文」承诺；`topProjects`（:92）保留完整项目路径。
   **修复**：只留计数/哈希，或删掉该字段。

### P3 中
3. **全局技能禁用不参与 scope 合成**：`index.js:341` scopeFor 只传 disabledGlobal 的 rules；`lib/scope.js:298-301` 只用 project/session 层 → `/scope`、`/metrics` 的 skills 计数把全局禁用技能算作启用，与 buildStatus（index.js:290）和 skills provider（index.js:607）口径矛盾。
4. **`/scope` POST（index.js:1096）与 `/rule`（:1152）cwd 零校验**：可在宿主可写的任意目录创建 `.dsh/workstyle.json`。**修复**：校验 cwd 为已存在目录。
5. **面板 evidence 请求无代际守卫（陈旧覆盖竞态）**：`client.js:1210-1213` 不检查 `requestId === statusRequest.current`；reports/exports 两条并行 fetch（1188-1197）反而都有守卫。

### P4 低
6. 导出文件名解析用 `lastIndexOf('-v')`（index.js:142-148），pack id 含 `-v` 时切错。
7. session 层 enabled/disabled 同 id 冲突时 enabled 静默胜出（lib/scope.js:281），README:45 承诺的冲突提示未兑现。
8. presetScope 只认 project.preset（lib/scope.js:333），state.activePreset 或请求参数时误标 'workspace'。
9. **i18n 硬编码**：client.js 大量中文绕过 t()（:1520-1521、2220、2280-2322、2333-2410、2418-2427 等），英文界面下仍是中文。
10. `t('about')` 使用字典不存在的 key（client.js:2181），fallback 显示裸 key。
11. zh/en 字典 severityHigh/Medium/Low 重复定义两次（client.js:108-110 与 207-209，en 同）；约 37 个 v4 遗留死 key 未清理。
12. 潜在 TypeError：`tpl.text.slice(0,90)`（client.js:2106）、`inj.text.split('\n')`（:1920）字段缺失时抛错（当前后端总会给 text，属防御缺失）。

### 非阻塞建议
- distill 的 spawnSync 阻塞事件循环（最多 20s×N 会话），蒸馏期间全部路由卡死。
- export.js:68-81 walk 用 statSync 跟随 symlink，技能目录 symlink 环可无限递归。
- readJsonBody（index.js:257）解析失败静默当 `{}`，应返回 400。
- pack.js:196 CJK 三元两分支相同（死代码）；export.js:159 `replace('T','T')` no-op。
- 每次 status 刷新强制收起"已处理"列表（client.js:1208）；loadEnv 部分失败保留旧指纹可能误导（:1152-1168，有意为之但建议标注"可能过期"）。
- pack frontmatter 解析遇值内 `\n---` 截断。
- HTTP 路由无鉴权（本地信任边界内可接受，建议 README 明示）。

## 三、文档不一致（已证实）

| 位置 | 文档 | 实际 |
|---|---|---|
| README.md:102 | 冒烟「82 项」 | 146 项 |
| README.md:103 | panel-render「44 项」 | 115 项（另 multipage 97 项未提） |
| README.md:56 | 路由「13」 | 17 路由/16 唯一路径（漏 /pack、/reports、/exports） |
| README.md:13 | 指标含「规则遵守度」 | metrics.js:5-8,:150 明确拒绝遵守率，与 :49「不出现遵守率」自相矛盾 |
| README.md:61 | 工具 `workstyle_unadopt` | 不存在（只有 /unadopt 路由和 `/workstyle undo` 命令） |
| docs/PLAN.md:42-43 | 路由「8」、P2 里程碑⬜ | 17 路由、preset/metrics 已实现，未勾 |

另：docs/HOME-V4.md 已被 V5 取代，建议移入 docs/archive/；PLAN.md 建议按 fde-reconcile 校准。git 工作区有 6 处修改 + 13 个未跟踪文件（含 lib/scope.js、lib/metrics.js 等核心源码）未提交，建议尽快固化。

## 四、修复路线（建议顺序）

1. B1 原子写 + writeState 互斥（P1）
2. 删/哈希化 threadNames（P2，一行改动）
3. scopeFor 传入 disabledFor().skills（P3-3）
4. /scope、/rule 校验 cwd（P3-4）+ evidence 请求代际守卫（P3-5）
5. README/PLAN 数字与清单校准；归档 HOME-V4
6. i18n 清理 + 死 key 清理（P4，可合并一次提交）

## 剩余开放事项

- 未做真机（Harness GUI）双击/慢网/双开面板实测，client 状态机结论基于代码推演。
- zstd maxBuffer 96MB 对超大 DSH 会话的截断风险未实测。

## 修复状态（2026-11-08 第二轮，全部落地并验证）

- **P1 原子写**：`writeJsonAtomic`（tmp + renameSync）落地于 lib/pack.js（writeState、readState 损坏时改存 `.corrupt` + 日志）、lib/scope.js、lib/distill.js、lib/export.js（tar.gz、导出元数据）、index.js（writeDisabled）。✅
- **P2 隐私**：lib/distill.js threadNames 原文不再落盘，只存 `threadNameCount`。✅
- **P3**：scopeFor 合成补全局禁用技能（composeScope 新参 disabledGlobalSkills）；`/scope`、`/rule` 增加 cwd statSync 校验与 body 空校验；client.js evidence fetch 加 requestId + envQuery 代际守卫。✅
- **P4**：listExportMetadata 改正则 `/^(.*)-v([^-]+)-\d{4}-\d{2}-\d{2}T.*\.tar\.gz$/`；sessionConflicts 显式输出；presetScope 按 project>session>workspace 判定；i18n 全量替换（client.js 硬编码中文→t()/scopedT()，新增约 80 个 zh/en key，删除 36 个死 key，severity 字典去重，新增 about/rulesLabel/skillsLabel 等）；tpl.text/inj.text 空值防御；CJK 死三元删除；export.js no-op replace 清理；walk 用 tryLstat 防 symlink 环。✅
- **文档**：README（146/115/97 项测试、17 项路由注册、移除"规则遵守度"、标注 workstyle_unadopt 不存在）；docs/PLAN.md（路由 17、smoke 146、P2 标 ◐：init 模板未实现）；docs/HOME-V4.md 顶部加已归档横幅。✅
- **验证**：smoke 146 / panel-render 115 / multipage-render 97 全部通过（acorn 解析 client.js 及全部 lib/index 通过）。
- **新发现并修复的过程 bug**：i18n 批量替换曾丢失 3 处右括号（pack tile、readOnlyResource、返回工作方式包链接）及 1 处 `t()` 误用于无 t 作用域组件（Loading/EnvironmentContextBar）——已由 acorn + 渲染测试捕获并修复。

## 剩余开放事项（更新）

- 未做真机（Harness GUI）双击/慢网/双开面板实测，client 状态机结论基于代码推演。
- zstd maxBuffer 96MB 对超大 DSH 会话的截断风险未实测。
- docs/PLAN.md P2 的 `init` 项目模板仍未实现。
- git 工作区有大量修改与未跟踪文件，建议尽快分批提交固化。
