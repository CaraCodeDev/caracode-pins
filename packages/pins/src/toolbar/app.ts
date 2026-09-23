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
    canvas.append(style, panel.layer.root, panel.drawer);

    server.on<PinsMessage>(EVENTS.pins, (msg) => panel.onPins(msg));
    server.on<ResultMessage>(EVENTS.result, (msg) => panel.onResult(msg));
    app.onToggled(({ state }) => panel.setOpen(state));
  },
});
