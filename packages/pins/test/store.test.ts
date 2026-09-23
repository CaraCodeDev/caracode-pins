import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keyToPath, pageKey } from '../src/pages.js';
import {
  createPin,
  deletePin,
  keyForFile,
  markPinDone,
  PinError,
  pinFilePath,
  readPins,
  replyToPin,
  sanitizeAnchor,
  sanitizeId,
  serialize,
  statusAfterComment,
} from '../src/store.js';
import type { Anchor, Author, PinStatus } from '../src/types.js';

describe('pageKey', () => {
  it.each([
    ['/', 'index'],
    ['', 'index'],
    ['/index.html', 'index'],
    ['/about', 'about'],
    ['/about/', 'about'],
    ['/blog/post/', 'blog/post'],
    ['/blog/post.html', 'blog/post'],
    ['/blog/post/?q=1#x', 'blog/post'],
    ['/caf%C3%A9/', 'café'],
  ])('%s → %s', (input, key) => expect(pageKey(input)).toBe(key));

  it.each(['/../etc/passwd', '/a/%2e%2e/b', '/a%5Cb', '/%E0%A4%A'])('rejects %s', (input) => {
    expect(pageKey(input)).toBeNull();
  });

  it('maps keys back to paths', () => {
    expect(keyToPath('index')).toBe('/');
    expect(keyToPath('blog/post')).toBe('/blog/post/');
  });
});

