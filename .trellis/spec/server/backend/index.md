# Server Backend Guidelines

> `@code-insights/server` 是本地 Hono API：读同一份 SQLite、跑 LLM 分析、把 dashboard SPA 静态资源打出去。

本层覆盖 `server/src/`。Server **没有 React 层**；UI 在 `@code-insights/dashboard`。

---

## Pre-Development Checklist

- [ ] 任何改动 → [Directory Structure](./directory-structure.md) + [Quality Guidelines](./quality-guidelines.md)
- [ ] 新/改 `/api/*` → [Route Guidelines](./route-guidelines.md) + [Error Handling](./error-handling.md)
- [ ] SQL / JOIN / 缺数据查询 → [Database Guidelines](./database-guidelines.md)
- [ ] LLM、insights、facets、prompt-quality、reflect → [LLM Analysis](./llm-analysis.md)
- [ ] 日志、SSE 进度、PostHog → [Logging Guidelines](./logging-guidelines.md)

始终再读 [Data Pipeline](../../guides/data-pipeline.md) 和 [Cross-Layer](../../guides/cross-layer-thinking-guide.md)。

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | `server/src` 与 `@code-insights/cli` 的依赖方向 |
| [Route Guidelines](./route-guidelines.md) | Hono 路由、query 校验、SSE 合同 |
| [Database Guidelines](./database-guidelines.md) | 只读/写入哪些表、JOIN 规则 |
| [LLM Analysis](./llm-analysis.md) | analysis / facets / reflect 职责切分 |
| [Error Handling](./error-handling.md) | `onError`、400/404 JSON、requireLLM |
| [Logging Guidelines](./logging-guidelines.md) | console.error 与 analysis_run 遥测 |
| [Quality Guidelines](./quality-guidelines.md) | `createApp()` 测试、重启运行态 |

---

## Quality Check

- [ ] 路由挂在 `createApp()`，测试用 `app.request()`，不 listen 真端口
- [ ] `/api/*` 未匹配返回 JSON 404，而不是 SPA `index.html`
- [ ] 会话查询带 `deleted_at IS NULL`
- [ ] 缺 facets 从 `sessions` LEFT JOIN `session_facets`，不从 `insights` 反查
- [ ] JOIN 用 `sessions.id`，不用 `sessions.session_id`
- [ ] 改完 server 源码后 **编译并重启** 正在服务的 dashboard 进程（CLI 打的是 `server/dist`）
- [ ] 端口有进程 ≠ 健康：还要打 `/api/health` 和一条数据接口

---

## Runtime Facts

- 依赖：`hono`、`@hono/node-server`、workspace `@code-insights/cli`
- 默认 `127.0.0.1:7890`，host/port 由 CLI `dashboard` 命令注入
- 静态资源：`dashboard/dist`（CLI 传入 `staticDir`）
- 本机曾因 ClashX 占用改跑 7891/7899——以 `code-insights config` 为准
