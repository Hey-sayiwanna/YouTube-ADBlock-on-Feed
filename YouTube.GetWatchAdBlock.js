/* YouTube /get_watch video-ad blocker v1
 * Derived from paired HARs 046289 (clean) and 046297 (ad).
 * Ad response structure: top field 1 -> field 2 -> ad field 7 + ad stream field 68.
 * Normal media streams stay in field 4. We only remove 7/68 when strong ad evidence is present.
 */
(() => {
  const raw = $response.body;
  if (!raw) return $done({});
  const src = raw instanceof Uint8Array ? raw : new Uint8Array(raw);

  function readVarint(a, i) {
    let v = 0, s = 0, b;
    do {
      if (i >= a.length || s > 49) throw new Error("bad varint");
      b = a[i++]; v += (b & 0x7f) * Math.pow(2, s); s += 7;
    } while (b & 0x80);
    return [v, i];
  }
  function encVarint(v) {
    const o = [];
    while (v > 127) { o.push((v % 128) | 128); v = Math.floor(v / 128); }
    o.push(v); return new Uint8Array(o);
  }
  function concat(parts) {
    let n = 0; for (const p of parts) n += p.length;
    const o = new Uint8Array(n); let k = 0;
    for (const p of parts) { o.set(p, k); k += p.length; }
    return o;
  }
  function parse(a) {
    const f = []; let i = 0;
    while (i < a.length) {
      const st = i; let k; [k, i] = readVarint(a, i);
      const no = Math.floor(k / 8), wt = k & 7;
      if (!no) throw new Error("field 0");
      let ps = -1, pe = -1;
      if (wt === 0) { [, i] = readVarint(a, i); }
      else if (wt === 1) i += 8;
      else if (wt === 2) { let l; [l, i] = readVarint(a, i); ps = i; pe = i + l; i = pe; }
      else if (wt === 5) i += 4;
      else throw new Error("unsupported wire");
      if (i > a.length) throw new Error("overflow");
      f.push({no, wt, st, en:i, ps, pe});
    }
    return f;
  }
  function asciiHas(a, needle) {
    const n = needle.length;
    outer: for (let i = 0; i <= a.length - n; i++) {
      for (let j = 0; j < n; j++) if (a[i+j] !== needle.charCodeAt(j)) continue outer;
      return true;
    }
    return false;
  }
  function strongAd(a) {
    return asciiHas(a,"aboutthisad") || asciiHas(a,"youtube.com/pagead/") ||
      asciiHas(a,"google.com/aclk") || asciiHas(a,"googleads.g.doubleclick.net/pagead/") ||
      asciiHas(a,"yt3.ggpht.com/proxy") || asciiHas(a,"googleusercontent.com/proxy");
  }
  function wrap(no, payload) {
    return concat([encVarint(no * 8 + 2), encVarint(payload.length), payload]);
  }
  function transformLevel2(a) {
    const fs = parse(a), out = []; let dropped = 0;
    for (const f of fs) {
      if (f.wt === 2 && (f.no === 7 || f.no === 68)) {
        const p = a.slice(f.ps, f.pe);
        if (strongAd(p)) { dropped++; continue; }
      }
      out.push(a.slice(f.st, f.en));
    }
    return [concat(out), dropped];
  }
  function transformLevel1(a) {
    const fs = parse(a), out = []; let dropped = 0;
    for (const f of fs) {
      if (f.wt === 2 && f.no === 2) {
        const p = a.slice(f.ps, f.pe); let q, d;
        try { [q,d] = transformLevel2(p); } catch (_) { q=p; d=0; }
        dropped += d; out.push(d ? wrap(2,q) : a.slice(f.st,f.en));
      } else out.push(a.slice(f.st,f.en));
    }
    return [concat(out), dropped];
  }
  try {
    const fs = parse(src), out = []; let dropped = 0;
    for (const f of fs) {
      if (f.wt === 2 && f.no === 1) {
        const p = src.slice(f.ps,f.pe); let q,d;
        try { [q,d] = transformLevel1(p); } catch (_) { q=p; d=0; }
        dropped += d; out.push(d ? wrap(1,q) : src.slice(f.st,f.en));
      } else out.push(src.slice(f.st,f.en));
    }
    if (!dropped) return $done({});
    const body = concat(out);
    console.log(`[YT GetWatchAdBlock v1] DROP ${dropped} ad subtrees, ${src.length}->${body.length}`);
    $done({body});
  } catch (e) {
    console.log(`[YT GetWatchAdBlock v1] PASS ${e}`);
    $done({});
  }
})();
