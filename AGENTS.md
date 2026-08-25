# code-insights 项目真相

指令正文只存在本文件；项目根 `AGENTS.md` / `CLAUDE.md` 是指向这里的本机软链接，不进业务仓库。

<!-- profile:start -->
## 项目身份证（自动生成，勿手动编辑）

**insights**: 采集分析AI编程会话

这个项目把分散在多种 AI 编程工具中的会话历史统一解析并落到本地 SQLite。
它解决记录分散、难检索、难复盘的问题，并通过终端统计、浏览器 Dashboard 和可选 LLM 分析把会话沉淀成知识资产。

### 能力
- 解析 Claude Code、Cursor、Codex CLI、Copilot CLI、VS Code Copilot Chat 的会话历史
- 写入结构化会话数据到本地 SQLite 数据库
- 展示终端统计报表与本地浏览器 Dashboard
- 生成跨会话的模式分析与 LLM 洞察
- 安装 Claude Code 会话结束后的自动同步 Hook

### 边界
- 不做云端账号体系或云端同步
- 不默认把会话数据发送到云端
- 不直接解析未接入 provider 的会话来源格式
- 不依赖远程托管服务，核心数据存储以本机为主

### 技术栈
Node.js、TypeScript、pnpm workspace、Commander.js、SQLite、better-sqlite3、Hono、React、Vite、Tailwind CSS

### 依赖（消费）
- Claude Code 会话文件（~/.claude/projects/**/*.jsonl）
- Cursor workspace storage SQLite（state.vscdb）
- Codex CLI 会话文件（~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl）
- Copilot CLI 事件文件（~/.copilot/session-state/{id}/events.jsonl）

### 对外提供
- code-insights / insights 本地 CLI 命令
- 本地 SQLite 会话数据库（~/.code-insights/data.db）
- 本地浏览器 Dashboard（默认 localhost:7890）
<!-- profile:end -->


## 项目定位

code-insights 是主人魔改的开源 AI 会话分析工具，将散落在各工具的会话历史统一采集、持久化到 SQLite。

## 核心能力

- 解析 **Claude Code / Cursor / Codex / GitHub Copilot** 会话历史
- 写入本地 **SQLite** 数据库
- 提供统计报表（cost / projects / today / models / patterns）
- 支持 **LLM 分析**（通过 `reflect` 命令调用外部 LLM 做跨会话分析）
- 内置 Web Dashboard（本地服务器 + 浏览器）

## 仓库位置

- 源码：`/data/github/code-insights`（主人魔改版）
- apps 链接：`/data/apps/code-insights` → `/data/github/code-insights`

## 技术栈

- **运行时**：Node.js (ES modules)
- **语言**：TypeScript
- **CLI 框架**：Commander.js
- **数据库**：better-sqlite3（SQLite）
- **包管理**：pnpm workspace（monorepo）
  - `@code-insights/cli` — CLI 工具
  - `@code-insights/server` — Dashboard 后端
  - `@code-insights/dashboard` — Dashboard 前端

## CLI 命令列表

| 命令 | 说明 |
|------|------|
| `code-insights init` | 初始化本地数据库 |
| `code-insights sync` | 同步 AI 会话到 SQLite（支持 -f/--force、-p/--project、-s/--source、--dry-run、-q/--quiet、-v/--verbose、--regenerate-titles） |
| `code-insights sync prune` | 软删除 ≤2 条消息的无效会话 |
| `code-insights status` | 显示状态和统计概览 |
| `code-insights install-hook` | 安装 Claude Code hook（会话结束自动同步） |
| `code-insights uninstall-hook` | 卸载 Claude Code hook |
| `code-insights open` | 在浏览器打开本地 Dashboard |
| `code-insights dashboard` | 启动 Dashboard 服务器并打开浏览器 |
| `code-insights reset` | 重置数据库 |
| `code-insights stats` | 统计汇总入口 |
| `code-insights stats cost` | 按项目/模型/时段的费用明细 |
| `code-insights stats projects` | 每个项目的会话数、时长、费用、模型 |
| `code-insights stats today` | 今日会话（标题、时长、费用） |
| `code-insights stats models` | 模型用量分布和趋势 |
| `code-insights stats patterns` | 跨会话模式（摩擦点、亮点、工作风格） |
| `code-insights config` | 查看/设置配置 |
| `code-insights telemetry` | 遥测配置 |
| `code-insights reflect` | 生成跨会话 LLM 分析（摩擦、规则、工作风格） |



## 经验精华（AIWS 蒸馏）

