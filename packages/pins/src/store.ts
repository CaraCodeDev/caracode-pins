import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { keyToPath } from './pages.js';
import type { CapturedPin, Pin, PinFile } from './types.js';

export const PIN_DIR = '.carapin';

/** Absolute path of a page's pin file, or null if the key escapes the folder. */
export function pinFilePath(siteRoot: string, key: string): string | null {
  const dir = path.resolve(siteRoot, PIN_DIR);
  const file = path.resolve(dir, `${key}.json`);
  const rel = path.relative(dir, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return file;
}

/** Page key for a file inside `.carapin/`, or null if it isn't a pin file. */
export function keyForFile(siteRoot: string, file: string): string | null {
  const dir = path.resolve(siteRoot, PIN_DIR);
  const rel = path.relative(dir, path.resolve(file));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !rel.endsWith('.json')) return null;
  return rel.slice(0, -'.json'.length).split(path.sep).join('/');
}

/**
 * Reads a page's pins fresh from disk. A missing file is an empty page; a file
 * that isn't valid JSON throws, so callers never overwrite a hand edit in progress.
 */
export async function readPins(siteRoot: string, key: string): Promise<PinFile> {
  const file = pinFilePath(siteRoot, key);
  if (!file) throw new Error(`Invalid page key: ${key}`);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { page: keyToPath(key), pins: [] };
    throw err;
  }
  const data = JSON.parse(raw) as Partial<PinFile>;
  return {
    ...data,
    page: typeof data.page === 'string' ? data.page : keyToPath(key),
    pins: Array.isArray(data.pins) ? data.pins : [],
  };
}

/**
 * Appends a pin. Re-reads the file first and holds nothing in memory, so edits
 * made on disk since the last write survive (notes/spec.md → "Non-functional
 * requirements").
 */
export async function appendPin(siteRoot: string, key: string, captured: CapturedPin): Promise<PinFile> {
  const file = pinFilePath(siteRoot, key);
  if (!file) throw new Error(`Invalid page key: ${key}`);
  const current = await readPins(siteRoot, key);
  const pin: Pin = {
    id: randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    note: '',
    source: captured.source,
    sourceChain: captured.sourceChain,
    selector: captured.selector,
    text: captured.text,
    tag: captured.tag,
  };
  const next: PinFile = { ...current, pins: [...current.pins, pin] };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

/** Keeps only the fields we expect from the browser, with the right types. */
export function sanitizeCaptured(input: unknown): CapturedPin | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : null);
  const selector = str(o.selector);
  if (!selector) return null;
  return {
    source: str(o.source),
    sourceChain: Array.isArray(o.sourceChain)
      ? o.sourceChain.filter((s): s is string => typeof s === 'string').slice(0, 50)
      : [],
    selector,
    text: str(o.text) ?? '',
    tag: str(o.tag, 64) ?? '',
  };
}
