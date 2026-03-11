// Knowledge Base template formatter
// Produces human-readable markdown organized by session, with rich insight content

export interface SessionRow {
  id: string;
  project_name: string | null;
  generated_title: string | null;
  custom_title: string | null;
  started_at: string | null;
  ended_at: string | null;
  message_count: number | null;
  estimated_cost_usd: number | null;
  session_character: string | null;
  source_tool: string | null;
}

export interface InsightRow {
  id: string;
  session_id: string;
  project_id: string;
  project_name: string | null;
  type: string;
  title: string;
  content: string;
  summary: string | null;
  bullets: string | null; // JSON array string
  confidence: number | null;
  source: string | null;
  metadata: string | null; // JSON object string
  timestamp: string;
  created_at: string;
  scope: string | null;
  analysis_version: string | null;
  linked_insight_ids: string | null;
}

function parseBullets(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function renderSummary(insight: InsightRow, lines: string[]) {
  const meta = parseMetadata(insight.metadata);
  const bullets = parseBullets(insight.bullets);

  lines.push('### 摘要');
  const outcome = meta.outcome as string | undefined;
  if (outcome) lines.push(`**结果：** ${outcome}`);
  if (insight.content) lines.push(insight.content);
  for (const bullet of bullets) lines.push(`- ${bullet}`);
}

function renderDecisions(insights: InsightRow[], lines: string[]) {
  lines.push('### 决策');
  lines.push('');
  for (const insight of insights) {
    const meta = parseMetadata(insight.metadata);
    lines.push(`#### ${insight.title}`);
    const situation = meta.situation as string | undefined;
    if (situation) lines.push(`**背景：** ${situation}`);
    const choice = meta.choice as string | undefined;
    if (choice) lines.push(`**选择：** ${choice}`);
    const reasoning = meta.reasoning as string | undefined;
    if (reasoning) lines.push(`**原因：** ${reasoning}`);
    const alternatives = meta.alternatives as Array<{ option?: string; rejected_because?: string } | string> | undefined;
    if (alternatives && alternatives.length > 0) {
      lines.push('');
      lines.push('**备选方案：**');
      for (const alt of alternatives) {
        if (typeof alt === 'string') {
          lines.push(`- ${alt}`);
        } else if (alt.option) {
          const reason = alt.rejected_because ? ` — rejected because ${alt.rejected_because}` : '';
          lines.push(`- ${alt.option}${reason}`);
        }
      }
    }
    const trade_offs = meta.trade_offs as string | undefined;
    if (trade_offs) lines.push(`**权衡：** ${trade_offs}`);
    const revisit_when = meta.revisit_when as string | undefined;
    if (revisit_when) lines.push(`**何时重审：** ${revisit_when}`);
    // Fallback to raw content when no structured metadata is present
    if (!situation && !choice && !reasoning && insight.content) lines.push(insight.content);
    lines.push('');
  }
}

function renderLearnings(insights: InsightRow[], lines: string[]) {
  lines.push('### 经验教训');
  lines.push('');
  for (const insight of insights) {
    const meta = parseMetadata(insight.metadata);
    lines.push(`#### ${insight.title}`);
    const symptom = meta.symptom as string | undefined;
    if (symptom) lines.push(`**现象：** ${symptom}`);
    const root_cause = meta.root_cause as string | undefined;
    if (root_cause) lines.push(`**根因：** ${root_cause}`);
    const takeaway = meta.takeaway as string | undefined;
    if (takeaway) lines.push(`**结论：** ${takeaway}`);
    const applies_when = meta.applies_when as string | undefined;
    if (applies_when) lines.push(`**适用条件：** ${applies_when}`);
    if (!symptom && !root_cause && !takeaway && insight.content) lines.push(insight.content);
    lines.push('');
  }
}

function renderTechniques(insights: InsightRow[], lines: string[]) {
  lines.push('### 可复用技巧');
  lines.push('');
  for (const insight of insights) {
    const meta = parseMetadata(insight.metadata);
    lines.push(`#### ${insight.title}`);
    const context = meta.context as string | undefined;
    if (context) lines.push(`**上下文：** ${context}`);
    const applicability = meta.applicability as string | undefined;
    if (applicability) lines.push(`**适用范围：** ${applicability}`);
    if (insight.content) lines.push(insight.content);
    lines.push('');
  }
}

function renderPromptQuality(insight: InsightRow, lines: string[]) {
  const meta = parseMetadata(insight.metadata);
  lines.push('### Prompt 质量');

  // Dual-read: new schema uses efficiency_score; legacy uses efficiencyScore
  const score = (meta.efficiency_score ?? meta.efficiencyScore) as number | undefined;
  const overhead = (meta.message_overhead ?? meta.potentialMessageReduction) as number | undefined;
  if (score !== undefined) lines.push(`**效率分：** ${score}/100`);
  if (overhead !== undefined && overhead > 0) lines.push(`**潜在节省：** 约减少 ${overhead} 条消息`);

  // New schema: categorized findings
  const findings = meta.findings as Array<{
    category?: string;
    type?: string;
    description?: string;
    impact?: string;
    suggested_improvement?: string;
  }> | undefined;

  if (findings && findings.length > 0) {
    const deficits = findings.filter(f => f.type === 'deficit');
    const strengths = findings.filter(f => f.type === 'strength');

    if (deficits.length > 0) {
      lines.push('');
      lines.push('**提示词问题：**');
      for (const f of deficits) {
        const category = f.category ? ` [${f.category}]` : '';
        const improvement = f.suggested_improvement ? ` —— 建议：${f.suggested_improvement}` : '';
        lines.push(`- ${f.description ?? '检测到问题'}${category}${improvement}`);
      }
    }

    if (strengths.length > 0) {
      lines.push('');
      lines.push('**提示词优点：**');
      for (const f of strengths) {
        const category = f.category ? ` [${f.category}]` : '';
        lines.push(`- ${f.description ?? '观察到优势'}${category}`);
      }
    }

    return;
  }

  // Legacy schema: antiPatterns and wastedTurns
  const antiPatterns = meta.antiPatterns as Array<{
    name?: string;
    count?: number;
    fix?: string;
  }> | undefined;
  if (antiPatterns && antiPatterns.length > 0) {
    lines.push('');
      lines.push('**反模式：**');
    for (const pattern of antiPatterns) {
      const countStr = pattern.count !== undefined ? ` (seen ${pattern.count}x)` : '';
      const fixStr = pattern.fix ? ` —— 建议：${pattern.fix}` : '';
      lines.push(`- ${pattern.name ?? 'Unknown'}${countStr}${fixStr}`);
    }
  }

  const wastedTurns = meta.wastedTurns as Array<{
    messageIndex?: number;
    reason?: string;
    suggestedRewrite?: string;
  }> | undefined;
  if (wastedTurns && wastedTurns.length > 0) {
    lines.push('');
      lines.push('**无效轮次：**');
    for (const turn of wastedTurns) {
      const msgStr = turn.messageIndex !== undefined ? `消息 #${turn.messageIndex}` : '消息';
      lines.push(`- ${msgStr}: ${turn.reason ?? ''}`);
      if (turn.suggestedRewrite) {
        lines.push(`  - 更好的写法："${turn.suggestedRewrite}"`);
      }
    }
  }
}

export function formatKnowledgeBase(sessions: SessionRow[], insights: InsightRow[]): string {
  const now = new Date().toISOString().split('T')[0];
  const lines: string[] = [
    `# Code Insights 导出`,
    `> 导出时间：${now}；共 ${sessions.length} 个会话，${insights.length} 条洞察`,
    '',
  ];

  if (insights.length === 0) {
    lines.push(
      '> **提示：** 当前所选会话还没有洞察。请先对会话执行分析，再进行导出。',
    );
    lines.push('');
  }

  // Build a map of session_id -> insights grouped by type
  const insightsBySession = new Map<string, Map<string, InsightRow[]>>();
  for (const insight of insights) {
    if (!insightsBySession.has(insight.session_id)) {
      insightsBySession.set(insight.session_id, new Map());
    }
    const byType = insightsBySession.get(insight.session_id)!;
    const list = byType.get(insight.type) ?? [];
    list.push(insight);
    byType.set(insight.type, list);
  }

  for (const session of sessions) {
    const title = session.custom_title ?? session.generated_title ?? session.id;
    lines.push(`## 会话：${title}`);

    const metaLine1: string[] = [];
    if (session.project_name) metaLine1.push(`**项目：** ${session.project_name}`);
    if (session.session_character) metaLine1.push(`**画像：** ${session.session_character}`);
    if (session.source_tool) metaLine1.push(`**来源：** ${session.source_tool}`);
    if (session.estimated_cost_usd != null) {
      metaLine1.push(`**成本：** $${Number(session.estimated_cost_usd).toFixed(2)}`);
    }
    if (metaLine1.length > 0) lines.push(metaLine1.join(' | '));

    const metaLine2: string[] = [];
    if (session.started_at && session.ended_at) {
      metaLine2.push(`**时间：** ${session.started_at} — ${session.ended_at}`);
    } else if (session.started_at) {
      metaLine2.push(`**时间：** ${session.started_at}`);
    }
    if (session.message_count != null) metaLine2.push(`**消息数：** ${session.message_count}`);
    if (metaLine2.length > 0) lines.push(metaLine2.join(' | '));

    lines.push('');

    const byType = insightsBySession.get(session.id);
    if (!byType || byType.size === 0) {
      lines.push('*这个会话还没有洞察。*');
      lines.push('');
      continue;
    }

    const summaries = byType.get('summary');
    if (summaries) {
      for (const s of summaries) {
        renderSummary(s, lines);
        lines.push('');
      }
    }

    const decisions = byType.get('decision');
    if (decisions) {
      renderDecisions(decisions, lines);
    }

    const learnings = byType.get('learning');
    if (learnings) {
      renderLearnings(learnings, lines);
    }

    const techniques = byType.get('technique');
    if (techniques) {
      renderTechniques(techniques, lines);
    }

    const pqInsights = byType.get('prompt_quality');
    if (pqInsights) {
      for (const pq of pqInsights) {
        renderPromptQuality(pq, lines);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
