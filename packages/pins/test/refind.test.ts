// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { capture } from '../src/toolbar/capture.js';
import { findPinElement } from '../src/toolbar/refind.js';
import type { Anchor } from '../src/types.js';

// The playground page as the dev server renders it (trimmed).
const card = (n: number, title = `Card ${n} title`) => `
  <article data-pins-src="src/components/FeatureCard.astro:13:1" class="feature-card">
    <div data-pins-src="src/components/FeatureCard.astro:15:3" class="feature-card__body">
      <h3 data-pins-src="src/components/FeatureCard.astro:17:5">${title}</h3>
      <p data-pins-src="src/components/FeatureCard.astro:18:5">Text ${n}</p>
    </div>
  </article>`;

const page = (cards: string) => `
  <main data-pins-src="src/layouts/Base.astro:36:5">
    <section data-pins-src="src/pages/index.astro:37:3" class="hero"><h1 data-pins-src="src/pages/index.astro:40:7">Hello</h1></section>
    <section data-pins-src="src/pages/index.astro:50:3" class="features">
      <div data-pins-src="src/pages/index.astro:54:7" class="grid">${cards}</div>
    </section>
  </main>`;

beforeEach(() => {
  document.body.innerHTML = page(card(1) + card(2) + card(3));
});

const h3s = () => Array.from(document.querySelectorAll('h3'));

describe('findPinElement (Decision 8)', () => {
  it('finds the element by its selector when the source file matches', () => {
    const el = h3s()[1]!;
    expect(findPinElement(capture(el))).toBe(el);
  });

  it('accepts a selector match whose nearest source is the same file on another line', () => {
    const anchor = capture(h3s()[1]!);
    const el = h3s()[1]!;
    el.setAttribute('data-pins-src', 'src/components/FeatureCard.astro:19:5'); // markup above it grew
    expect(findPinElement(anchor)).toBe(el);
  });

  it('rejects a selector match from a different file and falls back to source + text', () => {
    const target = h3s()[1]!;
    const anchor = capture(target);
    // Something else now sits where the selector points: the selector matches an
    // element from index.astro. The real title moved, but kept its source + text.
    const imposter = document.createElement('h3');
    imposter.setAttribute('data-pins-src', 'src/pages/index.astro:60:1');
    imposter.textContent = 'Imposter';
    target.replaceWith(imposter);
    const moved = document.createElement('h3');
    moved.setAttribute('data-pins-src', 'src/components/FeatureCard.astro:17:5');
    moved.textContent = 'Card 2 title';
    document.querySelector('.hero')!.append(moved);
    expect(document.querySelector(anchor.selector)).toBe(imposter);
    expect(findPinElement(anchor)).toBe(moved);
  });

  it('falls back to the one element with the exact source and the same text', () => {
    const anchor = { ...capture(h3s()[2]!), selector: 'body > nope' };
    expect(findPinElement(anchor)).toBe(h3s()[2]);
  });

  it('is lost when the source + text fallback matches more than one element', () => {
    document.body.innerHTML = page(card(1, 'Same') + card(2, 'Same'));
    const anchor = { ...capture(h3s()[0]!), selector: 'body > nope' };
    expect(findPinElement(anchor)).toBeNull();
  });

  it('is lost when the source matches but the text changed', () => {
    const anchor = { ...capture(h3s()[1]!), selector: 'body > nope', text: 'Old title' };
    expect(findPinElement(anchor)).toBeNull();
  });

  it('is lost when the element was removed (M2 exit verify step 9)', () => {
    const anchor = capture(h3s()[1]!);
    for (const el of h3s()) el.remove();
    expect(findPinElement(anchor)).toBeNull();
  });

  it('is lost when the selector now hits a different file and nothing matches the source', () => {
    const anchor = capture(document.querySelector('h1')!);
    document.querySelector('h1')!.setAttribute('data-pins-src', 'src/components/Other.astro:1:1');
    expect(findPinElement(anchor)).toBeNull();
  });

  it('with no recorded source, accepts only a selector match that has no source either', () => {
    document.body.innerHTML = '<div><span>plain</span></div>';
    const anchor: Anchor = { source: null, sourceChain: [], selector: 'body > div > span', text: 'plain', tag: 'span' };
    expect(findPinElement(anchor)).toBe(document.querySelector('span'));
    document.querySelector('div')!.setAttribute('data-pins-src', 'src/x.astro:1:1');
    expect(findPinElement(anchor)).toBeNull();
  });

  it('survives an invalid selector and missing or malformed anchors', () => {
    const anchor = { ...capture(h3s()[0]!), selector: 'h3[[[' };
    expect(findPinElement(anchor)).toBe(h3s()[0]);
    expect(findPinElement(undefined)).toBeNull();
    expect(findPinElement(null)).toBeNull();
    expect(findPinElement({})).toBeNull();
    expect(findPinElement({ selector: 42 as unknown as string })).toBeNull();
  });
});
