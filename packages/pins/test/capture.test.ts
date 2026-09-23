// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSelector, capture, snippet, sourceInfo } from '../src/toolbar/capture.js';

// A trimmed copy of the playground page as the dev server renders it.
const card = (n: number) => `
  <article data-pins-src="src/components/FeatureCard.astro:13:1" class="feature-card">
    <img data-pins-src="src/components/FeatureCard.astro:14:3" alt="Card ${n} image">
    <div data-pins-src="src/components/FeatureCard.astro:15:3" class="feature-card__body">
      <h3 data-pins-src="src/components/FeatureCard.astro:17:5" class="feature-card__title">Card
        ${n}   title</h3>
      <p data-pins-src="src/components/FeatureCard.astro:18:5">Text ${n} <strong>bold</strong></p>
    </div>
  </article>`;

beforeEach(() => {
  document.body.innerHTML = `
    <header data-pins-src="src/layouts/Base.astro:22:5"><a href="/">Home</a></header>
    <main data-pins-src="src/layouts/Base.astro:36:5">
      <section data-pins-src="src/pages/index.astro:37:3" class="hero"><a href="/subscribe">Go</a></section>
      <section data-pins-src="src/pages/index.astro:50:3" class="features">
        <h2 id="features-heading">Why</h2>
        <div data-pins-src="src/pages/index.astro:54:7" class="features__grid">${card(1)}${card(2)}${card(3)}</div>
      </section>
      <section id="dup"></section><div id="dup"><span>dup id</span></div>
    </main>`;
});

const cards = () => Array.from(document.querySelectorAll('article'));

describe('sourceInfo', () => {
  it('uses the nearest annotated element and walks distinct files up', () => {
    const strong = cards()[1]!.querySelector('strong')!;
    expect(sourceInfo(strong)).toEqual({
      source: 'src/components/FeatureCard.astro:18:5',
      sourceChain: ['src/components/FeatureCard.astro', 'src/pages/index.astro', 'src/layouts/Base.astro'],
    });
  });

  it('returns null source for an element with no annotated ancestor', () => {
    const div = document.createElement('div');
    document.body.append(div);
    expect(sourceInfo(div)).toEqual({ source: null, sourceChain: [] });
  });
});

describe('buildSelector', () => {
  it('matches only the second card title', () => {
    const h3 = cards()[1]!.querySelector('h3')!;
    const sel = buildSelector(h3);
    expect(document.querySelectorAll(sel)).toHaveLength(1);
    expect(document.querySelector(sel)).toBe(h3);
    expect(sel).toContain('article:nth-of-type(2)');
  });

  it('anchors from the nearest unique id', () => {
    const h2 = document.getElementById('features-heading')!;
    expect(buildSelector(h2)).toBe('#features-heading');
  });

  it('ignores duplicate ids and falls back to a body path', () => {
    const span = document.querySelector('div#dup span')!;
    const sel = buildSelector(span);
    expect(sel.startsWith('body > ')).toBe(true);
    expect(document.querySelectorAll(sel)).toHaveLength(1);
    expect(document.querySelector(sel)).toBe(span);
  });

  it('is unique for every element on the page', () => {
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const sel = buildSelector(el);
      expect(document.querySelectorAll(sel), sel).toHaveLength(1);
      expect(document.querySelector(sel)).toBe(el);
    }
  });
});

describe('snippet / capture', () => {
  it('collapses whitespace and falls back to alt', () => {
    expect(snippet(cards()[1]!.querySelector('h3')!)).toBe('Card 2 title');
    expect(snippet(cards()[2]!.querySelector('img')!)).toBe('Card 3 image');
  });

  it('truncates long text', () => {
    const p = document.createElement('p');
    p.textContent = 'x'.repeat(500);
    document.body.append(p);
    expect(snippet(p)).toHaveLength(160);
  });

  it('captures all anchors for the clicked element', () => {
    const h3 = cards()[1]!.querySelector('h3')!;
    expect(capture(h3)).toMatchObject({
      source: 'src/components/FeatureCard.astro:17:5',
      text: 'Card 2 title',
      tag: 'h3',
    });
  });
});
