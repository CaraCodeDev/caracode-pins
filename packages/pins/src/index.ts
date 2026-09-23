import type { AstroIntegration } from 'astro';
import { pinIcon } from './icon.js';

export const TOOLBAR_APP_ID = 'caracode-pins';

/**
 * carapin: an Astro dev-toolbar app for pinning notes onto elements.
 * Dev only. In `astro build` / `astro preview` it registers nothing.
 */
export default function pins(): AstroIntegration {
  return {
    name: '@caracode/pins',
    hooks: {
      'astro:config:setup': ({ command, addDevToolbarApp }) => {
        if (command !== 'dev') return;
        addDevToolbarApp({
          id: TOOLBAR_APP_ID,
          name: 'Pins',
          icon: pinIcon,
          // A bare package specifier, resolved by Vite from the site's root the
          // same way it would be from a real node_modules install.
          entrypoint: '@caracode/pins/toolbar',
        });
      },
    },
  };
}
