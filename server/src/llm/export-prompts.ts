// LLM prompts for cross-session export synthesis.
// Each format has two scope variants (project vs. all).
// The LLM returns raw markdown — no JSON parsing needed.

export type ExportFormat = 'agent-rules' | 'knowledge-brief' | 'obsidian' | 'notion';
export type ExportScope = 'project' | 'all';
export type ExportDepth = 'essential' | 'standard' | 'comprehensive';

export const DEPTH_CAPS: Record<ExportDepth, number> = {
  essential: 25,
  standard: 80,
  comprehensive: 200,
};

// Rough token estimate per insight (title + content + metadata summary).
// Used to enforce the hard 60k input token ceiling within the depth cap.
const AVG_TOKENS_PER_INSIGHT = 300;
const MAX_EXPORT_INPUT_TOKENS = 60000;

export interface ExportInsightRow {
  id: string;
  type: string;
  title: string;
  content: string;
  summary: string;
  confidence: number;
  project_name: string;
  timestamp: string;
}

export interface ExportContext {
  scope: ExportScope;
  format: ExportFormat;
  depth: ExportDepth;
  projectName?: string;    // set when scope === 'project'
  sessionCount: number;
  projectCount: number;
  dateRange: { from: string; to: string };
  exportDate: string;      // ISO 8601 date for Obsidian frontmatter
}

/**
 * Apply depth cap and token budget guard, returning the insights to send to the LLM.
 * Also returns totalInsights (before cap) for metadata.
 */
export function applyDepthCap(
  insights: ExportInsightRow[],
  depth: ExportDepth
): { capped: ExportInsightRow[]; totalInsights: number } {
  const totalInsights = insights.length;
  const depthCap = DEPTH_CAPS[depth];

  // Apply depth cap first
  let capped = insights.slice(0, depthCap);

  // Token budget guard within the depth cap — safety net for unusually large insights
  let tokenEstimate = 0;
  const tokenBudgeted: ExportInsightRow[] = [];
  for (const insight of capped) {
    tokenEstimate += AVG_TOKENS_PER_INSIGHT;
    if (tokenEstimate > MAX_EXPORT_INPUT_TOKENS) break;
    tokenBudgeted.push(insight);
  }
  capped = tokenBudgeted;

  return { capped, totalInsights };
}

/**
 * Format insights for LLM input, grouped by type.
 * Includes project_name on each insight for scope-awareness.
 */
export function buildInsightContext(insights: ExportInsightRow[]): string {
  const grouped: Record<string, ExportInsightRow[]> = {};
  for (const insight of insights) {
    const key = insight.type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(insight);
  }

  const sections: string[] = [];

  const typeOrder = ['decision', 'learning', 'technique', 'prompt_quality', 'summary'];
  const typeLabels: Record<string, string> = {
    decision: '决策',
    learning: '学习收获',
    technique: '技巧',
    prompt_quality: '提示词质量',
    summary: '会话摘要',
  };

  for (const type of typeOrder) {
    const items = grouped[type];
    if (!items || items.length === 0) continue;

    const label = typeLabels[type] ?? type.toUpperCase();
    sections.push(`## ${label}\n`);

    for (const item of items) {
      const projectTag = item.project_name ? ` [${item.project_name}]` : '';
      const confidence = Math.round(item.confidence * 100);
      sections.push(
        `### ${item.title}${projectTag}（置信度：${confidence}%）\n${item.content || item.summary}\n`
      );
    }
  }

  return sections.join('\n');
}

// ─── System prompts ──────────────────────────────────────────────────────────

