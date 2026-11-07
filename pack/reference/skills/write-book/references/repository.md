# 祝融说仓库约定

仅用于在祝融说站点中新增、续写或修订书稿。常见本地位置为 `/Users/rong.zhu/Code/zhurong/zhurongshuo`，优先使用用户当前仓库；其他环境先定位 `data/books.yaml` 与 `content/books/`，找不到时不要假装已读原文。

## 阅读与定位

- 先读当前 `AGENTS.md`，检查工作区状态，保留已有未提交修改。
- `data/books.yaml`、`data/practices.yaml` 的 `collection` 定位作品、卷/季、slug 与版本；`part_titles` 提供分部标题。不能仅由目录名猜分部标题，也不要把概述中的“5 卷 × 5 本”当成不变数量。
- 读取目标作品 `_index.md`、存在的导论/引言和相关正文；`guide/index.md` 可辅助定位。当前版本的书稿和用户指示优先于其他书的惯例。
- `data/glossary/glossary.yaml` 提供中英术语映射。翻译或双语写作使用 `recommended` 及其说明，不能从旧英文稿复制已弃用译名。

## 内容位置

常见结构是：

```text
content/books/volume-N/<book-slug>/
content/practices/season-N/<book-slug>/
  _index.md
  introduction.md 或 prologue.md（按实际作品）
  part-01/chapter-01.md
  part-02/chapter-04.md
  epilogue.md 或 appendix.md（需要时）
```

这是已观察到的常见形态，不是强制模板。先检查目标目录的编号方式，不能假定每部分从第 1 章重新开始。英文通常使用同位置 `.en.md`，例如 `chapter-01.en.md` 和 `_index.en.md`；用户只要求中文时不自动扩展为翻译任务。

## Frontmatter 与正文

已有文件保留有效元数据与未知字段。新增文件参考同书相邻文件；常见字段有 `title`、`date`、`description`、`draft`、`hidden`、`tags`、`keywords`、`slug`。书籍 `_index.md` 的类型与章文件不同，实践书入口可有 `type: practice`，不要把它复制到每章。

- 日期使用实际创建或用户指定日期，不复制参考书日期。
- `description` 概括实际章节内容，不原样复制正文开头，不写进度说明。
- 新的未发布草稿通常设 `draft: true`；保留已有文件的发布状态，除非用户要求改变。样本中的 `draft: false` 不代表所有新稿都应公开。
- 常见章标题在 frontmatter，正文从 `##` 开始，细分使用 `###`；跟随目标书，避免正文重复一个相同 H1。
- `slug` 与现有路由方式保持一致。重命名或移动章节前检查交叉引用。

只有新增书籍入口、分部或修改书名等需要时，更新相应数据文件；单章文字修订不需要改全站目录或宣布版本升级。双语任务另检查 `data/en/books.yaml`、`data/en/practices.yaml`。版本标签按现有约定和实际成熟度设置，不因完成一轮生成就标为正式版。

## 验证范围

纯写作至少检查 YAML 格式、章节顺序、文件名和引用目标。若任务改动路由、分部或站点元数据，使用当前 huan 帮助中确认的构建选项进行预览，尽量输出到临时目录，避免覆盖 `docs/` 和现有构建产物。不要假定仓库一定存在 `archetypes/books.md`：本次取样时不存在，应检查实际文件再决定使用模板。

创建或修订书稿不等于发布。`./deploy.sh` 包含上传、构建与 push；只有用户授权部署时才运行，不把它当作正文校验命令。
