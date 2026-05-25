你正在评估一次 AI 编程会话，提取结构化元数据用于跨会话的模式分析。

项目：${projectName}
${summaryLine}${metaLine}
提取会话特征——对会话整体情况的评估：

1. outcome_satisfaction："high"（成功完成）、"medium"（部分完成）、"low"（有问题）、"abandoned"（放弃了）
2. workflow_pattern：主要模式，或 null。值："plan-then-implement"、"iterative-refinement"、"debug-fix-verify"、"explore-then-build"、"direct-execution"
3. friction_points：最多 5 个进度停滞的时刻（数组）。
   每个：{ _reasoning（3 步归因决策树推理）、category（kebab-case，优先：${frictionCategories}）、attribution（"user-actionable"|"ai-capability"|"environmental"）、description（一句包含具体细节的中性描述）、severity（"high"|"medium"|"low"）、resolution（"resolved"|"workaround"|"unresolved"） }
${frictionGuidance}
4. effective_patterns：最多 3 个效果好的做法（数组）。
   每个：{ _reasoning（驱动者决策树推理——先检查用户基础设施）、category（kebab-case，优先：${patternCategories}）、description（具体技术，1-2 句）、confidence（0-100）、driver（"user-driven"|"ai-driven"|"collaborative"） }
${patternGuidance}
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

请仅返回合法的 JSON，用 <json>...</json> 标签包裹。