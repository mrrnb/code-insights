# Dashboard Frontend Guidelines

> `@code-insights/dashboard` 是 Vite + React 19 SPA，由本地 Hono server 提供 `/api` 与静态文件。

本层覆盖 `dashboard/src/`。不要在 dashboard 包里写 SQLite 或 Commander。

---

## Pre-Development Checklist

- [ ] 任何改动 → [Directory Structure](./directory-structure.md) + [Quality Guidelines](./quality-guidelines.md)
- [ ] 新页面/组件/导航项 → [Directory Structure](./directory-structure.md) + [Component Guidelines](./component-guidelines.md)
- [ ] 数据请求 / mutation / SSE → [Hook Guidelines](./hook-guidelines.md) + [API Client](./api-client.md)
- [ ] URL 筛选、React Query、Context → [State Management](./state-management.md)
- [ ] 类型、snake_case 行、JSON 列 → [Type Safety](./type-safety.md)

跨层字段变更再读 [Cross-Layer](../../guides/cross-layer-thinking-guide.md) 与 [Data Pipeline](../../guides/data-pipeline.md)。

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | pages / components / hooks / lib |
| [Component Guidelines](./component-guidelines.md) | shadcn/ui、i18n、组合 |
| [Hook Guidelines](./hook-guidelines.md) | TanStack Query hooks |
| [API Client](./api-client.md) | `lib/api.ts` 与 SSE |
| [State Management](./state-management.md) | Query cache、URL、少量 Context |
| [Type Safety](./type-safety.md) | snake_case API 类型、`parseJsonField` |
| [Quality Guidelines](./quality-guidelines.md) | 路径别名、禁止项、验收 |

---

## Quality Check

- [ ] 新 UI 字符串进 `dashboard/src/lib/i18n.tsx` 的 zh/en，组件用 `t()`
- [ ] HTTP 只走 `lib/api.ts`，页面不直接 `fetch('/api/...')`
- [ ] JSON 列用 `parseJsonField`，不用裸 `JSON.parse`
- [ ] 保留服务端 snake_case，不在 API 边界擅自 camelCase
- [ ] mutation 成功后 `invalidateQueries` 对应 key（`sessions` / `insights` / `facets`）
- [ ] 空数据用空态组件，不造演示会话

---

## Runtime Facts

- React 19、react-router 7、TanStack Query 5、Tailwind 4、Radix / shadcn new-york
- Vite alias `@` → `dashboard/src`
- Dev 代理：`/api` → `http://localhost:7890`（`dashboard/vite.config.ts`）
- 生产：同源，Hono 托管 `dashboard/dist`
