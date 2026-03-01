import { describe, it, expect } from 'vitest';
import {
  periodStartDate,
  resolveTitle,
  shortenModelName,
  bucketKey,
  createBuckets,
  computeDayStats,
  computeTopProjects,
} from './aggregation.js';
import type { SessionRow } from './types.js';

// ── Helper Factory ──

function makeSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session-1',
    projectId: 'proj-1',
    projectName: 'test-project',
    startedAt: new Date('2026-01-15T10:00:00Z'),
    endedAt: new Date('2026-01-15T11:00:00Z'),
    messageCount: 10,
    userMessageCount: 5,
    assistantMessageCount: 5,
    toolCallCount: 3,
    sourceTool: 'claude-code',
    ...overrides,
  };
}

// ── periodStartDate ──

describe('periodStartDate', () => {
  it('returns a date 7 days ago for "7d"', () => {
    const result = periodStartDate('7d');
    expect(result).toBeInstanceOf(Date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expected = new Date(now);
    expected.setDate(expected.getDate() - 7);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it('returns a date 30 days ago for "30d"', () => {
    const result = periodStartDate('30d');
    expect(result).toBeInstanceOf(Date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expected = new Date(now);
    expected.setDate(expected.getDate() - 30);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it('returns a date 90 days ago for "90d"', () => {
    const result = periodStartDate('90d');
    expect(result).toBeInstanceOf(Date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expected = new Date(now);
    expected.setDate(expected.getDate() - 90);
    expect(result!.getTime()).toBe(expected.getTime());
  });

  it('returns undefined for "all"', () => {
    expect(periodStartDate('all')).toBeUndefined();
  });
});

// ── resolveTitle ──

describe('resolveTitle', () => {
  it('returns customTitle when available', () => {
    const session = makeSessionRow({ customTitle: 'My Custom Title' });
    expect(resolveTitle(session)).toBe('My Custom Title');
  });

  it('returns generatedTitle when customTitle is absent', () => {
    const session = makeSessionRow({
      generatedTitle: 'Generated Title',
      summary: 'Summary',
    });
    expect(resolveTitle(session)).toBe('Generated Title');
  });

  it('returns summary when customTitle and generatedTitle are absent', () => {
    const session = makeSessionRow({ summary: 'Session Summary' });
    expect(resolveTitle(session)).toBe('Session Summary');
  });

  it('returns "Untitled Session" when all title fields are absent', () => {
    const session = makeSessionRow();
    expect(resolveTitle(session)).toBe('Untitled Session');
  });

  it('uses priority: customTitle > generatedTitle > summary > fallback', () => {
    const session = makeSessionRow({
      customTitle: 'Custom',
      generatedTitle: 'Generated',
      summary: 'Summary',
    });
    expect(resolveTitle(session)).toBe('Custom');
  });
});

// ── shortenModelName ──

describe('shortenModelName', () => {
  it('shortens claude-opus-4-5 to "Opus 4.x"', () => {
    expect(shortenModelName('claude-opus-4-5')).toBe('Opus 4.x');
  });

  it('shortens claude-sonnet-4 to "Sonnet 4.x"', () => {
    expect(shortenModelName('claude-sonnet-4')).toBe('Sonnet 4.x');
  });

  it('shortens claude-haiku-4-5 to "Haiku"', () => {
    expect(shortenModelName('claude-haiku-4-5')).toBe('Haiku');
  });

  it('shortens claude-3-5-sonnet-20241022 to "Sonnet 3.5"', () => {
    expect(shortenModelName('claude-3-5-sonnet-20241022')).toBe('Sonnet 3.5');
  });

  it('shortens claude-3-5-haiku-20241022 to "Haiku 3.5"', () => {
    expect(shortenModelName('claude-3-5-haiku-20241022')).toBe('Haiku 3.5');
  });

  it('shortens claude-3-opus-20240229 to "Opus 3"', () => {
    expect(shortenModelName('claude-3-opus-20240229')).toBe('Opus 3');
  });

  it('shortens gpt-4o to "GPT-4o"', () => {
    expect(shortenModelName('gpt-4o')).toBe('GPT-4o');
  });

  it('shortens gpt-4-turbo to "GPT-4 Turbo"', () => {
    expect(shortenModelName('gpt-4-turbo')).toBe('GPT-4 Turbo');
  });

  it('truncates unknown models longer than 20 chars', () => {
    expect(shortenModelName('some-very-long-model-name-here')).toBe('some-very-long-model');
  });

  it('returns unknown models under 20 chars as-is', () => {
    expect(shortenModelName('short-model')).toBe('short-model');
  });
});

// ── bucketKey ──

describe('bucketKey', () => {
  it('returns YYYY-MM-DD for 7d period', () => {
    const date = new Date(2026, 0, 15); // Jan 15, 2026
    expect(bucketKey(date, '7d')).toBe('2026-01-15');
  });

  it('returns YYYY-MM-DD for 30d period', () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(bucketKey(date, '30d')).toBe('2026-01-05');
  });

  it('returns YYYY-Wxx for 90d period', () => {
    const date = new Date(2026, 0, 15); // Jan 15, 2026
    const result = bucketKey(date, '90d');
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('returns YYYY-MM for all period', () => {
    const date = new Date(2026, 0, 15); // Jan 15, 2026
    expect(bucketKey(date, 'all')).toBe('2026-01');
  });

  it('zero-pads month and day', () => {
    const date = new Date(2026, 1, 5); // Feb 5, 2026
    expect(bucketKey(date, '7d')).toBe('2026-02-05');
  });
});

// ── createBuckets ──

describe('createBuckets', () => {
  const refDate = new Date(2026, 0, 15); // Jan 15, 2026

  it('creates 7 buckets for 7d period', () => {
    const buckets = createBuckets('7d', refDate);
    expect(buckets.size).toBe(7);
  });

  it('creates 30 buckets for 30d period', () => {
    const buckets = createBuckets('30d', refDate);
    expect(buckets.size).toBe(30);
  });

  it('creates ~13 buckets for 90d period', () => {
    const buckets = createBuckets('90d', refDate);
    // Approximately 13 weekly buckets (could be fewer if some weeks overlap)
    expect(buckets.size).toBeGreaterThanOrEqual(10);
    expect(buckets.size).toBeLessThanOrEqual(13);
  });

  it('creates 12 buckets for all period', () => {
    const buckets = createBuckets('all', refDate);
    expect(buckets.size).toBe(12);
  });

  it('all bucket values start at 0', () => {
    const buckets = createBuckets('7d', refDate);
    for (const point of buckets.values()) {
      expect(point.value).toBe(0);
    }
  });

  it('7d buckets end at the reference date', () => {
    const buckets = createBuckets('7d', refDate);
    const keys = Array.from(buckets.keys());
    expect(keys[keys.length - 1]).toBe('2026-01-15');
  });
});

// ── computeDayStats ──

describe('computeDayStats', () => {
  it('returns zero stats when no sessions match the day', () => {
    const sessions = [
      makeSessionRow({
        startedAt: new Date(2026, 0, 14, 10, 0),
        endedAt: new Date(2026, 0, 14, 11, 0),
      }),
    ];
    const dayStart = new Date(2026, 0, 15);
    const result = computeDayStats(sessions, dayStart);
    expect(result.sessionCount).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalMinutes).toBe(0);
  });

  it('counts sessions that start on the given day', () => {
    const sessions = [
      makeSessionRow({
        startedAt: new Date(2026, 0, 15, 10, 0),
        endedAt: new Date(2026, 0, 15, 11, 0),
        estimatedCostUsd: 2.50,
      }),
      makeSessionRow({
        id: 'session-2',
        startedAt: new Date(2026, 0, 15, 14, 0),
        endedAt: new Date(2026, 0, 15, 15, 30),
        estimatedCostUsd: 1.00,
      }),
    ];
    const dayStart = new Date(2026, 0, 15);
    const result = computeDayStats(sessions, dayStart);
    expect(result.sessionCount).toBe(2);
    expect(result.totalCost).toBe(3.50);
    expect(result.totalMinutes).toBe(150); // 60 + 90 minutes
  });

  it('returns 0 cost when estimatedCostUsd is undefined', () => {
    const sessions = [
      makeSessionRow({
        startedAt: new Date(2026, 0, 15, 10, 0),
        endedAt: new Date(2026, 0, 15, 11, 0),
      }),
    ];
    const dayStart = new Date(2026, 0, 15);
    const result = computeDayStats(sessions, dayStart);
    expect(result.sessionCount).toBe(1);
    expect(result.totalCost).toBe(0);
  });
});

// ── computeTopProjects ──

describe('computeTopProjects', () => {
  it('returns empty array for no sessions', () => {
    expect(computeTopProjects([], 5)).toEqual([]);
  });

  it('groups sessions by project name and sorts by count', () => {
    const sessions = [
      makeSessionRow({ projectName: 'project-a' }),
      makeSessionRow({ id: 's2', projectName: 'project-a' }),
      makeSessionRow({ id: 's3', projectName: 'project-b' }),
    ];
    const result = computeTopProjects(sessions, 5);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('project-a');
    expect(result[0].count).toBe(2);
    expect(result[1].name).toBe('project-b');
    expect(result[1].count).toBe(1);
  });

  it('respects the limit parameter', () => {
    const sessions = [
      makeSessionRow({ projectName: 'a' }),
      makeSessionRow({ id: 's2', projectName: 'b' }),
      makeSessionRow({ id: 's3', projectName: 'c' }),
    ];
    const result = computeTopProjects(sessions, 2);
    expect(result.length).toBe(2);
  });

  it('calculates percent correctly', () => {
    const sessions = [
      makeSessionRow({ projectName: 'a' }),
      makeSessionRow({ id: 's2', projectName: 'a' }),
      makeSessionRow({ id: 's3', projectName: 'b' }),
      makeSessionRow({ id: 's4', projectName: 'b' }),
    ];
    const result = computeTopProjects(sessions, 5);
    expect(result[0].percent).toBe(50);
    expect(result[1].percent).toBe(50);
  });

  it('sums cost per project', () => {
    const sessions = [
      makeSessionRow({ projectName: 'a', estimatedCostUsd: 1.50 }),
      makeSessionRow({ id: 's2', projectName: 'a', estimatedCostUsd: 2.00 }),
    ];
    const result = computeTopProjects(sessions, 5);
    expect(result[0].cost).toBe(3.50);
  });
});
