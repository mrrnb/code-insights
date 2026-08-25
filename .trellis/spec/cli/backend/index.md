# CLI Backend Guidelines

> `@code-insights/cli` 是 Node.js ESM CLI：解析各工具会话、写入本地 SQLite、提供统计命令，并启动 dashboard。

本层覆盖 `cli/src/`。CLI **没有 React/前端层**；dashboard UI 在 `@code-insights/dashboard`。

---

## Pre-Development Checklist

改 CLI 代码前按改动类型读对应文件：

- [ ] 任何改动 → [Directory Structure](./directory-structure.md) + [Quality Guidelines](./quality-guidelines.md)
- [ ] 新命令 / 改 flag / 改 `bin` 入口 → [Command Guidelines](./command-guidelines.md)
- [ ] `insights` / native runner / analysis_queue → [Analysis Guidelines](./analysis-guidelines.md)
- [ ] 新数据源 / 改 JSONL 或 vscdb 解析 → [Provider Guidelines](./provider-guidelines.md)
- [ ] 改表、SQL、迁移、读写路径 → [Database Guidelines](./database-guidelines.md)
- [ ] 失败路径、process.exit、hook 静默模式 → [Error Handling](./error-handling.md)
- [ ] 终端输出、spinner、遥测事件 → [Logging Guidelines](./logging-guidelines.md)

始终再读 [shared guides](../../guides/index.md)，尤其 [Data Pipeline](../../guides/data-pipeline.md)。

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [Directory Structure](./directory-structure.md) | `cli/src` 模块边界与 workspace 导出 |
| [Command Guidelines](./command-guidelines.md) | Commander 命令目录、HTTP vs 本地分析 |
| [Analysis Guidelines](./analysis-guidelines.md) | native runner、queue-worker、与 server 双份 normalize |
| [Provider Guidelines](./provider-guidelines.md) | SessionProvider 名称与虚拟路径 |
| [Database Guidelines](./database-guidelines.md) | better-sqlite3、schema、迁移 |
| [Error Handling](./error-handling.md) | 可抛错误 vs `process.exit`、hook quiet |
| [Logging Guidelines](./logging-guidelines.md) | chalk/ora 终端输出与 PostHog |
| [Quality Guidelines](./quality-guidelines.md) | 测试、禁止项、验收命令 |

---

## Quality Check

- [ ] 未把 `packages/*` 当成 workspace 路径（真实包是 `cli/`、`server/`、`dashboard/`）
- [ ] 未新增只叫 `code-insights` 的入口而丢掉 `insights` 别名
- [ ] SQL 用 `sessions.id`，不用 `sessions.session_id`
- [ ] 会话查询带 `deleted_at IS NULL`（除非明确查软删除）
- [ ] 新表/列走 `migrate.ts` 并 bump `CURRENT_SCHEMA_VERSION`
- [ ] 核心逻辑有 vitest；fixture 走 `cli/src/__fixtures__/db/seed.ts`
- [ ] 未把 `analyze`（HTTP）和 `insights`（本地 runner）写成同一入口
- [ ] `sync --source` 用的是 `getProviderName()`（`codex-cli` 不是 `codex`）
- [ ] 验证过 `pnpm --filter @code-insights/cli test` 或对应单测文件

---

## Runtime Facts

- 运行时：Node >= 18，ESM（`type: module`，导入必须带 `.js` 后缀）
- 包管理：顶层 pnpm workspace，**不是** `packages/*`
- 数据库：`~/.code-insights/data.db`（better-sqlite3，WAL）
- 配置：`~/.code-insights/config.json`；同步增量：`sync-state.json`
- 默认 dashboard 端口：`7890`，以 `config.dashboard.port` 为准
