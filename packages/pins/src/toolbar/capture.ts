import type { CapturedPin } from '../types.js';

/** Must match `SOURCE_ATTR` in ../source-attr.ts (kept separate: that file imports the compiler). */
const SOURCE_ATTR = 'data-pins-src';
const TEXT_MAX = 160;

/** Everything a pin records about the clicked element (Core framing, Decision 5). */
export function capture(el: Element): CapturedPin {
  const { source, sourceChain } = sourceInfo(el);
  return { source, sourceChain, selector: buildSelector(el), text: snippet(el), tag: el.localName };
}

/**
 * Source location of the nearest annotated element (self or ancestor), plus the
 * distinct files walking up annotated ancestors, innermost first.
 */
export function sourceInfo(el: Element): { source: string | null; sourceChain: string[] } {
  const nearest = el.closest(`[${SOURCE_ATTR}]`);
  const chain: string[] = [];
  for (let n = nearest; n; n = n.parentElement?.closest(`[${SOURCE_ATTR}]`) ?? null) {
    const file = fileOf(n.getAttribute(SOURCE_ATTR) ?? '');
    if (file && !chain.includes(file)) chain.push(file);
  }
  return { source: nearest?.getAttribute(SOURCE_ATTR) ?? null, sourceChain: chain };
}

/** `src/x.astro:13:1` → `src/x.astro` */
export function fileOf(loc: string): string {
  return loc.replace(/:\d+:\d+$/, '');
}

/**
 * A selector matching only `el`. Anchors from the nearest ancestor-or-self with a
 * unique `id`; otherwise a child path from `body`. `:nth-of-type` is added only
 * where a sibling shares the tag, to keep it readable.
 */
export function buildSelector(el: Element): string {
  const doc = el.ownerDocument;
  const parts: string[] = [];
  let useIds = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    parts.length = 0;
    for (let node: Element | null = el; node; node = node.parentElement) {
      if (useIds && node.id && doc.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      if (node === doc.body || node === doc.documentElement) {
        parts.unshift(node.localName);
        break;
      }
      parts.unshift(step(node));
    }
    const selector = parts.join(' > ');
    if (doc.querySelectorAll(selector).length === 1) return selector;
    useIds = false; // e.g. an id that isn't a valid anchor; fall back to the body path
  }
  return parts.join(' > ');
}

function step(node: Element): string {
  const tag = CSS.escape(node.localName);
  const parent = node.parentElement;
  if (!parent) return tag;
  const same = Array.from(parent.children).filter((c) => c.localName === node.localName);
  return same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(node) + 1})` : tag;
}

/** Visible text, whitespace collapsed and trimmed; falls back to alt / aria-label / title. */
export function snippet(el: Element): string {
  const raw = (el instanceof HTMLElement ? el.innerText : el.textContent) ?? '';
  let text = raw.replace(/\s+/g, ' ').trim();
  if (!text) {
    text = (el.getAttribute('alt') ?? el.getAttribute('aria-label') ?? el.getAttribute('title') ?? '').trim();
  }
  return text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX - 1)}…` : text;
}
