// Synthesis prompts for the Reflect/Patterns feature.
// These prompts receive pre-aggregated facet data and produce cross-session narratives.
// LLMs synthesize — they don't count. All counting is done in code before calling these.

// --- Friction & Wins ---

export const FRICTION_WINS_SYSTEM_PROMPT = `你正在分析一位开发者在多个 AI 编码会话中的模式。你将收到预聚合的摩擦类别和有效模式，包含出现次数和严重度评分。

你的任务是综合分析 3-5 个最重要的模式。对于每个模式：
1. 说明该模式是什么
2. 解释其重要性（对生产力的影响）
3. 识别可能的根本原因
4. 标注其趋势（在改善还是恶化）

规则：
- 每项结论必须有统计数据支撑，不得凭空编造模式。
- 模式需出现 2 次以上才会被提及。
- 不要给出建议——那是"规则与技能"部分的职责。
- 要具体明确："wrong-approach 出现了 7 次，严重度为高"，而非"存在一些问题"。
- 叙述控制在 500 字以内。
- 当 PQ 缺陷信号与摩擦类别相互印证时，简要说明佐证。
- PQ 信号是补充性上下文，而非主要证据。切勿单独为 PQ 设置完整模式——仅在摩擦或胜利段落中提及 PQ。

所有叙述和解释字段必须使用简体中文撰写。枚举值和机器可读的类别 ID 保持不变。

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。`;

export function generateFrictionWinsPrompt(data: {
  frictionCategories: Array<{ category: string; count: number; avg_severity: number; examples: string[] }>;
  effectivePatterns: Array<{ category: string; label: string; frequency: number; avg_confidence: number; descriptions: string[] }>;
  totalSessions: number;
  period: string;
  pqSignals?: {
    deficits: Array<{ category: string; count: number }>;
    strengths: Array<{ category: string; count: number }>;
  };
}): string {
  const hasPQData = data.pqSignals?.deficits.length || data.pqSignals?.strengths.length;
  const pqSection = hasPQData
    ? `
PROMPT QUALITY SIGNALS（补充）：

缺陷：
${((data.pqSignals?.deficits ?? []).map(d => `  ${d.category}: ${d.count}`).join('\n') || '  （无超过阈值的项目）')}

优势：
${((data.pqSignals?.strengths ?? []).map(s => `  ${s.category}: ${s.count}`).join('\n') || '  （无超过阈值的项目）')}
`
    : '';

  return `分析来自 ${data.totalSessions} 个会话（时间跨度 ${data.period}）的跨会话模式。

摩擦类别（按频率 × 严重度排序）：
${JSON.stringify(data.frictionCategories.slice(0, 15), null, 2)}

有效模式（按频率排序，按类别分组）：
${JSON.stringify(data.effectivePatterns.slice(0, 10), null, 2)}
${pqSection}
请按以下 JSON 格式响应：
{
  "narrative": "对最重要模式的 300-500 字分析",
  "topFriction": [
    {
      "category": "类别名称",
      "significance": "为什么这很重要",
      "rootCause": "可能的根本原因",
      "trend": "increasing | stable | decreasing | new"
    }
  ],
  "topWins": [
    {
      "category": "structured-planning",
      "pattern": "对有效做法的描述",
      "significance": "为什么这很有效"
    }
  ]
}

所有叙述和解释字段必须使用简体中文撰写。枚举值和机器可读的类别 ID 保持不变。

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。`;
}

// --- Rules & Skills ---

export const RULES_SKILLS_SYSTEM_PROMPT = `你正在根据开发者多个 AI 编码会话的跨会话分析，生成可直接使用的成果物。你将收到反复出现的摩擦模式和有效实践。

你的任务是产出具体、可直接复制粘贴的成果物：
1. CLAUDE.md 规则——添加到 AI 助手配置中的具体指令
2. Hook 配置——自动化触发器

规则：
- 仅为出现 3 次以上的摩擦模式或 2 次以上的有效模式生成成果物
- 规则必须足够具体，具有可操作性："创建 PR 前务必运行测试"，而非"注意代码质量"
- Hook 配置必须包含事件触发器和命令
- 最多 6 条规则、3 个 hook
- 每个成果物必须注明其所针对的摩擦模式或有效实践

所有叙述和解释字段必须使用简体中文撰写。枚举值和机器可读的类别 ID 保持不变。

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。`;

