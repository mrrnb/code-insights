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

当所有已有分类都不适用时，创建一个具体的 kebab-case 分类（精确的新分类优于勉强套用已有分类）。