describe('store', () => {
  let root: string;
  let file: string;
  const anchor: Anchor = {
    source: 'src/components/FeatureCard.astro:17:5',
    sourceChain: ['src/components/FeatureCard.astro', 'src/pages/index.astro'],
    selector: 'body > main',
    text: 'Hello',
    tag: 'h3',
  };
  const T0 = '2026-09-23T10:00:00.000Z';
  const T1 = '2026-09-23T11:00:00.000Z';

  const readRaw = () => readFile(file, 'utf8');
  const readJson = async () => JSON.parse(await readRaw());
  const writeJson = async (data: unknown) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
  };
  /** Writes a one-pin file by hand, the way Claude or Rich would. */
  const handPin = (status: PinStatus | string, extra: Record<string, unknown> = {}) =>
    writeJson({
      page: '/',
      pins: [
        {
          id: 'abc12345',
          status,
          createdAt: T0,
          updatedAt: T0,
          anchor,
          comments: [{ author: 'human', text: 'Make this bigger', at: T0 }],
          ...extra,
        },
      ],
    });

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'carapin-'));
    file = path.join(root, '.carapin', 'index.json');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(T0));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await rm(root, { recursive: true, force: true });
  });

  it('maps keys to files inside .carapin and back', () => {
    expect(pinFilePath(root, 'index')).toBe(path.join(root, '.carapin', 'index.json'));
    expect(pinFilePath(root, 'blog/post')).toBe(path.join(root, '.carapin', 'blog', 'post.json'));
    expect(pinFilePath(root, '../x')).toBeNull();
    expect(keyForFile(root, path.join(root, '.carapin', 'blog', 'post.json'))).toBe('blog/post');
    expect(keyForFile(root, path.join(root, '.carapin', 'notes.txt'))).toBeNull();
    expect(keyForFile(root, path.join(root, 'src', 'x.json'))).toBeNull();
  });

  describe('create', () => {
    it('writes Decision 1 exactly: key order, 2-space indent, trailing newline', async () => {
      const { pin } = await createPin(root, 'index', anchor, 'Make this bigger');
      expect(pin.id).toMatch(/^[0-9a-f]{8}$/);
      const expected =
        [
          '{',
          '  "page": "/",',
          '  "pins": [',
          '    {',
          `      "id": "${pin.id}",`,
          '      "status": "open",',
          `      "createdAt": "${T0}",`,
          `      "updatedAt": "${T0}",`,
          '      "anchor": {',
          '        "source": "src/components/FeatureCard.astro:17:5",',
          '        "sourceChain": [',
          '          "src/components/FeatureCard.astro",',
          '          "src/pages/index.astro"',
          '        ],',
          '        "selector": "body > main",',
          '        "text": "Hello",',
          '        "tag": "h3"',
          '      },',
          '      "comments": [',
          '        {',
          '          "author": "human",',
          '          "text": "Make this bigger",',
          `          "at": "${T0}"`,
          '        }',
          '      ]',
          '    }',
          '  ]',
          '}',
        ].join('\n') + '\n';
      expect(await readRaw()).toBe(expected);
    });

    it('creates nested folders for nested pages', async () => {
      await createPin(root, 'blog/post', anchor, 'x');
      const data = JSON.parse(await readFile(path.join(root, '.carapin', 'blog', 'post.json'), 'utf8'));
      expect(data.page).toBe('/blog/post/');
    });

    it('appends after existing pins with a fresh id', async () => {
      const a = await createPin(root, 'index', anchor, 'one');
      const b = await createPin(root, 'index', { ...anchor, text: 'Other' }, 'two');
      expect(b.pin.id).not.toBe(a.pin.id);
      const data = await readJson();
      expect(data.pins.map((p: { id: string }) => p.id)).toEqual([a.pin.id, b.pin.id]);
    });

    it('trims the note and rejects an empty or whitespace one without writing', async () => {
      await createPin(root, 'index', anchor, '  spaced  \n');
      expect((await readJson()).pins[0].comments[0].text).toBe('spaced');
      const before = await readRaw();
      for (const text of ['', '   ', '\n\t']) {
        await expect(createPin(root, 'index', anchor, text)).rejects.toMatchObject({ code: 'empty-text' });
      }
      expect(await readRaw()).toBe(before);
    });

    it('does not create a file for a rejected empty note', async () => {
      await expect(createPin(root, 'index', anchor, ' ')).rejects.toBeInstanceOf(PinError);
      await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('reply (Decision 2)', () => {
    it.each<[PinStatus, Author, PinStatus]>([
      ['open', 'human', 'open'],
      ['review', 'human', 'open'],
      ['done', 'human', 'open'],
      ['open', 'claude', 'open'],
      ['review', 'claude', 'review'],
      ['done', 'claude', 'done'],
    ])('%s + %s comment → %s', async (from, author, to) => {
      await handPin(from);
      vi.setSystemTime(new Date(T1));
      await replyToPin(root, 'index', 'abc12345', 'and bolder', author);
      const pin = (await readJson()).pins[0];
      expect(pin.status).toBe(to);
      expect(pin.updatedAt).toBe(T1);
      expect(pin.createdAt).toBe(T0);
      expect(pin.comments).toEqual([
        { author: 'human', text: 'Make this bigger', at: T0 },
        { author, text: 'and bolder', at: T1 },
      ]);
    });

    it('defaults to a human comment', async () => {
      await handPin('review');
      await replyToPin(root, 'index', 'abc12345', 'not quite');
      const pin = (await readJson()).pins[0];
      expect(pin.status).toBe('open');
      expect(pin.comments[1].author).toBe('human');
    });

    it('leaves an unknown status alone', () => {
      expect(statusAfterComment('wip', 'human')).toBe('wip');
    });

    it('rejects an empty reply without writing', async () => {
      await handPin('review');
      const before = await readRaw();
      await expect(replyToPin(root, 'index', 'abc12345', '  ')).rejects.toMatchObject({ code: 'empty-text' });
      expect(await readRaw()).toBe(before);
    });

    it('starts a comments array if a hand edit removed it', async () => {
      await handPin('open', { comments: undefined });
      await replyToPin(root, 'index', 'abc12345', 'hi');
      expect((await readJson()).pins[0].comments).toEqual([{ author: 'human', text: 'hi', at: T0 }]);
    });
  });

  describe('mark done (Decision 3)', () => {
    it.each<PinStatus>(['open', 'review', 'done'])('from %s', async (from) => {
      await handPin(from);
      vi.setSystemTime(new Date(T1));
      await markPinDone(root, 'index', 'abc12345');
      const pin = (await readJson()).pins[0];
      expect(pin.status).toBe('done');
      expect(pin.updatedAt).toBe(T1);
      expect(pin.comments).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('removes only that pin', async () => {
      const a = await createPin(root, 'index', anchor, 'one');
      const b = await createPin(root, 'index', anchor, 'two');
      const c = await createPin(root, 'index', anchor, 'three');
      await deletePin(root, 'index', b.pin.id);
      const data = await readJson();
      expect(data.pins.map((p: { id: string }) => p.id)).toEqual([a.pin.id, c.pin.id]);
      expect(await readRaw()).toBe(serialize(data));
    });
  });

  describe('missing pin id', () => {
    it.each([
      ['reply', () => replyToPin(root, 'index', 'nope', 'hi')],
      ['done', () => markPinDone(root, 'index', 'nope')],
      ['delete', () => deletePin(root, 'index', 'nope')],
    ])('%s throws not-found and leaves the file alone', async (_op, run) => {
      await handPin('open');
      const before = await readRaw();
      await expect(run()).rejects.toMatchObject({ name: 'PinError', code: 'not-found' });
      expect(await readRaw()).toBe(before);
    });

    it('on a page with no file yet, throws not-found and creates nothing', async () => {
      await expect(markPinDone(root, 'index', 'nope')).rejects.toMatchObject({ code: 'not-found' });
      await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('hand edits', () => {
    it('keeps unknown fields on the file, pins, anchors and comments, in place', async () => {
      await writeJson({
        page: '/',
        version: 7,
        pins: [
          {
            id: 'abc12345',
            status: 'open',
            label: 'content',
            priority: 'high',
            createdAt: T0,
            updatedAt: T0,
            anchor: { ...anchor, extraAnchor: true },
            comments: [{ author: 'human', text: 'x', at: T0, mood: 'grumpy' }],
          },
          { id: 'other123', status: 'review', createdAt: T0, updatedAt: T0, anchor, comments: [], x: 1 },
        ],
        trailer: { keep: ['me'] },
      });
      vi.setSystemTime(new Date(T1));
      await replyToPin(root, 'index', 'abc12345', 'hi');
      await markPinDone(root, 'index', 'abc12345');
      await createPin(root, 'index', anchor, 'new');
      await deletePin(root, 'index', (await readJson()).pins[2].id);

      const data = await readJson();
      expect(Object.keys(data)).toEqual(['page', 'version', 'pins', 'trailer']);
      expect(data.version).toBe(7);
      expect(data.trailer).toEqual({ keep: ['me'] });
      const [p1, p2] = data.pins;
      expect(Object.keys(p1)).toEqual([
        'id', 'status', 'label', 'priority', 'createdAt', 'updatedAt', 'anchor', 'comments',
      ]);
      expect(p1).toMatchObject({ label: 'content', priority: 'high', status: 'done', updatedAt: T1 });
      expect(p1.anchor.extraAnchor).toBe(true);
      expect(p1.comments[0].mood).toBe('grumpy');
      expect(p2).toEqual({ id: 'other123', status: 'review', createdAt: T0, updatedAt: T0, anchor, comments: [], x: 1 });
    });

    it('reads a documented file with no label, and with one', async () => {
      await handPin('review');
      expect((await readPins(root, 'index')).pins[0]).not.toHaveProperty('label');
      await handPin('review', { label: 'content' });
      expect((await readPins(root, 'index')).pins[0].label).toBe('content');
    });

    it('a hand edit between two operations survives', async () => {
      const a = await createPin(root, 'index', anchor, 'one');
      // Claude answers by editing the file.
      const data = await readJson();
      data.pins[0].status = 'review';
      data.pins[0].comments.push({ author: 'claude', text: 'Done, bumped to 2rem', at: T1 });
      await writeFile(file, JSON.stringify(data)); // not even pretty-printed
      await createPin(root, 'index', anchor, 'two');
      const after = await readJson();
      expect(after.pins).toHaveLength(2);
      expect(after.pins[0].status).toBe('review');
      expect(after.pins[0].comments.map((c: { author: string }) => c.author)).toEqual(['human', 'claude']);
      // …and the next operation on that pin sees it too.
      await replyToPin(root, 'index', a.pin.id, 'not quite');
      const last = (await readJson()).pins[0];
      expect(last.status).toBe('open');
      expect(last.comments).toHaveLength(3);
    });

    it.each([
      ['invalid JSON', '{ "pins": [ oops'],
      ['a JSON array', '[]'],
      ['pins not an array', '{ "page": "/", "pins": {} }'],
    ])('%s: every operation fails and the file is untouched', async (_what, raw) => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, raw);
      await expect(readPins(root, 'index')).rejects.toThrow();
      await expect(createPin(root, 'index', anchor, 'x')).rejects.toThrow();
      await expect(replyToPin(root, 'index', 'abc12345', 'x')).rejects.toThrow();
      await expect(markPinDone(root, 'index', 'abc12345')).rejects.toThrow();
      await expect(deletePin(root, 'index', 'abc12345')).rejects.toThrow();
      expect(await readRaw()).toBe(raw);
    });
  });

  it('reads a missing file as an empty page', async () => {
    expect(await readPins(root, 'nope')).toEqual({ page: '/nope/', pins: [] });
  });

  it('sanitizes what the browser sends', () => {
    expect(sanitizeAnchor(null)).toBeNull();
    expect(sanitizeAnchor({ text: 'x' })).toBeNull();
    expect(sanitizeAnchor({ selector: 'a', sourceChain: ['a', 1], source: 5, evil: true })).toEqual({
      selector: 'a',
      sourceChain: ['a'],
      source: null,
      text: '',
      tag: '',
    });
    expect(sanitizeId('abc')).toBe('abc');
    expect(sanitizeId('')).toBeNull();
    expect(sanitizeId(5)).toBeNull();
  });
});
