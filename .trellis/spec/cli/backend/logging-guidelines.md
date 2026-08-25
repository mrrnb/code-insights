# Logging Guidelines

> CLI 没有 pino/winston。终端输出是人看的，telemetry 是机器看的。

## 终端

- `console.log` + `chalk`：标题 cyan、成功 green、警告 yellow、失败 red、次要 dim。
- 长操作：`ora` spinner；`--quiet` 必须换成 noop spinner（`cli/src/commands/sync.ts`）。
- Banner：`cli/src/utils/banner.ts`，dashboard 启动时用。
- 面向主人的句子用中文。

`sync.ts` 用 cyan 标题 + ora。`queue status --quiet` 把 JSON 写 stdout（给机器读），人类文案走 stderr/非quiet 路径。本仓库没有 pino/winston/debug，不要单独给一个命令加。

## Verbose

`sync --verbose` 经 `setProviderVerbose` 打开 provider 诊断（例如 Cursor 警告）。默认关闭。新增诊断输出必须受这个开关或 `--verbose` 控制。

## Telemetry

- 默认 opt-out 模型：`CODE_INSIGHTS_TELEMETRY_DISABLED=1`、`DO_NOT_TRACK=1`、或 `config.telemetry === false` 则关闭。
- 事件名只能来自 `TelemetryEventName`（`cli/src/utils/telemetry.ts`）。新事件先加联合类型，再 `trackEvent`。
- 一次性披露：`showTelemetryNoticeIfNeeded`，`--help` / `--version` 跳过（`cli/src/index.ts`）。
- 只记聚合：provider 名、会话数、耗时、success。不要记会话正文、prompt、API key。

## 给后续 AI 看的输出

批处理（`insights check --analyze`、reflect backfill）应打印 `[n/total]`、session id、本步结果。单会话 10–20s 时，有进度才能判断是假死还是正常。不要只转 spinner 不报 id。

## Anti-patterns

- `console.log(session)` 把整段对话打到终端。
- quiet 模式下仍写 stdout（会破坏 hook）。
- 新造 telemetry 事件名却不更新 `TelemetryEventName`。
- 用 `debug`/`pino` 只打一半命令，风格分裂。
