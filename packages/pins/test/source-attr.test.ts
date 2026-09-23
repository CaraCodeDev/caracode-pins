import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, transform } from '@astrojs/compiler-rs';
import { describe, expect, it } from 'vitest';
import { annotateAstroSource } from '../src/source-attr.js';

const playground = (p: string) =>
  readFileSync(fileURLToPath(new URL(`../../../playground/${p}`, import.meta.url)), 'utf8');

/** `tag → [loc, …]` in document order, read back from the annotated output. */
function locs(code: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of code.matchAll(/<([a-zA-Z][\w.:-]*)\s+data-pins-src="([^"]+)"/g)) out.push([m[1]!, m[2]!]);
  return out;
}

/** Where each tag's `<` really sits in the original, as `line:col`. */
function realPos(src: string, needle: string, from = 0): string {
  const i = src.indexOf(needle, from);
  if (i < 0) throw new Error(`not found: ${needle}`);
  const before = src.slice(0, i).split('\n');
  return `${before.length}:${before.at(-1)!.length + 1}`;
}

describe('annotateAstroSource: playground files', () => {
  it('FeatureCard: article at 13:1 and children at their real lines', () => {
    const src = playground('src/components/FeatureCard.astro');
    const out = annotateAstroSource(src, 'src/components/FeatureCard.astro')!;
    expect(locs(out.code)).toEqual([
      ['article', 'src/components/FeatureCard.astro:13:1'],
      ['img', 'src/components/FeatureCard.astro:14:3'],
      ['div', 'src/components/FeatureCard.astro:15:3'],
      ['img', 'src/components/FeatureCard.astro:16:5'],
      ['h3', 'src/components/FeatureCard.astro:17:5'],
      ['p', 'src/components/FeatureCard.astro:18:5'],
    ]);
    // Frontmatter is untouched.
    expect(out.code.slice(0, src.indexOf('<article'))).toBe(src.slice(0, src.indexOf('<article')));
  });

  it('index.astro: every plain element matches the file, components skipped', () => {
    const src = playground('src/pages/index.astro');
    const out = annotateAstroSource(src, 'src/pages/index.astro')!;
    const found = locs(out.code);
    expect(found.map(([t]) => t)).not.toContain('Base');
    expect(found.map(([t]) => t)).not.toContain('FeatureCard');
    expect(out.code).toContain('<Base\n'); // component tag unchanged
    expect(out.code).toContain('<FeatureCard {...feature} />');
    // Each annotation points at the matching `<tag` in the original file.
    let cursor = src.indexOf('<Base');
    for (const [tag, loc] of found) {
      const i = src.indexOf(`<${tag}`, cursor);
      expect(loc).toBe(`src/pages/index.astro:${realPos(src, `<${tag}`, cursor)}`);
      cursor = i + 1;
    }
    expect(found.length).toBe(17);
    expect(found[0]).toEqual(['section', `src/pages/index.astro:${realPos(src, '<section class="hero"')}`]);
    expect(found).toContainEqual([
      'a',
      `src/pages/index.astro:${realPos(src, '<a class="button button--light"')}`,
    ]);
  });

  it('Base.astro: nothing in <head>, no html/head/slot; body content annotated', () => {
    const src = playground('src/layouts/Base.astro');
    const out = annotateAstroSource(src, 'src/layouts/Base.astro')!;
    const tags = locs(out.code).map(([t]) => t);
    for (const skipped of ['html', 'head', 'meta', 'link', 'title', 'slot']) expect(tags).not.toContain(skipped);
    expect(tags.slice(0, 3)).toEqual(['body', 'header', 'div']);
    expect(out.code).toContain('<slot />');
    expect(out.code).toContain('<meta charset="utf-8" />');
  });
});

