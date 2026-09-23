import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { pinIcon } from './icon.js';
import { pageKey } from './pages.js';
import { appendPin, keyForFile, PIN_DIR, readPins, sanitizeCaptured } from './store.js';
import { EVENTS, type PinsMessage } from './types.js';
import { sourceLocationsPlugin } from './vite-plugin.js';

export const TOOLBAR_APP_ID = 'caracode-pins';

/**
 * carapin: an Astro dev-toolbar app for pinning notes onto elements.
 * Dev only. In `astro build` / `astro preview` it registers nothing.
 */
export default function pins(): AstroIntegration {
  let siteRoot = '';

  return {
    name: '@caracode/pins',
    hooks: {
      'astro:config:setup': ({ command, config, addDevToolbarApp, updateConfig }) => {
        if (command !== 'dev') return;
        siteRoot = fileURLToPath(config.root);
        updateConfig({ vite: { plugins: [sourceLocationsPlugin(siteRoot)] } });
        addDevToolbarApp({
          id: TOOLBAR_APP_ID,
          name: 'Pins',
          icon: pinIcon,
          // A bare package specifier, resolved by Vite from the site's root the
          // same way it would be from a real node_modules install.
          entrypoint: '@caracode/pins/toolbar',
        });
      },

      'astro:server:setup': ({ server, toolbar, logger }) => {
        if (!siteRoot) return;
        const pinDir = path.resolve(siteRoot, PIN_DIR);

        const sendPins = async (key: string) => {
          let message: PinsMessage;
          try {
            message = { key, pins: (await readPins(siteRoot, key)).pins };
          } catch (err) {
            message = { key, pins: [], error: `Couldn't read ${PIN_DIR}/${key}.json: ${errText(err)}` };
          }
          toolbar.send(EVENTS.pins, message);
        };

        // One write at a time per file: each append re-reads the file, and the
        // queue stops two quick clicks from reading the same old version.
        const queues = new Map<string, Promise<unknown>>();
        const enqueue = (key: string, job: () => Promise<void>) => {
          const next = (queues.get(key) ?? Promise.resolve()).then(job, job);
          queues.set(key, next);
          void next.finally(() => {
            if (queues.get(key) === next) queues.delete(key);
          });
        };

        toolbar.on<{ path?: unknown }>(EVENTS.list, (data) => {
          const key = typeof data?.path === 'string' ? pageKey(data.path) : null;
          if (key) void sendPins(key);
        });

        toolbar.on<{ path?: unknown; pin?: unknown }>(EVENTS.add, (data) => {
          const key = typeof data?.path === 'string' ? pageKey(data.path) : null;
          const pin = sanitizeCaptured(data?.pin);
          if (!key || !pin) {
            logger.warn('Ignored a malformed pin from the toolbar.');
            return;
          }
          enqueue(key, async () => {
            try {
              const file = await appendPin(siteRoot, key, pin);
              toolbar.send(EVENTS.pins, { key, pins: file.pins } satisfies PinsMessage);
            } catch (err) {
              const error = `Pin not saved: ${PIN_DIR}/${key}.json ${errText(err)}`;
              logger.error(error);
              toolbar.send(EVENTS.pins, { key, pins: [], error } satisfies PinsMessage);
            }
          });
        });

        // Hand edits (by Rich or Claude) reach the open panel without a reload.
        server.watcher.add(pinDir);
        const onFsEvent = (file: string) => {
          const key = keyForFile(siteRoot, file);
          if (key) void sendPins(key);
        };
        server.watcher.on('add', onFsEvent);
        server.watcher.on('change', onFsEvent);
        server.watcher.on('unlink', onFsEvent);
      },
    },
  };
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
