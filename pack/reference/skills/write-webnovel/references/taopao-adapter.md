# 《逃跑》适配

仅用于《我们宗门正在逃跑》（《逃跑》）。本文件是入口导航，不能替代本书现版规则或成为第二份事实源。

## 定位与加载

已知工作区为 `/Users/rong.zhu/Code/zhurong/chunhuahua`，唯一正式写作事实源为其下 `books/zongmen-taopao/`。迁移工作区时重新定位该目录，不创建空白替代目录。

先读书内 `README.md` 与 `AGENTS.md`，再全文读 `rules/writing-policy.md`、`rules/world-rules.md`，按任务读宗门气质、当前卷单元与人物。规则更新时以现版为准。

- 已发生：`manuscript/` 原文 → `reports/` 逐章报告 → `state/writing-state.json` 实际记录。
- 未来安排：`planning/plan.json` 与当前细卡；人物编辑源为 `characters/registry.json`。
- `characters/C*.md`、`planning/volume-outline.md` 为生成视图，不能直接修改后冒充主源。
- 旧会话章号先查 `metadata/chapter-numbering.md`；不要将旧章号当当前定位。
- 网站 `src/data`、Git 历史副本、旧审读建议不是当前正文来源。

读取当前 `written_frontier`、`report_owned_start` 和发布状态；本技能不固定下一章、报告归属分界、总字数或细卡数量。

## 续写

1. 从实际前沿确定下一章 N；若缺细卡，依现版单元在已授权范围内自主拆卡，不读取旧卡补位。
2. 运行 `tools/packet.py N --mode draft --max-chars B --out PATH`。B 按书内入口明确选择；提炼时入口采用 200000，工具默认预算较小。超限按规则处理，不能自动截断、悄悄提额或用摘要冒充全文阅读。
3. 读完整包及要求的原文。卡外远因先补依赖并重建包。plan 模式只用于规划或历史修订准备，不作为续写放行。
4. 写完整正文和正式报告，落实七项 writing_review：chapter_change、lijing_choice、solidarity_skills、payoff_emotion、mainline_knowledge、variety_pacing、continuity；提供正文原句和现版契约要求的证据。
5. 按 README 用 `register.py` 同预算预检、修正、登记。登记保持连续，但不发布。不得从“写下一章”推导提交、部署授权。

## 已写正文修订

- 先读 README 修订契约及工具帮助，候选存书内 `revisions/` 或 `inputs/`，由 `revise.py` 处理；不能先覆盖正式正文。
- 取得截至目标章之前的历史事实包。生成 review-template 后做实质审读，dry-run 检查影响，再应用。
- 引用与报告归属按当前 report_owned_start 判断，不复制旧章号边界。
- 对每条受影响的事实、知识、成果和后续卡复核；依赖工具不能取代对隐含文学因果的回读。
- 用当前模板及逐项证据解除修订偏差；不得清空 open_deviations、改基线或刷新哈希冒充审读。
- 保留原发布批次、发布前沿、publishedAt 等生产字段。事务中断按现版要求执行 `register.py --recover`，冲突不得强行覆盖。

## 同步与检验

改 plan 或 registry 后按规则运行 `source_views.py --write` 和 `--check`。实际变化同步报告、实际账及生成概述；不另写第二套“已发生”摘要。

使用 `validate.py --max-chars B` 及项目要求的相关检查。审计本身不应顺手修复无关内容；需要纯读取时采用工具的只读选项。迁移基线检查不同于现版检查，不为消除合法修订差异改写历史基线。

追读修订同时参考现版：

- `planning/open-items.md`
- `rules/session-constraints.md`
- `reports/reading-retention-final-review.md`
- `reports/reading-retention-cards-0075-0094.md`
- `reports/reading-retention-capacity-and-reveals.md`

这些报告中的阶段结论与未来卡评价均有时间边界。下一次写作仍以最新原文和实际账核验，不能因为报告曾通过就宣称未来章节已兑现。
