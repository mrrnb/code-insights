# State Management

> 本项目没有 Redux/Zustand。状态分三层。

## 1. Server state：TanStack Query

`main.tsx` 全局 `QueryClient`：`staleTime: 30_000`，`retry: 1`。资源数据只放 query cache。

写操作成功后按 key 失效：

| 操作 | invalidate |
|------|------------|
| 改标题 / 删会话 | `['session', id]`、`['sessions']`、`['deletedSessionCount']` |
| 分析完成 / 队列 drain | `['sessions']`、`['insights']` |
| facets backfill | `['facets']` |

不要把 `sessions[]` 再拷进 Context。

## 2. URL state：search params

筛选、当前选中 session、insight deep link（`?insight=`）走 URL。`App.tsx` 对 `/insights?insight=` 禁止自动 `scrollTo(0,0)`。

可分享筛选优先 URL（`useFilterParams`）。`useSavedFilters` 做命名筛选持久化。`JournalPage` 的 source 目前是 `useState`，刷新会丢——这是现状，不是 URL 漏改。

## 3. 少量 Context

`main.tsx` 包裹顺序：

```text
QueryClientProvider → ThemeProvider → I18nProvider → AnalysisProvider → App
```

- `ThemeProvider`：light/dark/system
- `I18nProvider`：zh/en
- `AnalysisProvider`：正在跑的分析/SSE

不要为单个列表再包 Provider。跨页需要的分析进度才进 AnalysisContext。

## 局部 UI

Dialog 开关、hover、输入框用组件 `useState`。媒体查询可用 `useSyncExternalStore`（`SessionsPage` 的 lg breakpoint）。

## Anti-patterns

- 在 Context 里镜像一份 React Query 数据。
- 筛选只存在 `useState`，刷新丢失。
- 每个页面 new 自己的 `QueryClient`（会打散缓存）。
