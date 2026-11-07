# simple-api 验收卡

## 必须达到
- [ ] 自动检测：skip_frontend=true（Phase 3 跳过）；has_frontend=false
- [ ] 4 个端点均可访问且行为正确
- [ ] 运行门禁 PASS（build + `pytest -q` 通过）
- [ ] 最终报告头条 NOT `DOES_NOT_RUN`

## 加分
- [ ] SQLite 持久化文件正确创建
- [ ] 单测覆盖创建/列表/删除
