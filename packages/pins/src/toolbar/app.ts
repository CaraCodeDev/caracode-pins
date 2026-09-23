import { defineToolbarApp } from 'astro/toolbar';
import { EVENTS, type PinsMessage, type ResultMessage } from '../types.js';
import { PinsPanel } from './panel.js';
import { STYLES } from './styles.js';

/**
 * The Pins toolbar app. Everything it shows (the drawer, and the markers over
 * the page) lives in this app's canvas, a shadow root inside Astro's toolbar,
 * which Astro hides while the app is closed. See ./panel.ts.
 */
export default defineToolbarApp({
  init(canvas, app, server) {
    const style = document.createElement('style');
    style.textContent = STYLES;

    const panel = new PinsPanel({
      path: location.pathname,
      send: (event, payload) => server.send(event, payload),
      close: () => app.toggleState({ state: false }),
    });
    // Layer first so the drawer stacks above the markers.
    canvas.append(style, panel.layer.root, panel.drawer, panel.tab);

    server.on<PinsMessage>(EVENTS.pins, (msg) => panel.onPins(msg));
    server.on<ResultMessage>(EVENTS.result, (msg) => panel.onResult(msg));
    app.onToggled(({ state }) => panel.setOpen(state));

    // Phase 5, view transitions (<ClientRouter />). Astro keeps the toolbar across
    // a swap: it re-appends the same <astro-dev-toolbar> to the new <body> and
    // never re-runs `init`, so this listener is added exactly once. after-swap
    // fires once the new DOM is in and `location` is updated, inside the view
    // transition, before the new page is shown (so push's <style> is back in
    // time). Without ClientRouter the event never fires and each full page load
    // runs `init` afresh.
    document.addEventListener('astro:after-swap', () => panel.navigate(location.pathname));
  },
});
