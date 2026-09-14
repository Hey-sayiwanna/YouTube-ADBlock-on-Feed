/* YouTube /next sponsored-card filter v2
 * 2026-09-15 HAR regression fix.
 *
 * Proven leaked ad payloads occupy top-level protobuf fields 14 / 15 / 37 / 42.
 * These fields are dropped only when they contain strong ad evidence.
 * IMPORTANT: Surge binary http-response uses $response.body + $done({body: ...});
 * the previous v1 used bodyBytes and could appear "Modified" while leaving the
 * actual response payload unchanged.
 */
(() => {
  const input = $response.body instanceof Uint8Array
    ? $response.body
    : new Uint8Array($response.body || new ArrayBuffer(0));
  if (!input.length) return $done({});

  const AD_TOP_FIELDS = new Set([14, 15, 37, 42]);
  const markerStrings = [
    'www.youtube.com/aboutthisad',
    'www.youtube.com/pagead/',
    'google.com/aclk',
    'googleadservices.com/pagead/',
    'googleads.g.doubleclick.net/pagead/',
    'googleusercontent.com/proxy',
    'yt3.ggpht.com/proxy',
    'ad_panel_interactivity_state',
    'carousel_ad_card_metadata.eml-fe',
    'feed_ad_extension_carousel.eml-fe',
    'ad_card_badge.eml-fe',
    'ad_badge.eml-fe'
  ];
  const enc = new TextEncoder();
  const markers = markerStrings.map(s => enc.encode(s));

  function readVarint(a, i, end) {
    let v = 0, shift = 0;
    while (i < end && shift < 56) {
      const c = a[i++];
      v += (c & 127) * Math.pow(2, shift);
      if (c < 128) return [v, i];
      shift += 7;
    }
    throw new Error('bad varint');
  }

  function contains(a, s, e, n) {
    if (e - s < n.length) return false;
    outer: for (let i = s; i <= e - n.length; i++) {
      for (let j = 0; j < n.length; j++) {
        if (a[i + j] !== n[j]) continue outer;
      }
      return true;
    }
    return false;
  }

  function adEvidence(a, s, e) {
    let hits = 0;
    let hasAbout = false;
    let hasPageAd = false;
    let hasAclk = false;
    let hasProxy = false;
    for (let i = 0; i < markers.length; i++) {
      if (!contains(a, s, e, markers[i])) continue;
      hits++;
      if (i === 0) hasAbout = true;
      if (i === 1 || i === 3 || i === 4) hasPageAd = true;
      if (i === 2) hasAclk = true;
      if (i === 5 || i === 6) hasProxy = true;
    }
    // aboutthisad is definitive; otherwise require an ad click/pagead signal,
    // optionally reinforced by the ad image proxy/UI markers.
    const ad = hasAbout || hasPageAd || hasAclk || (hasProxy && hits >= 2);
    return { ad, hits };
  }

  try {
    const fields = [];
    let i = 0;
    while (i < input.length) {
      const start = i;
      const kv = readVarint(input, i, input.length);
      const key = kv[0], keyEnd = kv[1];
      const no = Math.floor(key / 8), wt = key & 7;
      if (!no || ![0, 1, 2, 5].includes(wt)) throw new Error('invalid field');

      let ps = keyEnd, end;
      if (wt === 0) end = readVarint(input, keyEnd, input.length)[1];
      else if (wt === 1) end = keyEnd + 8;
      else if (wt === 5) end = keyEnd + 4;
      else {
        const lv = readVarint(input, keyEnd, input.length);
        ps = lv[1];
        end = ps + lv[0];
      }
      if (end > input.length) throw new Error('overflow');
      fields.push({ no, wt, start, ps, end });
      i = end;
    }

    const keep = [];
    let dropped = 0;
    const droppedNos = [];
    let outLen = 0;

    for (const f of fields) {
      let drop = false;
      if (f.wt === 2 && AD_TOP_FIELDS.has(f.no)) {
        const ev = adEvidence(input, f.ps, f.end);
        if (ev.ad) {
          drop = true;
          dropped++;
          droppedNos.push(`${f.no}(${f.end - f.ps}B/${ev.hits}hits)`);
        }
      }
      if (!drop) {
        keep.push(input.subarray(f.start, f.end));
        outLen += f.end - f.start;
      }
    }

    if (!dropped) {
      console.log(`[YT NextAdBlock v2] PASS bytes=${input.length}`);
      return $done({});
    }

    const out = new Uint8Array(outLen);
    let p = 0;
    for (const part of keep) {
      out.set(part, p);
      p += part.length;
    }

    console.log(`[YT NextAdBlock v2] DROP fields=${droppedNos.join(',')} ${input.length}->${out.length}`);
    $done({ body: out });
  } catch (e) {
    console.log(`[YT NextAdBlock v2] ERROR ${e}`);
    $done({});
  }
})();
