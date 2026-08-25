# Error Handling

> 适用于 Hono 路由、LLM 调用、SSE 流。

## 全局

`createApp()` 的 `app.onError`（`server/src/index.ts`）：

- JSON `SyntaxError` → 400 `{ error: 'Invalid JSON in request body' }`
- 其他 → `console.error(err)` + 500 `{ error: 'Internal server error' }`（不把 stack 给客户端）

`/api/*` 未匹配 → 404 `{ error: 'Not found' }`。

## 路由级

| 情况 | 状态 | 例子 |
|------|------|------|
| 缺/非法参数 | 400 | `sessions.ts` 的 `from`/`to`；`analysis.ts` 缺 `sessionId`；facets backfill 超 200 上限 |
| 会话不存在或已软删 | 404 | `{ error: '未找到' }` |
| LLM 未配置 | 400 | `requireLLM()` 中文提示去 `config llm` |
| 非流式分析/凭据测试失败（`success: false`） | **422**（成功才是 200） | `analysis.ts` 三个 POST、`config.ts /llm/test`、`export.ts /generate` 取消或失败 |
| 流式分析失败 | HTTP 200 + SSE `error` 事件 | 由 `streamSessionAnalysis` 处理 |
| 创建成功 | 201 | `insights.ts POST /` 返回 `{ id }` |

非流式分析类 endpoint 的约定是 `c.json(result, result.success ? 200 : 422)`，不要改成 200 包 `success:false`。

用户可见 `error` 字符串用中文。内部 `Error.message` 可以英文。

PATCH/DELETE 用 `result.changes === 0` 判断 404，不要先 SELECT 再 UPDATE 而不检查。

## LLM / SSE

- `streamSessionAnalysis` catch 后 `captureError`，SSE 发 `{ error: message }`。`writeSSE` 失败 `.catch(() => {})`，避免客户端断开造成二次崩溃。
- `trackAnalysisResult` 成功/失败都打 `analysis_run`。失败带 `error_type`、`error_message`、`response_preview`。
- `captureError` 禁止 properties 键 `type`（PostHog 冲突），用 `analysis_type`。

## 进程退出

`startServer` 在 SIGINT/SIGTERM 里 `shutdownTelemetry()`，3s 超时后 `process.exit(0)`，让 CLI `getDb` 的 `exit` handler 做 WAL checkpoint。不要在 route 里 `process.exit`。

## Anti-patterns

- 把 SQLite 异常原文直接 500 给浏览器（本仓库没有 ORM）。
- 分析失败还当 200 `{ success: true }`。
- SSE 不处理 abort，取消请求后仍写库。
- 订阅/密钥错误死循环重试。
