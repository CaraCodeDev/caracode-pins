import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pins from '../src/index.js';
import { EVENTS, type PinsMessage, type ResultMessage } from '../src/types.js';

/** Drives the integration's hooks with a fake toolbar, the way Astro would in dev. */
async function setup(root: string) {
  const handlers = new Map<string, (data: unknown) => void>();
  const sent: { event: string; data: unknown }[] = [];
  const integration = pins();
  const hooks = integration.hooks as Record<string, (opts: unknown) => void>;
  hooks['astro:config:setup']!({
    command: 'dev',
    config: { root: pathToFileURL(`${root}/`) },
    addDevToolbarApp: () => {},
    updateConfig: () => {},
  });
  hooks['astro:server:setup']!({
    server: { watcher: { add: () => {}, on: () => {} } },
    toolbar: {
      on: (event: string, fn: (data: unknown) => void) => handlers.set(event, fn),
      send: (event: string, data: unknown) => sent.push({ event, data }),
    },
    logger: { warn: () => {}, error: () => {}, info: () => {} },
  });
  const send = (event: string, data: unknown) => handlers.get(event)!(data);
  /** Waits for the next `result` after `from` messages. */
  const nextResult = async (from: number) => {
    await vi.waitFor(() => expect(sent.slice(from).some((m) => m.event === EVENTS.result)).toBe(true));
    return sent.slice(from).find((m) => m.event === EVENTS.result)!.data as ResultMessage;
  };
  return { send, sent, nextResult };
}

describe('server messages', () => {
  let root: string;
  const anchor = { source: 'src/pages/index.astro:5:3', sourceChain: [], selector: 'h1', text: 'Hi', tag: 'h1' };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'carapin-srv-'));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('create → reply → done → delete, each answered with a result and fresh pins', async () => {
    const { send, sent, nextResult } = await setup(root);

    let n = sent.length;
    send(EVENTS.create, { path: '/', anchor, text: 'Tighten this', requestId: 'r1' });
    const created = await nextResult(n);
    expect(created).toMatchObject({ ok: true, op: 'create', key: 'index', requestId: 'r1' });
    const id = (created as { id: string }).id;
    await vi.waitFor(() => expect(sent.at(-1)?.event).toBe(EVENTS.pins));
    expect((sent.at(-1)!.data as PinsMessage).pins[0]).toMatchObject({ id, status: 'open' });

    n = sent.length;
    send(EVENTS.reply, { path: '/', id, text: 'and bolder', author: 'claude' });
    expect(await nextResult(n)).toMatchObject({ ok: true, op: 'reply', id });
    const file = path.join(root, '.carapin', 'index.json');
    const afterReply = JSON.parse(await readFile(file, 'utf8')).pins[0];
    // The panel can't claim to be Claude.
    expect(afterReply.comments.map((c: { author: string }) => c.author)).toEqual(['human', 'human']);

    n = sent.length;
    send(EVENTS.done, { path: '/', id });
    expect(await nextResult(n)).toMatchObject({ ok: true, op: 'done' });
    expect(JSON.parse(await readFile(file, 'utf8')).pins[0].status).toBe('done');

    n = sent.length;
    send(EVENTS.delete, { path: '/', id });
    expect(await nextResult(n)).toMatchObject({ ok: true, op: 'delete' });
    expect(JSON.parse(await readFile(file, 'utf8')).pins).toEqual([]);
  });

  it.each([
    ['reply to a missing id', EVENTS.reply, { path: '/', id: 'nope', text: 'x' }, /No pin nope/],
    ['done on a missing id', EVENTS.done, { path: '/', id: 'nope' }, /No pin nope/],
    ['delete a missing id', EVENTS.delete, { path: '/', id: 'nope' }, /No pin nope/],
    ['no id at all', EVENTS.done, { path: '/' }, /No pin id/],
    ['an empty note', EVENTS.create, { path: '/', anchor, text: '   ' }, /note is empty/],
    ['an empty reply', EVENTS.reply, { path: '/', id: 'x', text: '' }, /reply is empty/],
    ['a bad anchor', EVENTS.create, { path: '/', anchor: {}, text: 'x' }, /picked element/],
    ['a bad path', EVENTS.create, { path: '/../x', anchor, text: 'x' }, /path/],
    ['no payload', EVENTS.delete, undefined, /path/],
  ])('%s → an error result, not a crash', async (_what, event, data, message) => {
    const { send, sent, nextResult } = await setup(root);
    const n = sent.length;
    expect(() => send(event, data)).not.toThrow();
    const result = await nextResult(n);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toMatch(message);
  });
});
