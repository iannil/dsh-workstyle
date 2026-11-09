# simple-cli 基线结果 / Baseline

> 工程化代码（Tasks 1-8）完成并经测试 + 评审验证后的就绪状态基线。
> 全链路实时构建（live end-to-end run）见末尾 runbook。

## 状态总览

**代码就绪**: ✅ Tasks 1-8 全部完成、评审通过。
**自动检测**: ✅ 在 3 个真实 eval 输入上经验证，结果与 eval 矩阵完全一致（见下）。
**实时构建**: ⏳ 待执行（heavy operation，见 runbook）。

## 自动检测验证（Component 2，对真实 eval 输入）

对每个样例的 `requirements.md` 实跑 `detectComplexity()`：

| 样例 | detected_complexity | skip_requirements | skip_frontend | 预期 | 结果 |
|------|:--:|:--:|:--:|:--:|:--:|
| simple-cli  | simple | true  | true  | skip_req=T, skip_fe=T | ✅ |
| simple-api  | simple | true  | true  | skip_req=T, skip_fe=T | ✅ |
| web-crud    | simple | true  | false | skip_req=T, skip_fe=F | ✅ |

含义：simple-cli / simple-api 将自动跳过 Phase 1（需求分析）与 Phase 3（前端设计）；
web-crud 将跳过 Phase 1 但保留 Phase 3（前端设计）。与 evals/README.md 矩阵一致。

## run.wf.js 结构就绪性（Component 2/3/4）

- ESM 语法校验通过（`node --check`）。
- 无 Workflow 沙箱禁用 API（require/import/fs/Date.now/Math.random/argless new Date）。
- Phase 序列完整：Scaffold(0) → Requirements(1) → Architect(2) → Frontend(3) → Develop(4, JS 里程碑循环) → Run Gate(4.5) → Integrate(5) → Deploy(6) → Report(7)。
- Phase 4：里程碑解析 → topoSort → 逐里程碑 workflow+inspector，重试/降级/级联在 JS。
- Phase 4.5：agent 真跑 build+test，失败强制修复，修不动标 DOES_NOT_RUN，report 头条如实。
- 纯函数（detectComplexity/topoSort）内联 + 关键字表同步守卫测试（12/12 通过）。

## 已知问题（非本计划回归）

- `npm test` 有 2 个**预先存在**的失败：`fde-frontend-architect has compatibility listed`、
  `fde-requirements has compatibility listed` —— 在 master（本分支起点之前）即同样失败，
  属上一个 plan 创建的技能的 frontmatter 问题，非本计划引入。
- `fde-job/references/engine.md` 沿用旧 6 阶段编号（Develop="Phase 2" → 门禁="Phase 2.5"），
  与 run.wf.js/SKILL.md 的 8 阶段（"Phase 4.5"）不一致；engine.md 内部自洽，全量重编号超出本计划范围。

## 全链路实时构建 runbook（待执行）

实时构建是 heavy operation（8 阶段 × 多 agent，数分钟、大量 agent 调用），建议在专注会话执行：

```bash
mkdir -p /tmp/eval-simple-cli && cd /tmp/eval-simple-cli
```
```javascript
Workflow({
  script: "<repo>/skills/fde-job/run.wf.js",
  args: {
    requirements: "<skills/fde-job/evals/simple-cli/requirements.md 内容>",
    mode: "auto",
    projectName: "checklinks"
  }
})
```

**验收**（对照 `expected.md`）：
- [ ] 自动检测日志输出 skip_requirements=true、skip_frontend=true
- [ ] Phase 1（requirements）跳过
- [ ] Phase 3（frontend）跳过
- [ ] 产物 `checklinks` CLI 可执行
- [ ] Phase 4.5 run gate = PASS（报告头条非 DOES_NOT_RUN）

**结论标准**：能跑出可执行 CLI + 运行门禁 PASS = 达成"无人值守从 0 构建可运行初始版本"。
