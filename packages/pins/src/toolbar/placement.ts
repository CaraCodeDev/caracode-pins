/**
 * Where each marker sits (M2 "Open questions" → Marker placement): centred on the
 * top-left corner of its element's box, nudged inside the visible page area. If
 * two markers land on exactly the same spot (e.g. the same element pinned twice),
 * the later one is offset to the right. Pure: rectangles in, positions out.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MarkerInput<K> {
  key: K;
  /** The element's box in viewport coordinates; null when it isn't rendered. */
  rect: Box | null;
}

export interface MarkerPosition {
  /** Top-left of the marker, viewport coordinates. */
  x: number;
  y: number;
}

/**
 * @param items  in pin-number order; "later" means later in this list.
 * @param area   the visible page area (the viewport minus the drawer).
 * @param size   marker diameter in px.
 * @returns a position for every marker to show; elements entirely outside the
 *          area (scrolled away, under the drawer) or not rendered get none.
 */
export function placeMarkers<K>(items: readonly MarkerInput<K>[], area: Box, size: number): Map<K, MarkerPosition> {
  const placed = new Map<K, MarkerPosition>();
  const taken = new Set<string>();
  const half = size / 2;
  for (const { key, rect } of items) {
    if (!rect) continue;
    const outside = rect.bottom < area.top || rect.top > area.bottom || rect.right < area.left || rect.left > area.right;
    if (outside) continue;
    let x = clamp(rect.left - half, area.left, area.right - size);
    const y = clamp(rect.top - half, area.top, area.bottom - size);
    while (taken.has(`${x},${y}`)) x += size + 2;
    taken.add(`${x},${y}`);
    placed.set(key, { x, y });
  }
  return placed;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, Math.max(min, max)));
}
