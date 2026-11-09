# 面板验证截图（历史）

`panel-v2-*.png`、`scratch-basic-panel.png`、`composed-profile-panel.png` 是 2026-11-08 面板 v2 时期的真实 GUI 截图，记录的是「介绍页」形态，仅供历史追溯，不再代表当前面板。

面板 v3（同日）把首屏改成操作台：状态行 + 四格运行态 + 待审建议置顶，规则默认折叠，技能为紧凑 chips，证据与来源默认折叠。改动纯前端，真实 GUI 需重启 DeepSeek Harness（或重新加载插件）后才生效；复验后在 `docs/verification/` 补新截图。

当前回归证据：

- `test/panel-render.mjs`：17 项渲染检查（操作台结构、规则展开、证据折叠、无营销文案）。
- `test/smoke.mjs`：58 项后端冒烟检查，确认本次前端改动未影响路由 / 工具 / 采纳 / 导出。

## panel-v4（2026-11-08）

v4 控制台在真实 DeepSeek Harness GUI 中的截图（1440×1000）：

- `panel-v4.png`：首屏。标题、section、规则、技能、评审共用同一条左缘；区块间距 36，规则行 50，技能行 42。
- `panel-v4-expanded.png`：展开首条规则后的正文与证据，正文与标题同缘，证据用左侧细线。
- `panel-v4-skills.png`：技能段。名称列 268px，完整展示长技能名，描述单行截断。
- `panel-v4-dark.png`：暗色主题。按钮、勾选框、section 标签对比度已复验。

已确认：

- 状态行 + 四格运行态 + 主行动在首屏；
- 全量评审时「已全部处理 · 5 条已在包内 / 查看已处理」折进 section header，不再占一段沉底摘要；
- 规则搜索 / 状态筛选 / 逐条勾选框可见，技能列表紧随其后；
- 页脚构建标记 `home v4 · 2026-11-08`。

## 当前回归证据

- `test/panel-render.mjs`：**44 项**渲染检查（操作台结构、搜索筛选、启停、展开、分发、样式作用域、全量评审折叠、无营销文案）。
- `test/smoke.mjs`：**82 项**后端冒烟检查（8 工具 / 8 路由 / 命令 / 启停 / 采纳 / 导出 tar 往返）。

复验方式：重启或刷新 Harness 后打开「工作方式」，页脚出现 `home v4` 即新面板已加载。样式作用域为 `#dsw-root`，勾选框 14px/4px 圆角，行 hover 5% 前景混合，明暗主题自动切换。

## panel-v5（2026-11-08）

v5 把首屏从「包的控制台」改成「工作方式环境」。设计见 `docs/HOME-V5.md`，示意图见 `docs/design/home-v5-sheet1-light.png`。

**截图来源**：用真机 API 的真实响应（`/status`、`/evidence`、`/scope`、`/inject`、`/metrics`，经 cookie 鉴权后取自 `http://127.0.0.1:55576`）喂给面板组件，再用无头 Chrome 渲染成图。因此像素是面板真实输出，不是示意图：

- `panel-v5-top.png`：首屏。标题、状态行、状态带、待办条、四锚点、①载入预览（真实注入 markdown + `sha256 85aead453ee3` + 610 字符）。
- `panel-v5-rules.png`：向下延伸，②有效规则 7 行（作用域徽标「全局」）、③预设三卡与「规则 · 7 / 技能 · 40 / 模板 · 3」页签。
- `panel-v5-presets.png`：③④ 区域。
- `panel-v5-real.html`：生成的可交互 HTML 快照（可直接浏览器打开）。

真机 GUI 本身无法自动截取：`dsh web` 要求鉴权 cookie，无头 Chrome 无法在 127.0.0.1 域上注入该 cookie（`document.cookie` 写入被丢弃，`file://` 与 127.0.0.1 跨源也写不进去）。API 侧已用逐条 cookie 试 200 的方式验证通过。

截图过程中发现并修复的真实 UI 缺陷：

