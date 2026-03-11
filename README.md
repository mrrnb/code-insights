<p align="center">
  <img src="docs/assets/logo.svg" width="120" height="120" alt="Code Insights logo" />
</p>

<h1 align="center">Code Insights</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@code-insights/cli"><img src="https://img.shields.io/npm/v/@code-insights/cli" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@code-insights/cli"><img src="https://img.shields.io/npm/dm/@code-insights/cli" alt="npm downloads" /></a>
  <a href="https://github.com/melagiri/code-insights/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/@code-insights/cli" alt="license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@code-insights/cli" alt="node version" /></a>
  <a href="https://socket.dev/npm/package/@code-insights/cli"><img src="https://badge.socket.dev/npm/package/@code-insights/cli" alt="Socket Badge" /></a>
</p>

把 AI 编程会话沉淀成可检索、可分析、可复盘的知识资产。

`Code Insights` 可以解析 Claude Code、Cursor、Codex CLI、Copilot CLI 的会话历史，把结构化数据写入本地 SQLite，并通过终端统计与内置浏览器控制台展示洞察。

**无需账号。无需云端。数据不会离开您的机器。**

<p align="center">
  <img src="docs/assets/screenshots/dashboard-light.png" alt="Dashboard — activity chart, session stats, recent insights" width="800" />
</p>

## 快速开始

```bash
npm install -g @code-insights/cli

code-insights init      # 初始化配置与本地数据库
code-insights sync      # 解析已检测到的 AI 工具会话
code-insights dashboard # 打开内置控制台（默认 localhost:7890）
```

## 它能做什么

- **多工具支持**：解析 Claude Code、Cursor、Codex CLI、Copilot CLI 会话
- **终端统计**：`code-insights stats` 查看成本、使用量、活跃度分布
- **内置控制台**：在浏览器中查看会话列表、图表分析、LLM 洞察
- **自动同步 Hook**：`install-hook` 可在 Claude Code 会话结束后自动同步
- **LLM 分析**：生成摘要、决策、经验教训、Prompt 质量分析；支持自定义 API Key、本地 Ollama 以及 OpenAI 兼容接口
- **会话画像**：将会话归类为 7 种类型之一，如 `deep_focus`、`bug_hunt`、`feature_build`
- **PR 链接提取**：自动识别并展示会话中提到的 GitHub PR 链接

## 支持的 AI 工具

| 工具 | 数据位置 |
|------|----------|
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| Cursor | Workspace storage SQLite（macOS / Linux / Windows） |
| Codex CLI | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` |
| Copilot CLI | `~/.copilot/session-state/{id}/events.jsonl` |

## CLI 参考

```bash
code-insights init                     # 交互式初始化
code-insights sync                     # 同步会话到本地数据库
code-insights sync --force             # 强制重建所有会话
code-insights sync --source cursor     # 只同步指定来源
code-insights sync --dry-run           # 仅预览，不落库
code-insights status                   # 查看同步状态
code-insights dashboard                # 启动控制台并打开浏览器
code-insights dashboard --port 8080    # 自定义端口（默认 7890）
code-insights stats                    # 最近 7 天终端概览
code-insights stats cost               # 按项目和模型查看成本分布
code-insights stats projects           # 查看项目详情卡片
code-insights stats today              # 查看今日会话
code-insights stats models             # 查看模型使用分布
code-insights config                   # 查看当前配置
code-insights config llm               # 配置 LLM 提供商
code-insights install-hook             # Claude Code 会话结束时自动同步
code-insights reset --confirm          # 删除全部本地数据
```

<p align="center">
  <img src="docs/assets/screenshots/stats.png" alt="Terminal stats — sessions, cost, activity chart, top projects" width="500" />
</p>

## 架构

```
会话文件（Claude Code / Cursor / Codex CLI / Copilot CLI）
                           │
                           ▼
               ┌──────────────────┐
               │    CLI Providers │  负责发现并解析会话
               └──────────────────┘
                           │
                           ▼
               ┌──────────────────┐
               │   SQLite 数据库   │  ~/.code-insights/data.db
               └──────────────────┘
                    │          │
          ┌─────────┘          └──────────┐
          ▼                               ▼
  ┌───────────────┐            ┌──────────────────┐
  │  stats 命令    │            │   Hono API 服务   │
  │ （终端分析）   │            │   + React SPA     │
  └───────────────┘            │   localhost:7890  │
                               └──────────────────┘
```

这个 monorepo 包含 3 个包：

- **`cli/`**：Node.js CLI、会话 provider、SQLite 写入、终端统计
- **`server/`**：Hono API 服务、REST 接口、LLM 代理（API Key 只在服务端使用）
- **`dashboard/`**：Vite + React SPA，由 Hono 服务托管

## 开发

```bash
git clone https://github.com/mrrnb/code-insights.git
cd code-insights
pnpm install
pnpm build
cd cli && npm link
code-insights --version
```

更多说明请参考：

- `cli/README.md`：CLI 详细说明
- `CONTRIBUTING.md`：贡献指南

## 隐私说明

会话数据保存在本地 `~/.code-insights/data.db`。不需要账号，不做云同步。默认只有匿名使用统计；LLM 分析使用您自己配置的 API Key 或本地 Ollama，内容只会发送到您明确配置的提供商。

## 许可证

MIT，详见 `LICENSE`。
