# Server Directory Structure

> 适用于改 `server/src/` 或新增路由/LLM 模块。

## Layout

```text
server/src/
├── index.ts                 # createApp() + startServer()
├── utils.ts                 # parseIntParam、safeParseJson
├── routes/                  # 14 个子应用，见 route-guidelines.md 路由表
│   ├── route-helpers.ts     # loadSession* / requireLLM / streamSessionAnalysis / streamBatchBackfill
│   ├── shared-aggregation.ts
│   └── sessions.ts facets.ts analysis.ts reflect.ts dispatch.ts export.ts ...
├── llm/
│   ├── analysis.ts          # analyzeSession；再 export PQ/facets/recurring
│   ├── client.ts            # loadLLMConfig / isLLMConfigured / createLLMClient
│   ├── providers/           # openai anthropic gemini ollama llamacpp；custom 复用 openai + baseUrl
│   └── *-normalize.ts       # 与 cli/src/analysis/ 双份
└── export/                  # knowledge-base.ts、agent-rules.ts
```

入口：`server/src/index.ts`。测试只 import `createApp()`。

## 依赖方向

```text
dashboard (SPA)  --HTTP /api-->  server
server           --workspace-->  @code-insights/cli  (db/client, config, telemetry, 部分 analysis-db)
cli dashboard 命令 --fileURL-->  server/dist/index.js   （避免循环依赖）
```

Server 可以 import CLI exports，CLI **不能**把 server 当 package 依赖。

改 CLI `package.json` `exports` 后，确认 server 的 import 路径仍有效（例如 `@code-insights/cli/db/client`）。

## 路由文件 vs LLM

| 放 `routes/` | 放 `llm/` |
|--------------|-----------|
| HTTP 方法、query/body 校验、状态码 | 组 prompt、调模型、chunk、parse JSON |
| 调 `getDb()` 做列表/过滤 | `saveInsightsToDb` / `saveFacetsToDb` |
| SSE 包装（`route-helpers`） | `analyzeSession` / `extractFacetsOnly` / `analyzePromptQuality` |

不要在 route 里复制一份 session SELECT 列。列集合以 `loadSessionForAnalysis` / `loadSessionMessages`（`routes/route-helpers.ts`）为准。

## Anti-patterns

- 在 server 里重新实现 `getDb()` 或第二份 schema。
- 给 server 加 React/Vite。
- 新增路由却不挂到 `createApp()`。
- 把完整分析写进 `facets.ts`（facets 只提取/回填 `session_facets`）。
