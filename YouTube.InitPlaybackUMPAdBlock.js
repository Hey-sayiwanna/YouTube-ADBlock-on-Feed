/* YouTube initplayback UMP ad-stream filter v1
 * Built from the 2026-09-15 iOS HAR sample.
 *
 * The response is application/vnd.yt-ump, not a single protobuf message.
 * UMP framing: [varint partType][varint payloadLength][payload].
 * MEDIA_HEADER (type 20) contains protobuf field 2 = video id.
 * In the captured ad session the first media id is the requested video, while
 * a second id (the ad creative) appears later and owns its own media/control
 * parts. We keep the first video id and remove media/control parts belonging
 * to every other id. No byte-by-byte scan of multi-megabyte media payloads.
 */
(() => {
  const raw = $response.body;
  const input = raw instanceof Uint8Array ? raw : new Uint8Array(raw || new ArrayBuffer(0));
  if (!input.length) return $done({});

  function readUmpVarint(a, p) {
    if (p >= a.length) throw new Error('UMP varint EOF');
    const first = a[p];
    let n = 1;
    for (const bit of [0x80, 0x40, 0x20, 0x10]) {
      if (first & bit) n++;
      else break;
    }
    if (p + n > a.length) throw new Error('UMP varint overflow');
    let shift = 0, value = 0;
    if (n !== 5) {
      shift = 8 - n;
      value = first & ((1 << shift) - 1);
    }
    for (let i = 1; i < n; i++) {
      value += a[p + i] * Math.pow(2, shift);
      shift += 8;
    }
    return [value, p + n];
  }

  function readPbVarint(a, p, end) {
    let value = 0, shift = 0;
    while (p < end && shift < 56) {
      const c = a[p++];
      value += (c & 0x7f) * Math.pow(2, shift);
      if (c < 0x80) return [value, p];
      shift += 7;
    }
    throw new Error('protobuf varint');
  }

  // Fast protobuf field-2 string reader for UMP MEDIA_HEADER.
  function mediaVideoId(a, s, e) {
    let p = s;
    while (p < e) {
      const kv = readPbVarint(a, p, e);
      const key = kv[0]; p = kv[1];
      const no = Math.floor(key / 8), wt = key & 7;
      if (!no) return null;
      if (wt === 0) p = readPbVarint(a, p, e)[1];
      else if (wt === 1) p += 8;
      else if (wt === 5) p += 4;
      else if (wt === 2) {
        const lv = readPbVarint(a, p, e);
        const len = lv[0]; p = lv[1];
        const q = p + len;
        if (q > e) return null;
        if (no === 2 && len >= 6 && len <= 32) {
          let str = '';
          for (let i = p; i < q; i++) {
            const c = a[i];
            if (c < 0x20 || c > 0x7e) { str = ''; break; }
            str += String.fromCharCode(c);
          }
          if (str) return str;
        }
        p = q;
      } else return null;
      if (p > e) return null;
    }
    return null;
  }

  function payloadContainsAscii(a, s, e, str) {
    if (!str || e - s < str.length) return false;
    outer: for (let i = s; i <= e - str.length; i++) {
      for (let j = 0; j < str.length; j++) {
        if (a[i + j] !== str.charCodeAt(j)) continue outer;
      }
      return true;
    }
    return false;
  }

  try {
    const parts = [];
    const ids = [];
    let p = 0;
    while (p < input.length) {
      const start = p;
      const tv = readUmpVarint(input, p); const type = tv[0]; p = tv[1];
      const sv = readUmpVarint(input, p); const size = sv[0]; p = sv[1];
      const ps = p, end = p + size;
      if (end > input.length) throw new Error(`partial UMP part type=${type} size=${size}`);
      let id = null;
      if (type === 20) {
        id = mediaVideoId(input, ps, end);
        if (id && !ids.includes(id)) ids.push(id);
      }
      parts.push({ start, ps, end, type, id });
      p = end;
    }

    // A normal response with only one media video id needs no rewrite.
    if (ids.length < 2) {
      console.log(`[YT UMPAdBlock v1] PASS ids=${ids.join(',') || 'none'} bytes=${input.length}`);
      return $done({});
    }

    const mainId = ids[0];
    const adIds = ids.slice(1);
    const keep = [];
    let outLen = 0, droppedBytes = 0, droppedParts = 0;
    let currentId = null;

    for (const part of parts) {
      if (part.type === 20 && part.id) currentId = part.id;

      let drop = false;
      const inAdStream = currentId && currentId !== mainId;

      // Media-bearing UMP types observed in the captured iOS initplayback flow.
      // Type 20 = MEDIA_HEADER, 21 = MEDIA, 22 = MEDIA_END.
      // Onesie types 11/12 can also carry media in the same ad context.
      if ([20, 21, 22, 11, 12].includes(part.type) && inAdStream) drop = true;

      // Remove ad-specific control records even when they occur just before
      // their MEDIA_HEADER (observed for PLAYBACK_START_POLICY/format metadata).
      if (!drop && part.type !== 21) {
        for (const adId of adIds) {
          if (payloadContainsAscii(input, part.ps, part.end, adId)) {
            drop = true;
            break;
          }
        }
      }

      if (drop) {
        droppedParts++;
        droppedBytes += part.end - part.start;
      } else {
        keep.push(input.subarray(part.start, part.end));
        outLen += part.end - part.start;
      }
    }

    if (!droppedParts) return $done({});

    const out = new Uint8Array(outLen);
    let q = 0;
    for (const x of keep) { out.set(x, q); q += x.length; }

    console.log(`[YT UMPAdBlock v1] main=${mainId} ad=${adIds.join(',')} dropParts=${droppedParts} ${input.length}->${out.length}`);
    $done({ body: out });
  } catch (e) {
    // Fail open: never break normal playback on an unknown/partial UMP shape.
    console.log(`[YT UMPAdBlock v1] ERROR ${e}`);
    $done({});
  }
})();