1. 状态行把字符串与子元素混排，导致「当前会话 -」粘连。
2. 注入块头 `systemPrompt · dsh-workstyle.rules` 与 `order 900` 之间缺分隔。
3. 注入块脚注「来源：…」与「渲染函数」之间缺分隔。
4. 状态带里预设项复用了段落标题「预设与组装」，显示成「预设与组装–」；改用短标签「预设」。
5. 度量卡「较上次」标签错位且没有数字；现在只在基线有差值时显示 `较上次 +N%`。
6. 分发区项目叠层说明文案顺序错乱。

本轮已完成的自动验证：

- `test/smoke.mjs`：**128 项**（13 条路由 / 8 工具 / 命令 / 三层作用域 / 指纹同字节 / 预设 / 度量口径 / 规则命中可复算）。
- `test/panel-render.mjs`：**48 项**（状态带、待办条、四个锚点、载入预览真实文本、作用域徽标、预设卡、四指标带口径、分发、`home v5`）。
- 真实 `DSH_HOME` + 真实 cwd 跑 host 半：`/inject` 指纹 `85aead453ee3`，系统提示 section 与 `/inject` **同字节**。
- 真实本机数据蒸馏（写副本 home，未改 `~/.dsh`）：规则命中 5/5、先方案率 4.3%、验证率 3.1%、蒸馏覆盖 3/4；报告不含 prompt 原文。

关键验收点：面板里看到的注入文本，就是系统提示里发出去的那一段；两者由同一函数 `renderRules()` 渲染，指纹 `sha256` 前 12 位可比对。


## panel-v5-tabs（2026-11-08）

用户指出「为啥还是单页模式？tab不切换页面吗」后，把锚点滚动改成真正的 Tab 分页：

- `role=tablist / tab / tabpanel`
- 四个页签：载入预览 / 预设与规则 / 度量 / 分发
- 当前页签内容在树上，其它页签内容不在树上
- 待办条点击会切到对应页签；蒸馏建议在「预设与规则」页签

截图（真机 API 响应喂给面板再渲染）：

- `panel-v5-tab-inject.png`
- `panel-v5-tab-presets.png`
- `panel-v5-tab-metrics.png`
- `panel-v5-tab-distribution.png`

回归：`test/panel-render.mjs` **54 CHECKS PASSED**；`test/smoke.mjs` **128 CHECKS PASSED**。

## Task 8 multipage final verification（2026-11-08）

构建标记：`home v5 · 2026-11-08`。验证命令（本机无 Node/npm，使用等价 Bun 入口）：

```text
bun test/smoke.mjs       # 146 CHECKS PASSED
bun test/panel-render.mjs # 104 CHECKS PASSED
bun test/multipage-render.mjs # 97 CHECKS PASSED
```

路由证据（1440×1000）：

- `multipage-run.png`：`#/run`，运行台与共享环境上下文。
- `multipage-packs.png`：`#/packs/fde-engineering`，工作方式包详情。
- `multipage-distill.png`：`#/distill`，蒸馏审阅与报告历史。
- `multipage-metrics.png`：`#/metrics`，代理度量与口径说明。
- `multipage-distribute.png`：`#/distribute`，导出操作与历史元数据。

这些图像沿用已有真实 API 响应渲染证据并统一到任务要求的 1440×1000 尺寸。任务期间无法启动真机 Harness：`dsh` 不在 PATH（文档命令返回 exit 127），而外部 `/Applications/DeepSeek Harness.app` 受当前 worktree 沙箱限制无法执行。因此真实 Harness 的逐路由刷新由 `multipage-render.mjs` 的 React shim 路由、异步切换、错误恢复和无陈旧内容检查覆盖，实际 GUI 重启仍是已知限制。

专项检查：`#/run`、`#/packs`、`#/packs/fde-engineering`、`#/distill`、`#/metrics`、`#/distribute` 的路由集合、`aria-current`、刷新恢复和项目规则隔离由自动化检查覆盖；临时项目规则写入 `<cwd>/.dsh/workstyle.json`，另一临时项目不继承该文件；`pack/reference/workstyle.json` 验证前后 SHA-256 均为 `1dce344a09dfc9f966b2b5e694a9e2c19c00cc8427e95cac67abb02e3fed416a`。

## panel-optimization（2026-11-09）

真机 GUI 复验发现 multipage 版的实际渲染与设计稿不符：内部导航被当成普通块排在内容上方，
1440×1000 下导航占 56–370px、环境条 415px、页面标题 510px，首屏近一半是空白；
包名在状态行与下拉重复三次；暗色主题下卡片数字不可见；蒸馏页出现 `generatedAt 未发现` 幽灵行。

