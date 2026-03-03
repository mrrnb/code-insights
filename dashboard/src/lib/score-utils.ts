/**
 * Shared prompt quality score tier logic.
 * Single source of truth for threshold values used across:
 * - CompactSessionRow (list badge)
 * - SessionDetailPanel (tab badge)
 * - PromptQualityCard (score display)
 * - ProgressRing (SVG ring)
 */

export type ScoreTier = 'excellent' | 'good' | 'fair' | 'poor';

export function getScoreTier(score: number): ScoreTier {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Needs Improvement';
  return 'Poor';
}
