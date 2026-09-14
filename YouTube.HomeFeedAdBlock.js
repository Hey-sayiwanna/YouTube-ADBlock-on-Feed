/*
 * YouTube Raw Protobuf AdGuard v12
 *
 * 独立处理三类广告响应：
 *   /browse              首页 / Feed Sponsored
 *   /next                视频下方、评论区附近 companion / engagement Sponsored
 *   /player/ad_break     独立播放广告 break
 *
 * 不处理 /player、/get_watch、timedtext；因此不会接管双语字幕链。
 */
(() => {
  const TARGET = 49399797;
  const MAX_DEPTH = 12;
  const url = ($request && $request.url) || '';
  const isNext = /\/youtubei\/v1\/next(?:\?|$)/.test(url);

  const MARKERS = [
    'www.youtube.com/aboutthisad',
    'www.youtube.com/pagead/',
    'googleads.g.doubleclick.net/pagead/',
    'googleadservices.com/pagead/',
    'ad_card_badge.eml-fe',
    'ad_button.eml-fe',
    'ad_image.eml-fe',
    'feed_ad_extension_carousel.eml-fe',
    'feed_ad_metadata.eml-fe',
    'ad_badge.eml-fe'
  ];
  const PROXY = 'yt3.ggpht.com/proxy';
  const DIVIDER = 'cell_divider.eml-fe';
  const NORMAL_THUMB = 'i.ytimg.com/vi/';
  const TINY_LAYOUT = 'video_display_button_group_layout.eml-fe';
  const PROMINENCE = 'home_vertical_feed_prominence_group_key';
  // 2026-09-15 HAR 中 /next 新广告主要落在这些 unknown fields。
  const NEXT_AD_FIELDS = new Set([14, 15, 37, 42, 777]);

  function ascii(s) {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
    return b;
  }
  const markerBytes = MARKERS.map(ascii);
  const proxyBytes = ascii(PROXY);
  const dividerBytes = ascii(DIVIDER);
  const normalThumbBytes = ascii(NORMAL_THUMB);
  const tinyBytes = ascii(TINY_LAYOUT);
  const prominenceBytes = ascii(PROMINENCE);

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
  function varintBytes(v) {
    const r = [];
    while (v >= 128) { r.push((v % 128) | 128); v = Math.floor(v / 128); }
    r.push(v);
    return new Uint8Array(r);
  }
  function contains(a, s, e, n) {
    if (e - s < n.length) return false;
    outer: for (let i = s; i <= e - n.length; i++) {
      for (let j = 0; j < n.length; j++) if (a[i + j] !== n[j]) continue outer;
      return true;
    }
    return false;
  }
  function evidence(a, s, e) {
    let strong = 0, ui = 0;
    for (let i = 0; i < markerBytes.length; i++) {
      if (!contains(a, s, e, markerBytes[i])) continue;
      if (i === 0) return { ad: true, hits: 4, reason: 'aboutthisad' };
      if (i <= 3) strong++; else ui++;
    }
    const proxy = contains(a, s, e, proxyBytes);
    // proxy 单独绝不能作为广告证据，它也承载正常图片。
    const ad = strong >= 2 || (strong >= 1 && ui >= 1) || ui >= 2 || (strong >= 1 && proxy);
    return { ad, hits: strong + ui + (proxy ? 1 : 0), reason: ad ? 'ad-markers' : 'none' };
  }
  function parse(a, s, e) {
    const f = []; let i = s;
    try {
      while (i < e) {
        const fs = i, kv = readVarint(a, i, e), key = kv[0], ke = kv[1];
        const no = Math.floor(key / 8), wt = key & 7;
        if (!no || ![0,1,2,5].includes(wt)) return null;
        let ps = ke, pe, fe;
        if (wt === 0) { const q = readVarint(a, ke, e); pe = fe = q[1]; }
        else if (wt === 1) pe = fe = ke + 8;
        else if (wt === 5) pe = fe = ke + 4;
        else { const q = readVarint(a, ke, e); ps = q[1]; pe = ps + q[0]; fe = pe; }
        if (fe > e) return null;
        f.push({ no, wt, start: fs, keyEnd: ke, ps, pe, end: fe }); i = fe;
      }
      return i === e ? f : null;
    } catch (_) { return null; }
  }
  const range = (s,e) => ({s,e});
  const bytes = b => ({b});
  const slen = x => x.b ? x.b.length : x.e - x.s;
  const sum = a => a.reduce((n,x) => n + slen(x), 0);
  function emit(src, segs, len) {
    const out = new Uint8Array(len); let p = 0;
    for (const x of segs) {
      if (x.b) { out.set(x.b,p); p += x.b.length; }
      else { const v = src.subarray(x.s,x.e); out.set(v,p); p += v.length; }
    }
    return out;
  }
  function shell(a,x) {
    if (x.no !== 1 || x.pe-x.ps > 8192 || contains(a,x.ps,x.pe,normalThumbBytes)) return false;
    return contains(a,x.ps,x.pe,tinyBytes) && contains(a,x.ps,x.pe,prominenceBytes);
  }

  function rewrite(a, s, e, depth) {
    const f = parse(a,s,e); if (!f) return null;
    const drop = new Set();
    let ads=0, shells=0, dividers=0;

    for (let i=0;i<f.length;i++) {
      const x=f[i]; if (x.wt!==2) continue;
      const ev=evidence(a,x.ps,x.pe);
      const browseItem = (x.no===1 || x.no===32);
      const targetFeed = x.no===TARGET;
      const nextUnknown = isNext && NEXT_AD_FIELDS.has(x.no);

      // 删除最小的已知广告容器；不因为祖先容器“包含广告字符串”而整块删除。
      if ((browseItem || nextUnknown) && ev.ad) {
        drop.add(i); ads++;
        console.log(`[YT AdGuard v12] DROP ${isNext?'NEXT':'BROWSE'} field=${x.no} depth=${depth} bytes=${x.pe-x.ps} hits=${ev.hits}`);
        continue;
      }
      if (!isNext && shell(a,x)) { drop.add(i); shells++; continue; }

      // TARGET 自身通常是容器，继续进入而不是整块删除。
      if (targetFeed || depth < MAX_DEPTH) {
        const child = parse(a,x.ps,x.pe) ? rewrite(a,x.ps,x.pe,depth+1) : null;
        if (child && child.changed) x.child=child;
      }
    }

    // browse 广告项后的 divider 一并清掉。
    if (!isNext) for (let i=1;i<f.length;i++) {
      const x=f[i];
      if (!drop.has(i) && drop.has(i-1) && x.wt===2 && x.no===1 && x.pe-x.ps<3000 && contains(a,x.ps,x.pe,dividerBytes)) {
        drop.add(i); dividers++;
      }
    }

    let changed=drop.size>0; const segs=[];
    for (let i=0;i<f.length;i++) {
      const x=f[i]; if (drop.has(i)) continue;
      if (x.child) {
        segs.push(range(x.start,x.keyEnd), bytes(varintBytes(x.child.len)), ...x.child.segs);
        changed=true; ads+=x.child.ads; shells+=x.child.shells; dividers+=x.child.dividers;
      } else segs.push(range(x.start,x.end));
    }
    return {changed,segs,len:sum(segs),ads,shells,dividers};
  }

  try {
    const input = $response.body instanceof Uint8Array ? $response.body : new Uint8Array($response.body || new ArrayBuffer(0));
    if (url.includes('/youtubei/v1/player/ad_break')) {
      console.log(`[YT AdGuard v12] BLOCK player/ad_break ${input.length}->0`);
      return $done({body:new Uint8Array(0)});
    }
    const plan=rewrite(input,0,input.length,0);
    if (plan && plan.changed) {
      const out=emit(input,plan.segs,plan.len);
      console.log(`[YT AdGuard v12] DONE ${isNext?'next':'browse'} ads=${plan.ads} shells=${plan.shells} dividers=${plan.dividers} ${input.length}->${out.length}`);
      $done({body:out});
    } else {
      console.log(`[YT AdGuard v12] PASS ${isNext?'next':'browse'} bytes=${input.length}`);
      $done({});
    }
  } catch(e) {
    console.log(`[YT AdGuard v12] ERROR ${e}`); $done({});
  }
})();
