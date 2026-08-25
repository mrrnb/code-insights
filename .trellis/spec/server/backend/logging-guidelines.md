# Logging Guidelines

> Server 同样没有结构化 logger。请求路径靠 HTTP JSON；分析路径靠 PostHog + SSE。

## console

- 未处理异常：`app.onError` 里 `console.error(err)`。
- 启动：`Code Insights dashboard running at http://host:port`（`startServer`）。
- 现有 handler 不打 per-request access log；不要给某个新路由单独加 `console.log(c.req.url)`。

## 遥测

复用 `@code-insights/cli/utils/telemetry` 的 `trackEvent` / `captureError`。分析相关：

- `analysis_run`：类型、provider、model、duration_ms、success
- `insight_generated`：放在 `trackAnalysisResult` 的 `onSuccess`

事件名必须属于 CLI 的 `TelemetryEventName`。Server 不要另起一套 PostHog client。

## SSE 进度文案

给 dashboard 的 `message` 用中文（如 `正在加载消息...`）。`phase` 用稳定英文 token（`loading_messages`、chunk 进度）。改 `phase` 字符串要同步 dashboard 解析。

## Anti-patterns

- `console.log` 打印 prompt 或消息全文。
- 在 `captureError` 里传 `type` 字段。
- 用 server 自己的 PostHog key 再 init 一次。
