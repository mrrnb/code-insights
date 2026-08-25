# Server Database Guidelines

> Server **不拥有** schema。表结构与迁移只在 `cli/src/db/schema.ts` + `migrate.ts`。Server 通过 `getDb()` 读写同一文件。

## 接入

```ts
import { getDb } from '@code-insights/cli/db/client';
```

不要 new 第二个 `better-sqlite3` 连接去打开别的路径。测试里 `vi.mock('@code-insights/cli/db/client')` 指向 `:memory:` 并 `runMigrations(db)`（`server/src/routes/facets.test.ts`）。

## JOIN 与主键

- `sessions.id` 是会话主键。
- `messages.session_id`、`insights.session_id`、`session_facets.session_id` 才叫 `session_id`。
- 正确：`JOIN sessions s ON i.session_id = s.id`
- 错误：`sessions.session_id` → `no such column`

软删除：除“已删除计数”外，会话查询都加 `s.deleted_at IS NULL`。`loadSessionForAnalysis` 已包含此条件。

## 缺数据查询

缺 **facets**（`GET /api/facets/missing`）：

```sql
FROM sessions s
LEFT JOIN session_facets sf ON s.id = sf.session_id
WHERE sf.session_id IS NULL AND s.deleted_at IS NULL
```

不要 `FROM insights ... LEFT JOIN session_facets`：零 insights 的会话会被漏掉。这是已经踩过的坑。

缺 **insights** 是另一条链路，走 analysis 路由 / `insights check`，不要和 facets missing 混用。

## JSON 列

SQLite 里 `models_used`、`slash_commands`、`friction_points`、`effective_patterns`、`bullets`、`metadata` 是 TEXT JSON。Server 用 `safeParseJson`（`server/src/utils.ts`），与 dashboard `parseJsonField` 镜像。坏 JSON 返回默认值，不 500。

新增 JSON 列时：写入侧 `JSON.stringify`，两端 parse helper 同步，dashboard `lib/types.ts` 注明“JSON-encoded”。

## 共享 SELECT

分析路径的列变更只改 `route-helpers.ts` 的 `loadSessionForAnalysis` / `loadSessionMessages`。`analysis.ts`、`facets.ts`、`export.ts`、`reflect.ts` 都应走这两函数，避免漏列。

聚合走 `routes/shared-aggregation.ts` 的 `buildWhereClause` / `getAggregatedData`。`/missing` 不能复用 `buildWhereClause`（它会生成完整 `WHERE ...` 前缀），缺行查询自己拼 conditions——见 `facets.ts` 注释。

## Anti-patterns

- 在 server 新增 `CREATE TABLE` 而不走 CLI 迁移。
- 从 `insights` 表出发找“未分析会话”。
- 把 `export-memories` 状态写入 SQLite。
- 测试打到真实 `~/.code-insights/data.db`。
