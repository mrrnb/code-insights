import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Ban,
  HelpCircle,
  Lightbulb,
  CalendarClock,
  FileText,
  Scale,
  GitFork,
  ArrowRightLeft,
  Clock,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import type { InsightType, InsightMetadata } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

// --- Outcome Badge ---

function getOutcomeConfig(t: (key: string) => string): Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> {
  return {
    success: { label: t('insight.outcome.success'), className: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
    partial: { label: t('insight.outcome.partial'), className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: AlertCircle },
    abandoned: { label: t('insight.outcome.abandoned'), className: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: XCircle },
    blocked: { label: t('insight.outcome.blocked'), className: 'bg-red-500/10 text-red-600 border-red-500/20', icon: Ban },
  };
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const { t } = useI18n();
  const config = getOutcomeConfig(t)[outcome];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// --- Field icon config ---

function getFieldConfig(t: (key: string) => string): Record<string, { icon: LucideIcon; color: string }> {
  return {
    [t('insight.field.whatHappened')]: { icon: AlertCircle, color: 'text-muted-foreground' },
    [t('insight.field.why')]: { icon: HelpCircle, color: 'text-muted-foreground' },
    [t('insight.field.takeaway')]: { icon: Lightbulb, color: 'text-yellow-500' },
    [t('insight.field.appliesWhen')]: { icon: CalendarClock, color: 'text-muted-foreground' },
    [t('insight.field.situation')]: { icon: FileText, color: 'text-muted-foreground' },
    [t('insight.field.choice')]: { icon: CheckCircle2, color: 'text-blue-500' },
    [t('insight.field.reasoning')]: { icon: Scale, color: 'text-muted-foreground' },
    [t('insight.field.alternatives')]: { icon: GitFork, color: 'text-muted-foreground' },
    [t('insight.field.tradeoffs')]: { icon: ArrowRightLeft, color: 'text-muted-foreground' },
    [t('insight.field.revisitWhen')]: { icon: Clock, color: 'text-muted-foreground' },
    [t('insight.field.evidence')]: { icon: FileText, color: 'text-muted-foreground' },
  };
}

// --- Shared metadata helpers ---

export function MetadataSection({ label, children, prominent }: { label: string; children: React.ReactNode; prominent?: boolean }) {
  const { t } = useI18n();
  const fieldConfig = getFieldConfig(t)[label];
  const FieldIcon = fieldConfig?.icon;

  return (
    <div className="space-y-0.5">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {FieldIcon && <FieldIcon className={`h-3 w-3 ${fieldConfig.color}`} />}
        {label}
      </span>
      {prominent ? (
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium text-foreground">{children}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  );
}

export function formatAlternatives(alternatives: InsightMetadata['alternatives']): string {
  if (!alternatives || alternatives.length === 0) return '';
  return alternatives.map(a => {
    if (typeof a === 'string') return a;
    return a.rejected_because ? `${a.option} (rejected: ${a.rejected_because})` : a.option;
  }).join('; ');
}

// --- Type-specific content components ---

export function DecisionContent({ metadata }: { metadata: InsightMetadata }) {
  const { t } = useI18n();
  const hasStructured = metadata.situation || metadata.choice || metadata.reasoning;
  if (!hasStructured) return null;

  return (
    <div className="space-y-2.5">
      {metadata.situation && <MetadataSection label={t('insight.field.situation')}>{metadata.situation}</MetadataSection>}
      {metadata.choice && <MetadataSection label={t('insight.field.choice')} prominent>{metadata.choice}</MetadataSection>}
      {metadata.reasoning && <MetadataSection label={t('insight.field.reasoning')}>{metadata.reasoning}</MetadataSection>}
      {metadata.alternatives && metadata.alternatives.length > 0 && (
        <div className="space-y-0.5">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <GitFork className="h-3 w-3 text-muted-foreground" />
            {t('insight.field.alternatives')}
          </span>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {metadata.alternatives.map((alt, i) => {
              const label = typeof alt === 'string' ? alt : alt.option;
              const reason = typeof alt === 'string' ? undefined : alt.rejected_because;
              return (
                <Badge key={i} variant="outline" className="text-xs font-normal" title={reason ? t('insight.rejected', { reason }) : undefined}>
                  {label}
                  {reason && <span className="ml-1 text-muted-foreground/60">- {reason}</span>}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
      {metadata.trade_offs && <MetadataSection label={t('insight.field.tradeoffs')}>{metadata.trade_offs}</MetadataSection>}
      {metadata.revisit_when && metadata.revisit_when !== 'N/A' && (
        <MetadataSection label={t('insight.field.revisitWhen')}>{metadata.revisit_when}</MetadataSection>
      )}
      {metadata.evidence && metadata.evidence.length > 0 && (
        <MetadataSection label={t('insight.field.evidence')}>{metadata.evidence.join(', ')}</MetadataSection>
      )}
    </div>
  );
}

export function LearningContent({ metadata }: { metadata: InsightMetadata }) {
  const { t } = useI18n();
  const hasStructured = metadata.symptom || metadata.root_cause || metadata.takeaway;
  if (!hasStructured) return null;

  return (
    <div className="space-y-2.5">
      {metadata.symptom && <MetadataSection label={t('insight.field.whatHappened')}>{metadata.symptom}</MetadataSection>}
      {metadata.root_cause && <MetadataSection label={t('insight.field.why')}>{metadata.root_cause}</MetadataSection>}
      {metadata.takeaway && <MetadataSection label={t('insight.field.takeaway')} prominent>{metadata.takeaway}</MetadataSection>}
      {metadata.applies_when && <MetadataSection label={t('insight.field.appliesWhen')}>{metadata.applies_when}</MetadataSection>}
    </div>
  );
}

export function SummaryContent({ metadata, bullets }: { metadata: InsightMetadata; bullets: string[] }) {
  return (
    <div className="space-y-2">
      {metadata.outcome && (
        <div>
          <OutcomeBadge outcome={metadata.outcome} />
        </div>
      )}
      {bullets.length > 0 && (
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          {bullets.map((bullet, i) => (
            <li key={i} className="line-clamp-1">{bullet}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function renderTypeContent(type: InsightType, metadata: InsightMetadata, bullets: string[]) {
  switch (type) {
    case 'decision':
      return <DecisionContent metadata={metadata} />;
    case 'learning':
    case 'technique':
      return <LearningContent metadata={metadata} />;
    case 'summary':
      return <SummaryContent metadata={metadata} bullets={bullets} />;
    default:
      return null;
  }
}
