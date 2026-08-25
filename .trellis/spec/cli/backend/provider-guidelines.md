# Provider Guidelines

> 适用于接入新会话来源，或改 JSONL / vscdb 解析。

## 合同

`SessionProvider`（`cli/src/providers/types.ts`）：

- `getProviderName()`：稳定 id，也是 `sessions.source_tool` 与 `sync --source` 的值
- `discover({ projectFilter })`：路径列表；目录不存在返回 `[]`
- `parse(filePath)`：失败返回 `null`，不要 throw 中断整批 sync

输出 `ParsedSession`（`cli/src/types.ts`），在 parse 末尾设置 `sourceTool`。注册：`cli/src/providers/registry.ts`。未知 `--source` 抛 `Unknown provider`。

## 现有来源（名称必须一字不差）

| `getProviderName()` | 本机位置 | 格式 | 实现 |
|---------------------|----------|------|------|
| `claude-code` | `~/.claude/projects/**/*.jsonl`（`utils/config.ts` 的 `getClaudeDir()`） | JSONL，解析在 `parser/jsonl.ts` | `claude-code.ts` |
| `cursor` | macOS `~/Library/Application Support/Cursor/User/workspaceStorage/*/state.vscdb` | SQLite；**虚拟路径** `state.vscdb#<composerId>`（一 DB 多会话） | `cursor.ts` |
| `codex-cli` | `~/.codex/sessions` 与 `archived_sessions`（`CODEX_HOME` 可覆盖） | JSONL v0.104+ 或旧单文件 JSON；`rollout-*.jsonl`/`json` | `codex.ts` |
| `copilot-cli` | `~/.copilot/session-state/{id}/events.jsonl`（`COPILOT_HOME` 可覆盖） | JSONL | `copilot-cli.ts` |
| `copilot` | VS Code `.../Code/User/workspaceStorage/<hash>/chatSessions/<id>.json` | 单文件 JSON v3 | `copilot.ts` |

`sync --source codex` 会失败，正确值是 `codex-cli`。

Cursor 的 `#composerId` 由 `cli/src/utils/paths.ts` 的 `splitVirtualPath` 拆开（`sync.ts` 调用）。新的“一文件多会话”来源沿用 `path#id`，不要改 `SessionProvider` 接口。

## Claude JSONL

- 跳过 hidden、`var-folders`、`-tmp`（`claude -p` 分析会话）。见 `ClaudeCodeProvider.discover`
- 诊断输出受 `providers/context.ts` `setProviderVerbose` 控制
- 标题 / character：`parser/titles.ts` 的 `generateTitle` / `detectSessionCharacter`。Cursor/Codex/Copilot 已调用，不要在新 provider 里另写打分

## 写入边界

Provider 只产出 `ParsedSession`。写库是 `db/write.ts` 的 `insertSessionWithProjectAndReturnIsNew` / `insertMessages`，由 `runSync` 调用。Provider 内不要 `getDb()`。

## 测试

- `providers/__tests__/claude-code.test.ts`、`cursor.test.ts`
- `providers/codex.test.ts`（与文件同级，不是 `__tests__/`）
- `parser/jsonl.test.ts`、`titles.test.ts`

至少覆盖：目录缺失 → `[]`；一条真实 fixture；坏文件 → `null`。

## Anti-patterns

- command 里 `if (source === 'cursor')` 解析。
- 把 Cursor/Codex 记录塞进 `parser/jsonl.ts`。
- 名称写成 `codex` / `github-copilot` 而不是表里的 id。
- 未设 `sourceTool`。
