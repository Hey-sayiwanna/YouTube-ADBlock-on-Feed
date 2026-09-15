/* YouTube /player/ad_break blocker v3
 * HAR 2026-09-15 #48283:
 *   top-level field 1   = request/session metadata (~2.7 KB)
 *   top-level field 8   = small control metadata (~34 B)
 *   top-level field 10  = ad engagement payload (~42.6 KB; aboutthisad/pagead/aclk/proxy)
 *   top-level field 777 = ad UI/companion payload (~320 KB; AD_PARENT_CONTAINER/ad_* EML)
 *
 * Do NOT return an empty protobuf: preserve the response envelope/control fields and
 * remove only the two independently verified ad payload fields.
 */
(() => {
  try {
    const src = $response.body instanceof Uint8Array
      ? $response.body
      : new Uint8Array($response.body || new ArrayBuffer(0));
    if (!src.length) return $done({});

    function readVarint(a, p) {
      let v = 0, s = 0, i = p;
      while (i < a.length && s <= 35) {
        const b = a[i++];
        v += (b & 0x7f) * Math.pow(2, s);
        if ((b & 0x80) === 0) return [v, i];
        s += 7;
      }
      throw new Error('bad varint');
    }

    let p = 0, keepStart = 0, removed = 0;
    const chunks = [];
    while (p < src.length) {
      const fieldStart = p;
      const [key, p1] = readVarint(src, p);
      const no = Math.floor(key / 8), wt = key & 7;
      p = p1;
      if (wt === 0) p = readVarint(src, p)[1];
      else if (wt === 1) p += 8;
      else if (wt === 2) { const [n, p2] = readVarint(src, p); p = p2 + n; }
      else if (wt === 5) p += 4;
      else throw new Error(`unsupported wire type ${wt}`);
      if (p > src.length) throw new Error('truncated protobuf');

      if (no === 10 || no === 777) {
        if (fieldStart > keepStart) chunks.push(src.slice(keepStart, fieldStart));
        removed += p - fieldStart;
        keepStart = p;
      }
    }
    if (!removed) return $done({});
    if (keepStart < src.length) chunks.push(src.slice(keepStart));
    const total = chunks.reduce((n, x) => n + x.length, 0);
    const out = new Uint8Array(total);
    let o = 0; for (const x of chunks) { out.set(x, o); o += x.length; }
    console.log(`[YT AdBreakBlock v3] ${src.length} -> ${out.length}; removed fields 10/777 (${removed} B)`);
    $done({ body: out });
  } catch (e) {
    console.log(`[YT AdBreakBlock v3] fail-open: ${e}`);
    $done({});
  }
})();