describe('annotateAstroSource: edge cases', () => {
  const src = [
    '---', // 1
    'const x = "<div>héllo — 🎉</div>";', // 2  (markup-looking string in frontmatter)
    'const items = [1, 2];', // 3
    '---', // 4
    '<!-- <div>commented</div> -->', // 5
    `<p data-x="a > b" title='q"q' class={x}>é 🎉 <span>{x}</span></p>`, // 6
    '<Fragment><em>in fragment</em></Fragment>', // 7
    '<Foo.Bar><i>dotted</i></Foo.Bar>', // 8
    '<slot name="x" />', // 9
    '<ul>{items.map((i) => <li class={`i-${i}`}>{i > 1 ? <b>big</b> : "small"}</li>)}</ul>', // 10
    '<my-el is:raw>{not an expr <u>raw</u>}</my-el>', // 11
    '<svg viewBox="0 0 1 1"><path d="M0 0" /></svg>', // 12
    '<script>const a = "<div>";</script>', // 13
    '<style>div > p { color: red; }</style>', // 14
    '<input disabled>', // 15
    '<img src="/a.png" alt="" />', // 16
    '<div data-pins-src="keep:1:1">kept</div>', // 17
    '<div set:html={"<b>x</b>"} />', // 18
    '<script is:inline>1</script>', // 19
    '<Astro.self />', // 20
  ].join('\n');
  const out = annotateAstroSource(src, 'src/t.astro')!;
  const found = locs(out.code);
  const at = (tag: string) => found.filter(([t]) => t === tag).map(([, l]) => l);

  it('annotates plain elements with 1-based line:col', () => {
    expect(at('p')).toEqual(['src/t.astro:6:1']);
    // Column is in UTF-16 code units, after "é 🎉 " (é=1, 🎉=2).
    expect(at('span')).toEqual([`src/t.astro:6:${src.split('\n')[5]!.indexOf('<span') + 1}`]);
    expect(at('em')).toEqual(['src/t.astro:7:11']);
    expect(at('i')).toEqual(['src/t.astro:8:10']);
    expect(at('input')).toEqual(['src/t.astro:15:1']);
    expect(at('img')).toEqual(['src/t.astro:16:1']);
    expect(at('svg')).toEqual(['src/t.astro:12:1']);
    expect(at('path')).toEqual(['src/t.astro:12:24']);
    expect(at('my-el')).toEqual(['src/t.astro:11:1']);
  });

  it('annotates markup written inside expressions', () => {
    expect(at('ul')).toEqual(['src/t.astro:10:1']);
    expect(at('li')).toEqual([`src/t.astro:10:${src.split('\n')[9]!.indexOf('<li') + 1}`]);
    expect(at('b')).toEqual([`src/t.astro:10:${src.split('\n')[9]!.indexOf('<b>') + 1}`]);
  });

  it('skips components, Fragment, slot, script, style, raw content, frontmatter, comments', () => {
    const tags = found.map(([t]) => t);
    for (const t of ['Fragment', 'Foo.Bar', 'slot', 'script', 'style', 'u', 'Astro.self']) {
      expect(tags).not.toContain(t);
    }
    expect(out.code).toContain('const x = "<div>héllo — 🎉</div>";');
    expect(out.code).toContain('<!-- <div>commented</div> -->');
    expect(out.code).toContain('<script>const a = "<div>";</script>');
    expect(out.code).toContain('{not an expr <u>raw</u>}');
  });

  it('leaves existing data-pins-src alone', () => {
    expect(out.code).toContain('<div data-pins-src="keep:1:1">kept</div>');
    expect(out.code.match(/data-pins-src/g)!.length).toBe(found.length);
  });

  it('keeps attributes with > and quotes, self-closing and void tags intact', () => {
    expect(out.code).toContain(`<p data-pins-src="src/t.astro:6:1" data-x="a > b" title='q"q' class={x}>`);
    expect(out.code).toContain('<img data-pins-src="src/t.astro:16:1" src="/a.png" alt="" />');
    expect(out.code).toContain('<input data-pins-src="src/t.astro:15:1" disabled>');
    expect(out.code).toContain(`<div data-pins-src="src/t.astro:18:1" set:html={"<b>x</b>"} />`);
  });

  it('only inserts text: removing the attributes gives back the original', () => {
    expect(out.code.replace(/ data-pins-src="src\/t\.astro:\d+:\d+"/g, '')).toBe(src);
  });

  it('output still parses and compiles cleanly', () => {
    expect(parse(out.code).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const compiled = transform(out.code, { filename: '/x/src/t.astro' });
    expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(compiled.code).toContain('data-pins-src');
  });

  it('is idempotent', () => {
    expect(annotateAstroSource(out.code, 'src/t.astro')).toBeNull();
  });

  it('escapes the path in the attribute', () => {
    const r = annotateAstroSource('<div></div>', 'src/a"b&c.astro')!;
    expect(r.code).toBe('<div data-pins-src="src/a&quot;b&amp;c.astro:1:1"></div>');
  });

  it('returns null for files with nothing to annotate or parse errors', () => {
    expect(annotateAstroSource('---\nconst a = 1;\n---\n<Foo />', 'x.astro')).toBeNull();
    expect(annotateAstroSource('<div>{</div>', 'x.astro')).toBeNull();
  });

  it('handles CRLF line endings', () => {
    const r = annotateAstroSource('---\r\nconst a = 1;\r\n---\r\n\r\n  <div></div>', 'x.astro')!;
    expect(locs(r.code)).toEqual([['div', 'x.astro:5:3']]);
  });
});
