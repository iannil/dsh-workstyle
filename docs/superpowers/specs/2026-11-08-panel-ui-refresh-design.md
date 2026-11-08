# dsh-workstyle 面板 UI 全面优化设计（Notion 风重构）

日期：2026-11-08
状态：已与用户在可视化 brainstorming 中确认（方向 B · Notion 风；信息架构 A · 左侧栏分组；页面细节示意已批准）

## 1. 目标

把 dsh-workstyle 插件在 DSH Web GUI 中的全部前端页面（`client.js`，侧边栏入口 + 全宽面板）统一升级为「明亮文档感」设计语言，并重组信息架构，使每个页面短而专注、三态完备、深浅主题一致。

非目标：不改 HTTP 路由与宿主契约、不改 `index.js` 提供的数据形态（只允许只读消费）、不改 pack 内容与注入文本逻辑。

## 2. 设计方向

- **基准**：Notion 式文档感 —— 白底、文档排版、弱边框、宽松行距、克制的色块使用。
- **色板（语义 token，替换现有 INK/PAPER/AMBER 散点色）**：
  - `bg` 页面底 `#FFFFFF`，`surface` 侧栏底 `#F7F6F3`，`hover/sel` 选中底 `#EFEDEA`
  - `border` `#EDECE9`，`ink` 主文字 `#37352F`，`ink-2` 次级 `#787774`，`ink-3` 弱化 `#9B9A97`
  - `accent` 深灰实心按钮 `#37352F`（主操作），`danger` `#EB5757`，`ok` `#2E9E5B`
- **深色主题**：同一套语义 token 的反色版本，跟随 DSH 主界面主题切换（沿用现有 `--dsw-alias-*` 变量探测机制，见 `client.js:41`）。
- 排版：页面标题 18/700，正文 12/400，行距放宽；数字卡片只用 1px 轻边框，不铺色块底。

## 3. 信息架构（左侧栏 + 分组）

导航从顶部 5 tab（run / packs / distill / metrics / distribute）改为左侧固定侧栏，三组：

- **状态**：概览（原 packs 首屏 + 指纹/包切换器）、状态轨
- **内容**：规则（含预设编辑入口）、预设、技能
- **维护**：蒸馏审查（原 distill）、指标与运行（metrics+run 合并）、分发（distribute）

要点：
- 「包」不再是一级页；当前包内容平铺进内容区，多包管理收进概览右上「切换包 ▾」。
- 规则页按作用域 chip 筛选：全部 / workspace / session / 已停用（替代混排+角标）。
- 概览页放快捷动作：编辑规则、载入预览、蒸馏一次。
- 每个列表页统一空态：「暂无 X，[主操作] 或 [来源动作]」。

## 4. 组件与代码组织

现状：`client.js` 单文件 2597 行，全部内联样式 + `React.createElement`。重构时同步拆分（保持无构建步骤，纯 ESM 内嵌即可）：

- `token 层`：语义色/间距/圆角集中定义，所有样式引用 token，禁止页面内硬编码色值
- `共享组件`：`Section`、`Card`（数字卡）、`Chip`（筛选/作用域徽章）、`EmptyState`、`LoadingState`、`ErrorState`、`Sidebar`
- 三态规则：所有数据区必须显式处理 loading / empty / error，复用同一组件
- 现有渲染分层保留：环境条（EnvironmentContextBar）、注入指纹显示、包详情 tab（rules/skills/templates/reports）逻辑不动，只换皮

## 5. 错误与边界

- 保留现有「per-history 失败不阻塞面板」原则（`client.js:1093` 注释），失败行内提示不吞整页
- 深浅色切换依赖宿主变量探测失败时回退浅色
- 可访问性：沿用现有 role/aria（tablist/tabpanel、aria-current、focus-visible），侧栏加 `aria-label`

## 6. 验收标准

1. `npm run test:panel`（`node test/panel-render.mjs`）与 `npm run test:all` 通过
2. 面板所有页面在浅色/深色主题下均有截图/目视验证，无硬编码旧色残留（grep `INK|PAPER|AMBER` 仅剩 token 定义处）
3. 全部一级页面（概览、状态轨、规则、预设、技能、蒸馏审查、指标与运行、分发）均具备 loading、empty、error 三态
4. 现有交互不回归：规则增删改、预设管理、审查采纳/驳回、指纹查看、载入预览

## 7. 风险

- `client.js` 拆分若与宿主 module loader 约定冲突，则退化为单文件内「分区注释 + token 常量」组织，不强行拆文件
- 包详情区逻辑（2335-2362 行一带）耦合较深，先换皮后拆逻辑，分两步提交