export const AGENT_RULES_PROJECT_SYSTEM_PROMPT = (projectName: string) => `\
你是一位技术作家，正在将 AI 编码会话的 insights 转换为项目 "${projectName}" 的 agent 指令规则。\
产出适用于 CLAUDE.md 或 .cursorrules 文件的祈使句式指令。

规则：
- 对重叠的 insights 去重——合并为单一规则
- 使用祈使语气："USE X"、"DO NOT Y"、"WHEN Z, do W"
- 按主题分组（而非按会话）
- 在相关处包含 REVISIT 条件
- 按置信度和频率排定优先级
- 如果决策随时间演变，记录当前决策及其变更原因
- 包含"提示词卫生"部分，汇总来自 prompt quality insights 的反模式（如果存在）
- 仅输出干净的 Markdown——不要添加前言或元评论
- 所有生成的 Markdown 使用简体中文撰写，同时保留代码标识符、文件名、URL、CLI 命令和必要的 section 语法`;

export const AGENT_RULES_ALL_SYSTEM_PROMPT = `\
你是一位技术作家，正在将来自多个项目的 AI 编码会话 insights 转换为 agent 指令规则。\
产出适用于 CLAUDE.md 或 .cursorrules 文件的祈使句式指令。

对你产出的每条规则，按以下范围分类：

- PROJECT-SPECIFIC：该规则引用了特定项目、框架版本、库或代码库结构，仅适用于该项目。\
  以 "[project-name]" 为前缀，例如 "[code-insights] USE WAL mode for SQLite"

- UNIVERSAL：该规则是通用的工程实践、调试技巧或提示模式，适用于任何项目。\
  无需前缀。

如有疑问，标记为 PROJECT-SPECIFIC。

按如下结构组织输出：
## Universal Rules
（适用于任何项目的规则）

## Project-Specific Rules
### {project-name}
（特定于该项目的规则）

附加规则：
- 对重叠的 insights 去重——合并为单一规则
- 使用祈使语气："USE X"、"DO NOT Y"、"WHEN Z, do W"
- 在每个 section 内按主题分组
- 按置信度和频率排定优先级
- 包含"提示词卫生"部分，汇总通用反模式（如果存在）
- 仅输出干净的 Markdown——不要添加前言或元评论
- 所有生成的 Markdown 使用简体中文撰写，同时保留项目名称、代码标识符、URL 和必要的 section 语法`;

export const KNOWLEDGE_BRIEF_PROJECT_SYSTEM_PROMPT = (projectName: string) => `\
你是一位技术作家，正在为项目 "${projectName}" 创建知识交接文档。\
产出一份可读的 Markdown 文档，汇总来自 AI 编码会话的决策、学习收获和技巧。

结构：
- 执行摘要（3-5 句话，涵盖项目走向和关键架构决策）
- 关键决策（附带理由和权衡说明）
- 学习收获（按主题分组）
- 值得复用的技巧

仅输出干净的 Markdown——不要添加前言或元评论。
所有生成的 Markdown 使用简体中文撰写，同时保留项目名称、代码标识符、文件名、命令和 URL。`;

export const KNOWLEDGE_BRIEF_ALL_SYSTEM_PROMPT = `\
你是一位技术作家，正在基于多个项目的 AI 编码会话创建知识交接文档。\
产出一份可读的 Markdown 文档，汇总决策、学习收获和技巧。

结构：
- 顶部设置跨项目主题部分（跨项目出现的模式）
- 然后按项目组织，每个项目包含：
  - 关键决策（附带理由和权衡说明）
  - 学习收获（按主题分组）
  - 值得复用的技巧

仅输出干净的 Markdown——不要添加前言或元评论。
所有生成的 Markdown 使用简体中文撰写，同时保留项目名称、代码标识符、文件名、命令和 URL。`;

export const OBSIDIAN_PROJECT_SYSTEM_PROMPT = (projectName: string, exportDate: string) => `\
为项目 "${projectName}" 生成适用于 Obsidian 的带 YAML frontmatter 的 Markdown。\
以如下 frontmatter 块开头：

---
date: ${exportDate}
project: ${projectName}
tags: [code-insights, decisions, learnings, techniques]
type: knowledge-export
---

在适当处使用 [[wikilinks]] 进行概念间的交叉引用。\
按主题分组内容，而非按会话。\
仅输出干净的 Markdown——不要添加前言或元评论。
所有生成的 Markdown 使用简体中文撰写，同时保留 YAML/frontmatter 键名、wikilinks 语法、代码标识符、文件名、命令和 URL。`;

