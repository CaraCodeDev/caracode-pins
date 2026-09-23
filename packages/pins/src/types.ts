/**
 * Spike pin format (M1). Provisional: M2 sets the real one (notes/spec.md →
 * "Data model"). Shared by the toolbar and the dev server.
 */
export interface Pin {
  id: string;
  createdAt: string;
  /** Rich's note. Empty in the spike. */
  note: string;
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

export interface PinFile {
  page: string;
  pins: Pin[];
}

/** What the toolbar captures; the server adds `id`, `createdAt`, `note`. */
export type CapturedPin = Omit<Pin, 'id' | 'createdAt' | 'note'>;

/** Toolbar message names. */
export const EVENTS = {
  /** client → server: `{ path }` */
  list: 'caracode-pins:list',
  /** client → server: `{ path, pin: CapturedPin }` */
  add: 'caracode-pins:add',
  /** server → client: `PinsMessage` */
  pins: 'caracode-pins:pins',
} as const;

export interface PinsMessage {
  key: string;
  pins: Pin[];
  /** Set when the file couldn't be read or written. */
  error?: string;
}
