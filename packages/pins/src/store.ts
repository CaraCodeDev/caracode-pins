import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { keyToPath } from './pages.js';
import type { Anchor, Author, Comment, Pin, PinFile, PinStatus } from './types.js';

export const PIN_DIR = '.carapin';

/** Longest note or reply the server accepts, in UTF-16 code units. */
export const TEXT_MAX = 20_000;

export type PinErrorCode = 'invalid-key' | 'invalid-file' | 'invalid-input' | 'not-found' | 'empty-text';

/** An expected failure: reported to the panel, never a crash. */
export class PinError extends Error {
  constructor(
    readonly code: PinErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PinError';
  }
}

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

function fileFor(siteRoot: string, key: string): string {
  const file = pinFilePath(siteRoot, key);
  if (!file) throw new PinError('invalid-key', `Invalid page key: ${key}`);
  return file;
}

/**
 * Reads a page's pins fresh from disk. A missing file is an empty page. A file
 * that isn't valid JSON, or isn't shaped like a pin file, throws, so callers
 * never overwrite a hand edit in progress.
 *
 * Unknown fields on the file and on pins come back untouched, in their order.
 * Pins are returned as written: a hand edit may leave a pin missing fields.
 */
export async function readPins(siteRoot: string, key: string): Promise<PinFile> {
  const file = fileFor(siteRoot, key);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { page: keyToPath(key), pins: [] };
    throw err;
  }
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data)) throw new PinError('invalid-file', 'The file is not a JSON object.');
  if (data.pins !== undefined && !Array.isArray(data.pins)) {
    throw new PinError('invalid-file', '"pins" is not an array.');
  }
  return {
    ...data,
    page: typeof data.page === 'string' ? data.page : keyToPath(key),
    pins: (data.pins as Pin[] | undefined) ?? [],
  };
}

/**
 * The one write path: re-read the file, apply one change, write it back. Holds
 * nothing in memory between calls, so edits made on disk since the last write
 * survive (notes/spec.md → "Non-functional requirements"). Callers serialise
 * calls per file (the server's queue). If `change` throws, nothing is written.
 */
async function updatePins(siteRoot: string, key: string, change: (file: PinFile) => PinFile): Promise<PinFile> {
  const file = fileFor(siteRoot, key);
  const next = change(await readPins(siteRoot, key));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serialize(next), 'utf8');
  return next;
}

/** Decision 1: 2-space indent, trailing newline. */
export function serialize(file: PinFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

/**
 * Decision 2: a human comment on a `review` or `done` pin reopens it; on an
 * `open` pin it stays `open`. A claude comment never changes status. A status
 * outside the documented three is left as it is.
 */
export function statusAfterComment(status: unknown, author: Author): unknown {
  if (author === 'human' && (status === 'review' || status === 'done')) return 'open' satisfies PinStatus;
  return status;
}

/** Creates a pin (status `open`) whose first comment is the note. */
export async function createPin(
  siteRoot: string,
  key: string,
  anchor: Anchor,
  text: string,
): Promise<{ file: PinFile; pin: Pin }> {
  const note = requireText(text, 'note');
  let pin!: Pin;
  const file = await updatePins(siteRoot, key, (current) => {
    const now = new Date().toISOString();
    pin = {
      id: newId(current.pins),
      status: 'open',
      createdAt: now,
      updatedAt: now,
      anchor: { ...anchor },
      comments: [{ author: 'human', text: note, at: now }],
    };
    return { ...current, pins: [...current.pins, pin] };
  });
  return { file, pin };
}

/** Adds a comment, applying Decision 2's status rule. */
export async function replyToPin(
  siteRoot: string,
  key: string,
  id: string,
  text: string,
  author: Author = 'human',
): Promise<PinFile> {
  const reply = requireText(text, 'reply');
  return updatePin(siteRoot, key, id, (pin, now) => {
    const comment: Comment = { author, text: reply, at: now };
    const comments = Array.isArray(pin.comments) ? pin.comments : [];
    return {
      ...pin,
      status: statusAfterComment(pin.status, author) as PinStatus,
      updatedAt: now,
      comments: [...comments, comment],
    };
  });
}

/** Decision 3: done from any status. */
export async function markPinDone(siteRoot: string, key: string, id: string): Promise<PinFile> {
  return updatePin(siteRoot, key, id, (pin, now) => ({ ...pin, status: 'done', updatedAt: now }));
}

export async function deletePin(siteRoot: string, key: string, id: string): Promise<PinFile> {
  return updatePins(siteRoot, key, (current) => {
    indexOfPin(current, id, key);
    return { ...current, pins: current.pins.filter((p) => !isPinWithId(p, id)) };
  });
}

/**
 * Changes one pin in place. Spreading keeps the pin's existing key order (and
 * any unknown fields); a key the pin didn't have yet goes at the end.
 */
function updatePin(
  siteRoot: string,
  key: string,
  id: string,
  change: (pin: Pin, now: string) => Pin,
): Promise<PinFile> {
  return updatePins(siteRoot, key, (current) => {
    const i = indexOfPin(current, id, key);
    const pins = [...current.pins];
    pins[i] = change(pins[i]!, new Date().toISOString());
    return { ...current, pins };
  });
}

function indexOfPin(file: PinFile, id: string, key: string): number {
  const i = file.pins.findIndex((p) => isPinWithId(p, id));
  if (i === -1) throw new PinError('not-found', `No pin ${id} in ${PIN_DIR}/${key}.json (it may have been deleted).`);
  return i;
}

function isPinWithId(p: unknown, id: string): boolean {
  return isRecord(p) && p.id === id;
}

function requireText(text: unknown, what: string): string {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) throw new PinError('empty-text', `The ${what} is empty.`);
  return t.slice(0, TEXT_MAX);
}

/** 8 hex characters, not already used on this page. */
function newId(pins: unknown[]): string {
  const taken = new Set(pins.map((p) => (isRecord(p) ? p.id : undefined)));
  let id: string;
  do id = randomUUID().slice(0, 8);
  while (taken.has(id));
  return id;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// --- Input from the browser -----------------------------------------------

/** Keeps only the anchor fields we expect from the browser, with the right types. */
export function sanitizeAnchor(input: unknown): Anchor | null {
  if (!isRecord(input)) return null;
  const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : null);
  const selector = str(input.selector);
  if (!selector) return null;
  return {
    source: str(input.source),
    sourceChain: Array.isArray(input.sourceChain)
      ? input.sourceChain.filter((s): s is string => typeof s === 'string').slice(0, 50)
      : [],
    selector,
    text: str(input.text) ?? '',
    tag: str(input.tag, 64) ?? '',
  };
}

/** A pin id from the browser: a short non-empty string, or null. */
export function sanitizeId(input: unknown): string | null {
  return typeof input === 'string' && input.length > 0 && input.length <= 200 ? input : null;
}

/** A `requestId` from the browser, echoed back on the result. */
export function sanitizeRequestId(input: unknown): string | undefined {
  return typeof input === 'string' && input.length <= 200 ? input : undefined;
}