export const OBSIDIAN_ALL_SYSTEM_PROMPT = (exportDate: string) => `\
为涵盖多个项目的场景生成适用于 Obsidian 的带 YAML frontmatter 的 Markdown。\
以如下 frontmatter 块开头：

---
date: ${exportDate}
project: multiple
tags: [code-insights, decisions, learnings, techniques]
type: knowledge-export
---

在适当处使用 [[wikilinks]] 进行概念间的交叉引用。\
按项目组织内容，首先设置跨项目主题部分。\
仅输出干净的 Markdown——不要添加前言或元评论。
所有生成的 Markdown 使用简体中文撰写，同时保留 YAML/frontmatter 键名、wikilinks 语法、代码标识符、文件名、命令和 URL。`;

export const NOTION_PROJECT_SYSTEM_PROMPT = (projectName: string) => `\
为项目 "${projectName}" 生成兼容 Notion 的 Markdown。使用：
- Toggle blocks（▶ **Section Name**）实现可折叠章节
- Callout blocks（> [!note] content）标注关键决策
- 在适当处使用表格进行结构化对比
- 不使用 wikilinks——仅使用标准 Markdown 链接

按主题分组内容，而非按会话。\
仅输出干净的 Markdown——不要添加前言或元评论。
所有生成的 Markdown 使用简体中文撰写，同时保留 Notion 语法标记、代码标识符、文件名、命令和 URL。`;

export const NOTION_ALL_SYSTEM_PROMPT = `\
为涵盖多个项目的场景生成兼容 Notion 的 Markdown。使用：
- Toggle blocks（▶ **Section Name**）实现可折叠章节
- Callout blocks（> [!note] content）标注关键决策
- 在适当处使用表格进行结构化对比
- 不使用 wikilinks——仅使用标准 Markdown 链接

按项目组织内容，首先设置跨项目主题部分。\
仅输出干净的 Markdown——不要添加前言或元评论。
所有生成的 Markdown 使用简体中文撰写，同时保留 Notion 语法标记、代码标识符、文件名、命令和 URL。`;

/**
 * Select the appropriate system prompt for the given format and scope.
 */
export function getExportSystemPrompt(ctx: ExportContext): string {
  const { format, scope, projectName = 'unknown', exportDate } = ctx;

  switch (format) {
    case 'agent-rules':
      return scope === 'project'
        ? AGENT_RULES_PROJECT_SYSTEM_PROMPT(projectName)
        : AGENT_RULES_ALL_SYSTEM_PROMPT;

    case 'knowledge-brief':
      return scope === 'project'
        ? KNOWLEDGE_BRIEF_PROJECT_SYSTEM_PROMPT(projectName)
        : KNOWLEDGE_BRIEF_ALL_SYSTEM_PROMPT;

    case 'obsidian':
      return scope === 'project'
        ? OBSIDIAN_PROJECT_SYSTEM_PROMPT(projectName, exportDate)
        : OBSIDIAN_ALL_SYSTEM_PROMPT(exportDate);

    case 'notion':
      return scope === 'project'
        ? NOTION_PROJECT_SYSTEM_PROMPT(projectName)
        : NOTION_ALL_SYSTEM_PROMPT;

    default:
      return AGENT_RULES_PROJECT_SYSTEM_PROMPT(projectName);
  }
}

/**
 * Build the user prompt that combines the export context header with the insight data.
 */
export function buildExportUserPrompt(ctx: ExportContext, insightContext: string): string {
  const scopeDescription = ctx.scope === 'project'
    ? `项目：${ctx.projectName}`
    : `全部项目（${ctx.projectCount} 个项目）`;

  const header = [
    `来源：${scopeDescription}`,
    `分析会话数：${ctx.sessionCount}`,
    `日期范围：${ctx.dateRange.from} 至 ${ctx.dateRange.to}`,
  ].join('\n');

  return `${header}\n\n${insightContext}`;
}
