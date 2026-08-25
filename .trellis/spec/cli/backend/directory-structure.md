# CLI Directory Structure

> 适用于改 `cli/src/`、新增模块、调整 `package.json` exports。

## Layout

```text
cli/src/
├── index.ts                 # Commander 入口；双 bin → dist/index.js
├── types.ts                 # ParsedSession 等跨模块类型
├── commands/
│   ├── sync.ts / insights.ts / session-end.ts / ...
│   ├── stats/                 # shared.ts + actions/ + data/ + render/
│   └── doctor/                # index.ts(命令) runner.ts types.ts first-run.ts
│                              #   + checks/{environment,database,config,providers,analysis,hooks,sync,dashboard}.ts
├── providers/               # registry + 五个 SessionProvider
├── parser/                  # 仅 Claude JSONL + titles.ts
├── db/                      # schema.ts 是 v1；migrate.ts 是 v2+；queue.ts 是分析队列
├── analysis/                # 见 analysis-guidelines.md
├── prompts/prompt-loader.ts
├── constants/llm-providers.ts
├── utils/                   # config(paths/getClaudeDir/splitVirtualPath 所在地)、pricing、telemetry、
│                           #   device、hooks-utils、banner、browser、date-utils、ollama-detect、tips、welcome
└── __fixtures__/db/seed.ts
```

## Ownership

| 目录 | 拥有什么 | 不要放什么 |
|------|----------|------------|
| `commands/` | flag 解析、终端交互、调用 db/provider | JSONL 解析、SQL schema |
| `providers/` | discover + parse → `ParsedSession` | 直接写 SQLite |
| `parser/` | Claude JSONL / 标题 | 其他工具的私有格式（放对应 provider） |
| `db/` | schema、迁移、读写 | 业务文案、LLM prompt |
| `analysis/` | native/provider runner、queue-worker、analysis-db | Hono 路由（`server/src/routes/`） |
| `commands/doctor/checks/` | 单项检查，返回 `Check` | 在 check 里写交互修复 UI |
| `utils/` | config、paths、pricing、telemetry、device、hooks-utils | 一次性命令逻辑 |

## Workspace 边界

- 顶层 `pnpm-workspace.yaml` 只有 `cli`、`dashboard`、`server`。
- Server 通过 `@code-insights/cli/...` 的 **exports** 引用 CLI（见 `cli/package.json` `exports`）。新增给 server 用的符号必须加 export，并在 `cli/src/__tests__/package-imports.test.ts` 能解析的依赖范围内。
- CLI **不能** 把 `@code-insights/server` 列为依赖（循环）。`cli/src/commands/dashboard.ts` 用 `pathToFileURL` 加载 `server/dist/index.js`。
- `prepare`/`prepublishOnly` 会把 `dashboard/dist`、`server/dist` 拷进 `cli/dashboard-dist`、`cli/server-dist`。改发布产物时先看这两段脚本，不要另起拷贝路径。

## Anti-patterns

- 在 `packages/cli` 下找源码（本仓库没有这个目录）。
- 把 React 组件塞进 CLI。
- 在 command 文件里内联一整份 SQL schema。
- 给 server 用的函数只 `export` 自源码、不写进 `package.json` `exports`（运行态会解析失败）。