## 架构与约定
- 顶层 pnpm workspace 是 `cli/`、`server/`、`dashboard/`，不是 `packages/*` → 批量清理、构建或查依赖前先读 `pnpm-workspace.yaml`。
- `cli/package.json` 的 `bin` 同时保留 `code-insights` 与 `insights`，两者都指向 `./dist/index.js` → 新增命令名用别名，不重命名旧入口。
- `code-insights sync` 只采集 Claude/Cursor/Codex/Copilot 会话入 `~/.code-insights/data.db` → 不会自动生成 `insights` 或 `session_facets`。
- 完整 LLM 会话分析走 `server/src/routes/analysis.ts` 和 `server/src/llm/analysis.ts` → 不要把 facets backfill 当成完整 insights 分析入口。
- `reflect backfill` 只调用 `/api/facets/missing`、`/api/facets/outdated`、`/api/facets/backfill` → 目标是补 `session_facets`，不是补 `insights`。
- `/api/facets/missing` 必须从 `sessions` 主表出发并 `LEFT JOIN session_facets ON s.id = sf.session_id` → 从 `insights` 反查会漏掉零 insights 的会话。
- SQLite 主键约定：`sessions.id` 是主键，`messages`/`insights`/`session_facets` 外键才叫 `session_id` → 写 JOIN 前先查 schema。
- Dashboard 默认端口是 `7890`，实际以 `code-insights config`/`config.dashboard.port` 为准 → 本机曾因 ClashX 占用改跑 `7891` 或临时用 `7899`。
- `memories` 按日期聚合写 `/data/apps/gains/<project>/aiws/memories/<date>.md` 并会 `mkdir -p` → `export-memories` 按 session 写 `YYYY-MM-DD_<source>_<seq>_<shortId>.md`，只消费已存在的 `aiws/memories` 目录。
- `export-memories` 的增量状态在 `~/.code-insights/export-state.json`，`--force` 才覆盖重导 → 不把导出状态写入 SQLite。

## 踩坑记录
- 任务引用不存在的 `Todos.md` 会卡住入口 → 先说明文件缺失，再按对话任务和真实代码入口重建最小任务清单。
- `/api/facets/missing` 旧实现会把 43 个零 insights/零 facets 会话漏掉 → 正确做法是从 `sessions` 主表查缺失 `session_facets`。
- `reflect backfill` 显示 `All analyzed sessions already have up-to-date facets.` 但 SQLite 还有缺口 → 根因通常是常驻 dashboard 仍加载旧 `server/dist`，重启对应端口进程后再验。
- 查询 `sessions.session_id` 会报 `no such column: session_id` → 正确写法是 `sessions.id`，例如 `JOIN sessions s ON i.session_id = s.id`。
- `https://api.cursorhub.cloud/v1` 返回 `SUBSCRIPTION_NOT_FOUND` → custom/OpenAI-compatible LLM 配置已失效，继续重试不会补出 insights。
- `pnpm link --global` 报 `ERR_PNPM_NO_GLOBAL_BIN_DIR` → 先 `pnpm setup` 并加载 shell 配置，或只验证现有全局 `code-insights`/`insights` 是否可用。
- 现有全局 CLI 可用不等于已经链接到本地源码 → 同时查 `which code-insights`、`ls -l $(which code-insights)`、`code-insights --help`/`insights --help`。
- 根目录 `node -e "require('better-sqlite3')"` 报 `Cannot find module 'better-sqlite3'` 不等于依赖坏了 → pnpm workspace 要在实际依赖子包或 `.pnpm` 原生绑定路径验证。
- Node 升级后 dashboard 报 `ERR_DLOPEN_FAILED` → 先跑 `pnpm rebuild better-sqlite3` 对齐当前 Node ABI，再用 `/api/health` 和 `/api/sessions` 验。
- 端口有进程监听不代表 dashboard 健康 → `lsof -iTCP -sTCP:LISTEN` 后还要请求 `/api/health` 和 `/api/sessions`。
- 修完 server 代码只编译不重启会继续错报 → CLI 请求的是常驻 server API，不是刚改好的源码文件。
- 长生命周期本地 HTTP 服务不稳定时，临时 `backfill-insights.mjs` 可直接 import server 分析逻辑补零 insights 会话 → 用完删除，避免未跟踪脚本污染工作区。
- `export-memories --verbose | head` 的阶段性输出可能与最终导出数不一致 → 以 `~/.code-insights/export-state.json` 和目标目录文件数复核。
- 导出文件名不能假设 `session_id` 一定是 UUID 或 8 位后缀 → 任何把 session id 放进文件名/URL 的逻辑都要做字符安全与长度归一化。

