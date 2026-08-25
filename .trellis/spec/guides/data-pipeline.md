# Data Pipeline

> 主人最常见的混淆：把 sync、insights、facets、memories 当成同一步。它们不是。

## 管道

```text
各工具会话文件
    │  sync / session-end.syncSingleFile
    ▼
SQLite sessions / messages / projects      ← 采集。无 LLM。
    │
    ├─ insights（本地 runner）/ analyze（HTTP）/ dashboard 分析
    │     → insights 表；CLI insights 若模型返回 facets 会顺带写 session_facets
    ├─ reflect backfill                 → session_facets
    ├─ reflect backfill --prompt-quality → insights.type = prompt_quality
    ├─ reflect（无子命令）              → reflect_snapshots
    ├─ memories                         → gains/.../aiws/memories/<date>.md（不读 insights）
    └─ export-memories                  → 同目录下按 session 的 md（只要有 insights 的会话）
```

| 命令/API | 读 | 写 | 不写 |
|----------|----|----|------|
| `sync` | 五个 provider 的文件 | `sessions` `messages` `projects` `usage_stats` | insights、facets |
| `insights` | sessions+messages | `insights` + `analysis_usage`；有 facets 字段才写 `session_facets` | 不打 HTTP |
| `analyze --session-id` | HTTP `/api/analysis/session/stream` | 由 server 写 insights | 本地 runner |
| `reflect backfill` | `/api/facets/missing` `outdated` | `session_facets` | 完整 session insights |
| `reflect backfill --prompt-quality` | `/api/facets/missing-pq` `outdated-pq` | PQ insight | facets |
| `reflect` | facets 聚合 | `reflect_snapshots` | |
| `memories` | 当日 sessions+messages | `<gains>/<project>/aiws/memories/<date>.md`（mkdir -p） | insights 表 |
| `export-memories` | 有 insights 的 sessions + facets + `export-state.json` | `${date}_${source}_${seq}_${id8}.md` | 不建目录、不写 SQLite |

`session-end` = 单文件 sync + `enqueue` + 脱离进程跑 `processQueue`（内部 `runInsightsCommand`）。**不会**自动 reflect / backfill。

## 排查顺序

先查底表再选命令：

```sql
SELECT
  (SELECT COUNT(*) FROM sessions WHERE deleted_at IS NULL) AS sessions,
  (SELECT COUNT(*) FROM session_facets) AS facets,
  (SELECT COUNT(DISTINCT session_id) FROM insights) AS sessions_with_insights;
```

交叉缺口：有 session 无 facet、有 session 无 insight。不要只信 CLI 摘要。历史上 `736|693|43` → 修 missing 查询后 `736|736|0`。

## 已知假象

1. **`reflect backfill` 说已最新，库里仍缺 facets** — 常驻进程还在用旧 `server/dist`。重启后再打 `/api/facets/missing`。
2. **missing 漏会话** — 必须 `FROM sessions s LEFT JOIN session_facets sf ON s.id = sf.session_id`。从 `insights` 出发会漏零 insights 行。
3. **`export-memories --verbose \| head` 数量对不上** — 以 `~/.code-insights/export-state.json` 和目标文件数为准。无 `aiws/memories/` 目录是 skip，不是崩溃。无 insights 的会话根本不会入选。
4. **`memories` 跑了但 export 仍 skip** — `memories` 不产生 insights；export 要先 `insights`/`analyze`。
5. **`SUBSCRIPTION_NOT_FOUND`** — custom endpoint 订阅失效，重试无意义。
6. **`sync --source codex`** — provider 名是 `codex-cli`。

## 本机路径

- DB：`~/.code-insights/data.db`
- 配置：`config.json`；sync 增量：`sync-state.json`；导出增量：`export-state.json`
- hook worker 日志：`hook-analysis.log`
- gains 默认：`/data/apps/gains`

## Anti-patterns

- 往 insights 插演示行冒充链路已通。
- 把 export 状态写入 SQLite。
- 一次任务里同时改 sync 解析、prompt、dashboard 卡片还不分别验收。
