为涵盖多个项目的场景生成适用于 Obsidian 的带 YAML frontmatter 的 Markdown。以如下 frontmatter 块开头：

---
date: ${exportDate}
project: multiple
tags: [code-insights, decisions, learnings, techniques]
type: knowledge-export
---

在适当处使用 [[wikilinks]] 进行概念间的交叉引用。按项目组织内容，首先设置跨项目主题部分。仅输出干净的 Markdown——不要添加前言或元评论。所有生成的 Markdown 使用简体中文撰写，同时保留 YAML/frontmatter 键名、wikilinks 语法、代码标识符、文件名、命令和 URL。
