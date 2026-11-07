# fde-job Evals / 回归基线

3 个标准样例，验证"普通开发给简单需求 → 无人值守从 0 构建可运行初始版本"。

## 执行方式

在**干净临时目录**里调用 Workflow（避免污染本仓库）：

```bash
mkdir -p /tmp/eval-simple-cli && cd /tmp/eval-simple-cli
```

```javascript
Workflow({
  script: "<repo>/skills/fde-job/run.wf.js",
  args: {
    requirements: "<把 evals/<sample>/requirements.md 内容粘进来>",
    mode: "auto",
    projectName: "<sample-name>"
  }
})
```

> 不传 `skip_*` —— 验证自动检测是否正确。

## 评分

对照 `evals/<sample>/expected.md` 逐项打勾。**任一"必须"项未达 = 该样例 FAIL**。
运行门禁结果以最终报告头条为准：`DOES_NOT_RUN` = FAIL。

## 样例矩阵

| 样例 | 栈 | 预期自动检测 | 关键验证点 |
|------|----|------------|-----------|
| simple-cli | Python | skip_req=T, skip_fe=T | CLI 能跑 + pytest 过 |
| simple-api | FastAPI+SQLite | skip_req=T, skip_fe=T | CRUD API + pytest 过 |
| web-crud | Next.js | skip_req=T, skip_fe=F | 含前端 + npm build 过 |

跑通后，输出快照作为回归基线。
