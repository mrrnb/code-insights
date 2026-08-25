# Cross-Layer Thinking Guide

> 本仓库的层是 **Provider → CLI DB → Hono API → Dashboard**，不是泛化的 Controller/Service。

## 数据流

```text
JSONL / vscdb
  → SessionProvider.parse()        → ParsedSession (camelCase, Date)
  → db/write.ts                    → SQLite snake_case TEXT / JSON TEXT
  → Hono c.json(row)               → 原样返回行
  → dashboard lib/api.ts + types   → 仍是 snake_case
  → 组件边界                       → new Date / parseJsonField
```

每一跳都可能丢字段。加列时从下往上问：

1. 迁移写了吗？（`cli/src/db/migrate.ts` + `CURRENT_SCHEMA_VERSION`）
2. `write.ts` / analysis-db 写入了吗？
3. `loadSessionForAnalysis` 或列表 SELECT 选了吗？
4. `dashboard/src/lib/types.ts` 有字段吗？
5. JSON 列是否用了 `safeParseJson` / `parseJsonField`？
6. SSE 若涉及，CLI `reflect.ts` 与 dashboard `sse.ts` 是否同形状？

## 主键与命名

| 层 | 会话标识 |
|----|----------|
| `ParsedSession.id` | camelCase |
| `sessions.id` | SQLite PK |
| `messages.session_id` / `insights.session_id` / `session_facets.session_id` | FK |
| Dashboard `Session.id` | 与行一致 |

在 JOIN 或 dashboard 里写 `session.session_id` 是错的。文件名/URL 塞 session id 时要做字符安全与长度归一化（id 不一定是 UUID）。

## 合同清单（改一处搜全部）

| 合同 | 位置 |
|------|------|
| Session 列表列 | `cli/src/db/read.ts`、`server/src/routes/sessions.ts`、`dashboard/src/lib/types.ts` |
| 分析用 session/messages 列 | `server/src/routes/route-helpers.ts` |
| JSON 列 parse | `server/src/utils.ts` `safeParseJson` ↔ `dashboard/src/lib/types.ts` `parseJsonField` |
| SSE 事件 | `route-helpers.ts` ↔ `dashboard/src/lib/sse.ts` ↔ `cli/src/commands/reflect.ts` ↔ `analyze.ts` |
| Provider 名 | `getProviderName()` = `sync --source` = `sessions.source_tool`（`codex-cli` 不是 `codex`） |
| memories vs export | `memories.ts` 不读 insights；`export-memories.ts` 只要有 insights 的会话 |
| 模型短名 | `cli/.../aggregation.ts` `shortenModelName` ↔ `dashboard/src/lib/utils.ts` `formatModelName` |
| Session 标题 | `getSessionTitle` / CLI stats render |
| Insight type | server 写入、`InsightType`、colors、i18n |
| Prompt JSON schema | `cli/src/analysis/schemas/*.json` 与 normalize 测试 |

## 校验放在哪

| 输入 | 谁校验 |
|------|--------|
| CLI flags | Command 层（Commander option） |
| HTTP query/body | 对应 route（400） |
| LLM 是否配置 | `requireLLM()` / `isLLMConfigured()` |
| JSONL 坏文件 | Provider 返回 null，sync 记 errorCount |
| SQLite JSON 损坏 | parse helper 默认值，不 500 |

不要在 dashboard 再实现一遍 ISO 日期校验（server `sessions.ts` 已挡）；但 dashboard 仍要能展示非法/空 JSON 列而不崩溃。

## 运行态层

源码层正确 ≠ 进程层正确：

- CLI 调的是已编译 `server/dist` + 已占用端口的进程
- Vite dev 默认 proxy `7890`，config 可能是 7891
- `better-sqlite3` 与 Node ABI 绑定

改 API 后的验收：build → 重启 → `/api/health` → 具体资源 → SQLite 计数。

## Anti-patterns

- 假设 API 已经 camelCase。
- 只改 dashboard 类型，不改 SELECT。
- 只改 SCHEMA_SQL 不加迁移。
- 把内部 JSONL provider 字段当用户输入做安全夸大，或反过来把 query `q` 直接拼 LIKE。
