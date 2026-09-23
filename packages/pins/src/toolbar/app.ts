import { defineToolbarApp } from 'astro/toolbar';

const PANEL_HEADING = 'Pins';
const EMPTY_MESSAGE = 'No pins on this page yet.';

export default defineToolbarApp({
  init(canvas) {
    const win = document.createElement('astro-dev-toolbar-window');

    const style = document.createElement('style');
    style.textContent = `
      h1 { margin: 0 0 8px; font-size: 22px; font-weight: 600; color: #fff; }
      p { margin: 0; color: rgba(191, 193, 201, 1); }
    `;

    const heading = document.createElement('h1');
    heading.textContent = PANEL_HEADING;

    const empty = document.createElement('p');
    empty.textContent = EMPTY_MESSAGE;

    win.append(style, heading, empty);
    canvas.append(win);
  },
});
