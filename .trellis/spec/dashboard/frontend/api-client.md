# API Client

> 适用于 `dashboard/src/lib/api.ts`、`sse.ts`。

## JSON 入口

绝大多数 JSON HTTP 走内部 `request<T>()`：

- `BASE = '/api'`（Vite dev proxy → `http://localhost:7890`，见 `dashboard/vite.config.ts`；本机真实端口可能是 7891）
- **仅当有 `body` 时**设 `Content-Type: application/json`
- `!res.ok` → `throw new Error(\`API ${status}: ${text}\`)`

组件不要 `fetch('http://localhost:7890/...')`。设置页读的是 `GET /api/config/llm`（`fetchLlmConfig`），不是 `/api/config`。保存是 `PUT /api/config/llm`（`saveLlmConfig`）。

返回 key 与 server `c.json` 对齐：`{ sessions }` `{ session }` `{ ok: true }` `{ count }` `{ facets, missingCount, totalSessions }`。改 server key 必须改 `api.ts` + 对应 hook + `lib/types.ts`。

## 例外：不是 JSON 的

`exportMarkdown` **不走** `request()`。它 `fetch('/api/export/markdown')` 后 `res.text()`，因为 server 返回 markdown 文本。新的非 JSON 响应同样自己处理，不要塞进 `request<T>()` 再 `res.json()`。

SSE：`parseSSEStream`。事件名与 `server/src/routes/route-helpers.ts` 对齐。改名是 breaking：dashboard + `cli/src/commands/analyze.ts` + `reflect.ts`。

## 现有函数分组（`api.ts`）

projects / sessions / messages / insights / search / analytics / analysis / config/llm / export / facets / reflect / dispatch / analysis queue / telemetry identity。新增 endpoint 先在这里加函数，再写 hook。

## 错误

`request` 抛错由 React Query `isError` 接住，页面用 `ErrorCard` 或 sonner。不要在 `api.ts` 里 `alert`。

## Anti-patterns

- 只在某个组件里 fetch，不进 `api.ts`。
- GET 带 `Content-Type: application/json`。
- 把 markdown 导出当 JSON 解析。
