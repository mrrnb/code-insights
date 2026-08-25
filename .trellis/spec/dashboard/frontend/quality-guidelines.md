# Quality Guidelines

> Dashboard 当前 **没有** vitest 用例（测试在 cli/server）。改 UI 用类型、构建、真接口验收。

## 代码标准

- 函数组件 + hooks。根错误边界是 class `ErrorBoundary`（需要 `getDerivedStateFromError`）。
- import 用 `@/`（`vite.config.ts` alias）。
- 用户字符串进 i18n 双语言。
- `cn()` 合并 Tailwind；不要字符串拼接 class 还覆盖不了冲突。

## 禁止项

- 演示数据冒充已同步会话。
- 写死 `http://localhost:7890`。
- 直接改 `components/ui/*` 的 DOM 结构而不考虑其他调用方（那是 shadcn 共享 primitive）。
- 在 dashboard 包引入 `better-sqlite3` 或 CLI 源码。
- 忽略 `models_used` 等 JSON 列可能损坏。

## 验收

改前端至少：

```bash
pnpm --filter @code-insights/dashboard build
```

连 API 的改动还要：

1. 确认 dashboard server 在 **配置端口** 上（`code-insights config`）
2. `GET /api/health` 与对应资源接口返回 JSON
3. 浏览器里走一遍空态 + 有数据态（本机 `~/.code-insights/data.db` 是真数据）

Dev：`pnpm --filter @code-insights/dashboard dev` 依赖已启动的 server（proxy 到 7890，若端口改过要同步 `vite.config.ts`）。

成功声明：build 绿灯 ≠ UI 正确 ≠ API 合同未破。