## 有效模式
- 排查缺失分析先查 SQLite 底表：`sessions` 总数、`session_facets` 总数、`insights` 覆盖、交叉缺失分布 → 再决定跑 facets 还是完整 insights。
- 验证 facets 修复用补跑前后底表计数闭环，例如历史上 `736|693|43` 到 `736|736|0` → 不只信 CLI 摘要。
- 本地服务类问题按“配置端口 → PID → 健康接口 → 数据接口 → 日志”的顺序查 → 避免把旧进程、错端口、代码 bug 混在一起。
- LLM 批处理输出 `[n/total]`、session id、生成 insight 数量并落到文件 → 单会话 10-20 秒时能判断是假死还是正常推进。
- 导出类命令先跑 `--help`，再做单项目小样本、增量重跑、`--force` 覆盖、全量真实数据导出 → 单看编译通过不足以证明格式可用。
- 环境修复类任务可能没有源码改动 → 用 `pnpm rebuild better-sqlite3`、CLI 启动、API 响应、历史记录计数作为验收结果。
- 涉及补跑和导出的任务先区分“代码修复”“数据补跑”“本机环境修复”三类成果 → 收尾时分别给证据，不强行混成一个 commit。

## 依赖与集成
- 采集输入来自 Claude Code `~/.claude/projects/**/*.jsonl`、Cursor `state.vscdb`、Codex `~/.codex/sessions/**/rollout-*.jsonl`、Copilot `~/.copilot/session-state/{id}/events.jsonl` → provider 入口在 `cli/src/providers/`。
- 本项目与 gains/aiws 集成走 `/data/apps/gains/<project>/aiws/memories` → `memories` 会创建目录，`export-memories` 只消费已存在目录。
- 全量导出数量受两件事影响：SQLite 是否有 `insights`、目标 gains 项目是否已有 `.aiws/memories/` → skip 不是导出失败。
- Claude Code hook 只在会话结束后触发同步入库 → 不会连带触发 reflect、facets backfill 或完整 LLM 分析。
- 费用校验以 assistant usage 或 `task_complete.payload.usage` 为准 → session frontmatter 的 `cost: $X` 可用于对账但不是唯一真值。


## 主人画像

## 工作风格
- 主人在本项目中倾向先核对真实数据状态，再决定是否改代码；SQLite 底表、HTTP API、端口/PID 比口头任务描述优先级更高。
- 主人在本项目中偏好小步闭环：修一处、编译或重启、跑真实命令、查结果，再进入下一步。
- 主人在本项目中把“能启动”和“数据正确”分开验收；dashboard 打开后仍要确认 `/api/sessions`、导出文件、统计计数。
- 主人在本项目中接受 AI 在 `Todos.md` 缺失时自行依据任务上下文推进，但要求把缺失入口和替代依据说清楚。

## 沟通偏好
- 主人偏好短结论加关键证据，证据要包含命令、接口、表名、错误文本或计数，不接受只说“已验证”。
- 主人不希望 AI 因缺少 Todo 文件停住；当前上下文足够时要主动重建任务清单并推进。
- 主人不喜欢把不同层次的问题混为一谈；要明确区分 sync、insights、facets、memories/export-memories。
- 主人对环境问题要真实说明边界；例如 `pnpm link` 失败但现有全局命令可用时，不要夸大为项目构建失败。

## 质量标准
- 主人要求以运行态证据验收：CLI `--help`、server API、SQLite 计数、真实导出文件至少覆盖一个关键路径。
- 主人要求保持工作区干净；临时脚本、输出文件、后台补跑残留都要清掉或明确报告。
- 主人对兼容性保守；新增 `insights` 命令时保留 `code-insights`，导出状态外置而不是扩 SQLite 模型。
- 主人接受不做源码改动的环境修复，但必须说明为何没有提交物，并给出可复现验证结果。

## 高频摩擦
- 多次任务引用不存在的 `Todos.md` → AI 应先报告入口缺失，再按对话任务继续执行，不要反复搜索。
- 多次出现环境漂移：PNPM 全局 bin、Node/better-sqlite3 ABI、旧 dashboard 进程 → AI 应先做本机状态探测。
- 多次混淆“缺 insights”和“缺 session_facets” → AI 应先用 SQLite 交叉统计定义任务范围。
- 多次服务端修复后运行态未更新 → AI 应把重启 dashboard 和确认端口/PID 列为默认验收步骤。

## 高效模式
- 主人最认可“底表统计 → 修复最小代码 → 编译/重启 → API 验证 → 再查底表”的闭环。
- 主人最认可导出/批处理功能从单项目小样本开始，再验证增量、强制覆盖和全量真实数据。
- 主人最认可把外部依赖失效直接归因到明确错误，如 `SUBSCRIPTION_NOT_FOUND`，而不是继续盲重试。
- 主人最认可完成汇报列出改了哪些文件、跑过哪些验证、还剩哪些外部阻塞。
