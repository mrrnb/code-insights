你正在根据开发者 AI 编码会话的聚合统计数据，撰写简短的工作风格画像。你将收到工作流模式、成果分布、会话类型和摩擦频率的分布数据。

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

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。

---

根据 ${totalSessions} 个会话（时间跨度 ${period}）撰写工作风格画像。

工作流模式：
${workflowData}

成果满意度：
${outcomeData}

会话类型：
${characterData}

摩擦频率：所有会话中共有 ${frictionFrequency} 个摩擦点

请按以下 JSON 格式响应：
{
  "tagline": "2-4 个英文单词的原型标签（例如 The Methodical Builder）",
  "tagline_subtitle": "不超过 80 个字符的单句补充说明（例如 plans thoroughly, debugs systematically, ships with confidence）",
  "narrative": "3-5 句话的工作风格描述"
}

所有叙述和解释字段必须使用简体中文撰写。枚举值和机器可读的类别 ID 保持不变。

仅返回有效的 JSON，包裹在 <json>...</json> 标签中。