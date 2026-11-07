# 证据分级与动态平台资料

用于涉及当前平台功能、资格、政策、指标和最佳实践的任务。以下快照源自 2026-10-09 的方法论研究，不是永久规则。使用时复用本轮已有核验或打开相关原始页面；无需为单篇改稿重新研究所有平台。

## 如何采用证据

| 类别 | 可支持 | 不能支持 |
|---|---|---|
| A 平台官方 | 当前能力、配置、资格、指标定义 | 达到条件必定产生收益 |
| B 原始研究/观察 | 在明确样本和环境中的结果 | 普适权重、无限外推或长期效果保证 |
| C 综合建议 | 可执行流程和待验证假设 | 搜索内部算法或统计充分性 |
| U 未知 | 缺口、后续验证条件 | 用推测补成事实 |

对核心论断记录：原始 URL/证据位置、发布或更新时间、核验时间、平台/地区/版本、支持的结论和限制。来源冲突时检查日期、功能范围及具体定义，保留差异；不能只选符合预期的文档。

来源读取失败或未获得账号数据时，写出未核验的部分，不由搜索摘要或其他平台经验补全。代码检查和构建验证不能证明研究建议会改善引用或收入。

## 2026-10-09 平台快照及复核入口

| 对象 | 当时核对的信息 | 使用时应查 |
|---|---|---|
| Google AI 搜索 | SEO 基础仍适用；无需特殊 AI Schema；llms.txt 不带来 Google 搜索可见度增益 | [AI 优化指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) |
| Google AI 控制 | 公告在 2026-08-31 更新为全球推出；包含/排除与属性继承影响参与资格，与训练控制不同 | [公告](https://blog.google/products-and-platforms/products/search/new-controls-website-owners/)、[控制说明](https://support.google.com/webmasters/answer/16908024) |
| Google AI 报告 | 以展示为核心，按页面/国家/日期/设备看数据；与 Web 报告重叠，不能直接相加；日期按 PT | [报告口径](https://support.google.com/webmasters/answer/16984139)；重新核对指标、缺失值、门槛与导出行为 |
| Google FAQ 富结果 | 从 2026-05-07 停止展示，06-15 移除对应文档；可见问答的用途另行判断 | [文档更新记录](https://developers.google.com/search/updates) |
| Bing AI Performance | 覆盖其支持的 Copilot、Bing 与部分伙伴入口；新增 Intents、Topics、Citation Share、Compare | [初始公告](https://blogs.bing.com/webmaster/2026/2/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview/)、[2026-06 扩展](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/)；引用份额非流量份额 |
| ChatGPT Search | OAI-SearchBot 为搜索；GPTBot 为可能用于训练的抓取；ChatGPT-User 为用户触发访问 | [爬虫文档](https://developers.openai.com/api/docs/bots)、[发布者 FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq)；核对 IP、访问控制与来源追踪 |
| Perplexity | PerplexityBot 为搜索；Perplexity-User 为用户触发读取；WAF 检查 bot 与官方 IP | [爬虫说明](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) |
| Claude | Claude-SearchBot、Claude-User、ClaudeBot 的用途不同 | [Anthropic 爬虫说明](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| IndexNow | 通知参与引擎新增、变更、重定向或删除；回执不能证明收录或引用 | [FAQ](https://www.indexnow.org/faq)；不要当成所有 AI 平台的推送 API |
| llms.txt | 面向代理/工具的内容入口提案，不等于所有搜索引擎采用 | [提案](https://llmstxt.org/)；核对消费者与成本 |
| 国内平台 | 原研究只有百度目录层核验，未建立各家 AI 产品的统一优化规则 | [百度官方指南目录](https://ziyuan.baidu.com/doc/)；其他平台分别寻找官方依据 |

原研究中的 Google [旧 AI features 页面](https://developers.google.com/search/docs/appearance/ai-features)与新版报告文档存在时间差。不要把旧口径覆盖到新功能，也不要凭公开功能存在推断用户账号已有数据。

## 技术与内容的原始依据

需要解决对应问题时再读取：

- 抓取与索引：[Google 技术要求](https://developers.google.com/search/docs/essentials/technical)、[robots 规则](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec)。
- URL 与语言：[canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)、[语言版本](https://developers.google.com/search/docs/specialty/international/localized-versions)。
- 导航与表达：[链接指南](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)、[结构化数据政策](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)。
- 内容与滥用：[有用内容](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)、[垃圾政策](https://developers.google.com/search/docs/essentials/spam-policies)、[第三方建议](https://developers.google.com/search/docs/fundamentals/third-party-seo)。
- 体验：[Web Vitals](https://web.dev/articles/vitals)。原研究核对的良好阈值为 LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1，移动/桌面现场 p75 分别评估；使用时复核当前定义。

## 引用研究时保留限制

- [KDD 2024 GEO](https://arxiv.org/html/2311.09735v3)：最高约 40% 为特定实验可见度结果；主实验在已取得的前五来源中改变内容，另有当时 Perplexity 评估。不能当成当前跨平台自然发现、流量或收益承诺。
- [Pew 2025 点击研究](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)：美国 900 人的 2025-03 行为、之后重建结果、观察设计；不能当作今天所有网站的流量降幅。
- [Ahrefs 75,000 品牌观察](https://ahrefs.com/blog/ai-brand-visibility-correlations/)：筛选 DR > 40、最高搜索量关键词至少 800 的域名，关注提及相关性；不能推断买提及有效，也不直接代表新站。
- [2026 GEO 综述预印本](https://arxiv.org/abs/2607.14035)：综述的证据局限受收录范围约束，不是所有现行产品的实测。

不要把这些研究的最大值、样本门槛或相关系数写成执行阈值。平台和行业变化后，用目标场景的新数据判断是否继续采用。
