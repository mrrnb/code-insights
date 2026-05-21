// Canonical category arrays and classification guidance strings for LLM analysis.
// Extracted from prompts.ts — imported by normalizers and prompt generators.
//
// Guidance text is loaded from prompts/*.md files when available,
// falling back to built-in defaults. Users can customize by editing the files.

import { loadPrompt } from '../prompts/prompt-loader.js';

// Shared guidance for friction category and attribution classification.
// Actor-neutral category definitions describe the gap, not the actor.
// Attribution field captures who contributed to the friction for actionability.
const FRICTION_CLASSIFICATION_GUIDANCE_DEFAULT = `
摩擦分类指导：

每个摩擦点记录：出了什么问题（分类 + 描述）、谁导致的（归因）、以及分类理由（_reasoning）。

分类 — 判定障碍或缺陷的类型：
- "wrong-approach": 采用了不适合当前任务的策略——架构选错、工具选错、模式选错。包括在有更优工具可选的情况下选择了次优方案。
- "knowledge-gap": 对 library、API、framework 或语言特性的认知有误。能力本身存在，但使用方式不正确。
- "stale-assumptions": 基于对当前状态的错误假设继续工作（文件已过时、配置已变更、环境不同、工具行为在版本间发生变化）。
- "incomplete-requirements": 指令缺少正确执行所需的关键上下文、约束条件或验收标准。
- "context-loss": 会话早期建立的决策或约束在后续被遗忘或丢失。
- "scope-creep": 工作范围超出了既定任务的边界。
- "repeated-mistakes": 尽管已有过纠正，相同或类似的错误仍然多次出现。
- "documentation-gap": 相关文档存在，但在会话期间无法访问或找不到。
- "tooling-limitation": AI 编码工具或其底层模型确实无法执行所需操作——缺少文件系统访问权限、不支持的语言特性、上下文窗口溢出、无法运行特定命令类型。诊断方法：合理的用户提示或方法能否达到同样效果？如果唯一变通方案极其复杂或会严重损失保真度，这就是 tooling-limitation。如果存在直接替代方案，则不是。
  满足以下条件时应重新分类：
  - 被限流或降速 → 改用 "rate-limit-hit"
  - Agent 崩溃或丢失状态 → 使用 "wrong-approach" 或创建 "agent-orchestration-failure"
  - 有更优工具却选错了 → "wrong-approach"
  - 用户不知道工具能做什么 → "knowledge-gap"
  - 工具行为与预期不同 → "stale-assumptions"

消歧义 — 当两个分类都看似适用时，用以下规则打破平局：
- tooling-limitation vs wrong-approach：limitation = 工具确实做不到（无变通方案）。wrong-approach = 工具能做到，但选了次优方法。
- tooling-limitation vs knowledge-gap：limitation = 能力确实不存在。knowledge-gap = 能力存在但用法不正确。
- tooling-limitation vs stale-assumptions：limitation = 工具的永久性缺陷。stale-assumptions = 工具过去的行为方式不同，或对当前行为的假设有误。
- wrong-approach vs knowledge-gap：wrong-approach = 策略性选择（选了库 X 而非 Y）。knowledge-gap = 事实性错误（错误使用了库 X 的 API）。
- incomplete-requirements vs context-loss：incomplete = 信息从未提供。context-loss = 信息曾提供过但被遗忘或丢失。

当所有分类都不适用时，创建一个具体的 kebab-case 分类。精确的新分类优于模糊的已有分类。

归因 — 三步决策树（按顺序执行）：
第一步：原因是否在用户-AI 交互之外？（文档缺失、工具故障、基础设施中断）→ "environmental"
第二步：用户能否通过更好的输入来避免？证据：提示模糊、缺少上下文、无约束、需求提出太晚、纠正含糊 → "user-actionable"
第三步：用户输入清晰但 AI 仍然失败 → "ai-capability"
当 user-actionable 和 ai-capability 混合时，倾向于 "user-actionable"——本工具旨在帮助用户提升。

描述规则：
- 用一句中立的话描述缺陷本身，而非行为方
- 包含具体细节（文件名、API、错误信息）
- 表述为"缺少 X 导致 Y"，而非"AI 没做到 X"或"用户忘了 X"
- 把"谁的责任"留给归因字段承载`;

export function getFrictionClassificationGuidance(): string {
  return loadPrompt('friction-classification', undefined, FRICTION_CLASSIFICATION_GUIDANCE_DEFAULT);
}

// Backward-compatible export
export const FRICTION_CLASSIFICATION_GUIDANCE = FRICTION_CLASSIFICATION_GUIDANCE_DEFAULT;

export const CANONICAL_FRICTION_CATEGORIES = [
  'wrong-approach',
  'knowledge-gap',
  'stale-assumptions',
  'incomplete-requirements',
  'context-loss',
  'scope-creep',
  'repeated-mistakes',
  'documentation-gap',
  'tooling-limitation',
] as const;

