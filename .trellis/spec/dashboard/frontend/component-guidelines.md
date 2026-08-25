# Component Guidelines

> 适用于 `dashboard/src/pages/*` 与 `dashboard/src/components/*`。

## 分层

1. **Page**：拉 hooks、拼布局、把 URL 筛选交给子组件。例：`pages/SessionsPage.tsx`。
2. **Domain 组件**：只吃 props + 少量局部 UI state。例：`InsightCard`、`SessionListPanel`。
3. **ui/**：shadcn + CVA variants。例：`components/ui/button.tsx`。改 variant 用 `cva`，class 合并用 `cn()`（`lib/utils.ts`）。

Page 保持薄。`SessionsPage` 把 filter 交给 `useFilterParams`，列表/详情拆 `SessionListPanel` / `SessionDetailPanel`。完整聊天在 `components/chat/`（`ChatConversation`、`MessageBubble`、`tools/panels/*`），不要在 page 里铺开。`SessionDetailPage.tsx` 只有约 200 字节，真正内容在 panel。

## 样式

- Tailwind utility + `cn(...)`。
- 图标：`lucide-react`。
- 类型色：`lib/constants/colors.ts` 的 `INSIGHT_TYPE_COLORS` / `INSIGHT_TYPE_LABELS`，不要在卡片里写死一组 class。
- 不要新开 CSS module。全局只放 `styles/globals.css`。

## i18n

用户可见字符串走 `useI18n().t('key')`。字典：`dashboard/src/lib/i18n.tsx`（`zh` 与 `en` 必须成对）。插值用 `{name}` 占位，如 `t('insightCard.recurring', { count })`。

硬编码中文/英文到 JSX 只允许：
- 与数据本身相同的内容（session title、insight.title）
- 开发者调试，不进主路径

## 组合样例

`InsightCard`（`components/insights/InsightCard.tsx`）：

- 用 `parseJsonField` 解 `bullets` / `metadata`
- 类型图标 map + shadcn `Card`/`Badge`
- 文案 `t(INSIGHT_TYPE_LABELS[insight.type])`

新卡片跟这个走，不要复制一份类型色。

## 错误与空态

- 根：`ErrorBoundary`（`components/ErrorBoundary.tsx`）
- 区块失败：`ErrorCard`
- 加载：`components/skeletons/*`
- 无数据：`components/empty-states/*`，不要塞假会话

## Anti-patterns

- 在组件里 `fetch`。
- 把 `tool_calls` 当已经是数组用（它是 JSON 字符串）。
- 复制 `button.tsx` 改一两个 class 当新 primitive——先加 variant。
- 只加中文 key 不加英文（或反过来）。