export function generateRulesSkillsPrompt(data: {
  recurringFriction: Array<{ category: string; count: number; avg_severity: number; examples: string[] }>;
  effectivePatterns: Array<{ category: string; label: string; frequency: number; avg_confidence: number; descriptions: string[] }>;
  targetTool: string;
}): string {
  return `根据这些反复出现的模式生成可操作的成果物。

目标工具：${data.targetTool}（生成与该工具生态兼容的成果物）

反复出现的摩擦（3 次以上）：
${JSON.stringify(data.recurringFriction, null, 2)}

有效模式（2 次以上）：
${JSON.stringify(data.effectivePatterns, null, 2)}

请按以下 JSON 格式响应：
{
  "claudeMdRules": [
    {
      "rule": "要添加到 CLAUDE.md 的具体文本",
      "rationale": "该规则为何有效（引用摩擦模式）",
      "frictionSource": "类别名称（出现 N 次）"
    }
  ],
  "hookConfigs": [
    {
      "event": "pre-commit | post-file-edit | etc.",
      "command": "要执行的 shell 命令",
      "rationale": "该自动化为何有帮助"
    }
  ]
}

所有叙述和解释字段必须使用简体中文撰写。枚举值和机器可读的类别 ID 保持不变。

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。`;
}

// --- Working Style ---

export const WORKING_STYLE_SYSTEM_PROMPT = `你正在根据开发者 AI 编码会话的聚合统计数据，撰写简短的工作风格画像。你将收到工作流模式、成果分布、会话类型和摩擦频率的分布数据。

你的任务是描述你观察到的现象，而非建议他们应该如何改变。使用第二人称撰写（"你倾向于……"）。

规则：
- 每项陈述必须基于所提供的统计数据
- 叙述控制在 3-5 句话
- 只做描述，不做处方（不提建议）
- 提及主导的工作流模式、成果分布以及显著特征
- 如果数据过于稀疏（少于 5 个会话），如实说明并保持简洁
- 生成一个标签：2-4 个英文单词的原型标签，使用首字母大写格式，最多 40 个字符（例如 "The Methodical Builder"、"Relentless Debugger"、"Ship Fast Fix Later"、"Deep Focus Specialist"）
- 标签必须具有赋能性和描述性，绝不使用批评性或负面措辞
- 标签应基于主导的会话类型、工作流模式和成果分布
- 将其视为开发者人格类型——具体且有据可循，而非泛泛而谈
- 生成一个 tagline_subtitle：一句简短的话（不超过 80 个字符），用具体的行为观察来补充或阐释标签（例如 "plans thoroughly, debugs systematically, ships with confidence"）

所有叙述和解释字段必须使用简体中文撰写。枚举值和机器可读的类别 ID 保持不变。

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。`;

export function generateWorkingStylePrompt(data: {
  workflowDistribution: Record<string, number>;
  outcomeDistribution: Record<string, number>;
  characterDistribution: Record<string, number>;
  totalSessions: number;
  period: string;
  frictionFrequency: number;
}): string {
  return `根据 ${data.totalSessions} 个会话（时间跨度 ${data.period}）撰写工作风格画像。

工作流模式：
${JSON.stringify(data.workflowDistribution, null, 2)}

成果满意度：
${JSON.stringify(data.outcomeDistribution, null, 2)}

会话类型：
${JSON.stringify(data.characterDistribution, null, 2)}

摩擦频率：所有会话中共有 ${data.frictionFrequency} 个摩擦点

请按以下 JSON 格式响应：
{
  "tagline": "2-4 个英文单词的原型标签（例如 The Methodical Builder）",
  "tagline_subtitle": "不超过 80 个字符的单句补充说明（例如 plans thoroughly, debugs systematically, ships with confidence）",
  "narrative": "3-5 句话的工作风格描述"
}

所有叙述和解释字段必须使用简体中文撰写。枚举值和机器可读的类别 ID 保持不变。

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。`;
}
