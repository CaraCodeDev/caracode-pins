// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PinMode } from '../src/toolbar/pin-mode.js';

/** Phase 5: pin mode across a view-transition swap (new <head> and <body>, same window). */
describe('PinMode across a view-transition swap', () => {
  afterEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  /** Roughly what Astro's ClientRouter swap does to the document. */
  function swap(): HTMLElement {
    for (const el of Array.from(document.head.children)) el.remove();
    const body = document.createElement('body');
    const target = document.createElement('h1');
    target.textContent = 'New page';
    body.append(target);
    document.body.replaceWith(body);
    return target;
  }

  it('keeps exactly one set of listeners and restores the cursor style', () => {
    const onPick = vi.fn();
    const onHover = vi.fn();
    const mode = new PinMode({ onPick, onHover });
    mode.enable();
    expect(document.head.querySelectorAll('style').length).toBe(1);

    const target = swap();
    expect(document.head.querySelectorAll('style').length).toBe(0);
    mode.afterSwap();
    mode.afterSwap(); // any number of navigations
    expect(mode.on).toBe(true);
    expect(document.head.querySelectorAll('style').length).toBe(1);
    expect(onHover).toHaveBeenLastCalledWith(null);

    const pageClick = vi.fn();
    target.addEventListener('click', pageClick);
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    expect(onPick).toHaveBeenCalledTimes(1); // one composer, not two
    expect(onPick).toHaveBeenCalledWith(target);
    expect(pageClick).not.toHaveBeenCalled(); // still blocked from the page

    mode.disable();
    expect(document.head.querySelectorAll('style').length).toBe(0);
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(pageClick).toHaveBeenCalledTimes(1);
  });

  it('does nothing after a swap when pin mode is off', () => {
    const mode = new PinMode({ onPick: vi.fn(), onHover: vi.fn() });
    swap();
    mode.afterSwap();
    expect(mode.on).toBe(false);
    expect(document.head.querySelectorAll('style').length).toBe(0);
  });
});
