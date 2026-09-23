// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  effectivePlacement,
  PagePush,
  PUSH_MIN_WIDTH,
  readPlacement,
  shouldTuck,
  STORAGE_KEY,
  writePlacement,
} from '../src/toolbar/dock.js';

describe('effectivePlacement', () => {
  it('pushes at and above 1280px', () => {
    expect(PUSH_MIN_WIDTH).toBe(1280);
    expect(effectivePlacement('push', 1280)).toEqual({ mode: 'push', side: 'right', fallback: false });
    expect(effectivePlacement('push', 2560)).toEqual({ mode: 'push', side: 'right', fallback: false });
  });

  it('push below 1280px overlays on the right, flagged as a fallback', () => {
    expect(effectivePlacement('push', 1279)).toEqual({ mode: 'overlay', side: 'right', fallback: true });
    expect(effectivePlacement('push', 800)).toEqual({ mode: 'overlay', side: 'right', fallback: true });
  });

  it('right and left overlay at any width, never a fallback', () => {
    for (const w of [600, 1279, 1280, 2000]) {
      expect(effectivePlacement('right', w)).toEqual({ mode: 'overlay', side: 'right', fallback: false });
      expect(effectivePlacement('left', w)).toEqual({ mode: 'overlay', side: 'left', fallback: false });
    }
  });
});

describe('shouldTuck', () => {
  const base = { mode: 'overlay' as const, pinMode: true, composerOpen: false, expanded: false };
  it('tucks an overlay in pin mode with no composer', () => expect(shouldTuck(base)).toBe(true));
  it('never tucks in push', () => expect(shouldTuck({ ...base, mode: 'push' })).toBe(false));
  it('not without pin mode', () => expect(shouldTuck({ ...base, pinMode: false })).toBe(false));
  it('not while the composer is open', () => expect(shouldTuck({ ...base, composerOpen: true })).toBe(false));
  it('not when expanded by hand', () => expect(shouldTuck({ ...base, expanded: true })).toBe(false));
});

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('readPlacement / writePlacement', () => {
  it('defaults to push when nothing is stored', () => {
    expect(readPlacement(() => memoryStore())).toBe('push');
  });

  it('reads a stored value', () => {
    expect(readPlacement(() => memoryStore({ [STORAGE_KEY]: 'left' }))).toBe('left');
    expect(readPlacement(() => memoryStore({ [STORAGE_KEY]: 'right' }))).toBe('right');
  });

  it('falls back to push for an unknown stored value', () => {
    expect(readPlacement(() => memoryStore({ [STORAGE_KEY]: 'bottom' }))).toBe('push');
    expect(readPlacement(() => memoryStore({ [STORAGE_KEY]: '' }))).toBe('push');
  });

  it('falls back to push when storage is missing or throws', () => {
    expect(readPlacement(() => null)).toBe('push');
    expect(
      readPlacement(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
    ).toBe('push');
    expect(
      readPlacement(() => ({
        getItem: () => {
          throw new Error('nope');
        },
        setItem: () => {},
      })),
    ).toBe('push');
  });

  it('writes, and never throws when storage fails', () => {
    const store = memoryStore();
    writePlacement('left', () => store);
    expect(store.data.get(STORAGE_KEY)).toBe('left');
    expect(readPlacement(() => store)).toBe('left');
    expect(() =>
      writePlacement('right', () => {
        throw new DOMException('blocked', 'SecurityError');
      }),
    ).not.toThrow();
    expect(() =>
      writePlacement('right', () => ({
        getItem: () => null,
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      })),
    ).not.toThrow();
  });

  it('uses window.localStorage by default', () => {
    localStorage.removeItem(STORAGE_KEY);
    expect(readPlacement()).toBe('push');
    writePlacement('right');
    expect(readPlacement()).toBe('right');
    localStorage.removeItem(STORAGE_KEY);
  });
});

describe('PagePush', () => {
  const html = document.documentElement;
  afterEach(() => {
    html.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  const snapshot = () => ({
    head: document.head.innerHTML,
    htmlAttrs: html.getAttributeNames().map((n) => [n, html.getAttribute(n)]),
    bodyAttrs: document.body.getAttributeNames().map((n) => [n, document.body.getAttribute(n)]),
  });

  it('adds one style element while active and removes it on release', () => {
    const before = snapshot();
    const push = new PagePush();
    push.apply(400);
    push.apply(400); // idempotent
    expect(push.active).toBe(true);
    const styles = document.head.querySelectorAll('style');
    expect(styles.length).toBe(1);
    expect(styles[0]!.textContent).toContain('margin-right: 400px');
    // Nothing set on html or body themselves.
    expect(snapshot().htmlAttrs).toEqual(before.htmlAttrs);
    expect(snapshot().bodyAttrs).toEqual(before.bodyAttrs);
    push.release();
    push.release(); // harmless twice
    expect(push.active).toBe(false);
    expect(snapshot()).toEqual(before);
  });

  it("leaves the page's own inline styles on html untouched", () => {
    html.setAttribute('style', 'margin-right: 7px; color: red');
    const before = snapshot();
    const push = new PagePush();
    push.apply(400);
    expect(html.getAttribute('style')).toBe('margin-right: 7px; color: red');
    push.release();
    expect(snapshot()).toEqual(before);
  });
});