export const CANONICAL_PATTERN_CATEGORIES = [
  'structured-planning',
  'incremental-implementation',
  'verification-workflow',
  'systematic-debugging',
  'self-correction',
  'context-gathering',
  'domain-expertise',
  'effective-tooling',
] as const;

export const CANONICAL_PQ_DEFICIT_CATEGORIES = [
  'vague-request',
  'missing-context',
  'late-constraint',
  'unclear-correction',
  'scope-drift',
  'missing-acceptance-criteria',
  'assumption-not-surfaced',
] as const;

export const CANONICAL_PQ_STRENGTH_CATEGORIES = [
  'precise-request',
  'effective-context',
  'productive-correction',
] as const;

export const CANONICAL_PQ_CATEGORIES = [
  ...CANONICAL_PQ_DEFICIT_CATEGORIES,
  ...CANONICAL_PQ_STRENGTH_CATEGORIES,
] as const;

const PROMPT_QUALITY_CLASSIFICATION_GUIDANCE_DEFAULT = `
提示词质量分类指导：

每条发现记录一个具体时刻：用户的提示词在此处造成了摩擦（缺陷）或促进了效率（优势）。

缺陷分类 — 判定提示词问题：
- "vague-request": 请求缺少让 AI 无需猜测即可行动的具体性。缺少文件路径、函数名、预期行为或具体细节。
  如果 AI 有足够的上下文可以成功但仍然失败，则不属于此分类——那是 AI 能力问题，不是提示词问题。

- "missing-context": 未提供关于架构、规范、依赖或当前状态的关键背景知识。
  如果信息在代码库中存在且 AI 通过读取文件可以找到，则不属于此分类——那是 AI 上下文收集失败。

- "late-constraint": 在 AI 已经开始按另一种方式实现之后，才提出需求或约束条件，导致返工。
  如果约束条件是在实现过程中才真正发现的（需求变更），则不属于此分类。仅在用户在会话开始前就已知晓该约束时才归入此类。

- "unclear-correction": 用户告诉 AI 其输出有误，但未解释哪里有误或为什么。"不对"、"再试一次"、"不行"，没有上下文。
  如果用户给出了简短但足够的纠正（如"用 map 代替 forEach"已经足够清晰），则不属于此分类。

- "scope-drift": 会话目标在对话中途发生转移，或在一个会话中处理了多个不相关的目标。
  如果用户在处理一个目标下逻辑相关的子任务，则不属于此分类。

- "missing-acceptance-criteria": 用户未定义成功完成的标准，导致反复确认输出是否符合预期。
  如果是探索性会话，用户正在发现自己想要什么，则不属于此分类。

- "assumption-not-surfaced": 用户持有一个未明说的假设，而 AI 无法从代码或对话中合理推断。
  如果该假设是 AI 可以合理做出的（如标准编码规范），则不属于此分类。

优势分类 — 判定提示词成功（仅在明显高于平均水平时）：
- "precise-request": 请求包含足够的具体性（文件路径、函数名、预期行为、错误信息），使 AI 能在第一次尝试时就正确执行。

- "effective-context": 用户主动分享了架构、规范、先前决策或当前状态，且 AI 明确利用这些信息做出了更好的决策。

- "productive-correction": 当 AI 偏离方向时，用户的纠正包含了哪里有问题、为什么、以及足够上下文，使 AI 在下一次响应中能有效调整。

对比配对：
- vague-request vs missing-context：问题在于任务描述方式（vague-request）还是缺失的背景知识（missing-context）？
- late-constraint vs missing-context：用户是否在同一会话中最终提供了信息？是 → late-constraint。始终未提供 → missing-context。
- missing-context vs assumption-not-surfaced：这是用户可以复制粘贴的事实（missing-context），还是用户持有的信念/偏好（assumption-not-surfaced）？
- scope-drift vs missing-acceptance-criteria：用户试图做的事情太多（scope-drift），还是只做一件事但未定义成功标准（missing-acceptance-criteria）？
- unclear-correction vs vague-request：这是用户关于此任务的第一条消息（vague-request），还是对 AI 输出的回应（unclear-correction）？

维度评分（0-100）：
- context_provision：用户提前提供了多少相关背景信息？
  90+：主动分享了架构、约束、规范。50-69：存在明显缺口导致绕路。<30：无上下文，AI 盲目工作。
- request_specificity：任务请求的精确度如何？
  90+：文件路径、预期行为、范围边界。50-69：具体与模糊混杂。<30：几乎所有请求都缺乏细节。
- scope_management：会话的聚焦程度如何？
  90+：单一明确目标，逻辑推进。50-69：有一定偏移但主要目标达成。<30：无聚焦，无明确目标。
- information_timing：需求是否在需要时及时提供？
  90+：所有约束在实现前一次性提供。50-69：部分重要需求提出较晚。<30：需求零星提供，持续纠正。
- correction_quality：用户引导 AI 的纠正质量如何？
  90+：纠正包含什么问题、为什么、以及上下文。50-69：清晰与模糊混杂。<30：纠正几乎不提供有效信号。
  如果无需纠正，评分 75（成功会话中无纠正 = 良好的提示词实践）。

边界情况：
- 短会话（<5 条用户消息）：保守评分。不要因为快速任务中不必要的元素缺失而扣分。
- 探索性会话：不要因为缺少验收标准或范围偏移而扣分。
- AI 尽管提示模糊但仍表现良好的会话：仍然分类缺陷。影响等级应为 "low"，因为没有可见成本。
- Agent/委托式会话：如果用户给出了清晰的高层指令且 AI 自主规划并成功执行，不要因为消息数量少或缺少微观细节而扣分。有效的委托本身就是良好的提示词实践。关注初始委托提示的质量。`;

