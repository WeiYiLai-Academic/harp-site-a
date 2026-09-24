// /harps/：型號舞台（左右翻頁：箭頭、分頁籤、點點、滑動、鍵盤、#27s 深連結）、顏色切換、拆解圖、比較表／尺寸圖同步。
(() => {
  const d = document;
  const stage = d.querySelector('[data-stage]');
  if (!stage) return;
  const data = JSON.parse(d.getElementById('harps-data').textContent);
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const N = data.length;
  const $ = (s, r = d) => r.querySelector(s), $$ = (s, r = d) => [...r.querySelectorAll(s)];

  const view = $('[data-view]', stage), track = $('[data-track]', stage), slides = $$('.hs-slide', stage);
  const rail = $('[data-hrail]', stage), tabs = $$('.hs-tab', rail), ind = $('[data-ind]', stage);
  const dots = $$('.hs-dots button', stage), count = $('[data-count]', stage);
  const prev = $('[data-prev]', stage), next = $('[data-next]', stage);

  stage.classList.add('js');
  track.scrollLeft = 0;
  // 沒有 JS 時 #27s 靠 id 讓 scroll-snap 捲到那一頁；有 JS 之後由 go() 接手。
  // 把 id 換掉，免得瀏覽器在載入完成前又把頁面捲到那一頁的位置（深連結應該停在頁首）
  slides.forEach((s) => { s.id = 'm-' + s.dataset.key; });
  tabs.forEach((t) => t.setAttribute('aria-controls', 'm-' + t.getAttribute('href').slice(1)));

  let i = Math.max(0, slides.findIndex((s) => s.classList.contains('is-cur')));

  const noAnim = (fn) => { stage.classList.add('dragging'); fn(); void track.offsetWidth; stage.classList.remove('dragging'); };
  const setSp = (frac = 0) => slides.forEach((s, k) => s.style.setProperty('--sp', (k - i + frac).toFixed(4)));
  const moveInd = (instant) => {
    const t = tabs[i]; if (!t || !ind) return;
    const f = () => { ind.style.setProperty('--x', t.offsetLeft + 'px'); ind.style.setProperty('--w', t.offsetWidth + 'px'); };
    if (instant) { ind.style.transition = 'none'; f(); void ind.offsetWidth; ind.style.transition = ''; } else f();
  };

  function go(n, o = {}) {
    n = Math.max(0, Math.min(N - 1, n));
    const changed = n !== i; i = n;
    const apply = () => { track.style.setProperty('--i', i); track.style.setProperty('--dx', '0px'); setSp(0); };
    (o.instant || RM.matches) ? noAnim(apply) : apply();
    slides.forEach((s, k) => {
      const on = k === i;
      s.classList.toggle('is-cur', on); s.inert = !on;
      if (Math.abs(k - i) <= 1) $$('img[loading="lazy"]', s).forEach((im) => { if (im.closest('[data-ph]')) im.loading = 'eager'; });
    });
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i); t.tabIndex = k === i ? 0 : -1; });
    moveInd(o.instant || RM.matches);
    // 手機上 7 個分頁籤放不下時，軌道可以橫向捲動：把目前這一台捲進畫面
    const rw = rail.parentElement;
    if (rw && rw.scrollWidth > rw.clientWidth + 2) { const t = tabs[i]; rw.scrollTo({ left: Math.max(0, t.offsetLeft + t.offsetWidth / 2 - rw.clientWidth / 2), behavior: (o.instant || RM.matches) ? 'auto' : 'smooth' }); }
    dots.forEach((b, k) => b.classList.toggle('on', k === i));
    count.textContent = i + 1;
    prev.disabled = i === 0; next.disabled = i === N - 1;
    if (!o.noHash) try { history.replaceState(null, '', '#' + data[i].key); } catch {}
    if (changed || o.force) d.dispatchEvent(new CustomEvent('hh-model', { detail: { i, key: data[i].key } }));
  }

  // ── 深連結 ──
  const fromHash = () => data.findIndex((m) => '#' + m.key === location.hash.toLowerCase());
  const h0 = fromHash();
  if (h0 >= 0) i = h0;
  go(i, { instant: true, noHash: h0 < 0, force: true });
  if (h0 >= 0) {
    // 瀏覽器會捲到 #27s 那一頁的位置；翻頁舞台本來就在最上面，回到頂端讓標題與分頁籤都看得到
    const top = () => { if (scrollY > 0 && stage.getBoundingClientRect().top < 0) scrollTo(0, 0); };
    requestAnimationFrame(top); addEventListener('load', () => requestAnimationFrame(top), { once: true });
  }
  addEventListener('hashchange', () => { const k = fromHash(); if (k >= 0) go(k); });

  // ── 箭頭、分頁籤、點點、其他區塊裡的「看這台」 ──
  prev.addEventListener('click', () => go(i - 1));
  next.addEventListener('click', () => go(i + 1));
  d.addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]');
    if (a) {
      e.preventDefault();
      go(+a.dataset.go);
      if (!stage.contains(a)) stage.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
      else if (a.classList.contains('hs-tab')) a.focus({ preventScroll: true });
      return;
    }
    const j = e.target.closest('[data-jump]');
    if (j) { const t = d.querySelector(j.getAttribute('href')); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' }); } }
  });

  // ── 鍵盤 ← → ──
  d.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (dlg && dlg.open) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], .cmp-wrap, .sz-scroll, .hs-sw-row, .xv-models, .an-set')) return;
    if (!stage.contains(t)) {
      if (t !== d.body && t !== d.documentElement) return;
      const r = stage.getBoundingClientRect();
      if (r.bottom < 160 || r.top > innerHeight * .6) return; // 舞台不在畫面上就不搶方向鍵
    }
    e.preventDefault();
    go(i + (e.key === 'ArrowRight' ? 1 : -1));
    if (t.classList && t.classList.contains('hs-tab')) tabs[i].focus({ preventScroll: true });
  });

  // ── 滑動（pointer events；觸控、筆、滑鼠拖曳都可以） ──
  let ps = null, eatClick = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && (e.button !== 0 || e.target.closest('a, button'))) return;
    if (e.target.closest('.hs-sw-row')) return;
    ps = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, drag: false, w: view.clientWidth || 1, dx: 0 };
  });
  view.addEventListener('pointermove', (e) => {
    if (!ps || e.pointerId !== ps.id) return;
    const dx = e.clientX - ps.x, dy = e.clientY - ps.y;
    if (!ps.drag) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        ps.drag = true; stage.classList.add('dragging');
        try { view.setPointerCapture(e.pointerId); } catch {}
      } else if (Math.abs(dy) > 12) { ps = null; }
      return;
    }
    e.preventDefault();
    const edge = (i === 0 && dx > 0) || (i === N - 1 && dx < 0);
    ps.dx = edge ? dx * .3 : dx;
    track.style.setProperty('--dx', ps.dx + 'px');
    setSp(ps.dx / ps.w);
  });
  const end = (e) => {
    if (!ps || e.pointerId !== ps.id) return;
    const p = ps; ps = null;
    if (!p.drag) return;
    stage.classList.remove('dragging');
    const v = p.dx / Math.max(1, performance.now() - p.t);
    let n = i;
    if (e.type !== 'pointercancel') {
      if (p.dx < -p.w * .18 || v < -.5) n = i + 1;
      else if (p.dx > p.w * .18 || v > .5) n = i - 1;
    }
    eatClick = true; setTimeout(() => { eatClick = false; }, 60);
    go(n, { force: n === i });
  };
  // 滑鼠按住照片拖曳：不要讓瀏覽器開始「拖曳圖片」（會送 pointercancel，翻頁就失效）
  view.addEventListener('dragstart', (e) => e.preventDefault());
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
  view.addEventListener('click', (e) => { if (eatClick) { e.preventDefault(); e.stopPropagation(); eatClick = false; } }, true);

  // 分頁籤指示條跟著字型與版面變化
  if ('ResizeObserver' in window) new ResizeObserver(() => moveInd(true)).observe(rail);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => moveInd(true));

  // ── 顏色：交叉淡入 ──
  const pick = (btn) => {
    const row = btn.closest('.hs-sw-row'), slide = btn.closest('.hs-slide');
    if (btn.getAttribute('aria-checked') === 'true') return;
    $$('.hs-dot', row).forEach((b) => { b.setAttribute('aria-checked', b === btn); b.tabIndex = b === btn ? 0 : -1; });
    const name = btn.dataset.name, label = $('[data-cname]', slide), ph = $('[data-ph]', slide);
    if (label) label.textContent = name;
    paintBuy();
    const old = $('img', ph), im = new Image();
    im.width = 720; im.height = 960; im.decoding = 'async';
    im.alt = (old ? old.alt.split('・')[0] : '') + '・' + name;
    im.src = btn.dataset.src;
    const show = () => {
      if (!RM.matches) im.className = 'fade-in';
      ph.appendChild(im);
      setTimeout(() => $$('img', ph).slice(0, -1).forEach((x) => x.remove()), RM.matches ? 0 : 650);
    };
    (im.decode ? im.decode() : Promise.resolve()).then(show, show);
  };
  $$('.hs-sw-row', stage).forEach((row) => {
    const bs = $$('.hs-dot', row);
    bs.forEach((b, k) => { b.tabIndex = k === 0 ? 0 : -1; });
    row.addEventListener('click', (e) => { const b = e.target.closest('.hs-dot'); if (b) pick(b); });
    row.addEventListener('keydown', (e) => {
      const k = bs.indexOf(d.activeElement); if (k < 0) return;
      const m = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!m) return;
      e.preventDefault(); const b = bs[(k + m + bs.length) % bs.length]; b.focus(); pick(b);
      b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  });

  // ── 目前選的顏色 ──
  const colorOf = (k) => { const b = $('.hs-dot[aria-checked="true"]', slides[k]); return b ? b.dataset.name : ''; };

  // ── 加入購物車：顏色一起帶進去（新版 cart.js 會把它寫進結帳備註）；沒載入 cart.js 就帶去商店頁 ──
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const C = window.HHCart;
    if (!C || typeof C.add !== 'function') { location.href = '/shop/'; return; }
    const slide = b.closest('.hs-slide'), k = slide ? slides.indexOf(slide) : i;
    const sku = slide ? b.dataset.add : data[k].sku, color = colorOf(k);
    let r;
    try { r = color ? C.add(sku, 1, { color }) : C.add(sku, 1); } catch { r = C.add(sku); }
    const lb = $('[data-add-lb]', b);
    b.classList.add('added'); if (lb) lb.textContent = '已加入購物車';
    clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('added'); if (lb) lb.textContent = '加入購物車'; }, 2200);
    return r;
  });

  // ── 捲離舞台後的購買列 ──
  const buy = d.querySelector('[data-buy]'), foot = d.querySelector('.site-ft');
  function paintBuy() {
    if (!buy) return;
    const m = data[i], c = colorOf(i);
    $('[data-buy-name]', buy).textContent = m.name;
    $('[data-buy-color]', buy).textContent = c ? '顏色：' + c : m.textColors ? '顏色：' + m.textColors : m.pending ? '規格確認中' : '';
    $('[data-buy-price]', buy).textContent = m.price;
    const add = $('[data-buy-add]', buy), line = $('[data-buy-line]', buy);
    if (m.sku) add.dataset.add = m.sku;
    add.hidden = !m.sku; line.hidden = !!m.sku; // 38 沒有在賣 ⇒ 只給 LINE 詢問
    $('[data-buy-go]', buy).setAttribute('href', '#' + m.key);
    const dot = $('.hs-dot[aria-checked="true"] img', slides[i]);
    $('[data-buy-img]', buy).src = dot ? dot.getAttribute('src') : m.thumb;
  }
  if (buy) {
    buy.hidden = false;
    let tick = 0;
    const check = () => {
      tick = 0;
      const past = stage.getBoundingClientRect().bottom < 40;
      const atFoot = foot && foot.getBoundingClientRect().top < innerHeight;
      const on = past && !atFoot;
      if (on !== buy.classList.contains('on')) { buy.classList.toggle('on', on); buy.inert = !on; d.body.classList.toggle('hs-buy-on', on); }
    };
    buy.inert = true;
    addEventListener('scroll', () => { if (!tick) tick = requestAnimationFrame(check); }, { passive: true });
    addEventListener('resize', check); check();
    $('[data-buy-go]', buy).addEventListener('click', (e) => { e.preventDefault(); stage.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' }); });
    d.addEventListener('hh-model', paintBuy);
    paintBuy();
  }

  // ── 構造圖（實拍照片＋編號定位點）──
  const xv = d.querySelector('[data-xv]');
  if (xv) {
    const sets = $$('.an-set', xv);
    const wide = matchMedia('(min-width: 960px)');
    const NS = 'http://www.w3.org/2000/svg';
    let curSet = sets.find((s) => !s.hidden) || sets[0];
    // 電腦版：從定位點拉引線到兩側的標籤
    const draw = () => {
      if (!curSet) return;
      const svg = $('.an-lines', curSet);
      svg.replaceChildren();
      const lis = $$('.an-li', curSet);
      if (!wide.matches) { curSet.classList.remove('an-abs'); lis.forEach((li) => { li.style.top = ''; }); curSet.style.minHeight = ''; return; }
      curSet.classList.add('an-abs');
      let box = curSet.getBoundingClientRect();
      // 標籤的高度對齊自己的定位點；互相重疊就往下推，超出底部再整欄往上收
      ['an-l', 'an-r'].forEach((side) => {
        const col = lis.filter((li) => li.classList.contains(side)).map((li) => {
          const pin = $(`.an-pin[data-p="${li.dataset.p}"]`, curSet);
          const pr = pin ? pin.getBoundingClientRect() : null;
          return { li, h: li.offsetHeight, want: pr ? pr.top + pr.height / 2 - box.top : 0 };
        }).sort((x, y) => x.want - y.want);
        let y = 0;
        col.forEach((c) => { c.top = Math.max(c.want - c.h / 2, y); y = c.top + c.h + 10; });
        const over = y - 10 - box.height;
        if (over > 0) { let floor = box.height; for (let k = col.length - 1; k >= 0; k--) { const c = col[k]; c.top = Math.min(c.top, floor - c.h); floor = c.top - 10; } }
        col.forEach((c) => { c.li.style.top = Math.max(0, c.top) + 'px'; });
      });
      box = curSet.getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      $$('.an-pin', curSet).forEach((pin) => {
        const li = $(`.an-li[data-p="${pin.dataset.p}"]`, curSet); if (!li) return;
        const p = pin.getBoundingClientRect(), l = li.getBoundingClientRect();
        const px = p.left + p.width / 2 - box.left, py = p.top + p.height / 2 - box.top;
        const left = li.classList.contains('an-l');
        const lx = (left ? l.right + 8 : l.left - 8) - box.left, ly = l.top + l.height / 2 - box.top;
        const ex = left ? lx + 28 : lx - 28;
        const dx = px - ex, dy = py - ly, len = Math.hypot(dx, dy) || 1;
        const tx = px - (dx / len) * 17, ty = py - (dy / len) * 17; // 停在定位點圓圈外緣
        const path = d.createElementNS(NS, 'path');
        path.setAttribute('d', `M${lx.toFixed(1)} ${ly.toFixed(1)}H${ex.toFixed(1)}L${tx.toFixed(1)} ${ty.toFixed(1)}`);
        path.dataset.p = pin.dataset.p;
        if (pin.classList.contains('is-on')) path.classList.add('is-on');
        svg.appendChild(path);
        const dot = d.createElementNS(NS, 'circle');
        dot.setAttribute('cx', lx.toFixed(1)); dot.setAttribute('cy', ly.toFixed(1)); dot.setAttribute('r', 3); dot.dataset.p = pin.dataset.p;
        svg.appendChild(dot);
      });
    };
    const light = (id, scroll) => {
      $$('[data-p]', curSet).forEach((el) => el.classList.toggle('is-on', el.dataset.p === id));
      if (scroll && !wide.matches) { const li = $(`.an-li[data-p="${id}"]`, curSet); li && li.scrollIntoView({ block: 'nearest', behavior: RM.matches ? 'auto' : 'smooth' }); }
    };
    xv.addEventListener('click', (e) => {
      const pin = e.target.closest('.an-pin'); if (pin) { light(pin.dataset.p, true); return; }
      const li = e.target.closest('.an-li'); if (li && !li.classList.contains('off')) light(li.dataset.p, false);
    });
    xv.addEventListener('mouseover', (e) => { if (!wide.matches) return; const t = e.target.closest('.an-pin, .an-li'); if (t && !t.classList.contains('off')) light(t.dataset.p, false); });
    const setModel = (k) => {
      const m = data[k];
      // 34、38 還沒有構造圖 ⇒ 停在原本那一台，型號按鈕都不按下
      if (!sets.some((s) => s.dataset.an === m.key)) { $$('[data-xm]', xv).forEach((b) => b.setAttribute('aria-pressed', 'false')); return; }
      sets.forEach((s) => { s.hidden = s.dataset.an !== m.key; });
      curSet = sets.find((s) => !s.hidden);
      $$('img[loading="lazy"]', curSet).forEach((im) => { im.loading = 'eager'; });
      $('[data-xname]', xv).textContent = m.name;
      $$('[data-xm]', xv).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.xm === k));
      requestAnimationFrame(draw);
    };
    $$('[data-xm]', xv).forEach((b) => b.addEventListener('click', () => go(+b.dataset.xm)));
    d.addEventListener('hh-model', (e) => setModel(e.detail.i));
    sets.forEach((s) => $$('img', s).forEach((im) => im.addEventListener('load', () => { if (s === curSet) draw(); })));
    addEventListener('resize', () => requestAnimationFrame(draw));
    wide.addEventListener ? wide.addEventListener('change', draw) : 0;
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(draw);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { draw(); } }), { threshold: .1 });
      io.observe(xv);
    }
    setModel(i);
  }

  // ── 比較表與尺寸圖：標出目前的型號 ──
  const mark = (key) => $$('[data-col]').forEach((el) => el.classList.toggle('is-sel', el.dataset.col === key));
  d.addEventListener('hh-model', (e) => mark(e.detail.key));
  mark(data[i].key);
  // ── 聽音色：點了才載入 YouTube（youtube-nocookie），直式影片用直式播放框；關掉就移除 iframe（停止播放） ──
  let dlg = null;
  const openVideo = (btn) => {
    if (!dlg) {
      dlg = d.createElement('dialog');
      dlg.className = 'hs-yt';
      dlg.setAttribute('aria-label', '聽音色影片');
      dlg.innerHTML = '<div class="hs-yt-box"><p class="hs-yt-t"></p><button type="button" class="hs-yt-x" aria-label="關閉影片">×</button><div class="hs-yt-frame"></div></div>';
      d.body.appendChild(dlg);
      dlg.addEventListener('close', () => { $('.hs-yt-frame', dlg).replaceChildren(); });
      dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.hs-yt-x')) dlg.close(); });
    }
    const id = btn.dataset.listen, ar = btn.dataset.ar || '16 / 9';
    const f = d.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
    f.title = btn.dataset.title || 'YouTube 影片';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    const box = $('.hs-yt-frame', dlg);
    box.style.setProperty('--ar', ar);
    box.classList.toggle('vert', /^(9 \/ 16|720 \/ 1144)$/.test(ar));
    box.replaceChildren(f);
    $('.hs-yt-t', dlg).textContent = btn.dataset.title || '';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  };
  d.addEventListener('click', (e) => { const b = e.target.closest('[data-listen]'); if (b) { e.preventDefault(); openVideo(b); } });
})();
