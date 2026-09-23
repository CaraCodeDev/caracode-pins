/** Tiny element builder for the panel. Text is always set as text, never HTML. */

type Child = Node | string | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  attrs?: Record<string, string | boolean | undefined>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) {
    if (value === false || value === undefined) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  for (const [type, fn] of Object.entries(props.on ?? {})) {
    el.addEventListener(type, fn as EventListener);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** A button with the panel's base class. */
export function button(label: string | Node[], cls: string, onClick: (e: MouseEvent) => void, attrs: Props['attrs'] = {}): HTMLButtonElement {
  const b = h('button', { class: `cp-btn ${cls}`.trim(), attrs: { type: 'button', ...attrs }, on: { click: onClick } });
  if (typeof label === 'string') b.textContent = label;
  else b.append(...label);
  return b;
}

// Static, trusted SVG markup (from the mockup), parsed once per use.
const ICONS = {
  pin: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 14s4-4.2 4-7.5a4 4 0 0 0-8 0C4 9.8 8 14 8 14Z"/><circle cx="8" cy="6.5" r="1.4"/></svg>',
  close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8h5.8l.6-8"/></svg>',
  alert: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4M8 11v.5"/></svg>',
} as const;

export function icon(name: keyof typeof ICONS): SVGElement {
  const t = document.createElement('template');
  t.innerHTML = ICONS[name];
  return t.content.firstElementChild as SVGElement;
}

/** `⌘` on Apple platforms, `Ctrl` elsewhere. */
export const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

export function kbd(...keys: string[]): Node[] {
  return keys.map((k) => h('kbd', { text: k }));
}
