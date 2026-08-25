# Quality Guidelines

> Server 测试：vitest + `createApp().request()`。不启动真实 listen。

## 测试样例

信任这些文件的写法：

- `server/src/routes/facets.test.ts` — mock `getDb`、seed、缺行查询
- `server/src/routes/sessions.test.ts`、`analysis.test.ts`、`reflect.test.ts`
- `server/src/llm/analysis.test.ts`、normalize `*.test.ts`
- `server/src/utils.test.ts`

模式与 CLI 相同：模块级 `testDb`、`vi.mock('@code-insights/cli/db/client')`、`runMigrations`、动态 `import('../index.js')`。LLM 一律 mock，单测不打外网。

## 改完必须重启

CLI `dashboard` 加载 `server/dist`。只改 ts 或只 `tsc` 而不重启占用端口的进程，运行态仍是旧逻辑。`reflect backfill` 曾因此误报“facets 已最新”。

验收顺序：

```bash
pnpm --filter @code-insights/server test
pnpm --filter @code-insights/server build
# 重启 dashboard 进程后再：
curl -sS http://127.0.0.1:<port>/api/health
curl -sS http://127.0.0.1:<port>/api/sessions?limit=1
```

端口以 `code-insights config` / `config.dashboard.port` 为准。`lsof` 有监听不够，还要看 JSON。

## Node ABI

dashboard 报 `ERR_DLOPEN_FAILED` 时先 `pnpm rebuild better-sqlite3`，再打 health。根目录 `require('better-sqlite3')` 失败不等于 workspace 依赖坏了。

## 禁止项

- 测试或运行时写 Fake 业务 insight 冒充链路已通。
- 提交临时 `backfill-*.mjs` / 一次性脚本。
- 改生产机器上的 `~/.code-insights/data.db` 而不经 CLI 命令。
- 在 server 测试里依赖本机已配置的真实 LLM。

## ESM

与 CLI 一样：相对 import 带 `.js` 后缀。从 CLI 引用用 package exports 子路径，不要 `../../cli/src/...`。
