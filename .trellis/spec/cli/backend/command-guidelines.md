# Command Guidelines

> 适用于新增/修改 `code-insights` / `insights` 子命令。入口：`cli/src/index.ts`。

## 入口与别名

`cli/package.json` `bin` 同时指向 `./dist/index.js`：

- `code-insights`
- `insights`

不要重命名旧入口。无参数运行走 `dashboardCommand({ open: true, sync: true })`。

## 注册方式

| 方式 | 命令 | 文件 |
|------|------|------|
| `program.command().action()` | `init` `sync` `sync prune` `status` `install-hook` `uninstall-hook` `doctor` `open` `dashboard` `session-end` `insights` `insights check` | `cli/src/index.ts` |
| `program.addCommand(exported)` | `reset` `stats` `config` `telemetry` `reflect` `analyze` `memories` `export-memories` `queue` | 各 `commands/*.ts` |

`stats` 用 `applySharedFlags` + 动态 `import()`（`commands/stats/index.ts`）。`doctor` 在 `index.ts` 里 `.action`，实现在 `commands/doctor/index.ts`。

## 命令目录（按职责）

| 命令 | 做什么 | 依赖 dashboard 进程？ |
|------|--------|----------------------|
| `init` | 建 `~/.code-insights/` + db | 否 |
| `sync` / `sync prune` | 采集写入 SQLite；prune 软删 ≤2 条消息 | 否 |
| `status` | 库概览 | 否 |
| `stats` `{cost,projects,today,models,patterns}` | 终端报表，读 SQLite | 否 |
| `config` / `config set` / `config llm` | 读写 `config.json` | 否 |
| `telemetry` `{status,enable,disable}` | 遥测开关 | 否 |
| `doctor` | 8 组检查；首次无数据走 `first-run.ts` | 否（会探测端口） |
| `dashboard` | 先可选 sync，再 `pathToFileURL` 加载 `server/dist` | 自己就是 server |
| `open` | 只打开浏览器，不启动 server | 假定已在跑 |
| `insights [id]` / `insights check` | **本地**分析：`--native` → `claude -p`，默认 → 已配置 LLM。写 `insights`；若模型返回 facets 也写 `session_facets`。不需要 dashboard | 否 |
| `analyze --session-id` | **HTTP** `GET /api/analysis/session/stream` | **是**，先 `/api/health` |
| `reflect` | HTTP `POST /api/reflect/generate` 合成周报 | 是 |
| `reflect backfill` | HTTP `/api/facets/missing` + `outdated` + `backfill` | 是 |
| `reflect backfill --prompt-quality` | HTTP `/api/facets/missing-pq` + `outdated-pq` + `backfill-pq` | 是 |
| `queue` `{status,process,retry,prune}` | 直接打 `db/queue.ts` / `analysis/queue-worker.ts` | 否 |
| `session-end` | stdin JSON → `syncSingleFile` → `enqueue` → spawn 脱离 worker。**quiet 不是默认**，hook 安装时再传 `-q` | 否 |
| `memories` | 按日把会话摘录写入 gains。读 sessions+messages，**不读 insights** | 否 |
| `export-memories` | 只导出 **已有 insights** 的会话；目录必须已存在 | 否 |
| `install-hook` / `uninstall-hook` | Claude Code SessionEnd | 否 |
| `reset` | 清库 | 否 |

`insights --hook` 已在 v4.9 删除，调用会打印错误，改走 `session-end`（`cli/src/commands/insights.ts`）。

## 外部依赖探测

- **Ollama**：`sync` 与 `dashboard` 启动时调 `autoDetectOllama()`（`utils/ollama-detect.ts`）探 `localhost:11434`，3s 超时；仅在未配置 LLM 且有模型时自动写入 `config.json`。首选模型顺序必须与 `constants/llm-providers.ts` 同步改。
- **claude CLI**：native runner 先跑 `claude --version` 探测（见 analysis-guidelines）。缺失不是 fatal——worker 落回 provider runner。
- **配置清洗**：`saveConfig` 只保留已知键（`dashboard.{port,host,llm}`、`telemetry`），会丢弃历史残留键（如 `firebase`、`webConfig`）。给 config 加新字段要同时改 `ClaudeInsightConfig` 类型和这里的白名单。

## 分层

| 层 | 做什么 | 例子 |
|----|--------|------|
| Commander 声明 | name / description / option | `sync` 的 `-f/-p/-s/--dry-run` |
| `*Command` | option → typed options | `syncCommand` → `runSync` |
| 核心函数 | 可复用；fatal **throw** 不 `process.exit` | `runSync`、`sessionEndCommand` |

HTTP 类命令（`reflect.ts`、`analyze.ts`）内有一份 `getBaseUrl()`：`loadConfig()?.dashboard?.port || 7890`，先 `GET /api/health`，失败则中文提示 `code-insights dashboard` 后 `process.exit(1)`。两文件各写了一份，改端口逻辑要两处一起看。

## memories vs export-memories

`memories`（`commands/memories.ts`）：

- 默认 `--gains-dir /data/apps/gains`
- 按 `basename(projectPath)` 分组，写入 `<gains>/<project>/aiws/memories/<YYYY-MM-DD>.md`
- `mkdirSync(..., { recursive: true })`
- 去重读文件里的 `> session: <id>`
- 内容来自 user excerpt / summary / 工具摘要，**不查询 insights 表**

`export-memories`（`commands/export-memories.ts`）：

- 只选 `s.id IN (SELECT DISTINCT session_id FROM insights)`
- 文件名：`${date}_${sourceAbbrev}_${seq}_${id.slice(0,8)}.md`（id 不一定是 UUID）
- 目录不存在则 skip，**不创建**
- 增量状态：`~/.code-insights/export-state.json` 的 `{ exported: string[] }`，`--force` 才覆盖

## session-end

`commands/session-end.ts`：读 stdin 的 Claude SessionEnd JSON（`session_id`、`transcript_path`）。`CODE_INSIGHTS_HOOK_ACTIVE` 已设置则立即 return，防止 worker 自己的会话再触发 hook。worker 日志：`~/.code-insights/hook-analysis.log`。worker 调 `processQueue` → `runInsightsCommand`。

## 用户可见文案

description / spinner / 错误用中文。标识符和 telemetry event 用英文。

## Anti-patterns

- 新增命令却删掉 `insights` bin。
- 把 `analyze`（HTTP）和 `insights`（本地 runner）当成同一个入口。
- 把 `reflect backfill` 当成完整 insights 分析；`--prompt-quality` 是第三条 PQ 链路。
- 在 `runSync` / `sessionEndCommand` 里 `process.exit`（测试会挂）。
- hook 路径弹 `inquirer`；`sync prune` 必须确认，但 hook 不要走 prune。
- 假设端口一定是 7890。
- `memories` 与 `export-memories` 混用创建目录的策略。
