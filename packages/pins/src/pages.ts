/**
 * Page keys: the path of a page's pin file inside `.carapin/`, without `.json`.
 * `/` → `index`, `/blog/post/` → `blog/post`. Shared by the toolbar (browser)
 * and the dev server, so it must stay free of Node imports.
 *
 * Returns null for paths that can't safely become a file name.
 */
export function pageKey(pathname: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(pathname.split(/[?#]/)[0] ?? '');
  } catch {
    return null;
  }
  p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const segments = p.split('/').filter((s) => s !== '');
  if (segments.length === 0) return 'index';
  for (const seg of segments) {
    if (seg === '.' || seg === '..' || /[\\\0:]/.test(seg)) return null;
  }
  return segments.join('/');
}

/** The URL path a page key stands for (`index` → `/`, `blog/post` → `/blog/post/`). */
export function keyToPath(key: string): string {
  return key === 'index' ? '/' : `/${key}/`;
}
