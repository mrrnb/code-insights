# Route Guidelines

> 适用于 `server/src/routes/*` 与 `createApp()`（`server/src/index.ts`）。

## 挂载顺序

`createApp()`：

1. `app.onError`（JSON SyntaxError → 400；其余 500 无 stack）
2. 子路由全部挂在 `/api/...`（见下表）
3. `GET /api/health` → `{ ok: true, version: '0.1.0' }`
4. `app.all('/api/*')` JSON 404 —— **必须在静态资源之前**
5. `startServer` 才 `serveStatic` + SPA fallback

未匹配 `/api/*` 若落到 SPA，会 200 HTML，dashboard 会当 JSON 解析失败。

## 路由表（`createApp` 现挂的全部）

| 前缀 | 文件 | 方法 |
|------|------|------|
| `/api/projects` | `projects.ts` | `GET /` `GET /:id` |
| `/api/search` | `search.ts` | `GET /?q=` |
| `/api/sessions` | `sessions.ts` | `GET /` `GET /deleted/count`（必须在 `/:id` 前）`GET/PATCH/DELETE /:id` |
| `/api/messages` | `messages.ts` | `GET /:sessionId` |
| `/api/insights` | `insights.ts` | `GET /` `POST /` `DELETE /:id` |
| `/api/analysis` | `analysis.ts` | `GET /usage` `POST /session` `GET /session/stream` `POST /prompt-quality` `GET /prompt-quality/stream` `POST /recurring` |
| `/api/analysis/queue` | `analysis-queue.ts` | `GET /` |
| `/api/analytics` | `analytics.ts` | `GET /dashboard` `GET /usage` |
| `/api/config` | `config.ts` | `GET/PUT /llm` `POST /llm/test` `GET /llm/ollama-models` `GET /llm/llamacpp-models` |
| `/api/export` | `export.ts` | `POST /markdown`（返回 **text/markdown**）`POST /generate` `GET /generate/stream` |
| `/api/telemetry` | `telemetry.ts` | `GET /identity` |
| `/api/facets` | `facets.ts` | `GET /` `/aggregated` `/missing` `/outdated` `POST /backfill`；PQ：`/missing-pq` `/outdated-pq` `POST /backfill-pq` |
| `/api/reflect` | `reflect.ts` | `POST /generate` `GET /results` `/weeks` `/snapshot` |
| `/api/dispatch` | `dispatch.ts` | `POST /generate` `POST /image-prompt` |

新增文件必须 `app.route(...)` 进 `createApp()`，且加在 404 catch-all **之前**。

## 写法

每个文件 `const app = new Hono(); export default app`。Handler：读 query/json → 400 校验 → `getDb()` → bind params → `c.json`。用户错误文案中文。

- 整数：`parseIntParam`（`utils.ts`）
- 日期：`sessions.ts` `ISO_DATE_RE`（非法日期 SQLite 会静默比错）
- LIKE：`escapeLike` + `ESCAPE '\'`
- LLM 写路径：`requireLLM()`（`route-helpers.ts`）
- 分析用 SELECT：只改 `loadSessionForAnalysis` / `loadSessionMessages`，不要在各 route 复制列
- 聚合 WHERE：`shared-aggregation.ts` `buildWhereClause`。`/missing` **不能**用它（需要 `WHERE sf.session_id IS NULL`），见 `facets.ts` 注释

`/api/facets/missing` 的 `project` 按 **`sessions.project_name`** 过滤，不是 `project_id`。对齐 CLI `reflect backfill --project` 与 `useMissingFacets`。

`PUT /api/config/llm` 会 `saveConfig`；返回给 UI 的 apiKey 必须 `maskApiKey`（前4...后4）。provider 枚举：`openai|anthropic|gemini|ollama|llamacpp|custom`。

## SSE 合同

`streamSessionAnalysis`：`progress` `{phase,message}` → `complete` `{success,insightCount,tokenUsage,costUsd,provider,model}` → `error` `{error}`。

`streamBatchBackfill`：`progress` `{completed,failed,total,currentSessionId}` → `complete` `{completed,failed,total}`。并发封顶 10。facets `MAX_BACKFILL_SESSIONS = 200`。

改 event 名要同步 `dashboard/src/lib/sse.ts`、`cli/src/commands/reflect.ts`、`cli/src/commands/analyze.ts`。

## Anti-patterns

- 用户输入拼进 SQL。
- 新路由加在 404 catch-all 之后。
- 用 200 `{ error }` 表示 HTTP 失败（SSE `error` 事件除外）。
- `export/markdown` 走 `c.json`（它是纯文本，dashboard `exportMarkdown` 也按 `res.text()` 读）。
