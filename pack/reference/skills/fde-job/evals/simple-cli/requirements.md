# 样例需求：Markdown 死链检查器（simple-cli）

做一个 Python 命令行工具，扫描指定 Markdown 文件里的所有链接，检查哪些是死链（HTTP 状态码 ≥ 400 或请求失败），把死链列表打印出来。

- 命令：`checklinks <file.md>`
- 正常链接返回 0；发现死链返回非 0。
- 纯标准库 + requests 即可，不需要数据库。
- 带 pytest 单测。
