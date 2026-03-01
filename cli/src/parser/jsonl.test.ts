import { describe, it, expect } from 'vitest';
import { parseJsonlFile } from './jsonl.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '..', '__fixtures__', 'sessions');

// Valid fixture uses UUID filename so extractSessionId succeeds
const validFixture = resolve(fixturesDir, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.jsonl');

describe('parseJsonlFile', () => {
  it('parses a valid simple session', async () => {
    const result = await parseJsonlFile(validFixture);
    expect(result).not.toBeNull();
    expect(result!.id).toBeTruthy();
    expect(result!.messages.length).toBeGreaterThanOrEqual(2);
    expect(result!.startedAt).toBeInstanceOf(Date);
    expect(result!.endedAt).toBeInstanceOf(Date);
  });

  it('returns null for empty file', async () => {
    const result = await parseJsonlFile(resolve(fixturesDir, 'empty.jsonl'));
    expect(result).toBeNull();
  });

  it('handles malformed JSONL gracefully', async () => {
    const result = await parseJsonlFile(resolve(fixturesDir, 'malformed.jsonl'));
    expect(result).toBeNull();
  });

  it('generates a title for the parsed session', async () => {
    const result = await parseJsonlFile(validFixture);
    expect(result).not.toBeNull();
    expect(result!.generatedTitle).toBeTruthy();
    expect(result!.titleSource).toBeTruthy();
  });

  it('extracts session ID from filename', async () => {
    const result = await parseJsonlFile(validFixture);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });

  it('extracts usage data from assistant messages', async () => {
    const result = await parseJsonlFile(validFixture);
    expect(result).not.toBeNull();
    expect(result!.usage).toBeDefined();
    expect(result!.usage!.totalInputTokens).toBe(100);
    expect(result!.usage!.totalOutputTokens).toBe(50);
    expect(result!.usage!.primaryModel).toBe('claude-sonnet-4-5');
  });

  it('counts user and assistant messages', async () => {
    const result = await parseJsonlFile(validFixture);
    expect(result).not.toBeNull();
    expect(result!.userMessageCount).toBe(1);
    expect(result!.assistantMessageCount).toBe(1);
  });
});
