# Thinking Guides

> 在写代码前问对问题。本仓库的典型故障发生在 **sync / insights / facets / export** 边界，而不是 React 组件内部。

---

## Available Guides

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| [Data Pipeline](./data-pipeline.md) | 分清采集、insights、facets、memories | 任何“数据怎么没了 / 为什么没分析” |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | CLI ↔ SQLite ↔ Hono ↔ Dashboard 合同 | 改字段、API、JSON 列、SSE |
| [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md) | 避免双份 normalize / SELECT / 格式化 | 复制函数、加模型名、加 insight type |

---

## Quick Reference: Thinking Triggers

### 数据怎么没出来

- [ ] 刚 `sync` 完却没有 insights
- [ ] `reflect backfill` 说 facets 已最新，但 SQLite 有缺口
- [ ] dashboard 有会话无分析，或有 insights 无 facets
- [ ] `export-memories` skip 很多文件

→ [Data Pipeline](./data-pipeline.md)

### 跨层

- [ ] 给 `sessions` / `insights` / `session_facets` 加列或 JSON 字段
- [ ] 改 `/api/*` 的 JSON key 或 SSE event 名
- [ ] Dashboard 开始 `JSON.parse` 某个 TEXT 列
- [ ] CLI stats 与 dashboard 展示同一数字却公式不同

→ [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md)

### 复用

- [ ] 准备写 `safeParseJson` / `parseJsonField` 的第三份
- [ ] 改 `friction-normalize` 或 prompt schema
- [ ] 加模型展示名、insight 类型色、session 标题优先级
- [ ] 在多个 route 里复制 `SELECT ... FROM sessions`

→ [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md)

### 运行态（本机服务）

- [ ] 改了 server 源码，CLI 行为没变
- [ ] 端口在听但页面报错
- [ ] Node 升级后 `ERR_DLOPEN_FAILED`

先：配置端口 → PID → `/api/health` → 数据接口 → 是否加载了新的 `server/dist`。

---

## Pre-Modification Rule

改任何常量、JSON key、event 名、表列之前先搜：

```bash
rg "the_symbol_or_key" cli/src server/src dashboard/src
```

---

## Durable Facts

- CLI 与 dashboard **没有**共享的前端层；`spec/cli/frontend` 与 `spec/server/frontend` 已删除。
- 工作区是 `cli/` + `server/` + `dashboard/`，不是 `packages/*`。
- 本 spec 的每条规则都对应真实源码路径或已踩过的坑；发现与代码不符时直接改 spec，不留模板句。
