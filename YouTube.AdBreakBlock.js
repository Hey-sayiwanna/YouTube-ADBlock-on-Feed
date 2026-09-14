/* YouTube /player/ad_break blocker v1
 * This endpoint's captured protobuf is an ad-break payload. Return an empty valid protobuf.
 */
(() => {
  const a = $response.bodyBytes;
  if (!a || !a.length) return $done({});
  console.log(`[YT AdBreakBlock] DROP ${a.length} bytes`);
  $done({bodyBytes: new Uint8Array(0)});
})();
