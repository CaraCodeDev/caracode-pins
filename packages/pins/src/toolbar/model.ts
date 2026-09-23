/**
 * Pure helpers the panel and markers share: numbering (Decision 7), the status
 * filter (Decision 3), and reading hand-edited pins defensively. No DOM.
 */
import type { Comment, Pin } from '../types.js';

export interface NumberedPin {
  pin: Pin;
  /** 1-based position in the file, counting done pins (Decision 7). */
  number: number;
}

/** Every pin with its stable number: its position in the file. */
export function numberPins(pins: readonly Pin[]): NumberedPin[] {
  return pins.map((pin, i) => ({ pin, number: i + 1 }));
}

/**
 * The pin's status as written. A hand edit may leave it missing or set something
 * unknown (e.g. `wip`); a missing one reads as `open`, an unknown one is kept.
 */
export function statusOf(pin: Pin): string {
  return typeof pin?.status === 'string' && pin.status ? pin.status : 'open';
}

/** Decision 3: done pins are hidden unless `showDone`. Order (and numbers) kept. */
export function filterPins(pins: readonly NumberedPin[], showDone: boolean): NumberedPin[] {
  return showDone ? [...pins] : pins.filter((p) => statusOf(p.pin) !== 'done');
}

/** Comments that look like comments; a hand edit may break some. */
export function commentsOf(pin: Pin): Comment[] {
  if (!Array.isArray(pin?.comments)) return [];
  return pin.comments.filter((c): c is Comment => Boolean(c) && typeof c === 'object' && typeof c.text === 'string');
}

/** First non-empty line of the pin's first comment, trimmed. Empty if there is none. */
export function firstLine(pin: Pin): string {
  const first = commentsOf(pin)[0];
  if (!first) return '';
  return (
    first.text
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) ?? ''
  );
}

/** The most recent comment by Claude, if any. */
export function latestClaudeComment(pin: Pin): Comment | undefined {
  return commentsOf(pin)
    .filter((c) => c.author === 'claude')
    .at(-1);
}

/** Counts for the subbar: how many rows are shown, and how many await review. */
export function countSummary(pins: readonly NumberedPin[], showDone: boolean): { shown: number; review: number; done: number } {
  let review = 0;
  let done = 0;
  for (const { pin } of pins) {
    const s = statusOf(pin);
    if (s === 'review') review++;
    if (s === 'done') done++;
  }
  return { shown: showDone ? pins.length : pins.length - done, review, done };
}

/** `src/components/FeatureCard.astro:17:5` → `FeatureCard.astro` */
export function baseName(file: string): string {
  return file.replace(/:\d+:\d+$/, '').split('/').at(-1) ?? file;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Short relative age for list rows: `now`, `12m`, `2h`, `yesterday`, `3d`. Empty if unparseable. */
export function relativeTime(iso: string | undefined, now: Date): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return '';
  const diff = now.getTime() - t;
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  if (diff < 2 * DAY) return 'yesterday';
  return `${Math.floor(diff / DAY)}d`;
}

/** Comment timestamps: `13:41` today, `Yesterday, 13:41`, else `3 Sep, 13:41`. Local time. */
export function clockTime(iso: string | undefined, now: Date): string {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return '';
  const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(t)) / DAY);
  if (days === 0) return hm;
  if (days === 1) return `Yesterday, ${hm}`;
  const month = t.toLocaleString('en', { month: 'short' });
  return `${t.getDate()} ${month}, ${hm}`;
}
