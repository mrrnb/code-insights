// Prompt template strings and generator functions for LLM session analysis.
// Types → prompt-types.ts, constants → prompt-constants.ts,
// formatting → message-format.ts, parsers → response-parsers.ts.
//
// Prompts are loaded from ~/.code-insights/prompts/*.md files when available,
// falling back to built-in defaults. Users can customize prompts by editing
// the files in ~/.code-insights/prompts/.

import type { SessionMetadata, ContentBlock } from './prompt-types.js';
import {
  FRICTION_CLASSIFICATION_GUIDANCE,
  CANONICAL_FRICTION_CATEGORIES,
  CANONICAL_PATTERN_CATEGORIES,
  CANONICAL_PQ_DEFICIT_CATEGORIES,
  CANONICAL_PQ_STRENGTH_CATEGORIES,
  PROMPT_QUALITY_CLASSIFICATION_GUIDANCE,
  EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE,
} from './prompt-constants.js';
import { formatSessionMetaLine } from './message-format.js';
import { loadPrompt } from '../prompts/prompt-loader.js';

// =============================================================================
// SHARED SYSTEM PROMPT
// A minimal (~100 token) system prompt shared by all analysis calls.
// The full classification guidance and schema examples live in the instruction
// suffix (user[1]), keeping the system prompt cacheable across calls.
// =============================================================================

/**
 * Shared system prompt for all LLM analysis calls.
 * Paired with buildCacheableConversationBlock() + an analysis-specific instruction block.
 * Loaded from ~/.code-insights/prompts/system-prompt.md if it exists.
 */
const SYSTEM_PROMPT_DEFAULT = `你是一位资深工程师，负责分析一次 AI 辅助编程会话。你将收到对话记录，随后是具体的提取指令。请仅返回合法的 JSON，用 <json>...</json> 标签包裹。`;

export function getSharedSystemPrompt(): string {
  return loadPrompt('system-prompt', undefined, SYSTEM_PROMPT_DEFAULT);
}

// Backward-compatible export
export const SHARED_ANALYST_SYSTEM_PROMPT = SYSTEM_PROMPT_DEFAULT;

// =============================================================================
// CACHEABLE CONVERSATION BLOCK
// Wraps the formatted conversation in an Anthropic ephemeral cache block.
// CRITICAL: Must contain ONLY the formatted messages — no project name, no session
// metadata, no per-session variables. This ensures cache hits across sessions.
// =============================================================================

/**
 * Wrap formatted conversation messages in a cacheable content block.
 * The cache_control field instructs Anthropic to cache everything up to
 * and including this block (ephemeral, 5-minute TTL).
 *
 * Non-Anthropic providers receive this as a ContentBlock[] and use
 * flattenContent() to convert it to a plain string.
 *
 * @param formattedMessages - Output of formatMessagesForAnalysis()
 */
export function buildCacheableConversationBlock(formattedMessages: string): ContentBlock {
  return {
    type: 'text',
    // Trailing double newline ensures the instruction block (user[1]) reads as a
    // distinct section when providers flatten content blocks to a single string.
    text: `--- 对话记录 ---\n${formattedMessages}\n--- 对话记录结束 ---\n\n`,
    cache_control: { type: 'ephemeral' },
  };
}

// =============================================================================
// SESSION ANALYSIS INSTRUCTIONS
// The instruction suffix for session analysis calls (user[1]).
// Contains the full analyst persona, schema, and quality guidance.
// Per-session variables (project name, summary, meta) go here — NOT in the
// cached conversation block.
// =============================================================================

/**
 * Build the instruction suffix for session analysis.
 * Used as the second content block in the user message, after the cached conversation.
 * Loads from ~/.code-insights/prompts/session-analysis.md if it exists.
 */
export function buildSessionAnalysisInstructions(
  projectName: string,
  sessionSummary: string | null,
  meta?: SessionMetadata
): string {
  const summaryLine = sessionSummary ? `会话摘要：${sessionSummary}\n` : '';
  const metaLine = formatSessionMetaLine(meta);

  const vars = {
    projectName,
    summaryLine,
    metaLine,
    frictionCategories: CANONICAL_FRICTION_CATEGORIES.join(', '),
    frictionGuidance: FRICTION_CLASSIFICATION_GUIDANCE,
    patternGuidance: EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE,
  };

  return loadPrompt('session-analysis', vars, SESSION_ANALYSIS_DEFAULT(projectName, summaryLine, metaLine));
}

