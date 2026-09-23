/**
 * The pin file format (M2 Decision 1) and the toolbar message contract.
 * Shared by the toolbar (browser) and the dev server, so no Node imports.
 *
 * One file per page at `<site>/.carapin/<page key>.json`:
 *
 *   { "page": "/", "pins": [ { "id", "status", "label"?, "createdAt", "updatedAt",
 *                              "anchor": { … }, "comments": [ … ] } ] }
 *
 * 2-space indent, trailing newline. Fields not listed here may appear (hand edits,
 * later versions); the server keeps them on every write. A pin in a hand-edited
 * file may be missing fields, so the panel should read defensively.
 */

export type PinStatus = 'open' | 'review' | 'done';
export const PIN_STATUSES: readonly PinStatus[] = ['open', 'review', 'done'];

/** Who wrote a comment. The panel only ever writes `human`; Claude edits the file. */
export type Author = 'human' | 'claude';

export interface Comment {
  author: Author;
  text: string;
  /** ISO timestamp. */
  at: string;
}

/** What a pin was attached to, as captured by the toolbar (Core framing, M1 Decision 5). */
export interface Anchor {
  /** Nearest annotated element: `<file>:<line>:<col>`, or null if none. */
  source: string | null;
  /** Distinct source files walking up annotated ancestors, innermost first. */
  sourceChain: string[];
  /** Selector matching only the clicked element. */
  selector: string;
  /** Trimmed visible text of the clicked element. */
  text: string;
  /** Tag name of the clicked element, lowercase. */
  tag: string;
}

/** Key order as written here is the order a new pin is written in. */
export interface Pin {
  id: string;
  status: PinStatus;
  /** Optional, e.g. `content`. No UI sets it in M2; Claude or a hand edit can. */
  label?: string;
  createdAt: string;
  updatedAt: string;
  anchor: Anchor;
  comments: Comment[];
}

export interface PinFile {
  page: string;
  pins: Pin[];
}

// --- Toolbar messages ------------------------------------------------------
//
// Client → server messages name the page by `path` (location.pathname); the
// server turns it into a page key. Mutations name pins by `id` and may carry a
// `requestId` (any string the client picks) that comes back on the `result`.
//
// Every mutation answers with one `result`. On success the server also sends a
// fresh `pins` for that page. The watcher sends `pins` whenever a pin file is
// added, changed or deleted on disk (hand edits, Claude).

/** Toolbar message names. */
export const EVENTS = {
  /** client → server: `ListRequest`. Answered with `pins`. */
  list: 'caracode-pins:list',
  /** client → server: `CreateRequest`. New pin, status `open`, one human comment. */
  create: 'caracode-pins:create',
  /** client → server: `ReplyRequest`. Human comment; `review`/`done` → `open` (Decision 2). */
  reply: 'caracode-pins:reply',
  /** client → server: `PinRequest`. Status → `done`, from any status (Decision 3). */
  done: 'caracode-pins:done',
  /** client → server: `PinRequest`. Removes the pin from the file. */
  delete: 'caracode-pins:delete',
  /** server → client: `PinsMessage`. The page's pins as they are on disk. */
  pins: 'caracode-pins:pins',
  /** server → client: `ResultMessage`. The outcome of one mutation. */
  result: 'caracode-pins:result',
} as const;

export interface ListRequest {
  path: string;
}

export interface CreateRequest {
  path: string;
  anchor: Anchor;
  /** The note: the pin's first comment. Must not be empty or whitespace. */
  text: string;
  requestId?: string;
}

export interface ReplyRequest {
  path: string;
  id: string;
  /** Must not be empty or whitespace. */
  text: string;
  requestId?: string;
}

/** For `done` and `delete`. */
export interface PinRequest {
  path: string;
  id: string;
  requestId?: string;
}

export type Operation = 'create' | 'reply' | 'done' | 'delete';

export type ResultMessage =
  | {
      ok: true;
      op: Operation;
      key: string;
      /** The pin acted on (the new pin's id for `create`). */
      id: string;
      requestId?: string;
    }
  | {
      ok: false;
      op: Operation;
      /** Null when the path couldn't be turned into a page key. */
      key: string | null;
      /** The pin named in the request, if any. */
      id?: string;
      /** Human-readable, for showing in the panel. */
      error: string;
      requestId?: string;
    };

export interface PinsMessage {
  key: string;
  pins: Pin[];
  /** Set when the file couldn't be read (e.g. invalid JSON); `pins` is then empty. */
  error?: string;
}
