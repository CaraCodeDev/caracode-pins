import { parse } from '@astrojs/compiler-rs';
import MagicString from 'magic-string';

/** Attribute carapin adds to plain elements in dev: `<file>:<line>:<col>`, 1-based. */
export const SOURCE_ATTR = 'data-pins-src';

/**
 * Plain HTML tags that never get the attribute. `html`/`head` are document
 * scaffolding, the rest are head-level or non-rendered. Anything inside `<head>`
 * is skipped too (see `walk`).
 */
const SKIP_TAGS = new Set([
  'html',
  'head',
  'meta',
  'link',
  'title',
  'base',
  'script',
  'style',
  'slot',
  'fragment',
]);

export interface AnnotateResult {
  code: string;
  map: ReturnType<MagicString['generateMap']>;
  /** Number of elements annotated. */
  count: number;
}

/**
 * Adds `data-pins-src="<relPath>:<line>:<col>"` to every plain HTML element in
 * an `.astro` file's template. Positions are for `code` as given (the file on
 * disk), 1-based, columns in UTF-16 code units (what editors report).
 *
 * Uses Astro's own compiler parser, so frontmatter, `{expressions}`, `<script>`,
 * `<style>` and `is:raw` content are understood rather than guessed at. Markup
 * written inside an expression (`{items.map(i => <li>…</li>)}`) is markup and is
 * annotated.
 *
 * Returns null when there's nothing to change or the file doesn't parse cleanly
 * (Astro reports the parse error itself; we must not make it worse).
 */
export function annotateAstroSource(code: string, relPath: string): AnnotateResult | null {
  let ast: Record<string, unknown>;
  try {
    const result = parse(code);
    if (result.diagnostics.some((d) => d.severity === 'error')) return null;
    ast = result.ast;
  } catch {
    return null;
  }

  const lineStarts = computeLineStarts(code);
  const attrPath = escapeAttr(relPath);
  const s = new MagicString(code);
  let count = 0;

  const walk = (node: unknown, inHead: boolean): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, inHead);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;

    let childInHead = inHead;
    if (n.type === 'JSXElement') {
      const opening = n.openingElement as JsxOpening | undefined;
      const name = opening?.name;
      if (opening && name?.type === 'JSXIdentifier' && typeof name.name === 'string') {
        const tag = name.name;
        if (tag === 'head') childInHead = true;
        if (!inHead && isPlainElement(tag) && !hasAttr(opening, SOURCE_ATTR)) {
          const { line, col } = position(lineStarts, opening.start);
          s.appendLeft(name.end, ` ${SOURCE_ATTR}="${attrPath}:${line}:${col}"`);
          count++;
        }
      }
    }

    for (const key of Object.keys(n)) {
      // Frontmatter is TypeScript, never markup.
      if (key === 'frontmatter') continue;
      const value = n[key];
      if (value && typeof value === 'object') walk(value, childInHead);
    }
  };

  walk(ast, false);
  if (count === 0) return null;
  return {
    code: s.toString(),
    map: s.generateMap({ hires: 'boundary', source: relPath, includeContent: true }),
    count,
  };
}

interface JsxOpening {
  start: number;
  name?: { type: string; name?: string; start: number; end: number };
  attributes?: Array<{ type: string; name?: { type: string; name?: string } }>;
}

/** Lowercase, un-dotted, un-namespaced names are HTML (or custom elements). */
function isPlainElement(tag: string): boolean {
  const first = tag.charAt(0);
  if (first !== first.toLowerCase() || first === first.toUpperCase()) return false;
  return !SKIP_TAGS.has(tag);
}

function hasAttr(opening: JsxOpening, attr: string): boolean {
  return (opening.attributes ?? []).some(
    (a) => a.type === 'JSXAttribute' && a.name?.type === 'JSXIdentifier' && a.name.name === attr,
  );
}

function computeLineStarts(code: string): number[] {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10 /* \n */) starts.push(i + 1);
  }
  return starts;
}

/** 1-based line and column for a string offset. */
export function position(lineStarts: number[], offset: number): { line: number; col: number } {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: offset - lineStarts[lo]! + 1 };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
