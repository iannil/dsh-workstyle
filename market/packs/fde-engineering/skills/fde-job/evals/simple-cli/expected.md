# simple-cli 验收卡

## 必须达到
- [ ] 自动检测：skip_requirements=true、skip_frontend=true（Phase 1 与 Phase 3 被跳过）
- [ ] 产物含可执行 CLI：`checklinks <file.md>` 能运行
- [ ] 运行门禁 PASS（`pip install -e .` + `pytest -q` 均通过）
- [ ] 最终报告头条 NOT `DOES_NOT_RUN`

## 加分
- [ ] 对 4xx/5xx/网络异常都判定为死链
- [ ] 至少 3 个 pytest 用例（含一个死链、一个正常）
