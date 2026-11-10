/**
 * Where the generator backend is reachable from the browser, given the URL of one of this addon's
 * own modules.
 *
 * In production the shell loads the addon from `/addon-assets/<name>/` and the addon container's
 * nginx proxies `/api` next to its files, so the API sits beside the folder the chunks came from.
 * Chunks live in `assets/`, the manifest and remoteEntry.js one level up. In dev the module comes
 * straight from the Vite dev server, whose proxy serves `/api` at its root.
 */
export function apiBaseFor(moduleUrl: string, dev: boolean, pageOrigin = globalThis.location?.origin): string {
  const url = new URL(moduleUrl);
  if (dev) return new URL("/api", url).href;

  const assets = url.pathname.lastIndexOf("/assets/");
  const root = assets >= 0 ? url.pathname.slice(0, assets) : url.pathname.slice(0, url.pathname.lastIndexOf("/"));
  const path = `${root}/api`;
  // Same origin stays relative so the request goes through whatever proxy served the page.
  return url.origin === pageOrigin ? path : `${url.origin}${path}`;
}
