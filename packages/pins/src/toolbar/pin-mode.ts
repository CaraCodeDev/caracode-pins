/**
 * Pin mode (M1 mechanics, kept): capture listeners on `window`, all on one
 * AbortController, so turning pin mode off removes every one of them.
 *
 * - Mouse/pointer events aimed at the page are swallowed; a click picks the element.
 * - Decision 9: Enter and Space keydowns (and their keyups, which activate
 *   buttons) aimed at the page are swallowed too.
 * - Anything inside the dev toolbar (the drawer, its inputs, the markers) is
 *   exempt: it all lives in the toolbar's shadow tree.
 */

const BLOCKED_POINTER_EVENTS = [
  'click',
  'dblclick',
  'auxclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'contextmenu',
] as const;

const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Spacebar']);

export function isToolbarEvent(e: Event): boolean {
  return e.composedPath().some((n) => n instanceof Element && n.localName === 'astro-dev-toolbar');
}

function targetOf(e: Event): Element | null {
  const t = e.target;
  if (t instanceof Element) return t;
  return t instanceof Node ? t.parentElement : null;
}

export interface PinModeHandlers {
  /** The page element under the pointer changed (null: none, or over the toolbar). */
  onHover: (el: Element | null) => void;
  /** An element was clicked in pin mode. */
  onPick: (el: Element) => void;
}

export class PinMode {
  private controller: AbortController | null = null;
  private cursorStyle: HTMLStyleElement | null = null;

  constructor(private readonly handlers: PinModeHandlers) {}

  get on(): boolean {
    return this.controller !== null;
  }

  enable(): void {
    if (this.controller) return;
    this.controller = new AbortController();
    const opts = { capture: true, signal: this.controller.signal };

    window.addEventListener(
      'pointermove',
      (e) => this.handlers.onHover(isToolbarEvent(e) ? null : targetOf(e)),
      { ...opts, passive: true },
    );

    for (const type of BLOCKED_POINTER_EVENTS) {
      window.addEventListener(
        type,
        (e) => {
          if (isToolbarEvent(e)) return; // the panel and markers stay usable
          e.preventDefault();
          e.stopImmediatePropagation();
          if (type === 'click') {
            const el = targetOf(e);
            if (el) this.handlers.onPick(el);
          }
        },
        opts,
      );
    }

    for (const type of ['keydown', 'keyup', 'keypress'] as const) {
      window.addEventListener(
        type,
        (e) => {
          if (!ACTIVATION_KEYS.has(e.key) || isToolbarEvent(e)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
        },
        opts,
      );
    }

    // Page CSS, removed when pin mode ends (the only thing carapin ever puts in
    // the page's own DOM, and only while pin mode is on).
    this.cursorStyle = document.createElement('style');
    this.cursorStyle.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
    document.head.append(this.cursorStyle);
  }

  disable(): void {
    this.controller?.abort();
    this.controller = null;
    this.cursorStyle?.remove();
    this.cursorStyle = null;
    this.handlers.onHover(null);
  }
}
