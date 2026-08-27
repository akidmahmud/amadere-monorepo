/**
 * Recovery for "Failed to load chunk … from module …".
 *
 * WHAT HAPPENS
 *
 * A visitor has the site open (or a page cached) from build A. Build B ships;
 * its JS chunks are hashed differently and build A's files are gone. The next
 * lazy import the open page attempts requests a chunk URL that now 404s, and
 * React unmounts the tree into the error boundary.
 *
 * WHY "TRY AGAIN" COULD NOT FIX IT
 *
 * `reset()` re-renders the same client tree, which re-requests the SAME dead
 * chunk URL. It can never succeed. The only cure is a document reload, which
 * fetches fresh HTML pointing at build B's hashes.
 */

const RELOAD_KEY = "amader:chunk-reload-at";
/** One reload per 30s. Anything more is a loop, not a recovery. */
const RELOAD_WINDOW_MS = 30_000;

/**
 * Bundlers word this several ways and it varies by browser, so match broadly:
 * a false positive costs one reload, a false negative leaves the visitor on a
 * dead page with a button that cannot help them.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const name = (error as { name?: string }).name ?? "";
  const message = (error as { message?: string }).message ?? "";
  return (
    name === "ChunkLoadError" ||
    /Failed to load chunk/i.test(message) ||
    /Loading chunk .* failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

/**
 * Reload once to pick up the current build.
 *
 * Returns false when a reload was already attempted recently — if the fresh
 * HTML still cannot load its chunks (a genuinely broken deploy, or the visitor
 * is offline) then reloading again would spin forever, so the boundary shows
 * its message instead. Getting this guard wrong is worse than the bug.
 */
export function tryReloadForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Private mode / storage blocked: allow exactly one reload rather than
    // risking a loop we cannot detect.
    if (window.name === "amader-chunk-reloaded") return false;
    window.name = "amader-chunk-reloaded";
  }
  window.location.reload();
  return true;
}