function SESSION_ANALYSIS_DEFAULT(projectName: string, summaryLine: string, metaLine: string): string {
  return `你是一位资深工程师，正在为团队的工程知识库撰写条目。你刚刚观察了一次 AI 辅助编程会话，你的任务是提取那些能在 6 个月后帮助另一位工程师节省时间的洞察。

你的读者是一位从未看过这次会话但在同一代码库工作的开发者。他们需要足够的上下文来理解：为什么做了这个决策、发现了什么坑、以及这些知识在什么场景下适用。

项目：${projectName}
${summaryLine}${metaLine}
=== 第一部分：会话特征 ===
首先作为整体评估提取以下特征：

1. outcome_satisfaction：评估会话结果。
   - "high"：任务完成，用户满意
   - "medium"：部分完成或有小问题
   - "low"：问题较多，用户受挫
   - "abandoned"：会话结束但未达成目标

2. workflow_pattern：识别主要工作模式（如果不清楚则为 null）。
   推荐值："plan-then-implement"、"iterative-refinement"、"debug-fix-verify"、"explore-then-build"、"direct-execution"

3. friction_points：识别最多 5 个进度受阻或变慢的时刻（数组，最多 5 个）。
   每个摩擦点包含：
   - _reasoning：（必填）你对分类 + 归因的推理链。最多 2-3 句。逐步走完决策树。此字段会保存但不会展示给用户——用它在分类前先想清楚。
   - category：优先使用这些分类：${CANONICAL_FRICTION_CATEGORIES.join(', ')}。只有当这些都不适用时才创建新的 kebab-case 分类。
   - attribution："user-actionable"（更好的用户输入可以避免此问题）、"ai-capability"（AI 在输入充足的情况下仍然失败）、或 "environmental"（外部约束）
   - description：一句中性描述，说明发生了什么，包含具体细节（文件名、API、错误信息）
   - severity："high"（阻塞进度多轮）、"medium"（导致绕路）、"low"（小波折）
   - resolution："resolved"（会话中已修复）、"workaround"（绕过了）、"unresolved"（仍未解决）
${FRICTION_CLASSIFICATION_GUIDANCE}

4. effective_patterns：最多 3 个效果特别好的技术或方法（数组，最多 3 个）。
   每个包含：
   - _reasoning：（必填）你对分类 + 驱动者的推理链。最多 2-3 句。逐步走完决策树和基线排除检查。此字段会保存但不会展示给用户——用它在分类前先想清楚。
   - category：优先使用这些分类：structured-planning、incremental-implementation、verification-workflow、systematic-debugging、self-correction、context-gathering、domain-expertise、effective-tooling。只有当这些都不适用时才创建新的 kebab-case 分类。
   - description：值得复用的具体技术（1-2 句，包含具体细节）
   - confidence：0-100，你对这个模式确实有效的信心
   - driver：谁驱动了这个模式——"user-driven"（用户明确要求）、"ai-driven"（AI 自发表现出来）、或 "collaborative"（双方共同贡献或从交互中涌现）
${EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE}

5. had_course_correction：用户是否将 AI 从错误方向上拉回来了（true/false）
6. course_correction_reason：如果 had_course_correction 为 true，简要说明纠正了什么（否则为 null）
7. iteration_count：用户需要澄清、纠正或重新解释的次数

如果会话摩擦很小、执行顺畅，friction_points 用空数组，outcome_satisfaction 设为 "high"，iteration_count 设为 0。

=== 第二部分：洞察 ===
然后提取以下内容：

你将提取：
1. **摘要**：完成了什么以及结果如何的叙述
2. **决策**：做出的技术选择——包含完整的情境上下文、推理、被否决的替代方案、权衡取舍、以及重新考虑的条件（最多 3 个）
3. **经验教训**：技术发现、踩坑、调试突破——包含可观测的症状、根因、以及可迁移的收获（最多 5 个）

质量标准：
- 只提取你会写进团队知识库供未来参考的洞察
- 每个洞察必须引用具体细节：文件名、库名、错误信息、API 端点或代码模式
- 不要编造对话中没有的文件名、API、错误或细节
- 对每个洞察的价值评估信心分（0-100）。只提取信心分 70 以上的洞察。
- 宁可某个类别返回 0 个洞察，也不要包含泛泛而谈或琐碎的内容
- 如果会话很直接，没有值得注意的决策或经验，在摘要中说明，其他类别留空

长度指引：
- 填写 schema 中的每个字段。空的 "trade_offs" 或 "revisit_when" 比更长的回答更糟糕。
- 总回答：控制在 2000 token 以内。如果必须精简，丢弃信心分较低的洞察，而不是压缩高信心的洞察。
- 证据：每个洞察 1-3 条简短引用，标注对话轮次。
- 宁精确不简短——一个具体的 3 句洞察胜过一个模糊的 1 句洞察。

不要提取以下类型的洞察（太泛/太琐碎）：
- "使用了调试技术来修复问题"
- "对代码库做了架构决策"
- "实现了一个新功能"（摘要已经涵盖了）
- "使用了 React hooks 管理状态"（没有具体细节太泛了）
- "修复了代码中的 bug"（什么 bug？根因是什么？）
- 任何只是复述任务但没有提供可迁移知识的内容

以下是一个优秀洞察的示例——这是质量标杆：

优秀的经验教训：
{
  "title": "Tailwind v4 需要 @theme inline{} 才能使用 CSS 变量工具类",
  "symptom": "Tailwind v3→v4 升级后，bg-primary 等自定义工具类失效。HTML 中有类名但没有样式生效。",
  "root_cause": "Tailwind v4 移除了 tailwind.config.js 的主题扩展机制。:root 中的 CSS 变量不会自动作为工具类可用——必须在 CSS 文件中通过 @theme inline {} 注册。",
  "takeaway": "迁移 Tailwind v3→v4 搭配 shadcn/ui 时：添加 @theme inline {} 映射 CSS 变量，添加 @custom-variant dark 以支持 class 模式暗色主题，将 tailwindcss-animate 替换为 tw-animate-css。",
  "applies_when": "任何使用 CSS 变量做主题的 Tailwind v3→v4 迁移，尤其是搭配 shadcn/ui。",
  "confidence": 95,
  "evidence": ["User#12: '升级后颜色全没了'", "Assistant#13: 'Tailwind v4 需要显式通过 @theme inline 注册...'"]
}

按以下 JSON 格式提取洞察：
{
  "facets": {
    "outcome_satisfaction": "high | medium | low | abandoned",
    "workflow_pattern": "plan-then-implement | iterative-refinement | debug-fix-verify | explore-then-build | direct-execution | null",
    "had_course_correction": false,
    "course_correction_reason": null,
    "iteration_count": 0,
    "friction_points": [
      {
        "_reasoning": "用户说了 'fix the auth' 但没有指定是 OAuth 还是 session 认证，也没指定哪个文件。步骤 1：不是外部因素——问题在于提示词，不是基础设施。步骤 2：用户本可以指定用哪种认证流程 → user-actionable。分类：incomplete-requirements 比 vague-request 更合适，因为缺失的是具体约束（哪种流程、哪个文件），而非整体任务描述。",
        "category": "incomplete-requirements",
        "attribution": "user-actionable",
        "description": "未指定使用哪种认证流程（OAuth vs session），导致在 auth.ts 中实现了错误的 provider",
        "severity": "medium",
        "resolution": "resolved"
      },
      {
        "_reasoning": "AI 将 Express 中间件模式应用到了 Hono 路由上，尽管对话中已有 Hono 的 import。步骤 1：不是外部因素。步骤 2：用户在之前的消息中已提供了明确的 Hono 上下文。步骤 3：AI 在输入充足的情况下仍然失败 → ai-capability。分类：knowledge-gap——应用了错误的框架 API 知识。",
        "category": "knowledge-gap",
        "attribution": "ai-capability",
        "description": "尽管对话上下文中可见 Hono import，仍将 Express 风格的中间件模式应用到 Hono 路由上",
        "severity": "high",
        "resolution": "resolved"
      }
    ],
    "effective_patterns": [
      {
        "_reasoning": "在编辑之前，AI 读取了 server/src/routes/ 和 server/src/llm/ 下的 8 个文件来理解数据流。基线检查：跨 2 个目录读取 8 个文件 = 超出常规（<5 文件）读取量。步骤 1：没有 CLAUDE.md 规则要求这样做。步骤 2：用户没有要求调查。步骤 3：AI 自主探索 → ai-driven。分类：context-gathering（主动调查，而非已有知识）。",
        "category": "context-gathering",
        "description": "在修改聚合查询之前，读取了 routes/ 和 llm/ 目录下的 8 个文件来梳理数据流，避免了一个会导致返工的类型不匹配问题",
        "confidence": 88,
        "driver": "ai-driven"
      }
    ]
  },
  "summary": {
    "title": "简要描述主要成果的标题（最多 80 字符）",
    "content": "2-4 句叙述：目标是什么、做了什么、结果如何。提及主要修改的文件或组件。",
    "outcome": "success | partial | abandoned | blocked",
    "bullets": ["每条列出一个具体的产出物（文件、函数、端点）及其变更"]
  },
  "decisions": [
    {
      "title": "做出的具体技术选择（最多 80 字符）",
      "situation": "什么问题或需求导致了这个决策点",
      "choice": "选择了什么以及如何实现",
      "reasoning": "为什么做出这个选择——影响决策的关键因素",
      "alternatives": [
        {"option": "替代方案名称", "rejected_because": "为什么没有选择它"}
      },
      "trade_offs": "接受了什么代价、放弃了什么",
      "revisit_when": "在什么条件下应该重新考虑这个决策（如果永久有效则填 'N/A'）",
      "confidence": 85,
      "evidence": ["User#4: 引用文本...", "Assistant#5: 引用文本..."]
    }
  ],
  "learnings": [
    {
      "title": "具体的技术发现或踩坑（最多 80 字符）",
      "symptom": "出了什么问题或哪里让人困惑——触发调查的可观测行为",
      "root_cause": "底层技术原因——为什么会发生",
      "takeaway": "可迁移的经验——在类似场景下应该做什么或避免什么，在本项目之外也有用",
      "applies_when": "这条知识适用的条件（框架版本、配置等）",
      "confidence": 80,
      "evidence": ["User#7: 引用文本...", "Assistant#8: 引用文本..."]
    }
  ]
}

只提取信心分 70 以上的洞察。如果无法引用证据，丢弃该洞察。没有强洞察的类别返回空数组。最多 3 个决策、5 个经验教训。
证据应引用对话中的标签化轮次（如 "User#2"、"Assistant#5"）。

请仅返回合法的 JSON，用 <json>...</json> 标签包裹。不要包含任何其他文本。`;
}

