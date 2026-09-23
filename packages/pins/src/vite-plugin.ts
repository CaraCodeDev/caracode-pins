import path from 'node:path';
import type { AstroConfig } from 'astro';
import { annotateAstroSource } from './source-attr.js';

/** Vite's `Plugin`, reached through Astro's types so we don't depend on Vite directly. */
type VitePlugin = Extract<
  NonNullable<NonNullable<AstroConfig['vite']>['plugins']>[number],
  { name: string }
>;

/**
 * Dev-only Vite plugin: adds `data-pins-src` to plain elements in the site's own
 * `.astro` files before Astro compiles them. Astro 7.3.4's compiler-rs stubs
 * `annotateSourceFile`, so carapin supplies source locations itself.
 *
 * Register only for `astro dev`; production builds must carry no trace of it.
 */
export function sourceLocationsPlugin(siteRoot: string): VitePlugin {
  const root = path.resolve(siteRoot);
  return {
    name: '@caracode/pins:source-locations',
    enforce: 'pre',
    apply: 'serve',
    transform: {
      // Astro's own `astro:build` transform is also `enforce: 'pre'` and comes
      // earlier in the plugin list; hook-level `order: 'pre'` puts us first.
      order: 'pre',
      filter: { id: /\.astro$/ },
      handler(code, id) {
        // The client environment only gets a stub module from Astro.
        if (this.environment?.name === 'client') return null;
        const file = path.resolve(id);
        const rel = path.relative(root, file);
        if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
        if (rel.split(path.sep).includes('node_modules')) return null;
        const result = annotateAstroSource(code, rel.split(path.sep).join('/'));
        if (!result) return null;
        return { code: result.code, map: result.map };
      },
    },
  };
}
