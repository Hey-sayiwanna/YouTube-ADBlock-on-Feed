/* YouTube initplayback UMP fallback v1
 * 2026-09-15 targeted workaround.
 * The captured ad session shows Maasea's initplayback request handler is found,
 * but the original googlevideo UMP response still arrives unchanged.
 * Return the same empty 200 response used by Maasea when its UMP key path cannot
 * be used, forcing YouTube to fall back to the normal /player playback path.
 */
(() => {
  console.log('[YT InitPlaybackFallback v1] force /player fallback');
  $done({
    response: {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
      body: new Uint8Array(0)
    }
  });
})();
