# Quality Guidelines

> CLI 改动的代码标准与验收。测试框架：vitest。

## TypeScript / ESM

- `"type": "module"`。相对导入必须带 `.js` 后缀（`from './client.js'`），即使源文件是 `.ts`。
- 共享类型放 `cli/src/types.ts` 或命令局部 `types.ts`（如 `commands/stats/data/types.ts`），不要在多个 command 里复制 `ParsedSession`。
- 禁止 `any` 漏出公共 exports。SQLite row 在同文件定义 interface 再 `as SessionRow`（见 `commands/memories.ts`、`db/read.ts` 的 `ProjectRow`）。

## 测试风格

信任的样例：

- DB：`cli/src/db/read-write.test.ts`、`schema.test.ts`、`__tests__/migrate.test.ts`
- Provider/parser：`cli/src/providers/__tests__/*`、`parser/jsonl.test.ts`
- 命令：`cli/src/commands/sync.test.ts`、`commands/__tests__/insights.test.ts`
- 分析 normalize：`cli/src/analysis/__tests__/*`

模式：

1. `vi.mock` 提升，模块级 `let testDb`，mock `getDb` 闭包读取。
2. `await import(...)` 放在 mock 之后。
3. `beforeEach` → `createTestDb()` / `makeParsedSession()`；`afterEach` → `close()`。
4. 不断真实 `~/.code-insights/`。

## 禁止项

- 非测试业务代码填 Fake 会话、假 insight、演示项目名。
- 把 `export-state.json` 逻辑搬进 SQLite。
- 新增 CLI 命令名时丢掉 `insights` 别名。
- 假设全局 `code-insights` 已 link 到当前源码：验收要同时看 `which`、symlink、`--help`。
- Node 升级后不重建 `better-sqlite3`（会 `ERR_DLOPEN_FAILED`）。先 `pnpm rebuild better-sqlite3`。
- 根目录 `node -e "require('better-sqlite3')"` 失败不能当依赖坏了——pnpm 把原生绑定放在子包 / `.pnpm` 下。

## 验收命令（按改动选最小集）

```bash
pnpm --filter @code-insights/cli test
# 或单文件
pnpm --filter @code-insights/cli exec vitest run src/db/read-write.test.ts
pnpm --filter @code-insights/cli build
code-insights --help    # 或 ./cli/dist/index.js --help
```

根目录 `pnpm test` 走 `vitest.workspace.ts`，一次跑 cli + server 两包（dashboard 无测试，不在内）。CI（`.github/workflows/ci.yml`）在 Node 20 上跑 `pnpm build && pnpm test`——本地验收至少对齐这两步。

成功声明不得超过证据：typecheck ≠ 单测 ≠ 真命令跑通。涉及 sync 的改动，至少对一个真实 fixture 或 `--dry-run` 看输出。

## 发布/安装

改 CLI 对外行为后确认：

- `cli/package.json` `exports` 仍覆盖 server 需要的路径。
- `bin` 仍有 `code-insights` 与 `insights`。
- 不把 `cli/server-dist`、`cli/dashboard-dist` 当源码编辑（那是 build 拷贝）。
