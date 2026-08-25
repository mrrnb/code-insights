# CLI Analysis Guidelines

> 适用于 `cli/src/analysis/`、`commands/insights.ts`、`commands/queue.ts`、`session-end` worker。Dashboard HTTP 分析在 `server/src/llm/`，见 [server LLM Analysis](../../server/backend/llm-analysis.md)。

## 两条执行通道

| 通道 | 入口 | Runner | 要不要 dashboard |
|------|------|--------|------------------|
| 本地 | `insights`、`queue process`、session-end worker | `ClaudeNativeRunner` 或 `ProviderRunner` | 否 |
| HTTP | `analyze --session-id`、dashboard 按钮 | server `analyzeSession` | 是 |

不要在 `sync.ts` 里调 runner。

## 模块

```text
cli/src/analysis/
├── native-runner.ts       # execFileSync(['claude','-p',...])，禁止拼 shell
├── provider-runner.ts     # 走已配置的 HTTP LLM
├── runner-types.ts        # AnalysisRunner 接口
├── queue-worker.ts        # claimNext → runInsightsCommand
├── prompts.ts / prompt-constants.ts / prompt-types.ts
├── message-format.ts
├── response-parsers.ts
├── analysis-db.ts         # saveInsightsToDb / saveFacetsToDb / applyGeneratedTitle
├── analysis-usage-db.ts
├── *-normalize.ts         # 与 server/src/llm/ 同名，改一处搜另一处
└── schemas/*.json         # schema-sync.test.ts 钉住
```

`insights.ts` 两轮：session 分析（写 insights，有 `facets` 则 `saveFacetsToDb`）→ prompt quality（写 `type=prompt_quality`）。resume：`analysis_usage.session_message_count` 等于当前 `message_count` 则跳过，`--force` 打破。

Native 模式 token 记 0（算在 Claude Code 订阅里，Code Insights 不另计费）。见 `native-runner.ts` 文件头注释。外部二进制探测：runner 先跑 `claude --version` 拿友好报错，而不是让 ENOENT 直接冒出。

## Queue

表 `analysis_queue`（迁移 v9）。`db/queue.ts` 全部导出：`enqueue` / `claimNext` / `markCompleted` / `markFailed` / `resetStale` / `resetFailed(sessionId?)`（`queue retry` 用它）/ `getQueueStatus` / `pruneCompleted(olderThanDays = 7)`（`queue prune` 用它）。

`queue-worker.ts` 先 `resetStale()` 把卡在 `processing` 的抢回来，再循环直到空。worker 环境变量 `CODE_INSIGHTS_HOOK_ACTIVE=1`（`native-runner.ts` 还会把它传播进 `claude -p` 子进程 env）。worker 启动时若 `claude` CLI 不存在，`ClaudeNativeRunner.validate()` 抛错后 runner 置为 `undefined`，由 `runInsightsCommand` 自行落回 provider runner——不要在 worker 里提前退出。

`queue` 子命令：`status`（`--quiet` 打 JSON 到 stdout）、`process`、`retry [id]|--all`、`prune --days`。

## 与 server 的共享

Server 从 `@code-insights/cli/analysis/analysis-db` 引用 `applyGeneratedTitle` 等。新增要给 server 用的符号必须写进 `cli/package.json` `exports`。

normalize / schema 双份：

- `cli/src/analysis/friction-normalize.ts` ↔ `server/src/llm/friction-normalize.ts`
- `pattern-normalize` / `prompt-quality-normalize` 同理
- JSON schema 只在 `cli/src/analysis/schemas/`

## Anti-patterns

- `exec('claude -p ' + prompt)` 走 shell。
- session-end worker 不设 `CODE_INSIGHTS_HOOK_ACTIVE`（会递归 hook）。
- 以为 `insights` 不写 facets：模型返回 `facets` 时会写；没有返回才缺行。
- 改 CLI normalize 不改 server 副本。
