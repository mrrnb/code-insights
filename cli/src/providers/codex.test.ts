import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CodexProvider } from './codex.js';

async function writeCodexRollout(dir: string, sessionId: string, userText: string, assistantText: string): Promise<string> {
  const filePath = join(dir, `rollout-${sessionId}.jsonl`);
  const lines = [
    JSON.stringify({
      type: 'session_meta',
      timestamp: '2026-03-11T10:00:00.000Z',
      payload: {
        id: sessionId,
        timestamp: '2026-03-11T10:00:00.000Z',
        cwd: '/Users/rrming/data/apps/cgyj',
        cli_version: '0.114.0',
        model: 'gpt-5.4',
      },
    }),
    JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-03-11T10:00:01.000Z',
      payload: { type: 'user_message', message: userText },
    }),
    JSON.stringify({
      type: 'response_item',
      timestamp: '2026-03-11T10:00:02.000Z',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: assistantText }],
      },
    }),
    JSON.stringify({
      type: 'event_msg',
      timestamp: '2026-03-11T10:00:03.000Z',
      payload: {
        type: 'task_complete',
        usage: { input_tokens: 10, output_tokens: 20, cached_input_tokens: 0 },
        model: 'gpt-5.4',
      },
    }),
  ];

  await writeFile(filePath, `${lines.join('\n')}\n`, 'utf8');
  return filePath;
}

describe('CodexProvider', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('generates session-scoped message IDs for format A sessions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-provider-test-'));
    tempDirs.push(dir);

    const provider = new CodexProvider();
    const filePath = await writeCodexRollout(dir, 'session-alpha', 'first prompt', 'first reply');
    const session = await provider.parse(filePath);

    expect(session).not.toBeNull();
    expect(session!.messages.map(message => message.id)).toEqual([
      'codex:session-alpha:user:0',
      'codex:session-alpha:assistant:1',
    ]);
  });

  it('keeps message IDs unique across sessions with identical turn structure', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'codex-provider-test-'));
    tempDirs.push(dir);

    const provider = new CodexProvider();
    const [firstPath, secondPath] = await Promise.all([
      writeCodexRollout(dir, 'session-one', 'same prompt', 'same reply'),
      writeCodexRollout(dir, 'session-two', 'same prompt', 'same reply'),
    ]);

    const [first, second] = await Promise.all([provider.parse(firstPath), provider.parse(secondPath)]);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first!.messages).toHaveLength(2);
    expect(second!.messages).toHaveLength(2);

    const firstIds = first!.messages.map(message => message.id);
    const secondIds = second!.messages.map(message => message.id);
    expect(firstIds).not.toEqual(secondIds);
    expect(new Set([...firstIds, ...secondIds]).size).toBe(4);
  });
});
