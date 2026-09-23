import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { pinIcon } from './icon.js';
import { pageKey } from './pages.js';
import {
  createPin,
  deletePin,
  keyForFile,
  markPinDone,
  PIN_DIR,
  PinError,
  readPins,
  replyToPin,
  sanitizeAnchor,
  sanitizeId,
  sanitizeRequestId,
} from './store.js';
import { EVENTS, type Operation, type PinFile, type PinsMessage, type ResultMessage } from './types.js';
import { sourceLocationsPlugin } from './vite-plugin.js';

export const TOOLBAR_APP_ID = 'caracode-pins';

const OP_FAILED: Record<Operation, string> = {
  create: 'Pin not saved',
  reply: 'Reply not saved',
  done: 'Not marked done',
  delete: 'Pin not deleted',
};

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

        // One write at a time per file: each operation re-reads the file, and the
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

        /**
         * Runs one mutation through the page's queue, then answers with a
         * `result` and, on success, the page's fresh pins. Expected failures
         * (bad input, missing pin, unreadable file) become `ok: false` results.
         */
        const mutate = (
          op: Operation,
          data: Record<string, unknown> | undefined,
          run: (key: string, id: string | null) => Promise<{ file: PinFile; id: string }>,
          needsId: boolean,
        ) => {
          const requestId = sanitizeRequestId(data?.requestId);
          const key = typeof data?.path === 'string' ? pageKey(data.path) : null;
          const id = sanitizeId(data?.id);
          const fail = (error: string) => {
            logger.warn(error);
            toolbar.send(EVENTS.result, { ok: false, op, key, id: id ?? undefined, error, requestId } satisfies ResultMessage);
          };
          if (!key) return fail("This page's path can't be used as a pin file name.");
          if (needsId && !id) return fail(`No pin id given for ${op}.`);
          enqueue(key, async () => {
            try {
              const done = await run(key, id);
              toolbar.send(EVENTS.result, { ok: true, op, key, id: done.id, requestId } satisfies ResultMessage);
              toolbar.send(EVENTS.pins, { key, pins: done.file.pins } satisfies PinsMessage);
            } catch (err) {
              fail(`${OP_FAILED[op]}: ${PIN_DIR}/${key}.json: ${errText(err)}`);
            }
          });
        };

        toolbar.on<Record<string, unknown>>(EVENTS.create, (data) => {
          mutate(
            'create',
            data,
            async (key) => {
              const anchor = sanitizeAnchor(data?.anchor);
              if (!anchor) throw new PinError('invalid-input', 'The picked element was not sent correctly.');
              const { file, pin } = await createPin(siteRoot, key, anchor, data?.text as string);
              return { file, id: pin.id };
            },
            false,
          );
        });

        toolbar.on<Record<string, unknown>>(EVENTS.reply, (data) => {
          mutate(
            'reply',
            data,
            async (key, id) => ({ file: await replyToPin(siteRoot, key, id!, data?.text as string, 'human'), id: id! }),
            true,
          );
        });

        toolbar.on<Record<string, unknown>>(EVENTS.done, (data) => {
          mutate('done', data, async (key, id) => ({ file: await markPinDone(siteRoot, key, id!), id: id! }), true);
        });

        toolbar.on<Record<string, unknown>>(EVENTS.delete, (data) => {
          mutate('delete', data, async (key, id) => ({ file: await deletePin(siteRoot, key, id!), id: id! }), true);
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
