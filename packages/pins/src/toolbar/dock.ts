/**
 * Phase 4: where the drawer sits. A per-browser setting with three values:
 *
 * - `push` (default): the page is narrowed by the drawer's width while the panel
 *   is open, like docked devtools, and the drawer sits in the freed space on the
 *   right. Below PUSH_MIN_WIDTH it behaves as `right` (overlay) instead.
 * - `right` / `left`: the drawer overlays the page on that side, and tucks into a
 *   slim tab while pin mode is on and no composer is open.
 *
 * The pure parts (effective placement, storage, the tuck rule) are exported for
 * tests; PagePush is the only thing here that touches the page.
 */

export type Placement = 'push' | 'right' | 'left';
export type Side = 'right' | 'left';

export const PLACEMENTS: readonly Placement[] = ['push', 'right', 'left'];
/** Below this window width, `push` overlays on the right instead. */
export const PUSH_MIN_WIDTH = 1280;
/** Matches --cp-drawer-width in styles.ts. */
export const DRAWER_WIDTH = 400;
export const STORAGE_KEY = 'caracode-pins:placement';

export interface EffectivePlacement {
  /** push narrows the page; overlay covers it. */
  mode: 'push' | 'overlay';
  side: Side;
  /** The setting is `push` but the window is too narrow, so it overlays. */
  fallback: boolean;
}

export function isPlacement(v: unknown): v is Placement {
  return typeof v === 'string' && (PLACEMENTS as readonly string[]).includes(v);
}

/** What the drawer actually does for a setting at a given window width (px). */
export function effectivePlacement(setting: Placement, windowWidth: number): EffectivePlacement {
  if (setting === 'push') {
    return windowWidth >= PUSH_MIN_WIDTH ? { mode: 'push', side: 'right', fallback: false } : { mode: 'overlay', side: 'right', fallback: true };
  }
  return { mode: 'overlay', side: setting, fallback: false };
}

/**
 * The drawer tucks into a tab only when it overlays the page, pin mode is on, no
 * composer is open, and the user hasn't expanded it by hand (the tab, a marker).
 */
export function shouldTuck(s: { mode: EffectivePlacement['mode']; pinMode: boolean; composerOpen: boolean; expanded: boolean }): boolean {
  return s.mode === 'overlay' && s.pinMode && !s.composerOpen && !s.expanded;
}

type StorageGetter = () => Pick<Storage, 'getItem' | 'setItem'> | null | undefined;

// `window.localStorage` itself can throw (blocked site data), so it's read lazily.
const defaultStorage: StorageGetter = () => window.localStorage;

/** The remembered setting; `push` when nothing valid is stored or storage is unavailable. */
export function readPlacement(storage: StorageGetter = defaultStorage): Placement {
  try {
    const v = storage()?.getItem(STORAGE_KEY);
    return isPlacement(v) ? v : 'push';
  } catch {
    return 'push';
  }
}

/** Remember the setting. Never throws; an unavailable store just means it isn't remembered. */
export function writePlacement(p: Placement, storage: StorageGetter = defaultStorage): void {
  try {
    storage()?.setItem(STORAGE_KEY, p);
  } catch {
    // private mode / blocked storage: the setting lasts for this page only
  }
}

/**
 * Push mode's effect on the page: one <style> element in <head> that narrows the
 * root element. Nothing is set on `html` or `body` themselves, so removing the
 * element restores the page exactly. Fixed-position page elements still span the
 * viewport (accepted limitation).
 */
export class PagePush {
  private style: HTMLStyleElement | null = null;

  get active(): boolean {
    return this.style !== null;
  }

  apply(width: number): void {
    const css = `html { margin-right: ${width}px !important; width: auto !important; }`;
    if (!this.style) {
      this.style = document.createElement('style');
      (document.head ?? document.documentElement).append(this.style);
    }
    if (this.style.textContent !== css) this.style.textContent = css;
  }

  release(): void {
    this.style?.remove();
    this.style = null;
  }
}