// =============================================================================
// PROMPT QUALITY INSTRUCTIONS
// The instruction suffix for prompt quality analysis calls (user[1]).
// =============================================================================

/**
 * Build the instruction suffix for prompt quality analysis.
 * Used as the second content block in the user message, after the cached conversation.
 */
export function buildPromptQualityInstructions(
  projectName: string,
  sessionMeta: {
    humanMessageCount: number;
    assistantMessageCount: number;
    toolExchangeCount: number;
  },
  meta?: SessionMetadata
): string {
  const sessionShape = `${sessionMeta.humanMessageCount} 条用户消息、${sessionMeta.assistantMessageCount} 条助手消息、${sessionMeta.toolExchangeCount} 次工具调用`;
  const metaLine = formatSessionMetaLine(meta);

  const vars = {
    projectName,
    sessionShape,
    sessionMeta: metaLine,
    pqGuidance: PROMPT_QUALITY_CLASSIFICATION_GUIDANCE,
    pqDeficitCategories: CANONICAL_PQ_DEFICIT_CATEGORIES.join(', '),
    pqStrengthCategories: CANONICAL_PQ_STRENGTH_CATEGORIES.join(', '),
  };

  return loadPrompt('prompt-quality', vars, PQ_ANALYSIS_DEFAULT(projectName, sessionShape, metaLine, vars.pqDeficitCategories, vars.pqStrengthCategories));
}

