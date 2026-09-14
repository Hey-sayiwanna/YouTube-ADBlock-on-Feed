/*
 * YouTube iOS Browse / Sponsored / player ad_break 广告补丁 v10
 *
 * 目标：
 * 1. 保留 v9 对首页 Home Feed Sponsored 广告的专用清理；
 * 2. 恢复迁移前 Enhance 对非首页 /browse 中广告 item 的广泛过滤能力；
 * 3. 处理新版 /youtubei/v1/player/ad_break 伴随广告（视频下方“赞助”卡片）。
 *
 * 说明：
 * - /browse 只由本脚本处理，避免与 Enhance response 重复匹配；
 * - 对所有 protobuf 层级中的直接 field #1 / #32 item 做广告特征判断，
 *   以覆盖首页与非首页 browse 中的 Sponsored / Feed / companion item；
 * - /player/ad_break 返回的是独立广告响应，直接返回空 protobuf message，
 *   不影响 /player、/get_watch 等正常播放响应；
 * - 双语字幕模块完全独立，本脚本不处理 timedtext / caption。
 */
(() => {
  const TARGET = 49399797;
  const MAX_SEARCH_DEPTH = 10;
  const url = ($request && $request.url) || '';

  const ABOUT = 'www.youtube.com/aboutthisad';
  const OLD_CORE = [
    'googleadservices.com/pagead/aclk',
    'www.youtube.com/pagead/adview',
    'www.youtube.com/pagead/interaction'
  ];
  const BROAD = [
    'www.youtube.com/pagead/',
    'googleads.g.doubleclick.net/pagead/',
    'yt3.ggpht.com/proxy'
  ];
  const AD_UI = [
    'ad_card_badge.eml-fe',
    'ad_button.eml-fe',
    'ad_image.eml-fe',
    'feed_ad_extension_carousel.eml-fe',
    'feed_ad_metadata.eml-fe',
    'ad_badge.eml-fe'
  ];

  const TINY_LAYOUT = 'video_display_button_group_layout.eml-fe';
  const PROMINENCE = 'home_vertical_feed_prominence_group_key';
  const DIVIDER = 'cell_divider.eml-fe';
  const NORMAL_THUMB = 'i.ytimg.com/vi/';

  function ascii(s) {
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
    return out;
  }

  const aboutBytes = ascii(ABOUT);
  const oldBytes = OLD_CORE.map(ascii);
  const broadBytes = BROAD.map(ascii);
  const adUiBytes = AD_UI.map(ascii);
  const tinyLayoutBytes = ascii(TINY_LAYOUT);
  const prominenceBytes = ascii(PROMINENCE);
  const dividerBytes = ascii(DIVIDER);
  const normalThumbBytes = ascii(NORMAL_THUMB);
  const pageadBytes = ascii('pagead');

  function readVarint(a, i, end) {
    let v = 0;
    let shift = 0;
    while (i < end && shift < 56) {
      const c = a[i++];
      v += (c & 0x7f) * Math.pow(2, shift);
      if (c < 0x80) return [v, i];
      shift += 7;
    }
    throw new Error('bad varint');
  }

  function varintBytes(v) {
    const arr = [];
    while (v >= 0x80) {
      arr.push((v % 128) | 0x80);
      v = Math.floor(v / 128);
    }
    arr.push(v);
    return new Uint8Array(arr);
  }

  function containsRange(a, start, end, needle) {
    if (end - start < needle.length) return false;
    outer:
    for (let i = start; i <= end - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (a[i + j] !== needle[j]) continue outer;
      }
      return true;
    }
    return false;
  }

  function adEvidence(a, start, end) {
    if (containsRange(a, start, end, aboutBytes)) {
      return { ad: true, reason: 'aboutthisad', hits: 4 };
    }

    let hits = 0;
    let uiHits = 0;
    for (let i = 0; i < oldBytes.length; i++) {
      if (containsRange(a, start, end, oldBytes[i])) hits++;
    }
    for (let i = 0; i < broadBytes.length; i++) {
      if (containsRange(a, start, end, broadBytes[i])) hits++;
    }
    for (let i = 0; i < adUiBytes.length; i++) {
      if (containsRange(a, start, end, adUiBytes[i])) uiHits++;
    }

    const hasPagead = containsRange(a, start, end, pageadBytes);
    const ad = hits >= 2 || (hasPagead && uiHits >= 1) || uiHits >= 2;
    return { ad, reason: ad ? (uiHits ? 'pagead+ad-ui' : 'markers') : 'none', hits: hits + uiHits };
  }

  function parseFields(a, start, end) {
    const fields = [];
    let i = start;
    try {
      while (i < end) {
        const fieldStart = i;
        const kv = readVarint(a, i, end);
        const key = kv[0];
        const keyEnd = kv[1];
        const fieldNo = Math.floor(key / 8);
        const wt = key & 7;
        if (!fieldNo || (wt !== 0 && wt !== 1 && wt !== 2 && wt !== 5)) return null;

        let payloadStart = keyEnd;
        let payloadEnd;
        let fieldEnd;
        if (wt === 0) {
          const vv = readVarint(a, keyEnd, end);
          payloadEnd = vv[1];
          fieldEnd = vv[1];
        } else if (wt === 1) {
          payloadEnd = keyEnd + 8;
          fieldEnd = payloadEnd;
        } else if (wt === 5) {
          payloadEnd = keyEnd + 4;
          fieldEnd = payloadEnd;
        } else {
          const lv = readVarint(a, keyEnd, end);
          payloadStart = lv[1];
          payloadEnd = payloadStart + lv[0];
          fieldEnd = payloadEnd;
        }
        if (fieldEnd > end) return null;
        fields.push({ no: fieldNo, wt, start: fieldStart, keyEnd, ps: payloadStart, pe: payloadEnd, end: fieldEnd });
        i = fieldEnd;
      }
      return i === end ? fields : null;
    } catch (_) {
      return null;
    }
  }

  function rangeSeg(s, e) { return { s, e }; }
  function bytesSeg(b) { return { b }; }
  function segLen(x) { return x.b ? x.b.length : x.e - x.s; }
  function totalLen(segs) {
    let n = 0;
    for (let i = 0; i < segs.length; i++) n += segLen(segs[i]);
    return n;
  }

  function emit(a, segs, len) {
    const out = new Uint8Array(len);
    let p = 0;
    for (let i = 0; i < segs.length; i++) {
      const x = segs[i];
      if (x.b) {
        out.set(x.b, p);
        p += x.b.length;
      } else {
        const v = a.subarray(x.s, x.e);
        out.set(v, p);
        p += v.length;
      }
    }
    return out;
  }

  function isShell(a, x) {
    const size = x.pe - x.ps;
    if (x.no !== 1 || size > 8192) return false;
    if (containsRange(a, x.ps, x.pe, normalThumbBytes)) return false;
    return containsRange(a, x.ps, x.pe, tinyLayoutBytes) &&
           containsRange(a, x.ps, x.pe, prominenceBytes);
  }

  function rewriteFeedContainer(a, start, end) {
    const f = parseFields(a, start, end);
    if (!f) return null;

    const drop = {};
    let ads = 0;
    let shells = 0;
    let dividers = 0;

    for (let i = 0; i < f.length; i++) {
      const x = f[i];
      if (x.wt !== 2) continue;

      if (x.no === 1 || x.no === 32) {
        const ev = adEvidence(a, x.ps, x.pe);
        if (ev.ad) {
          drop[i] = true;
          ads++;
          console.log(`[YT AdBlock v10] DROP FEED AD field=${x.no} bytes=${x.pe - x.ps} hits=${ev.hits} reason=${ev.reason}`);
          continue;
        }
      }

      if (isShell(a, x)) {
        drop[i] = true;
        shells++;
        console.log(`[YT AdBlock v10] DROP SHELL bytes=${x.pe - x.ps}`);
      }
    }

    for (let i = 0; i < f.length; i++) {
      if (drop[i]) continue;
      const x = f[i];
      if (x.wt !== 2 || x.no !== 1 || (x.pe - x.ps) > 3000) continue;
      if (!containsRange(a, x.ps, x.pe, dividerBytes)) continue;
      if (drop[i - 1]) {
        drop[i] = true;
        dividers++;
        console.log(`[YT AdBlock v10] DROP DIVIDER bytes=${x.pe - x.ps}`);
      }
    }

    if (ads === 0 && shells === 0) {
      return { changed: false, segs: [rangeSeg(start, end)], len: end - start, ads: 0, shells: 0, dividers: 0, genericAds: 0 };
    }

    const segs = [];
    for (let i = 0; i < f.length; i++) {
      if (!drop[i]) segs.push(rangeSeg(f[i].start, f[i].end));
    }
    return { changed: true, segs, len: totalLen(segs), ads, shells, dividers, genericAds: 0 };
  }

  function rewriteSearch(a, start, end, depth) {
    const f = parseFields(a, start, end);
    if (!f) return null;

    let changed = false;
    let ads = 0;
    let shells = 0;
    let dividers = 0;
    let genericAds = 0;
    const segs = [];

    for (let i = 0; i < f.length; i++) {
      const x = f[i];

      // 恢复原 Enhance 对非首页 browse 广告 item 的广泛处理：
      // field #1 / #32 在任意有效 protobuf 容器内若出现明确广告特征，则删除整项。
      if (x.wt === 2 && depth > 0 && (x.no === 1 || x.no === 32)) {
        const ev = adEvidence(a, x.ps, x.pe);
        if (ev.ad) {
          changed = true;
          genericAds++;
          console.log(`[YT AdBlock v10] DROP GENERIC BROWSE AD depth=${depth} field=${x.no} bytes=${x.pe - x.ps} hits=${ev.hits} reason=${ev.reason}`);
          continue;
        }
      }

      let child = null;
      if (x.wt === 2 && x.no === TARGET) {
        child = rewriteFeedContainer(a, x.ps, x.pe);
      } else if (x.wt === 2 && depth < MAX_SEARCH_DEPTH) {
        const probe = parseFields(a, x.ps, x.pe);
        if (probe) child = rewriteSearch(a, x.ps, x.pe, depth + 1);
      }

      if (child && child.changed) {
        segs.push(rangeSeg(x.start, x.keyEnd));
        segs.push(bytesSeg(varintBytes(child.len)));
        for (let j = 0; j < child.segs.length; j++) segs.push(child.segs[j]);
        changed = true;
        ads += child.ads || 0;
        shells += child.shells || 0;
        dividers += child.dividers || 0;
        genericAds += child.genericAds || 0;
      } else {
        segs.push(rangeSeg(x.start, x.end));
      }
    }

    return { changed, segs, len: totalLen(segs), ads, shells, dividers, genericAds };
  }

  try {
    // 独立广告 break：响应本身就是广告载荷。空 protobuf message 合法，直接让客户端拿不到伴随广告。
    if (url.includes('/youtubei/v1/player/ad_break')) {
      const input = $response.body instanceof Uint8Array ? $response.body : new Uint8Array($response.body || new ArrayBuffer(0));
      console.log(`[YT AdBlock v10] BLOCK player/ad_break bytes=${input.length} -> 0`);
      $done({ body: new Uint8Array(0) });
      return;
    }

    const input = $response.body instanceof Uint8Array ? $response.body : new Uint8Array($response.body);
    console.log(`[YT AdBlock v10] START browse bytes=${input.length}`);

    const plan = rewriteSearch(input, 0, input.length, 0);
    if (plan && plan.changed) {
      const out = emit(input, plan.segs, plan.len);
      console.log(`[YT AdBlock v10] DONE feedAds=${plan.ads} genericAds=${plan.genericAds} shells=${plan.shells} dividers=${plan.dividers}, ${input.length} -> ${out.length}`);
      $done({ body: out });
    } else {
      console.log(`[YT AdBlock v10] PASS browse bytes=${input.length}`);
      $done({});
    }
  } catch (e) {
    console.log(`[YT AdBlock v10] ERROR ${e}`);
    $done({});
  }
})();