export function getPromptQualityClassificationGuidance(): string {
  return loadPrompt('pq-classification', undefined, PROMPT_QUALITY_CLASSIFICATION_GUIDANCE_DEFAULT);
}

export const PROMPT_QUALITY_CLASSIFICATION_GUIDANCE = PROMPT_QUALITY_CLASSIFICATION_GUIDANCE_DEFAULT;

const EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE_DEFAULT = `
有效模式分类指导：

每个有效模式记录一种对高效会话结果有贡献的技术或方法。

基线排除 — 以下行为不归类为模式：
- 会话开始时的例行文件读取（编辑前对 <5 个文件执行 Read/Glob/Grep）
- 遵循用户的明确指令（用户说"运行测试"→ 运行测试不算模式）
- 基础工具使用（单文件编辑、标准 CLI 命令）
- 琐碎的自我纠正（拼写修正、立即捕获的轻微语法错误）
仅归类明显超出基线预期的、有策略性的或深度充分的行为。

分类 — 判定有效模式的类型：
- "structured-planning": 将任务分解为明确步骤、定义范围边界，或在编写代码前制定计划。信号：计划/任务列表/范围定义出现在实现之前。
- "incremental-implementation": 以小而可验证的步骤推进工作，步骤之间有验证。信号：多次小幅编辑且中间有检查，而非一次性大批量操作。
- "verification-workflow": 在认为工作完成之前主动进行正确性检查（构建、测试、lint、类型检查）。信号：在未发现已知问题时执行 test/build/lint 命令。
- "systematic-debugging": 使用结构化技术进行系统性排查（二分法、日志插入、复现隔离）。信号：多个有针对性的诊断步骤，而非随机猜测。
- "self-correction": 识别到错误方向并在未获用户纠正的情况下自行调整。信号：明确承认错误 + 改变方法。如果用户指出了错误则不属于此类。
- "context-gathering": 在变更前进行明显深度的调查——阅读 5 个以上文件、跨模块探索、审查 schema/type/config。信号：在任何 Edit/Write 之前有大量跨多个目录的 Read/Grep/Glob 使用。
- "domain-expertise": 在未搜索的情况下首次尝试就正确应用了特定 framework/API/语言知识。信号：正确的非显而易见的 API 用法，且之前无搜索、之后无错误。如果先读了文件则不属于此类——那是 context-gathering。
- "effective-tooling": 利用了能倍增效率的高级工具能力——agent 委托、并行工作、多文件协调、策略性模式选择。信号：使用了超出基本 read/write/edit 的工具功能。

对比配对：
- structured-planning vs incremental-implementation：planning = 决定做什么（事前）。incremental = 如何执行（过程中）。两者可以独立存在。
- context-gathering vs domain-expertise：gathering = 主动调查（读取文件）。expertise = 应用已有知识无需调查。如果先读了文件 → context-gathering。
- verification-workflow vs systematic-debugging：verification = 主动检查（检查正常工作的代码）。debugging = 被动响应（排查故障）。
- self-correction vs 用户导向：self-correction = AI 在无提示下发现自己的错误。用户说了"这不对" → 不算 self-correction。

驱动方 — 四步决策树（按顺序执行）：
第一步：是否由用户基础设施促成？（CLAUDE.md 规则、agent 配置、hookify hooks、自定义命令、system prompts）→ "user-driven"
第二步：用户是否明确要求了此行为？（要求制定计划、请求测试、指示调查方向）→ "user-driven"
第三步：AI 是否在无任何用户提示或基础设施的情况下自主展现了此行为？→ "ai-driven"
第四步：双方都有各自明确且可辨识的贡献 → "collaborative"
仅当你能具体说明每一方的贡献时才使用 "collaborative"。如有不确定，倾向于更具体的标签。

当所有已有分类都不适用时，创建一个具体的 kebab-case 分类（精确的新分类优于勉强套用已有分类）。`;

export function getEffectivePatternClassificationGuidance(): string {
  return loadPrompt('pattern-classification', undefined, EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE_DEFAULT);
}

export const EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE = EFFECTIVE_PATTERN_CLASSIFICATION_GUIDANCE_DEFAULT;
