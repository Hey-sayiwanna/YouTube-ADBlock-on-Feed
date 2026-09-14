/* YouTube /next sponsored-card filter v1
 * HAR 2026-09-15: leaked ad is isolated in top-level protobuf field 14 -> 62960614.
 * Safety: field 14 is removed ONLY when it contains strong ad evidence.
 */
(() => {
  const a = $response.bodyBytes;
  if (!a || !a.length) return $done({});

  const markers = [
    'www.youtube.com/pagead/',
    'google.com/aclk',
    'googleadservices.com/pagead/',
    'googleads.g.doubleclick.net/pagead/',
    'www.youtube.com/aboutthisad',
    'ad_panel_interactivity_state',
    'carousel_ad_card_metadata.eml-fe',
    'feed_ad_extension_carousel.eml-fe'
  ].map(s => new TextEncoder().encode(s));

  function readVarint(i, end) {
    let v = 0, shift = 0;
    while (i < end && shift < 56) {
      const c = a[i++]; v += (c & 127) * Math.pow(2, shift);
      if (c < 128) return [v, i];
      shift += 7;
    }
    throw new Error('bad varint');
  }
  function has(s, e, n) {
    if (e - s < n.length) return false;
    outer: for (let i = s; i <= e - n.length; i++) {
      for (let j = 0; j < n.length; j++) if (a[i+j] !== n[j]) continue outer;
      return true;
    }
    return false;
  }
  function adEvidence(s, e) {
    let hits = 0;
    for (const m of markers) if (has(s, e, m) && ++hits >= 1) return true;
    return false;
  }
  try {
    let i = 0, last = 0, dropped = 0;
    const keep = [];
    while (i < a.length) {
      const st = i;
      const kv = readVarint(i, a.length), key = kv[0], ke = kv[1];
      const no = Math.floor(key / 8), wt = key & 7;
      if (!no || ![0,1,2,5].includes(wt)) throw new Error('invalid field');
      let ps = ke, end;
      if (wt === 0) end = readVarint(ke, a.length)[1];
      else if (wt === 1) end = ke + 8;
      else if (wt === 5) end = ke + 4;
      else { const lv = readVarint(ke, a.length); ps = lv[1]; end = ps + lv[0]; }
      if (end > a.length) throw new Error('overflow');
      if (no === 14 && wt === 2 && adEvidence(ps, end)) {
        if (last < st) keep.push(a.subarray(last, st));
        last = end; dropped++;
      }
      i = end;
    }
    if (!dropped) return $done({});
    if (last < a.length) keep.push(a.subarray(last));
    let n = 0; for (const x of keep) n += x.length;
    const out = new Uint8Array(n); let p = 0;
    for (const x of keep) { out.set(x, p); p += x.length; }
    console.log(`[YT NextAdBlock] DROP field14=${dropped}, ${a.length}->${out.length}`);
    $done({bodyBytes: out});
  } catch (e) {
    console.log(`[YT NextAdBlock] PASS ${e}`);
    $done({});
  }
})();
