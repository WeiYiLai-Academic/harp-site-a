// /shop/ 專用：分類篩選、加入購物車的按鈕動畫、商品介紹（底部抽屜／對話框＋可滑動相簿）、#p-SKU 連結、?paid=1。
// 購物車本身（儲存、抽屜、結帳交接）在 cart.js。
(() => {
  const d = document, b = d.body;
  const $ = (s, r = d) => r.querySelector(s), $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let DATA = { products: {}, line: '' };
  try { DATA = JSON.parse($('#hh-shop-data').textContent); } catch {}
  const P = DATA.products || {};
  const Cart = window.HHCart;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const keep = (s) => esc(s).replace(/Hope Harp希望豎琴|賴薇伊|Hope Harp/g, (n) => `<span class="nw">${n}</span>`);
  const ntd = (n) => 'NT$' + Number(n).toLocaleString('en-US');
  const hdH = () => parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--hd-h')) || 68;
  const CAT = { harp: ['Harps', '豎琴'], course: ['Lessons', '課程'], book: ['Books & Scores', '課本與樂譜'], ebook: ['E-books', '電子書'], acc: ['Strings & Accessories', '配件與琴弦'] };
  const IC = {
    check: '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    cart: '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/></svg>',
    line: '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.2.9c0 .3-.2 1 .9.5s6-3.5 8.2-6.1C21.4 14 22 12.6 22 11c0-4.4-4.5-8-10-8z"/></svg>',
    l: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    r: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    arrow: '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    harp: '<svg viewBox="0 0 64 80" width="96" height="120" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 74V8c14 0 26 9 36 30L14 74z"/><path d="M14 8c0 0 5-3 11 0"/><path d="M22 14v48M30 19v37M38 26v24M46 35v9" opacity=".7"/></svg>',
  };

  // 手機：下單須知收成可以點開的清單（沒有 JS 時全部展開）
  if (innerWidth < 720) $$('[data-acc]').forEach((el) => { el.open = false; });

  // ── 付款完成回來 ──
  if (Cart && Cart.justPaid) { const pb = $('[data-paid]'); if (pb) pb.hidden = false; }

  // ── 分類篩選 ──
  const bar = $('[data-bar]'), chips = $$('[data-filter]'), secs = $$('[data-cat-sec]');
  let current = 'all';
  function filter(cat, { scroll = true, hash = true } = {}) {
    if (cat !== 'all' && !secs.some((s) => s.dataset.catSec === cat)) cat = 'all';
    current = cat;
    chips.forEach((c) => c.setAttribute('aria-current', c.dataset.filter === cat ? 'true' : 'false'));
    secs.forEach((s) => { s.hidden = cat !== 'all' && s.dataset.catSec !== cat; });
    const on = chips.find((c) => c.dataset.filter === cat);
    if (on && on.scrollIntoView) on.parentElement.scrollTo({ left: on.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
    // 新顯示的卡片不要停在「還沒出場」的狀態
    secs.forEach((s) => { if (!s.hidden) $$('.reveal', s).forEach((el) => el.classList.add('in')); });
    if (hash) try { history.replaceState(null, '', location.pathname + location.search + (cat === 'all' ? '' : '#' + cat)); } catch {}
    if (scroll) {
      const list = $('#shop');
      const y = list.getBoundingClientRect().top + scrollY - hdH() - (bar ? bar.offsetHeight : 0) + 8;
      if (scrollY > y || cat !== 'all') scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
  }
  chips.forEach((c) => c.addEventListener('click', (e) => { e.preventDefault(); filter(c.dataset.filter); }));
  if (bar) {
    const onScroll = () => bar.classList.toggle('stuck', bar.getBoundingClientRect().top <= hdH() + 1);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  const openCartBtn = $('[data-open-cart]');
  if (openCartBtn) openCartBtn.addEventListener('click', () => Cart && Cart.open());

  // ── 加入購物車（卡片上的按鈕：變成 ✓ 已加入）──
  const morph = (btn) => {
    btn.classList.add('is-added');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => btn.classList.remove('is-added'), 1800);
  };
  d.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault(); e.stopPropagation();
      if (!Cart) return;
      Cart.add(add.dataset.add, 1).then((ok) => { if (ok) morph(add); });
      return;
    }
    const op = e.target.closest('[data-open]');
    if (op) { e.preventDefault(); openSheet(op.dataset.open, op); return; }
    // 點卡片其他地方也打開介紹（按鈕與連結除外）
    const pc = e.target.closest('.pc');
    if (pc && !e.target.closest('a,button')) openSheet(pc.dataset.sku, pc);
  });

  // ── 商品介紹 ──
  const sheet = $('[data-sheet]'), card = sheet && $('.sheet-card', sheet), body = sheet && $('[data-sheet-body]', sheet);
  let openSku = null, lastFocus = null, closeTimer;

  // 有顏色名稱的照片（型號照片；名稱取自正式站 /harps/）⇒ 資訊欄裡改放「選顏色」，選了就帶進購物車
  const colored = (p) => p.pics.length > 1 && p.pics.every((x) => x.c);
  function colorPicker(p) {
    return `<fieldset class="sd-colors"><legend>選顏色：<b data-cn>${esc(p.pics[0].c)}</b><span>照片為部分顏色，每款都有 16 色</span></legend>
      <div class="sd-sw" role="radiogroup" aria-label="顏色">${p.pics.map((x, i) => `<button type="button" role="radio" data-thumb="${i}" aria-checked="${i ? 'false' : 'true'}"${i ? ' tabindex="-1"' : ''}>
        <img src="${esc(x.t)}" width="48" height="64" alt="" loading="lazy" decoding="async"><span>${esc(x.c)}</span></button>`).join('')}</div>
      <p class="sd-cnote">現貨顏色請先用 LINE 詢問，指定顏色可訂製，交期約 70 天；選的顏色會帶到結帳備註，付款完成後老師會與您聯絡確認顏色與出貨時間。</p></fieldset>`;
  }
  // 常一起買（詳細頁）：只列真實商品；已在車裡的不列
  function crossHtml(sku) {
    const xs = Cart && Cart.suggest ? Cart.suggest([sku]) : [];
    if (!xs.length) return '';
    return `<section class="sd-x" aria-labelledby="sd-x-h"><h3 id="sd-x-h">常一起買</h3><ul class="hhc-xl">${xs.map((x) => {
      const c = Cart.catalog(x) || {};
      return `<li class="hhc-xi"><div class="hhc-th">${c.i ? `<img src="${esc(c.i)}" width="52" height="68" alt="" loading="lazy" decoding="async">` : ''}</div>
        <div><p class="hhc-nm"><a href="#p-${esc(x)}">${keep(c.n)}</a></p><p class="hhc-sh">${ntd(c.p)}</p></div>
        <button type="button" class="hhc-xadd" data-x-add="${esc(x)}" aria-label="加入 ${esc(c.n)}">＋ 加入</button></li>`;
    }).join('')}</ul></section>`;
  }

  function galleryHtml(p) {
    if (!p.pics.length) return `<div class="sd-gal"><div class="sd-ph"><span class="pc-ph">${IC.harp}<span class="pc-ph-en latin">${esc(CAT[p.cat][0])}</span></span></div></div>`;
    const many = p.pics.length > 1;
    return `<div class="sd-gal" aria-roledescription="相簿" aria-label="${esc(p.name)} 的照片">
      <div class="sd-stage"><div class="sd-track" tabindex="0" data-track>${p.pics.map((x, i) => `<figure class="sd-slide" aria-label="第 ${i + 1} 張，共 ${p.pics.length} 張${x.c ? '：' + esc(x.c) : ''}">
        <img src="${esc(x.src)}" width="600" height="800" alt="${esc(p.name)}${x.c ? ' ' + esc(x.c) : ''}" ${i ? 'loading="lazy"' : ''} decoding="async"></figure>`).join('')}</div>
      ${many ? `<button class="sd-arrow sd-prev" type="button" data-go="-1" aria-label="上一張">${IC.l}</button><button class="sd-arrow sd-next" type="button" data-go="1" aria-label="下一張">${IC.r}</button>` : ''}
      <div class="sd-cap"><span data-cap-c></span>${many ? '<span data-cap-n></span>' : ''}</div></div>
      ${many && !colored(p) ? `<div class="sd-thumbs" role="group" aria-label="選擇照片">${p.pics.map((x, i) => `<button type="button" data-thumb="${i}" aria-label="${x.c ? esc(x.c) : '第 ' + (i + 1) + ' 張'}"${i ? '' : ' aria-current="true"'}><img src="${esc(x.t)}" width="54" height="72" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>` : ''}
    </div>`;
  }

  function infoHtml(sku, p) {
    const max = p.stock != null ? Math.min(99, p.stock) : 99;
    const blocks = [];
    if (p.specs) blocks.push(`<dl class="specs sd-specs">${p.specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`);
    if (p.digital) {
      blocks.push(`<div class="sd-block"><h3>電子書・付款後立即下載</h3><ul>
        ${p.files ? `<li>內含 ${esc(p.files)}。</li>` : ''}
        ${p.dl ? `<li>付款完成後，頁面上會直接出現下載按鈕。下載連結 ${p.dl.days} 天內有效，每個檔案可以下載 ${p.dl.per} 次。</li>` : '<li>付款完成後，頁面上會直接出現下載按鈕。</li>'}
        <li><strong>機構授權</strong>：購買的機構可以在內部不限人數使用、列印與教學；不可以轉售、公開散布，或提供給購買機構以外的單位使用。</li>
        <li>電子書是數位內容，付款後立即提供，<strong>不適用七天鑑賞期</strong>（結帳時會請您確認）。</li>
        ${p.elder ? '<li>樂齡課程是音樂與藝術活動，<strong>非醫療行為</strong>。</li>' : ''}
      </ul></div>`);
      if (p.fileNames && p.fileNames.length) blocks.push(`<details class="sd-block"><summary>檔案清單（${p.fileNames.length} 個）</summary><ul>${p.fileNames.map((n) => `<li>${keep(n)}</li>`).join('')}</ul></details>`);
    } else if (p.shipNote) {
      blocks.push(`<div class="sd-block"><h3>運送方式</h3><p>${esc(p.shipLabel)}：${esc(p.shipNote)}。</p>
        ${p.cat === 'harp' ? `<p>顏色的現貨與訂製時間，請在下單前用 <a href="${esc(DATA.line)}" rel="noopener">LINE</a> 與老師確認。</p>` : ''}</div>`);
    }
    return `<div class="sd-info">
      <p class="eyebrow">${esc(CAT[p.cat][0])}</p>
      <h2 id="sheet-title">${keep(p.name)}</h2>
      <p class="sd-price"><span class="price"><small>NT$</small>${Number(p.price).toLocaleString('en-US')}</span>${p.listPrice ? `<s class="price-was">原價 ${ntd(p.listPrice)}</s>` : ''}</p>
      <div class="sd-chips"><span class="chip chip-gold">${esc(p.shipLabel)}</span>${p.listPrice ? '<span class="chip chip-rose">限時優惠</span>' : ''}</div>
      ${p.canBuy && colored(p) ? colorPicker(p) : ''}
      ${p.summary ? `<p class="sd-sum">${keep(p.summary)}</p>` : ''}
      ${blocks.join('')}
      ${crossHtml(sku)}
      ${p.more ? `<a class="link-arrow sd-more" href="${esc(p.more)}">看完整規格、顏色與型錄${IC.arrow}</a>` : ''}
      <div class="sd-buy">
        ${p.canBuy ? `<div class="sd-row">
          <div class="sd-qty" role="group" aria-label="數量">
            <button type="button" data-q="-1" aria-label="減少一件" disabled>−</button><output data-qv aria-live="polite">1</output><button type="button" data-q="1" aria-label="增加一件"${max <= 1 ? ' disabled' : ''}>＋</button>
          </div>
          <button class="btn btn-gold btn-lg pc-add" type="button" data-sheet-add="${esc(sku)}" data-max="${max}"><span class="pc-add-t">${IC.cart}加入購物車</span><span class="pc-add-ok" aria-hidden="true">${IC.check}已加入</span></button>
        </div>` : ''}
        <a class="btn btn-line btn-lg btn-block" href="${esc(DATA.line)}" rel="noopener">${IC.line}用 LINE 問老師</a>
      </div>
    </div>`;
  }

  function wireGallery() {
    const track = $('[data-track]', body); if (!track) return;
    const slides = $$('.sd-slide', track), thumbs = $$('[data-thumb]', body), p = P[openSku];
    const capC = $('[data-cap-c]', body), capN = $('[data-cap-n]', body), prev = $('.sd-prev', body), next = $('.sd-next', body);
    let idx = 0;
    const show = (i) => {
      idx = i;
      if (capC) capC.textContent = (p.pics[i] && p.pics[i].c) || '';
      if (capN) capN.textContent = `${i + 1} / ${slides.length}`;
      thumbs.forEach((t, k) => {
        if (t.getAttribute('role') === 'radio') { t.setAttribute('aria-checked', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; }
        else t.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
      if (colored(p)) { body.dataset.color = p.pics[i].c; const cn = $('[data-cn]', body); if (cn) cn.textContent = p.pics[i].c; }
      const t = thumbs[i]; if (t && t.parentElement.classList.contains('sd-thumbs')) t.parentElement.scrollTo({ left: t.offsetLeft - t.parentElement.clientWidth / 2 + t.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
      if (prev) prev.disabled = i === 0; if (next) next.disabled = i === slides.length - 1;
    };
    const go = (i) => { i = Math.max(0, Math.min(slides.length - 1, i)); track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' }); show(i); };
    let raf;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const i = Math.round(track.scrollLeft / track.clientWidth); if (i !== idx) show(i); }); }, { passive: true });
    body.querySelectorAll('[data-go]').forEach((btn) => btn.addEventListener('click', () => go(idx + Number(btn.dataset.go))));
    thumbs.forEach((t) => t.addEventListener('click', () => go(Number(t.dataset.thumb))));
    // 選顏色：方向鍵在選項之間移動（radiogroup 的標準操作）
    const sw = $('.sd-sw', body);
    if (sw) sw.addEventListener('keydown', (e) => {
      const dx = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!dx) return;
      e.preventDefault(); go(idx + dx); const b2 = thumbs[idx]; if (b2) b2.focus();
    });
    track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); } });
    show(0);
  }

  function wireBuy() {
    $$('[data-x-add]', body).forEach((b2) => b2.addEventListener('click', () => {
      if (!Cart || b2.disabled) return;
      Cart.add(b2.dataset.xAdd, 1).then((ok) => { if (ok) { b2.disabled = true; b2.textContent = '✓ 已加入'; } });
    }));
    const addBtn = $('[data-sheet-add]', body); if (!addBtn) return;
    const out = $('[data-qv]', body), max = Number(addBtn.dataset.max) || 99;
    let q = 1;
    const paintQ = () => { out.textContent = q; $('[data-q="-1"]', body).disabled = q <= 1; $('[data-q="1"]', body).disabled = q >= max; };
    $$('[data-q]', body).forEach((btn) => btn.addEventListener('click', () => { q = Math.max(1, Math.min(max, q + Number(btn.dataset.q))); paintQ(); }));
    addBtn.addEventListener('click', () => {
      if (!Cart) return;
      const pp = P[openSku], color = colored(pp) ? body.dataset.color || '' : '';
      const pic = color && pp.pics.find((x) => x.c === color);
      Cart.add(addBtn.dataset.sheetAdd, q, color ? { color, img: pic ? pic.t : '' } : {}).then((ok) => { if (ok) { morph(addBtn); q = 1; paintQ(); } });
    });
  }

  function openSheet(sku, from) {
    const p = P[sku]; if (!p || !sheet) return;
    clearTimeout(closeTimer);
    openSku = sku;
    lastFocus = from || d.activeElement;
    delete body.dataset.color;
    body.innerHTML = galleryHtml(p) + infoHtml(sku, p);
    body.scrollTop = 0;
    wireGallery(); wireBuy();
    sheet.hidden = false; b.classList.add('sheet-open');
    card.style.removeProperty('--drag');
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add('on')));
    try { history.replaceState(null, '', location.pathname + location.search + '#p-' + sku); } catch {}
    setTimeout(() => card.focus({ preventScroll: true }), 30);
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.classList.remove('on'); b.classList.remove('sheet-open');
    if (/^#p-/.test(location.hash)) try { history.replaceState(null, '', location.pathname + location.search + (current === 'all' ? '' : '#' + current)); } catch {}
    closeTimer = setTimeout(() => { sheet.hidden = true; body.innerHTML = ''; card.style.removeProperty('--drag'); }, reduce ? 0 : 380);
    const back = lastFocus && lastFocus.isConnected ? lastFocus : openSku && $('#p-' + CSS.escape(openSku));
    openSku = null;
    if (back && back.focus) back.focus({ preventScroll: true });
  }
  if (sheet) {
    sheet.addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) closeSheet(); });
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('a[href],button:not(:disabled),[tabindex="0"],summary', card).filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && (d.activeElement === f[0] || d.activeElement === card)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    // 手機：在頂端往下拉就關掉（相簿的左右滑不算）
    const scroller = body;
    let y0 = null, dy = 0;
    card.addEventListener('touchstart', (e) => {
      if (innerWidth >= 900 || e.target.closest('.sd-track,.sd-thumbs') || scroller.scrollTop > 0) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    card.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0 && scroller.scrollTop <= 0) { sheet.classList.add('dragging'); card.style.setProperty('--drag', dy + 'px'); }
    }, { passive: true });
    card.addEventListener('touchend', () => {
      if (y0 == null) return;
      sheet.classList.remove('dragging');
      if (dy > 110) closeSheet(); else card.style.removeProperty('--drag');
      y0 = null;
    });
  }

  // ── 網址的 #：#p-SKU 捲到那張卡、亮一下、打開介紹；#harp 等是分類 ──
  function fromHash(first) {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h || h === 'cart') return;
    if (h.startsWith('p-') && P[h.slice(2)]) {
      const sku = h.slice(2), el = d.getElementById(h);
      const sec = el && el.closest('[data-cat-sec]');
      if (sec && sec.hidden) filter('all', { scroll: false, hash: false });
      if (el) {
        el.classList.add('in');
        el.scrollIntoView({ block: 'center', behavior: first || reduce ? 'auto' : 'smooth' });
        el.classList.remove('is-hl'); void el.offsetWidth; el.classList.add('is-hl');
        setTimeout(() => el.classList.remove('is-hl'), 4000);
      }
      if (openSku !== sku) setTimeout(() => openSheet(sku, el && $('[data-open]', el)), first ? 350 : 250);
      return;
    }
    // 課程卡（#p-COURSE-…）沒有商品介紹，捲過去亮一下就好
    const el2 = h.startsWith('p-') && d.getElementById(h);
    if (el2) {
      const sec = el2.closest('[data-cat-sec]');
      if (sec && sec.hidden) filter('all', { scroll: false, hash: false });
      el2.classList.add('in');
      el2.scrollIntoView({ block: 'center', behavior: first || reduce ? 'auto' : 'smooth' });
      el2.classList.remove('is-hl'); void el2.offsetWidth; el2.classList.add('is-hl');
      setTimeout(() => el2.classList.remove('is-hl'), 4000);
      return;
    }
    if (CAT[h]) filter(h, { scroll: !first, hash: false });
  }
  addEventListener('hashchange', () => fromHash(false));
  // 瀏覽器的預設錨點跳躍會被黏住的分類列蓋住；等版面穩定再處理一次
  if (location.hash) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    requestAnimationFrame(() => fromHash(true));
  }
})();
