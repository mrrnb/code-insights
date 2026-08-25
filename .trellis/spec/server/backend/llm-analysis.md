# LLM Analysis

> 完整 LLM 会话分析的源码入口在 server，不在 CLI sync。

## 四条产品链路（不要混）

| 链路 | 写什么 | HTTP | CLI |
|------|--------|------|-----|
| Session insights | `insights`（summary/decision/learning/technique） | `POST /api/analysis/session` 与 `/session/stream` | `insights`（本地）、`analyze`（HTTP） |
| Prompt quality | `insights.type=prompt_quality` | `/api/analysis/prompt-quality`、`/api/facets/backfill-pq` | `insights` 第二轮；`reflect backfill --prompt-quality` |
| Facets | `session_facets` 一行/会话 | `POST /api/facets/backfill` | `reflect backfill`；`insights` 仅当模型返回 `facets` |
| Reflect 合成 | `reflect_snapshots` | `POST /api/reflect/generate` | `reflect`（无子命令） |

`sync` 只入库会话消息。看到 CLI 打印 facets 已最新时，用 SQLite 交叉计数核验。

## 代码入口

- 编排：`server/src/llm/analysis.ts` → `analyzeSession`
- PQ：`prompt-quality-analysis.ts`
- Facets：`facet-extraction.ts`
- Recurring：`recurring-insights.ts`
- 持久化：`analysis-db.ts`（server）+ CLI 导出的 `@code-insights/cli/analysis/analysis-db`（如 `applyGeneratedTitle`）
- 用量：`analysis-usage-db.ts`
- 客户端工厂：`llm/client.ts`，配置来自 `~/.code-insights/config.json` 的 `dashboard.llm`

CLI 也有一份 `cli/src/analysis/`（native `claude -p`、normalize、prompts）。改 normalize / schema JSON 时同时检查：

- `cli/src/analysis/schemas/*.json`
- `server/src/llm/*-normalize.ts`
- `cli/src/analysis/*-normalize.ts`

两边有同名文件（`friction-normalize`、`pattern-normalize` 等），改一处必须搜另一处。

## 配置探测

`isLLMConfigured()`（`llm/client.ts`）：

- `ollama` / `llamacpp`：有 model 即可（无需 API key）
- `custom`：apiKey + model + baseUrl
- 其他：apiKey + model

未配置时 route 层 `requireLLM()` 直接 400，不要进模型调用。

外部 custom endpoint 返回 `SUBSCRIPTION_NOT_FOUND` 视为配置失效，停止重试。

## 分析失败形状

`AnalysisResult`：`success`、`insights`、`error`、`error_type`、`response_preview`、`usage`。HTTP JSON 与 SSE `error` 事件都把 `error` 当人类可读中文/原文。parse 用 `jsonrepair` + `response-parsers.ts`，不要在 route 里再写一套 JSON 抽取。

Abort：尊重 `c.req.raw.signal`；`error.name === 'AbortError'`（Node，不是 DOMException）。

## 运行态

常驻 dashboard 加载的是 **`server/dist`**。改 `server/src` 只编译不重启，CLI/UI 仍走旧逻辑。验收顺序：

1. `pnpm --filter @code-insights/server build`
2. 重启占用配置端口的进程
3. `curl /api/health` 与相关 `/api/facets/missing` 或 `/api/sessions`
4. 用 SQLite 计数闭环（例如 missing facets 从 N → 0）

## Anti-patterns

- 把 facets backfill 当成完整 insights 分析。
- 在 CLI `sync` 成功后假设 insights 已生成。
- 新增 LLM provider 却不更新 `createClientFromConfig` switch 与 dashboard Settings 表单。
- 长批处理不打 `[n/total]` + session id（无法判断假死）。
- 留下未跟踪的 `backfill-insights.mjs` 临时脚本。
