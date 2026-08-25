# Type Safety

> API 返回的就是 SQLite 行：snake_case + ISO 8601 字符串。类型定义在 `dashboard/src/lib/types.ts`。

## 边界规则

- **不要**在 `lib/api.ts` 把行转成 camelCase。
- Date 只在组件边界 `new Date(session.started_at)`。
- JSON TEXT 列在类型上是 `string`（或 `string | null`），注释写明 encoded 形状。

JSON 列必须：

```ts
parseJsonField<string[]>(insight.bullets, [])
```

不要裸 `JSON.parse`。`parseJsonField` 不校验 runtime 形状；对数组在使用前 `Array.isArray()`。Server 侧镜像是 `safeParseJson`（`server/src/utils.ts`），两端默认值策略保持一致。

JSON 列清单见 `types.ts` 注释：`models_used`、`slash_commands`、`bullets`、`metadata`、`linked_insight_ids`、facets 的 `friction_points` / `effective_patterns`。

## 联合类型

跟数据合同走，不要放宽成 `string`：

- `SessionCharacter`、`TitleSource`、`InsightType`、`InsightScope`
- `LLMConfig.provider`：`'openai' | 'anthropic' | 'gemini' | 'ollama' | 'llamacpp' | 'custom'`

新增 insight type 要同时改：server 写入、`InsightType`、`INSIGHT_TYPE_COLORS`、`INSIGHT_TYPE_LABELS`、i18n。

## 标题优先级

Dashboard 标题用 `getSessionTitle`（`lib/utils.ts`）：`custom_title || generated_title || summary || 'Untitled Session'`。CLI 侧同优先级前两档，但 fallback 不统一（`insights.ts` 落到 `id`，`export-memories.ts` 落到 `` `${project_name} 会话` ``，`dispatch.ts` 落到 `'Untitled'`）。新 UI 跟 `getSessionTitle`；不要在页面再写一套三元。

`formatModelName` 与 CLI `commands/stats/data/aggregation.ts` 的 `shortenModelName` 镜像，加模型家族时两处一起改。

## Anti-patterns

- `as any` 读 `session.session_id`（字段是 `id`）。
- 把 `tool_calls: string` 当成 `ToolCall[]`。
- 在 dashboard 复制一份与 server 漂移的 Session 接口还不注明来源。
