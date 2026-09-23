import { describe, expect, it } from 'vitest';
import { placeMarkers, type Box } from '../src/toolbar/placement.js';

const area: Box = { left: 0, top: 0, right: 1000, bottom: 800 };
const box = (left: number, top: number, w = 100, h = 40): Box => ({ left, top, right: left + w, bottom: top + h });

describe('placeMarkers', () => {
  it('centres the marker on the element box top-left corner', () => {
    const p = placeMarkers([{ key: 1, rect: box(200, 300) }], area, 20);
    expect(p.get(1)).toEqual({ x: 190, y: 290 });
  });

  it('nudges a marker inside the visible area', () => {
    const p = placeMarkers(
      [
        { key: 'top-left', rect: box(0, 0) },
        { key: 'scrolled-up', rect: box(300, -30) }, // top edge above the viewport, still partly visible
        { key: 'under-drawer', rect: box(990, 100) },
      ],
      area,
      20,
    );
    expect(p.get('top-left')).toEqual({ x: 0, y: 0 });
    expect(p.get('scrolled-up')).toEqual({ x: 290, y: 0 });
    expect(p.get('under-drawer')).toEqual({ x: 980, y: 90 });
  });

  it('shows no marker for elements outside the area or not rendered', () => {
    const p = placeMarkers(
      [
        { key: 'below', rect: box(100, 900) },
        { key: 'above', rect: box(100, -200) },
        { key: 'behind-drawer', rect: box(1100, 100) },
        { key: 'hidden', rect: null },
      ],
      area,
      20,
    );
    expect(p.size).toBe(0);
  });

  it('offsets later markers that would land exactly on an earlier one', () => {
    const same = box(200, 300);
    const p = placeMarkers(
      [
        { key: 1, rect: same },
        { key: 2, rect: same },
        { key: 3, rect: same },
        { key: 4, rect: box(205, 300) }, // near but not exact: left alone
      ],
      area,
      20,
    );
    expect(p.get(1)).toEqual({ x: 190, y: 290 });
    expect(p.get(2)).toEqual({ x: 212, y: 290 });
    expect(p.get(3)).toEqual({ x: 234, y: 290 });
    expect(p.get(4)).toEqual({ x: 195, y: 290 });
  });
});
