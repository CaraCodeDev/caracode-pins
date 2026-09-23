import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { keyToPath, pageKey } from '../src/pages.js';
import { appendPin, keyForFile, pinFilePath, readPins, sanitizeCaptured } from '../src/store.js';
import type { CapturedPin } from '../src/types.js';

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
  const captured: CapturedPin = {
    source: 'src/components/FeatureCard.astro:17:5',
    sourceChain: ['src/components/FeatureCard.astro', 'src/pages/index.astro'],
    selector: 'body > main',
    text: 'Hello',
    tag: 'h3',
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'carapin-'));
  });
  afterEach(async () => {
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

  it('creates the folder and file, pretty-printed with 2 spaces', async () => {
    await appendPin(root, 'blog/post', captured);
    const raw = await readFile(path.join(root, '.carapin', 'blog', 'post.json'), 'utf8');
    const data = JSON.parse(raw);
    expect(raw).toBe(`${JSON.stringify(data, null, 2)}\n`);
    expect(data.page).toBe('/blog/post/');
    expect(data.pins).toHaveLength(1);
    expect(data.pins[0]).toMatchObject({ ...captured, note: '' });
    expect(data.pins[0].id).toMatch(/^[0-9a-f]{8}$/);
    expect(Date.parse(data.pins[0].createdAt)).not.toBeNaN();
  });

  it('re-reads before every write: a hand edit between appends survives', async () => {
    await appendPin(root, 'index', captured);
    const file = path.join(root, '.carapin', 'index.json');
    const data = JSON.parse(await readFile(file, 'utf8'));
    data.pins[0].text = 'edited by hand';
    data.extra = 'kept';
    await writeFile(file, JSON.stringify(data, null, 2));
    await appendPin(root, 'index', { ...captured, text: 'second' });
    const after = JSON.parse(await readFile(file, 'utf8'));
    expect(after.pins.map((p: { text: string }) => p.text)).toEqual(['edited by hand', 'second']);
    expect(after.extra).toBe('kept');
  });

  it('refuses to overwrite a file that is not valid JSON', async () => {
    const file = path.join(root, '.carapin', 'index.json');
    await appendPin(root, 'index', captured);
    await writeFile(file, '{ "pins": [ oops');
    await expect(appendPin(root, 'index', captured)).rejects.toThrow();
    expect(await readFile(file, 'utf8')).toBe('{ "pins": [ oops');
  });

  it('reads a missing file as an empty page', async () => {
    expect(await readPins(root, 'nope')).toEqual({ page: '/nope/', pins: [] });
  });

  it('sanitizes what the browser sends', () => {
    expect(sanitizeCaptured(null)).toBeNull();
    expect(sanitizeCaptured({ text: 'x' })).toBeNull();
    expect(sanitizeCaptured({ selector: 'a', sourceChain: ['a', 1], source: 5, evil: true })).toEqual({
      selector: 'a',
      sourceChain: ['a'],
      source: null,
      text: '',
      tag: '',
    });
  });
});
