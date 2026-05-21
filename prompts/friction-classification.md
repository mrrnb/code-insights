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
- 把"谁的责任"留给归因字段承载