function PQ_ANALYSIS_DEFAULT(projectName: string, sessionShape: string, metaLine: string, pqDeficitCategories: string, pqStrengthCategories: string): string {
  return `你是一位提示词工程教练，帮助开发者更有效地与 AI 编程助手沟通。你审查对话并识别出哪些时刻使用更好的提示词可以节省时间——以及哪些时刻用户的提示词特别好。

你将产出：
1. **要点总结**：用户可以学习的具体前后对比示例（最多 4 个）
2. **发现项**：用于跨会话聚合的分类发现（最多 8 个）
3. **维度评分**：5 个数值维度，用于跟踪进步
4. **效率评分**：0-100 的整体评分
5. **评估**：2-3 句总结

项目：${projectName}
会话结构：${sessionShape}
${metaLine}
在评估之前，先通读对话并识别：
1. 助手要求澄清的每次时刻——这些本可以避免
2. 用户纠正助手理解的每次时刻
3. 用户重复之前给过的指令的每次时刻
4. 关键上下文或需求是否提供得太晚
5. 用户是否在实现之前讨论了方案/方法
6. 用户的提示词写得特别好的时刻
7. 如果发生了上下文压缩，注意 AI 可能丢失了上下文——压缩后立即重复指令不属于用户的提示词缺陷
以上是你的候选发现。只保留那些真正有可操作性的。

${PROMPT_QUALITY_CLASSIFICATION_GUIDANCE}

指引：
- 只关注用户消息——不要评价助手的回答
- 建设性而非评判性——目标是帮助用户提升
- 100 分意味着每条用户消息都清晰完整
- 50 分意味着大约一半的消息可以更高效
- 同时包含不足和亮点——做对了什么和做错了什么同样重要
- 如果用户的提示词写得好，就明确说——不要硬找问题
- 如果会话中发生了上下文压缩，不要因为用户在压缩后重复指令而扣分——是 AI 丢失了上下文，不是用户的问题。与压缩事件无关的重复仍应标注。

长度指引：
- 最多 4 个要点（排序：先改进项，再强化项），最多 8 个发现项
- better_prompt 必须是一个完整可用的提示词——不是模糊的元建议
- assessment：2-3 句
- 总回答：控制在 2500 token 以内

评估用户的提示词质量，按以下 JSON 格式回答：
{
  "efficiency_score": 75,
  "message_overhead": 3,
  "assessment": "2-3 句总结用户的提示词风格和效率",
  "takeaways": [
    {
      "type": "improve",
      "category": "late-constraint",
      "label": "简短的人类可读标题",
      "message_ref": "User#5",
      "original": "用户的原始消息（简要摘录）",
      "better_prompt": "包含缺失上下文的具体改写",
      "why": "一句话：为什么原始消息导致了摩擦"
    },
    {
      "type": "reinforce",
      "category": "precise-request",
      "label": "简短的人类可读标题",
      "message_ref": "User#0",
      "what_worked": "用户做得好的地方",
      "why_effective": "为什么带来了好结果"
    }
  ],
  "findings": [
    {
      "category": "late-constraint",
      "type": "deficit",
      "description": "一句包含具体细节的中性描述",
      "message_ref": "User#5",
      "impact": "high",
      "confidence": 90,
      "suggested_improvement": "具体的改写或行为改变"
    },
    {
      "category": "precise-request",
      "type": "strength",
      "description": "一句描述用户做得好的地方",
      "message_ref": "User#0",
      "impact": "medium",
      "confidence": 85
    }
  ],
  "dimension_scores": {
    "context_provision": 70,
    "request_specificity": 65,
    "scope_management": 80,
    "information_timing": 55,
    "correction_quality": 75
  }
}

分类值——优先使用这些分类：
不足项：${pqDeficitCategories}
亮点项：${pqStrengthCategories}
只有当这些都不适用时才创建新的 kebab-case 分类。

规则：
- message_ref 使用对话中的标签化轮次（如 "User#0"、"User#5"）
- 只包含真正值得注意的发现，不要包含正常的来回对话
- 要点是面向用户的亮点——最多 4 个，排序：先改进项，再强化项
- 发现项是完整的分类集，用于聚合——最多 8 个
- 如果用户的提示词写得好，就包含亮点发现和强化要点——不要硬找问题
- message_overhead 是如果提示词更好，会话本可以少多少条消息
- dimension_scores：每项 0-100。如果没有需要纠正的地方，correction_quality 给 75 分。

请仅返回合法的 JSON，用 <json>...</json> 标签包裹。不要包含任何其他文本。`;
}

