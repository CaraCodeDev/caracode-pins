import { defineToolbarApp } from 'astro/toolbar';
import { pageKey } from '../pages.js';
import { EVENTS, type CreateRequest, type Pin, type PinsMessage, type ResultMessage } from '../types.js';
import { capture } from './capture.js';

const PANEL_HEADING = 'Pins';
const EMPTY_MESSAGE = 'No pins on this page yet.';

/** Mouse/pointer events swallowed in pin mode so the page never sees the click. */
const BLOCKED_EVENTS = [
  'click',
  'dblclick',
  'auxclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'contextmenu',
] as const;

export default defineToolbarApp({
  init(canvas, app, server) {
    const path = location.pathname;
    const key = pageKey(path);

    // --- Panel -------------------------------------------------------------
    const win = document.createElement('astro-dev-toolbar-window');
    const style = document.createElement('style');
    style.textContent = `
      h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #fff; }
      p { margin: 0; color: rgba(191, 193, 201, 1); }
      .bar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
      button { font: inherit; font-size: 14px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
        border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; }
      input { font: inherit; font-size: 14px; padding: 6px 8px; border-radius: 6px; min-width: 200px;
        border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; }
      button[aria-pressed="true"] { background: #b33ffd; border-color: #b33ffd; }
      .status { font-size: 13px; }
      .error { color: #ff8a8a; margin-bottom: 8px; }
      ol { margin: 0; padding: 0 0 0 20px; overflow-y: auto; max-height: 300px; color: #fff; }
      li { margin-bottom: 10px; font-size: 14px; }
      .meta { font-family: ui-monospace, monospace; font-size: 12px; color: rgba(191,193,201,1); word-break: break-all; }
      .note { color: #fff; }
      .overlay { position: fixed; pointer-events: none; z-index: 2147483646; display: none;
        outline: 2px solid #b33ffd; background: rgba(179,63,253,0.12); border-radius: 2px; }
      .overlay[data-saved] { outline-color: #3fd07a; background: rgba(63,208,122,0.15); }
      .overlay-label { position: absolute; left: -2px; top: -22px; white-space: nowrap; font: 12px ui-monospace, monospace;
        background: #b33ffd; color: #fff; padding: 2px 6px; border-radius: 3px; }
    `;

    const heading = document.createElement('h1');
    heading.textContent = PANEL_HEADING;

    const bar = document.createElement('div');
    bar.className = 'bar';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    // Provisional (Phase 2 replaces this with the composer): the note for the
    // next pin is typed here first, then the element is clicked.
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.placeholder = 'Note for the next pin';
    noteInput.setAttribute('aria-label', 'Note for the next pin');
    const status = document.createElement('p');
    status.className = 'status';
    bar.append(toggle, noteInput, status);

    const errorLine = document.createElement('p');
    errorLine.className = 'error';
    errorLine.hidden = true;
    const empty = document.createElement('p');
    empty.textContent = EMPTY_MESSAGE;
    const list = document.createElement('ol');

    win.append(style, heading, bar, errorLine, empty, list);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    const overlayLabel = document.createElement('span');
    overlayLabel.className = 'overlay-label';
    overlay.append(overlayLabel);

    canvas.append(win, overlay);

    const renderPins = (msg: PinsMessage) => {
      errorLine.hidden = !msg.error;
      errorLine.textContent = msg.error ?? '';
      if (msg.error) return; // keep showing the last good list
      list.replaceChildren(...msg.pins.map(renderPin));
      empty.hidden = msg.pins.length > 0;
    };

    server.on<PinsMessage>(EVENTS.pins, (msg) => {
      if (msg.key === key) renderPins(msg);
    });
    server.on<ResultMessage>(EVENTS.result, (msg) => {
      if (msg.key !== key) return;
      errorLine.hidden = msg.ok;
      errorLine.textContent = msg.ok ? '' : msg.error;
    });
    const refresh = () => server.send(EVENTS.list, { path });

    // --- Pin mode ----------------------------------------------------------
    // Every listener lives on this controller; pin mode off aborts it, so no
    // listener touches page clicks outside pin mode.
    let pinMode: AbortController | null = null;
    let hovered: Element | null = null;
    let cursorStyle: HTMLStyleElement | null = null;

    const isToolbarEvent = (e: Event) =>
      e.composedPath().some((n) => n instanceof Element && n.localName === 'astro-dev-toolbar');

    const targetOf = (e: Event): Element | null => {
      const t = e.target;
      if (t instanceof Element) return t;
      return t instanceof Node ? t.parentElement : null;
    };

    const placeOverlay = () => {
      if (!hovered || !hovered.isConnected) {
        overlay.style.display = 'none';
        return;
      }
      const r = hovered.getBoundingClientRect();
      Object.assign(overlay.style, {
        display: 'block',
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
      });
      const src = hovered.closest('[data-pins-src]')?.getAttribute('data-pins-src');
      overlayLabel.textContent = `${hovered.localName}${src ? `  ${src}` : ''}`;
    };

    const setPinMode = (on: boolean) => {
      if (on === Boolean(pinMode)) return;
      if (on) {
        pinMode = new AbortController();
        const opts = { capture: true, signal: pinMode.signal };

        window.addEventListener(
          'pointermove',
          (e) => {
            const el = isToolbarEvent(e) ? null : targetOf(e);
            if (el !== hovered) {
              hovered = el;
              overlay.removeAttribute('data-saved');
              placeOverlay();
            }
          },
          { ...opts, passive: true },
        );
        window.addEventListener('scroll', placeOverlay, { ...opts, passive: true });
        window.addEventListener('resize', placeOverlay, { ...opts, passive: true });

        for (const type of BLOCKED_EVENTS) {
          window.addEventListener(
            type,
            (e) => {
              if (isToolbarEvent(e)) return; // the panel itself stays usable
              e.preventDefault();
              e.stopImmediatePropagation();
              if (type === 'click') {
                const el = targetOf(e);
                if (el) savePin(el);
              }
            },
            opts,
          );
        }

        // The toolbar closes the open app on Escape keyup (on document). Catch
        // it first so Escape leaves pin mode and the panel stays open.
        window.addEventListener(
          'keyup',
          (e) => {
            if (e.key !== 'Escape') return;
            e.stopImmediatePropagation();
            setPinMode(false);
          },
          opts,
        );

        cursorStyle = document.createElement('style');
        cursorStyle.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
        document.head.append(cursorStyle);
      } else {
        pinMode?.abort();
        pinMode = null;
        hovered = null;
        cursorStyle?.remove();
        cursorStyle = null;
        overlay.style.display = 'none';
      }
      renderMode();
    };

    const savePin = (el: Element) => {
      if (!key) {
        status.textContent = "This page's path can't be used as a pin file name.";
        return;
      }
      const text = noteInput.value.trim();
      if (!text) {
        status.textContent = 'Type a note first, then click the element.';
        return;
      }
      server.send(EVENTS.create, { path, anchor: capture(el), text } satisfies CreateRequest);
      noteInput.value = '';
      hovered = el;
      placeOverlay();
      overlay.setAttribute('data-saved', '');
      status.textContent = 'Pin saved. Click another element, or Esc to stop.';
    };

    const renderMode = () => {
      const on = Boolean(pinMode);
      toggle.textContent = on ? 'Stop pinning' : 'Pin an element';
      toggle.setAttribute('aria-pressed', String(on));
      status.textContent = on ? 'Click an element to pin it. Esc to stop.' : '';
    };

    toggle.addEventListener('click', () => setPinMode(!pinMode));
    app.onToggled(({ state }) => {
      if (state) refresh();
      else setPinMode(false);
    });

    renderMode();
    if (key) refresh();
    else empty.textContent = "This page's path can't be used as a pin file name.";
  },
});

/** Provisional list item (Phase 2 replaces it). Hand-edited pins may lack fields. */
function renderPin(pin: Pin): HTMLLIElement {
  const li = document.createElement('li');
  const anchor = pin.anchor ?? ({} as Partial<Pin['anchor']>);
  const text = document.createElement('div');
  text.textContent = `[${pin.status ?? '?'}] ${anchor.text ? `“${anchor.text}”` : `<${anchor.tag || 'element'}>`}`;
  li.append(text);
  for (const c of Array.isArray(pin.comments) ? pin.comments : []) {
    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = `${c?.author ?? '?'}: ${c?.text ?? ''}`;
    li.append(note);
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = [anchor.source ?? '(no source location)', anchor.selector ?? ''].join('\n');
  meta.style.whiteSpace = 'pre-wrap';
  li.append(meta);
  return li;
}
