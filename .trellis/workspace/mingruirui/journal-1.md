# Journal - mingruirui (Part 1)

> AI development session journal
> Started: 2026-08-25

---

## 2026-08-25 — spec bootstrap

完整填写 `.trellis/spec/`。删除 CLI/Server 误加的 frontend 模板层；按 cli backend、server backend、dashboard frontend 写实文件路径与反模式。新增 `guides/data-pipeline.md` 区分 sync/insights/facets/memories。

## 2026-08-25 — spec 第二、三鞭

第二鞭纠错+补边界：非流式分析失败实为 **422**（原 spec 写 200，已改）；insights POST 成功 201；install-hook 写 settings.json 且清 v4.8 Stop hook；autoDetectOllama 探 localhost:11434；saveConfig 白名单清洗；queue 补 resetFailed/pruneCompleted。第三鞭核验：四份 index 与文件集一致、零占位零死链。五条硬合同：主键 sessions.id / 缺口 LEFT JOIN 查询 / 运行态 dist+重启 / normalize 双份镜像 / 管道边界不互产。

## 2026-08-25 — 任务归档

00-bootstrap-guidelines 收口：commit `e0dd670`（46 files, +1254/-1944），task 归档。

## 2026-08-25 — spec 第一鞭

对照源码改错：`codex-cli` 名称、`memories` 不读 insights、`analyze` vs `insights`、session-end quiet 非默认。补命令全表、14 条路由表、CLI `analysis-guidelines.md`、dashboard hook/路由实表。