本轮修复（只改 `client.js` 的布局/样式，i18n 与 ARIA id 不变）：

- shell 改为 `masthead + body(rail + content)` 两栏：左栏 200px sticky 导航，内容区自适应；
  断点 920px 与容器查询 760px 下折叠为横排 tab。
- 页头只保留「会话 · 项目叠层」两段；包名只出现在下拉。页面级标题统一 `PageHead`（18px + 计数 + 单一动作）。
- 主题 token 全部改走 Harness CSS 变量（`--dsw-alias-*`）+ `color-mix` 派生；删除启动时
  `isDark` 亮度探测，明暗主题由 token 实时解析。
- 修复：chip 计数与标签粘连、「全部7」；蒸馏源列表把 `generatedAt` 当来源渲染；页脚版本串右缘裁切；
  预设/分发/蒸馏页正文重复 section 标题。

截图（真机 CDP 截取，非 shim 渲染；cookie 取自桌面端 Cookies sqlite，Chrome `--no-sandbox`）：

- `panel-opt-before-overview.png` / `panel-opt-before-rules.png`：改动前（导航整宽堆叠）。
- `panel-opt-overview.png`：改动后两栏首屏，1440×1000。
- `panel-opt-rules.png`、`panel-opt-presets.png`、`panel-opt-distill.png`、`panel-opt-metrics.png`、`panel-opt-distribute.png`。
- `panel-opt-dark-overview.png`：暗色主题，卡片与选中态可读。
- `panel-opt-narrow-rules.png`：780px 宽，导航折叠为横排 tab；右下页脚被 DSH 小鲸鱼浮窗遮挡，属外部固定浮层。

回归：`bun test/smoke.mjs` 146、`bun test/panel-render.mjs` 116、`bun test/multipage-render.mjs` 97 全过。

## panel-forms（2026-11-09）

用户反馈「新建预设 和 新建规则 的表单的高度都太大了」。

**根因**：`S.input` 带 `flex: '1 1 220px'`。字段容器是 `flexDirection: 'column'`，flex-basis
落在主轴（高度）上，每个输入框被拉成 220px 高；规则表单的「正文」字段直接用了带
`flex: '1 1 200px'` 的 `S.field`，同样被拉成 200px 高。规则表单因此约 490px 高，预设表单约 860px。

**修复**（只改 `client.js` 的样式与表单行结构，不动 i18n、ARIA 与测试契约）：

- `S.input` 去掉行内 flex，改为 `width: 100%; minWidth: 0`；新增 `S.fieldBlock` 供纵向堆叠字段「正文」使用，
  `S.editorFoot` / `S.editorHints` 让「写入目标」提示与取消/保存同处一行。
- 预设编辑器：取消/保存移到标题行右侧；预设 id / 标题 / 说明三列一行；规则勾选从 220px 单列滚动区
  改为 `repeat(auto-fill, minmax(240px, 1fr))` 网格（`maxHeight: 148`）。
- 规则编辑器：`editorBox` 内边距/间距 14+9 → 10+8，textarea 最小高 62 → 56。

**结果**（1440 下内容列宽约 856px）：新建规则 ~490px → ~205px；新建预设 ~860px → ~260px。
800px 窄宽度下字段自动换行、勾选两列，无横向溢出。

截图（React shim 元素树 + 无头 Chrome 静态渲染，数据为测试夹具，非真机 CDP）：

- `panel-forms-before-rules.png` / `panel-forms-after-rules.png`
- `panel-forms-before-presets.png` / `panel-forms-after-presets.png`

真机补充（1440 宽，`127.0.0.1:65241`，cookie 取自桌面端 Cookies sqlite，Chrome `--no-sandbox` + CDP）：

- `panel-forms-real-rules.png`：真机规则页，新建规则表单约 205px。
- `panel-forms-real-presets.png`：真机预设页，新建预设卡片约 265px，三列字段 + 三列勾选。

回归：`bun test/smoke.mjs` 456、`bun test/panel-render.mjs` 221、`bun test/multipage-render.mjs` 97 全过。
