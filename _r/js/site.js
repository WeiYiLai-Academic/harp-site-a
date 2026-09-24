// 全站共用：頁首捲動狀態、手機選單、出場動畫、購物車數字。頁面專屬的互動放 src/js/<page>.js。
(() => {
  const d = document, b = d.body;
  b.classList.remove('no-js');

  const hd = d.querySelector('[data-hd]');
  const onScroll = () => hd && hd.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const btn = d.querySelector('[data-menu-btn]'), drawer = d.querySelector('[data-drawer]');
  if (btn && drawer) {
    const set = (open) => {
      drawer.hidden = !open; btn.setAttribute('aria-expanded', open);
      btn.setAttribute('aria-label', open ? '關閉選單' : '開啟選單'); b.classList.toggle('menu-open', open);
    };
    btn.addEventListener('click', () => set(drawer.hidden));
    drawer.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', (e) => {
      if (drawer.hidden) return;
      if (e.key === 'Escape') { set(false); btn.focus(); return; }
      // 選單蓋住整個畫面：Tab 只在頁首（選單鈕＋選單內容）裡繞，不要跑到被蓋住的頁面
      if (e.key !== 'Tab' || !hd) return;
      const f = [...hd.querySelectorAll('a[href],button:not(:disabled)')].filter((x) => x.offsetParent);
      if (!f.length) return;
      const i = f.indexOf(d.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
    });
  }

  const els = d.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add('in'));

  // 購物車數字：商店的 cart.js 用同一個 key 存（hh_cart_v1，與正式站相同；格式以 cart.js 為準）
  const paint = () => {
    let n = 0;
    try { n = (JSON.parse(localStorage.getItem('hh_cart_v1') || '[]') || []).reduce((a, x) => a + (+x.qty || 0), 0); } catch {}
    d.querySelectorAll('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
  };
  paint(); addEventListener('storage', paint); addEventListener('hh-cart', paint);

  // 首頁／英文頁的大標題是「由下往上浮現」的合成層動畫（opacity 0 開始）。Chrome 只在「重畫」時記錄 LCP，
  // 動畫期間只有合成、沒有重畫 ⇒ 標題一直沒被記錄，直到網頁字型換上（重畫）才記 ⇒ LCP 被算成字型到的時間。
  // 動畫結束時把 animation 拿掉（最後一格＝原本樣子，畫面完全一樣），讓瀏覽器在「標題真的完整出現」的那一刻重畫一次。
  const heroLn = [...d.querySelectorAll('.hero h1 .ln > span')];
  let heroDone = !heroLn.length || !heroLn[0].getAnimations;
  if (!heroDone) {
    Promise.all(heroLn.map((el) => Promise.all(el.getAnimations().map((a) => a.finished.catch(() => null)))
      .then(() => { el.style.animation = 'none'; }))).then(() => { heroDone = true; if (typeof fontStart === 'function') fontStart(); });
  }
  let fontStart = null; // 下面網頁字型的啟動函式（標題動畫完、LCP 記下之後才換字型）

  // ── 網頁字型（perf/assets.mjs 在 <head> 放了 <style id="hhf" media="print"> 的 @font-face）──
  // 之前來過：<head> 已經把 media 切成 all（字型在快取裡），這裡什麼都不做。
  // 第一次來訪：畫面先用系統字畫出來（不讓 1 MB 級的中文字型擋住首屏），window load 之後的下一幀，
  //   只下載「這一頁真的有字用到」的字重，全部到齊後一次換上 ⇒ 只重排一次（中文字重排很貴）。
  //   其餘 @font-face 也一併登記，之後打開抽屜／購物車用到別的字重時瀏覽器會自己補載。
  const hhf = d.getElementById('hhf');
  if (hhf && hhf.media !== 'all' && hhf.sheet && d.fonts && 'FontFace' in window && 'PerformanceObserver' in window) {
    const OURS = /^(Noto Sans TC|Noto Serif TC|Cormorant Garamond)$/;
    const CJK = /[⺀-鿿豈-￯]/, LAT = /[A-Za-z0-9]/;
    // CSS Fonts 4 的字重比對：網頁要 600、只有 500／700 時用哪一個
    const pickW = (avail, w) => {
      if (avail.includes(w)) return w;
      const up = avail.filter((x) => x > w).sort((a, c) => a - c), dn = avail.filter((x) => x < w).sort((a, c) => c - a);
      if (w >= 400 && w <= 500) { const mid = up.filter((x) => x <= 500); return mid.length ? mid[0] : dn.length ? dn[0] : up[0]; }
      return w < 400 ? (dn.length ? dn[0] : up[0]) : (up.length ? up[0] : dn[0]);
    };
    const go = () => {
      const faces = [];
      for (const r of hhf.sheet.cssRules) {
        if (!(r instanceof CSSFontFaceRule)) continue;
        const s = r.style, g = (k) => s.getPropertyValue(k).trim();
        const fam = g('font-family').replace(/["']/g, '');
        const desc = { weight: g('font-weight') || '400', style: g('font-style') || 'normal', display: 'swap' };
        if (g('unicode-range')) desc.unicodeRange = g('unicode-range');
        try { faces.push({ fam, w: +desc.weight, it: desc.style !== 'normal', ff: new FontFace(fam, g('src'), desc) }); } catch (e) { /* 單一字型壞掉不影響其他 */ }
      }
      if (!faces.length) return;
      // 這一頁實際用到的（字族, 字重, 斜體）：看每段文字所在元素的計算樣式
      const need = new Set(), seen = new Set();
      const tw = d.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let last = null, cs = null;
      for (let n; (n = tw.nextNode());) {
        const el = n.parentElement, t = n.data;
        if (!el || !t.trim() || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(el.tagName)) continue;
        if (el !== last) { last = el; cs = getComputedStyle(el); }
        const key = cs.fontFamily + '|' + cs.fontWeight + '|' + cs.fontStyle + '|' + CJK.test(t) + LAT.test(t);
        if (seen.has(key)) continue;
        seen.add(key);
        cs.fontFamily.split(',').map((x) => x.trim().replace(/["']/g, '')).forEach((fam, i) => {
          if (!OURS.test(fam)) return;
          if (fam[0] === 'C' ? !LAT.test(t) : i > 0 && !CJK.test(t)) return; // 排在後面的中文字型只負責中文字
          const it = cs.fontStyle !== 'normal';
          let cand = faces.filter((f) => f.fam === fam && f.it === it);
          if (!cand.length) cand = faces.filter((f) => f.fam === fam);
          if (!cand.length) return;
          need.add(fam + '|' + pickW([...new Set(cand.map((f) => f.w))], +cs.fontWeight) + '|' + cand[0].it);
        });
      }
      const load = faces.filter((f) => need.has(f.fam + '|' + f.w + '|' + f.it));
      Promise.all(load.map((f) => f.ff.load().catch(() => null))).then(() => {
        // 一個字族一個工作、隔一幀再換下一個：每次重排只動用到那個字族的字，不會卡住畫面一大段（TBT／INP）
        const fams = [...new Set(faces.map((f) => f.fam))];
        const next = () => {
          const fam = fams.shift();
          if (!fam) { try { localStorage.setItem('hhf', '1'); } catch (e) { /* 無痕模式 */ } return; }
          faces.filter((f) => f.fam === fam).forEach((f) => d.fonts.add(f.ff));
          requestAnimationFrame(() => setTimeout(next, 0));
        };
        next();
      });
    };
    // 開始的時機：window load（首屏圖片都到了）＋瀏覽器真的畫出第一幀（FCP）＋首屏最大元素（LCP）安定下來
    // （600ms 沒有新的 LCP 候選；首頁標題是逐行浮現的動畫，LCP 會比 FCP 晚一兩百毫秒）之後才開始。
    // 只看 load 不夠：GPU 初始化慢的機器，load 比第一幀早好幾百毫秒，字型會跟首屏搶。
    const types = PerformanceObserver.supportedEntryTypes || [];
    let loaded = d.readyState === 'complete', painted = !types.includes('paint'), started = false, quiet = 0, since = 0;
    const start = () => {
      if (started || !loaded || !painted || !heroDone) return;
      since = since || performance.now();
      clearTimeout(quiet); // 最多再等 4 秒（一直有新候選的頁面也會換字型）
      const wait = types.includes('largest-contentful-paint') ? Math.max(0, Math.min(600, since + 4000 - performance.now())) : 0;
      quiet = setTimeout(() => { started = true; requestAnimationFrame(() => setTimeout(go, 0)); }, wait);
    };
    if (!painted) {
      const po = new PerformanceObserver((l) => { if (l.getEntries().some((e) => e.name === 'first-contentful-paint')) { painted = true; po.disconnect(); start(); } });
      po.observe({ type: 'paint', buffered: true });
      setTimeout(() => { painted = true; start(); }, 6000); // 保險：背景分頁等等拿不到 FCP 時也不會永遠不換字型
    }
    if (types.includes('largest-contentful-paint')) {
      const lo = new PerformanceObserver(() => { if (started) lo.disconnect(); else start(); }); // 每來一個新候選就重新計時
      lo.observe({ type: 'largest-contentful-paint', buffered: true });
    }
    if (!loaded) addEventListener('load', () => { loaded = true; start(); });
    fontStart = start;
    start();
  }

  // 公告列：按 × 之後，同一則（data-announce 的 id）不再顯示
  const ann = d.querySelector('[data-announce]');
  if (ann) {
    const key = 'hh_announce_x';
    let closed = [];
    try { closed = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
    if (closed.includes(ann.dataset.announce)) ann.remove();
    else ann.querySelector('[data-announce-x]').addEventListener('click', () => {
      ann.remove();
      try { localStorage.setItem(key, JSON.stringify([...closed, ann.dataset.announce].slice(-20))); } catch {}
    });
  }
})();
