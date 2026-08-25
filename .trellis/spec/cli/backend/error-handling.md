# Error Handling

> 适用于 CLI 命令、provider、db 初始化、hook 路径。

## 分层

| 层 | 策略 | 出处 |
|----|------|------|
| 可复用核心（`runSync`、db write） | throw `Error`，让调用方决定 | `cli/src/commands/sync.ts` |
| 交互式命令 | 捕获后 chalk 打印，必要时 `process.exit(1)` | `reflect.ts` 的 `checkServer` |
| Provider parse | 返回 `null` / 记录 errorCount，继续下一条 | `runSync` 循环 |
| JSON 配置损坏 | `loadConfig` / `loadSyncState` catch 后返回 `null` 或默认值 | `cli/src/utils/config.ts` |
| Telemetry | 失败吞掉，不能影响主路径 | `cli/src/utils/telemetry.ts` |

`runSync` 注释写明：未知 provider 等 fatal 错误 throw，而不是 `process.exit()`。因为 dashboard 启动前也会调 `runSync`。

## Quiet / hook

`--quiet` 时：

- `log` 变成 no-op，spinner 换成 noop 对象（`sync.ts`）。
- 需要给 hook 的提示走 `process.stderr.write`，避免污染 stdout。
- 不要 `inquirer.prompt`。`sync prune` 这种破坏性交互必须确认；hook 不要走 prune。

`session-end` 是 SessionEnd 的唯一入口。`quiet` 默认 false；hook 安装时再传 `-q`。stdin JSON 坏掉或缺 `session_id` 时打错误并 return，不 `process.exit`（测试要直接调 `sessionEndCommand`）。

## install-hook 写入形状

- 写入 `~/.claude/settings.json`（`utils/hooks-utils.ts` 的 `HOOKS_FILE`），SessionEnd 命令形如 `node <CLI_ENTRY> session-end --native -q`。
- 重跑 `install-hook` 会顺手清掉 v4.8.x 遗留的 Stop hook（`removeStopHooks`），再幂等安装 SessionEnd。
- 解析已有 settings.json 失败时不覆盖文件，提示后新建——不要在损坏的 settings 上直接写。

## 分类与遥测

用 `classifyError` + `captureError` / `trackEvent`（`cli/src/utils/telemetry.ts`）。事件名是字面量联合类型 `TelemetryEventName`，不要随手发明新字符串还不加联合。

`captureError` 的 properties **不要**带键 `type`（PostHog schema 冲突）。分析相关用 `analysis_type`。见 `server/src/routes/route-helpers.ts` 注释。

## 外部 LLM / 订阅失效

配置了 custom/OpenAI-compatible 却返回 `SUBSCRIPTION_NOT_FOUND` 之类，判定为配置失效，**不要盲重试**指望补出 insights。CLI 应把错误原文留给主人，而不是包装成“分析中”。

Native 分析走 `claude -p`（`cli/src/analysis/native-runner.ts`）：用 `execFileSync` 传参数数组，禁止拼 shell 字符串。

## Anti-patterns

- 在 `runSync` 里 `process.exit`。
- parse 一个坏 JSONL 就让整个 sync 失败。
- hook 路径弹交互 confirm。
- `JSON.parse(config)` 不包 try/catch。
- 把 API 密钥打进错误日志或 telemetry properties。
