/* YouTube /player/ad_break blocker v2
 * Captured response is an independent ad-break protobuf payload.
 * Surge binary response output must use body, not bodyBytes.
 */
(() => {
  const input = $response.body instanceof Uint8Array
    ? $response.body
    : new Uint8Array($response.body || new ArrayBuffer(0));
  if (!input.length) return $done({});
  console.log(`[YT AdBreakBlock v2] DROP ${input.length} bytes -> 0`);
  $done({ body: new Uint8Array(0) });
})();
