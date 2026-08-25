# Hook Guidelines

> 适用于 `dashboard/src/hooks/*` 与 `AnalysisContext`。

## 资源 hook 对照

`hooks/index.ts` 只 re-export 一部分。完整文件：

| 文件 | queryKey / 作用 |
|------|-----------------|
| `useSessions.ts` | `['sessions', filters]`、`['session', id]`、`['deletedSessionCount']`；列表 60s refetch |
| `useInsights.ts` | `['insights', ...]` |
| `useProjects.ts` | `['projects']` |
| `useMessages.ts` | `['messages', sessionId]` |
| `useFacets.ts` | `['facets','missing', project, period, source]` |
| `useAnalytics.ts` | dashboard stats |
| `useAnalysis.ts` | 触发 session 分析 |
| `useAnalysisQueue.ts` | `['analysisQueue']`；active 时 5s poll，drain 后 invalidate `sessions`/`insights` |
| `useAnalysisCost.ts` | 单会话用量 |
| `useConfig.ts` | LLM 配置 |
| `useExport.ts` | markdown / generate |
| `useReflect.ts` | snapshot / aggregation |
| `useSearch.ts` | CommandPalette |
| `useFilterParams.ts` | URL search params |
| `useSavedFilters.ts` | 命名筛选持久化 |
| `useCommandPalette.ts` | Cmd+K 开关 |
| `useDispatchDiscovery.ts` | dispatch 入口 |
| `useUserProfile.ts` | 本地用户资料 |

标准写法见 `useSessions.ts`：`queryFn` 调 `lib/api.ts`，mutation `onSuccess` 失效父列表 + 详情。`enabled: !!id`。

不要在页面里 `useQuery` 直接 `fetch`。不要发明第二种 key（`['sessionList']` 打不中 `['sessions']`）。

## URL vs 局部 state（现状）

可分享筛选走 `useFilterParams`（`SessionsPage`：`q/project/source/character/status/dateRange/session/...`）。默认值不写进 URL。

例外（代码如此，不要假装全是 URL）：

- `JournalPage` 的 `source` 是 `useState('all')`，刷新会丢
- Dialog 开关、hover、输入框：组件 `useState`
- `SessionsPage` lg 断点：`useSyncExternalStore` + `matchMedia('(min-width: 1024px)')`

## SSE

`parseSSEStream`（`lib/sse.ts`）= `fetch` + `AbortController`，不用 `EventSource`。进度状态放 `components/analysis/AnalysisContext.tsx`，按钮不要各自存一份 progress。

## Anti-patterns

- 组件里 `setInterval` 打队列（用 `useAnalysisQueue` 的 `refetchInterval`）。
- hook 里拼展示文案（那是 `t()` 的事）。
- 新 hook 不进 `src/hooks/` 却丢到 `lib/hooks/`（那里只有 `useThemeColors`）。
