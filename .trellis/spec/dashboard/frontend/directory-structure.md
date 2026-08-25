# Dashboard Directory Structure

> 适用于新增页面、组件或 hooks。包：`dashboard/src/`。

## Layout

```text
dashboard/src/
├── main.tsx                 # QueryClient(staleTime 30s, retry 1) → Theme → I18n → AnalysisProvider → App
├── App.tsx                  # BrowserRouter；routeTitles；insight deep-link 不 scrollTo(0)
├── pages/                   # 见下表
├── components/
│   ├── ui/                  # shadcn new-york（components.json）；不要放业务
│   ├── layout/              # Layout、Header、ThemeProvider、ThemeToggle
│   ├── sessions/ insights/ chat/ analysis/ dispatch/ patterns/
│   ├── dashboard/ filters/ search/ charts/ brand/ empty-states/ skeletons/ shared/
│   ├── ErrorBoundary.tsx ErrorCard.tsx LlmNudgeBanner.tsx ProfilePromptDialog.tsx
├── hooks/                   # 资源 hook；index.ts 只 re-export 一部分
├── lib/                     # api.ts types.ts i18n.tsx sse.ts utils.ts telemetry.ts
│                           #   + cost-utils date-utils export-session buildDispatchPrefill
│                           #   + pattern-grouping prompt-quality-utils score-utils share-card-*
│                           #   + constants/(colors.ts) hooks/(useThemeColors)
└── styles/globals.css
```

## 路由

`App.tsx` 实际路由：

| path | page | Header `NAV_ITEMS` |
|------|------|--------------------|
| `/dashboard` | `DashboardPage.tsx` | 有 |
| `/sessions`、`/sessions/:id` | `SessionsPage` / `SessionDetailPage` | 有（`exact: false`） |
| `/insights` | `InsightsPage.tsx` | 有 |
| `/analytics` | `AnalyticsPage.tsx` | 有 |
| `/patterns` | `PatternsPage.tsx` | 有 |
| `/export` | `ExportPage.tsx` | 有 |
| `/settings` | `SettingsPage.tsx` | 有 |
| `/journal` | `JournalPage.tsx` | **无**，靠 CommandPalette / 直链 |
| `*` | Navigate → `/dashboard` | |

新屏幕：加 `pages/` + `App.tsx` Route + `routeTitles` + i18n。进主导航还要改 `Header.tsx` 的 `NAV_ITEMS`（前 4 项同时是移动端 `BOTTOM_TABS`）。

## 放哪

| 要做的事 | 放 |
|----------|----|
| 会话列表/详情 | `pages/SessionsPage.tsx` + `components/sessions/` |
| 聊天泡泡与工具面板 | `components/chat/{message,conversation,tools/panels}` |
| 洞察卡片 | `components/insights/InsightCard.tsx` |
| 分析按钮/SSE 进度 | `components/analysis/` + `AnalysisContext.tsx` |
| 发帖/封面图 | `components/dispatch/` + `lib/buildDispatchPrefill.ts` |
| 命令面板 Cmd+K | `components/search/CommandPalette.tsx` + `useCommandPalette`（`Layout.tsx` 绑定） |
| HTTP | `lib/api.ts` + `hooks/useX.ts` |
| 类型色 | `lib/constants/colors.ts` |

`src/hooks` = 资源请求。`lib/hooks/useThemeColors.ts` 仅主题色。不要开第三处。

## Anti-patterns

- 页面里写死 `localhost:7890`（dev 靠 `vite.config.ts` proxy `/api` → 7890，prod 相对路径）。
- 业务 Card 放进 `components/ui/`。
- 加路由却不更新 `App.tsx` `routeTitles`（title 与 `captureDashboardLoaded` 会错）。
- 以为 `/journal` 已在 Header 里。
