/**
 * Decision 8: finding a pin's element again. Never attaches a pin to a guess.
 *
 * 1. Try the selector. Accept the match if its nearest `data-pins-src` names
 *    the same file as `anchor.source`.
 * 2. Otherwise, take the element whose `data-pins-src` equals `anchor.source`
 *    exactly and whose snippet equals `anchor.text`, if exactly one matches.
 * 3. Otherwise the pin is lost (null).
 */
import type { Anchor } from '../types.js';
import { fileOf, snippet, SOURCE_ATTR } from './capture.js';

export function findPinElement(anchor: Partial<Anchor> | null | undefined, doc: Document = document): Element | null {
  if (!anchor || typeof anchor !== 'object') return null;
  const source = typeof anchor.source === 'string' && anchor.source ? anchor.source : null;

  // 1. Selector, checked against the source file.
  if (typeof anchor.selector === 'string' && anchor.selector) {
    let match: Element | null = null;
    try {
      match = doc.querySelector(anchor.selector);
    } catch {
      match = null; // a hand-edited selector that isn't valid CSS
    }
    if (match) {
      const nearest = match.closest(`[${SOURCE_ATTR}]`)?.getAttribute(SOURCE_ATTR) ?? null;
      const sameFile = source === null ? nearest === null : nearest !== null && fileOf(nearest) === fileOf(source);
      if (sameFile) return match;
    }
  }

  // 2. Exact source location + same text, only if unambiguous.
  if (source === null || typeof anchor.text !== 'string') return null;
  const candidates = Array.from(doc.querySelectorAll(`[${SOURCE_ATTR}]`)).filter(
    (el) => el.getAttribute(SOURCE_ATTR) === source && snippet(el) === anchor.text,
  );
  return candidates.length === 1 ? candidates[0]! : null;
}
