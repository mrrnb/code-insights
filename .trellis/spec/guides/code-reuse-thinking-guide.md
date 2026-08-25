# Code Reuse Thinking Guide

> 这个 monorepo 的重复不是“两个 React 组件长得像”，而是 **同一规则在 cli / server / dashboard 各写一次后漂移**。

## 先搜再写

```bash
rg "functionName|column_name|event_name" cli/src server/src dashboard/src
```

搜不到再新建。新建时想清楚它属于哪一层：CLI db、server route-helpers、dashboard `lib/`。

## 本仓库重复热点

### 1. JSON 解析

已有：

- `server/src/utils.ts` → `safeParseJson`
- `dashboard/src/lib/types.ts` → `parseJsonField`
- `cli/src/db/read.ts` → `parseModelsUsed`

不要在 route 或组件里再写 `try { JSON.parse } catch`。行为必须是：坏数据给默认值，不抛。

### 2. Normalize / schema

`friction-normalize`、`pattern-normalize`、`prompt-quality-normalize` 在 **cli/src/analysis/** 与 **server/src/llm/** 各有一份。改规则两边一起改，并跑两边测试。JSON schema 在 `cli/src/analysis/schemas/`，有 `schema-sync.test.ts`。

### 3. LIKE 转义（server 内已三份）

`escapeLike` 目前在 `routes/sessions.ts`、`routes/search.ts`、`routes/insights.ts` 各有一份私有实现。改转义规则三处一起改；新 route 需要 LIKE 时先搜这三份，不要写第四份。

### 4. Session SELECT

分析用列集中在 `server/src/routes/route-helpers.ts`。列表/过滤的 WHERE 在 `shared-aggregation.ts` 的 `buildWhereClause`（`/missing` 例外，见该文件注释）。

### 5. 展示格式

| 规则 | 单一入口 |
|------|----------|
| 会话标题 | Dashboard：`getSessionTitle`。CLI 各命令 fallback 仍不一致，改展示时不要再复制第四套 |
| 模型短名 | CLI `shortenModelName` + dashboard `formatModelName` |
| 时长 | dashboard `formatDuration*`；CLI `commands/stats/render/format.ts` |
| Insight 类型色 | `dashboard/src/lib/constants/colors.ts` |

### 6. LLM 客户端与分析入口

- HTTP 分析：`server/src/llm/client.ts` + `llm/providers/*`。route 不要直接打模型 HTTP。
- 本地分析：`cli/src/analysis/native-runner.ts` / `provider-runner.ts`（`insights`、queue worker）。
- CLI `analyze.ts` 与 `reflect.ts` 各有一份 `getBaseUrl`/`checkServer`/`checkLlmConfigured`，改端口探测要两处一起改。

### 7. Telemetry

只有 `cli/src/utils/telemetry.ts`。Server import 它。事件名加到 `TelemetryEventName`。

## 什么时候才抽取

- 同一逻辑出现第三次，或已经两边不一致出过 bug
- 抽出后能有一个测试文件钉住行为

不要为“将来 dashboard 也会用”而在 CLI 预建抽象。`export-memories` 状态就故意放 JSON 文件而不是扩 SQLite。

## 不要复用错对象

- 不要用 `insights` 表当 facets 覆盖率的源
- 不要用 CLI `runSync` 去触发 LLM
- 不要用 dashboard `request()` 去打绝对 URL 端口
- 不要把 `components/ui` 的 Button 业务化成 InsightButton 还留在 ui/

## Anti-patterns

- 复制 `loadSessionMessages` 的 SELECT 到新 route，过两个月漏列。
- 只更新 dashboard 模型短名，stats 终端仍显示长 id。
- 新增 `utils2.ts` / `helpers.ts` 而不放进已有 `utils.ts` / `route-helpers.ts`。
