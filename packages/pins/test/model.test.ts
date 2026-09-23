import { describe, expect, it } from 'vitest';
import {
  baseName,
  clockTime,
  commentsOf,
  countSummary,
  filterPins,
  firstLine,
  latestClaudeComment,
  numberPins,
  relativeTime,
  statusOf,
} from '../src/toolbar/model.js';
import type { Pin } from '../src/types.js';

const pin = (id: string, status: string, texts: string[] = ['note'], extra: Partial<Pin> = {}): Pin =>
  ({
    id,
    status,
    createdAt: '2026-09-23T10:00:00.000Z',
    updatedAt: '2026-09-23T10:00:00.000Z',
    anchor: { source: null, sourceChain: [], selector: 'h1', text: '', tag: 'h1' },
    comments: texts.map((text, i) => ({ author: i % 2 ? 'claude' : 'human', text, at: '2026-09-23T10:00:00.000Z' })),
    ...extra,
  }) as Pin;

describe('numbering (Decision 7)', () => {
  it('numbers pins by position in the file, 1-based, done included', () => {
    const n = numberPins([pin('a', 'done'), pin('b', 'open'), pin('c', 'review')]);
    expect(n.map((p) => [p.pin.id, p.number])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('keeps numbers when done pins are hidden or shown', () => {
    const n = numberPins([pin('a', 'done'), pin('b', 'open'), pin('c', 'done'), pin('d', 'review')]);
    expect(filterPins(n, false).map((p) => p.number)).toEqual([2, 4]);
    expect(filterPins(n, true).map((p) => p.number)).toEqual([1, 2, 3, 4]);
  });
});

describe('filtering (Decision 3)', () => {
  it('hides only done; unknown statuses stay visible', () => {
    const n = numberPins([pin('a', 'wip'), pin('b', 'done'), pin('c', 'open')]);
    expect(filterPins(n, false).map((p) => p.pin.id)).toEqual(['a', 'c']);
  });

  it('does not mutate its input', () => {
    const n = numberPins([pin('a', 'done')]);
    filterPins(n, false);
    expect(n).toHaveLength(1);
  });

  it('counts shown pins and pins waiting for review', () => {
    const n = numberPins([pin('a', 'done'), pin('b', 'review'), pin('c', 'open'), pin('d', 'review')]);
    expect(countSummary(n, false)).toEqual({ shown: 3, review: 2, done: 1 });
    expect(countSummary(n, true)).toEqual({ shown: 4, review: 2, done: 1 });
  });
});

describe('reading hand-edited pins', () => {
  it('reads a missing status as open and keeps an unknown one', () => {
    expect(statusOf(pin('a', ''))).toBe('open');
    expect(statusOf({ id: 'x' } as Pin)).toBe('open');
    expect(statusOf(pin('a', 'wip'))).toBe('wip');
  });

  it('first line of the first comment, skipping blank lines', () => {
    expect(firstLine(pin('a', 'open', ['\n  Make it bigger  \nand bolder']))).toBe('Make it bigger');
    expect(firstLine(pin('a', 'open', []))).toBe('');
    expect(firstLine({ id: 'a' } as Pin)).toBe('');
  });

  it('drops comments that are not comment-shaped', () => {
    const p = { ...pin('a', 'open'), comments: [null, 5, { text: 'ok', author: 'human', at: '' }, { author: 'claude' }] } as unknown as Pin;
    expect(commentsOf(p).map((c) => c.text)).toEqual(['ok']);
  });

  it('finds the latest Claude comment', () => {
    expect(latestClaudeComment(pin('a', 'review', ['do it', 'done v1', 'again', 'done v2']))?.text).toBe('done v2');
    expect(latestClaudeComment(pin('a', 'open', ['just me']))).toBeUndefined();
  });

  it('base names of source locations', () => {
    expect(baseName('src/components/FeatureCard.astro:17:5')).toBe('FeatureCard.astro');
    expect(baseName('src/pages/index.astro')).toBe('index.astro');
  });
});

describe('times', () => {
  const now = new Date('2026-09-23T12:00:00');
  it('relative ages for list rows', () => {
    expect(relativeTime(new Date('2026-09-23T11:59:40').toISOString(), now)).toBe('now');
    expect(relativeTime(new Date('2026-09-23T11:48:00').toISOString(), now)).toBe('12m');
    expect(relativeTime(new Date('2026-09-23T10:00:00').toISOString(), now)).toBe('2h');
    expect(relativeTime(new Date('2026-09-22T10:00:00').toISOString(), now)).toBe('yesterday');
    expect(relativeTime(new Date('2026-09-20T10:00:00').toISOString(), now)).toBe('3d');
    expect(relativeTime('nonsense', now)).toBe('');
    expect(relativeTime(undefined, now)).toBe('');
  });

  it('clock times for comments', () => {
    expect(clockTime(new Date('2026-09-23T09:05:00').toISOString(), now)).toBe('09:05');
    expect(clockTime(new Date('2026-09-22T13:41:00').toISOString(), now)).toBe('Yesterday, 13:41');
    expect(clockTime(new Date('2026-09-03T13:41:00').toISOString(), now)).toBe('3 Sep, 13:41');
    expect(clockTime('', now)).toBe('');
  });
});
