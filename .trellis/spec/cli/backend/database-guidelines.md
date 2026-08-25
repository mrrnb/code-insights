# Database Guidelines

> 适用于改 SQLite schema、迁移、`cli/src/db/*` 读写。本仓库 **没有 ORM**。

## 运行时

- 引擎：`better-sqlite3`（同步 API）。
- 路径：`~/.code-insights/data.db`（`cli/src/db/client.ts`）。
- 打开时：`journal_mode = WAL`、`busy_timeout = 5000`、`foreign_keys = ON`。
- 单例 `getDb()`；进程 `exit` 时 `closeDb()` 做 WAL checkpoint。
- 测试用 `:memory:` + `runMigrations`，**不要**打真实 `~/.code-insights/data.db`。

## 主键约定

| 表 | 主键 | 外键名 |
|----|------|--------|
| `sessions` | `id` | — |
| `messages` | `id` | `session_id` → `sessions.id` |
| `insights` | `id` | `session_id` → `sessions.id` |
| `session_facets` | `session_id` | `session_id` → `sessions.id` |
| `analysis_usage` | `(session_id, analysis_type)` | `session_id` |
| `analysis_queue` | `session_id` | `session_id` |

`SELECT sessions.session_id` 会报 `no such column: session_id`。JOIN 用 `JOIN sessions s ON i.session_id = s.id`。

## Schema vs 迁移

- `cli/src/db/schema.ts` 的 `SCHEMA_SQL` 是 **v1 初始库**（projects / sessions / messages / insights / usage_stats）。
- v2+ 只写在 `cli/src/db/migrate.ts` 的 `applyV*()`：`session_facets`(v3)、`reflect_snapshots`(v4)、`deleted_at`(v5)、compact/slash(v6)、`analysis_usage`(v7/v8)、`analysis_queue`(v9)。
- 改结构必须：新增 `applyV{N}` → bump `CURRENT_SCHEMA_VERSION` → 在 `runMigrations` 调用 → 更新 `schema.test.ts` / `migrate.test.ts`。
- 只改 `SCHEMA_SQL` 不会升级已有库。

时间戳一律 ISO 8601 TEXT。数组/嵌套对象存 JSON 字符串，读取侧要能容忍坏 JSON。

## 读写模式

- 写：`cli/src/db/write.ts`。模块级 **lazy prepared statement**，DB 实例变化时重建（测试隔离）。
- 读：`cli/src/db/read.ts`。动态 WHERE + bind params，禁止拼用户字符串。
- 队列：`cli/src/db/queue.ts`（`analysis_queue`）。
- 内容截断常量在 `write.ts`：`CONTENT_MAX=10000`、`THINKING_MAX=5000` 等。不要在 command 里另设一套。

会话列表默认：

```sql
WHERE deleted_at IS NULL
```

软删除由 v5 的 `deleted_at` 表达；`sync --force` 可恢复。`sync prune` 对消息数 ≤2 的会话走软删除。

`parseModelsUsed` / 同类 JSON 列：parse 失败返回 `undefined`/`[]`，不要 throw 打断整次查询。

## 谁写哪张表

| 表 | 写入方 |
|----|--------|
| `projects` / `sessions` / `messages` / `usage_stats` | CLI `sync` / `session-end` 的 `syncSingleFile` |
| `insights` / `analysis_usage` | CLI `insights`（`analysis-db.ts`）或 server `llm/analysis.ts` |
| `session_facets` | `reflect backfill`；或 `insights` 在模型返回 `facets` 时 |
| `reflect_snapshots` | server `routes/reflect.ts` |
| `analysis_queue` | `session-end` enqueue；`queue process/retry/prune` |

`sync` **不会**生成 `insights` 或 `session_facets`。缺分析不要怪 sync。

## 测试

- Fixture：`cli/src/__fixtures__/db/seed.ts` 的 `createTestDb` / `makeParsedSession`。
- Mock `getDb` 用模块级可变 `testDb` + `vi.mock`（见 `cli/src/db/read-write.test.ts`）。
- 新迁移加：空库升到 current、已有库幂等、回读新列。

## Anti-patterns

- 查询 `sessions.session_id`。
- 从 `insights` 反查“缺 facets 的会话”（会漏零 insights 行）。缺 facets 必须 `FROM sessions s LEFT JOIN session_facets sf ON s.id = sf.session_id`。
- 业务代码里塞 Fake 会话/insight 数据；没有真实数据就空态。
- 在测试外连生产/本机真实 db 做破坏性写。
- 把 `export-memories` 的增量状态写入 SQLite（它在 `~/.code-insights/export-state.json`）。