// =============================================================================
// FACET-ONLY INSTRUCTIONS
// The instruction suffix for facet-only extraction calls (user[1]).
// =============================================================================

/**
 * Build the instruction suffix for facet-only extraction (backfill path).
 * Used as the second content block in the user message, after the cached conversation.
 */
export function buildFacetOnlyInstructions(
  projectName: string,
  sessionSummary: string | null,
  meta?: SessionMetadata
): string {
  const summaryLine = sessionSummary ? `会话摘要：${sessionSummary}\n` : '';
  const metaLine = formatSessionMetaLine(meta);

  const vars = {
    projectName,
    summaryLine,
    metaLine,
    frictionCategories: CANONICAL_FRICTION_CATEGORIES.join(', '),
    patternCategories: CANONICAL_PATTERN_CATEGORIES.join(', '),
    frictionGuidance: FRICTION_CLASSIFICATION_GUIDANCE,
    patternGuidance: EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE,
  };

  return loadPrompt('facet-only', vars, FACET_ONLY_DEFAULT(projectName, summaryLine, metaLine));
}

function FACET_ONLY_DEFAULT(projectName: string, summaryLine: string, metaLine: string): string {
  return `你正在评估一次 AI 编程会话，提取结构化元数据用于跨会话的模式分析。

项目：${projectName}
${summaryLine}${metaLine}
提取会话特征——对会话整体情况的评估：

1. outcome_satisfaction："high"（成功完成）、"medium"（部分完成）、"low"（有问题）、"abandoned"（放弃了）
2. workflow_pattern：主要模式，或 null。值："plan-then-implement"、"iterative-refinement"、"debug-fix-verify"、"explore-then-build"、"direct-execution"
3. friction_points：最多 5 个进度停滞的时刻（数组）。
   每个：{ _reasoning（3 步归因决策树推理）、category（kebab-case，优先：${CANONICAL_FRICTION_CATEGORIES.join(', ')}）、attribution（"user-actionable"|"ai-capability"|"environmental"）、description（一句包含具体细节的中性描述）、severity（"high"|"medium"|"low"）、resolution（"resolved"|"workaround"|"unresolved"） }
${FRICTION_CLASSIFICATION_GUIDANCE}
4. effective_patterns：最多 3 个效果好的做法（数组）。
   每个：{ _reasoning（驱动者决策树推理——先检查用户基础设施）、category（kebab-case，优先：${CANONICAL_PATTERN_CATEGORIES.join(', ')}）、description（具体技术，1-2 句）、confidence（0-100）、driver（"user-driven"|"ai-driven"|"collaborative"） }
${EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE}

5. had_course_correction：true/false——用户是否将 AI 从错误方向拉回来了？
6. course_correction_reason：如果为 true 则简要说明，否则为 null
7. iteration_count：用户需要澄清/纠正的循环次数

按以下 JSON 格式提取特征：
{
  "outcome_satisfaction": "high | medium | low | abandoned",
  "workflow_pattern": "string or null",
  "had_course_correction": false,
  "course_correction_reason": null,
  "iteration_count": 0,
  "friction_points": [
    {
      "_reasoning": "分类 + 归因的推理过程",
      "category": "kebab-case-category",
      "attribution": "user-actionable | ai-capability | environmental",
      "description": "一句关于问题的中性描述，包含具体细节",
      "severity": "high | medium | low",
      "resolution": "resolved | workaround | unresolved"
    }
  ],
  "effective_patterns": [
    {
      "_reasoning": "分类 + 驱动者的推理过程，包含基线检查",
      "category": "kebab-case-category",
      "description": "技术描述",
      "confidence": 85,
      "driver": "user-driven | ai-driven | collaborative"
    }
  ]
}

请仅返回合法的 JSON，用 <json>...</json> 标签包裹。`;
}
