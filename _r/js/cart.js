/* Hope Harp 共用購物車（任何頁面放進 scripts 就有：右側滑出的購物車抽屜＋「已加入購物車」提示＋「常一起買」）
 *
 * ── 對外介面 ─────────────────────────────────────────────
 *   HHCart.add(sku, qty = 1, opts)  加入；opts.color＝顏色名稱（例「天空藍」）、opts.img＝那個顏色的縮圖（選填）。
 *                                    同一個型號、不同顏色＝不同的兩行。
 *                                    回傳 Promise<boolean>。opts.quiet＝true 時不跳提示。
 *   HHCart.remove(sku, color?)      移除；不給 color ⇒ 這個 sku 的每一行都移除
 *   HHCart.set(sku, qty, color?)    設定數量（≤ 0 等於移除；上限 99，與後端相同）
 *   HHCart.items() / count()        目前的清單（複製一份）／總件數
 *   HHCart.open() / close()         開關抽屜
 *   HHCart.suggest(skus?, n = 3)    「常一起買」：依車裡（或給定）商品算出的建議 sku，已在車裡的不會出現
 *   HHCart.justPaid                 這次載入是從付款完成頁（?paid=1）回來的
 *   HHCart.checkoutForm()           產生（但不送出）結帳用的表單；測試用
 *   每次變動後發出 window 事件 'hh-cart'（site.js 用它更新頁首與底部列的數字）。
 *   HTML 也可以直接寫 <button data-hh-add="27" data-qty="1" data-color="天空藍">，不用自己寫 JS。
 *   任何 href 是 "/shop/#cart" 的連結（頁首與底部列的購物車）⇒ 直接打開抽屜，不換頁。
 *
 * ── 儲存格式：沿用正式站 /shop/（localStorage 'hh_cart_v1'） ──
 *   [{ sku, name, price, qty, book, home, digital, img?, color? }]
 *   · sku/name/price/qty/book/home/digital 是正式站（ops/build-static-pages.mjs）原本就寫的欄位，一個都不改名，
 *     所以搬上線時客人車裡的東西不會不見；兩版可以同時讀寫同一份。
 *   · img、color 是新增的選用欄位。舊版的程式不讀它們：同 sku 兩種顏色在舊版會顯示成兩行同名的項目，
 *     金額、移除、結帳都照常（已用舊版原始碼實測）。
 *   · book＝課本（算 7-11 運費門檻）、home＝走宅配（shipping.class === 'included'；車裡有它整張免運）、digital＝電子書。
 *
 * ── 商品資料從哪裡來（名稱、價格、照片、運費類別、常一起買）──
 *   cart.js 自己不打任何外部網址。資料來源依序：
 *   1. window.HH_SHOP（/shop/ 頁把它直接寫在 <head> 裡）
 *   2. 沒有的話載入同網站的 /_r/js/hh-catalog.js（由 src/pages/shop.mjs 在建置時產生，內容與 /shop/ 相同）
 *   HH_SHOP = { api, order, rules: { bookFee, bookFreeOver },
 *               catalog: { [sku]: { n 名稱, cn 型號短名, p 價格, lp 原價, i 縮圖, k kind, b 課本, h 宅配, sl 運送標籤, ok, st 庫存, x 常一起買[] } } }
 *   「常一起買」的規則在 shop.mjs 建置時從真實商品算好（x），這裡只合併、去掉已在車裡的、取前 3 個。
 *   價格只是顯示用：結帳只送 {sku, qty}，**後端一律以資料庫價格重算**（shop-api/src/server.mjs resolveLines）。
 *
 * ── 結帳交接（與正式站相同，改了就接不上後台）──
 *   <form method="post" action="{api}/checkout">，同一個分頁送出（application/x-www-form-urlencoded）：
 *   · items＝JSON.stringify([{ sku, qty }, ...])——同 sku 不同顏色的幾行會**合併成一筆**（數量相加），
 *     後端的庫存檢查才會看到總數；車裡沒有顏色時，送出的內容與正式站一字不差。
 *   · note（選填，只有車裡有顏色時才放）＝「顏色：Hope Harp 27 天空藍；Hope Harp 17S 薄荷綠 ×2」，最多 300 字。
 *     後端 /checkout 會把它預先填進結帳頁的「備註」（shop-api/src/server.mjs notePrefill）。
 *   為什麼是表單 POST：購物車在 taiwanharp.org 的 localStorage，結帳頁在另一個網域，讀不到，只能隨導航帶過去。
 *   付款完成頁的「回到官網」會帶 /shop/?paid=1 回來 ⇒ 清空購物車、把 ?paid=1 從網址拿掉（與正式站相同）。
 *   api 是空字串時（後台還沒接上）不放結帳鈕，改成「用 LINE 告訴老師這張清單」（與正式站相同）。
 */
(() => {
  const KEY = 'hh_cart_v1';
  const LINE = 'https://line.me/ti/p/~pianoaaa';
  const d = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── 儲存 ──
  const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(c) ? c.filter((x) => x && x.sku) : []; } catch { return []; } };
  const write = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} dispatchEvent(new Event('hh-cart')); paint(); };
  const ntd = (n) => 'NT$' + Number(n || 0).toLocaleString('en-US');
  const clampQty = (q) => Math.max(0, Math.min(99, Math.floor(Number(q) || 0)));
  // 顏色名稱：去掉控制字元與分號（分號是 note 裡的分隔），最多 40 字
  const cleanColor = (c) => [...String(c ?? '')].map((ch) => (ch.charCodeAt(0) < 32 || ch === ';' || ch === '；' ? ' ' : ch)).join('').trim().slice(0, 40);
  const lineKey = (x) => x.sku + '|' + (x.color || '');
  const sameLine = (x, sku, color) => x.sku === sku && (x.color || '') === (color || '');

  // ── 付款完成回來（與正式站相同）──
  let justPaid = false;
  if (/[?&]paid=1(&|$)/.test(location.search)) {
    justPaid = true;
    try { localStorage.setItem(KEY, '[]'); } catch {}
    try { history.replaceState(null, '', location.pathname + location.hash); } catch {}
  }

  // ── 商品資料 ──
  let shop = window.HH_SHOP || null;
  let loading = null;
  const loadShop = () => {
    if (shop) return Promise.resolve(shop);
    if (loading) return loading;
    loading = new Promise((res) => {
      const s = d.createElement('script');
      s.src = '/_r/js/hh-catalog.js';
      s.onload = () => { shop = window.HH_SHOP || null; res(shop); paint(); };
      s.onerror = () => res(null);
      d.head.appendChild(s);
    });
    return loading;
  };
  const cat = (sku) => (shop && shop.catalog && shop.catalog[sku]) || null;
  const itemFrom = (sku, c) => ({ sku, name: c.n, price: c.p, qty: 0, book: !!c.b, home: !!c.h, digital: c.k === 'digital', ...(c.i ? { img: c.i } : {}) });
  const maxOf = (sku) => { const p = cat(sku); return p && p.st != null ? Math.min(99, p.st) : 99; };

  // 車裡的名稱、價格跟著目前的商品資料走（後端本來就用資料庫價格；這裡只是讓畫面不要顯示過期的數字）
  const refresh = () => {
    if (!shop) return;
    const c = read(); let changed = false;
    c.forEach((it) => {
      const p = cat(it.sku); if (!p) return;
      const fresh = itemFrom(it.sku, p);
      // 有顏色的那一行保留那個顏色的照片
      for (const k of ['name', 'price', 'book', 'home', 'digital', ...(it.color ? [] : ['img'])]) {
        if (fresh[k] !== undefined && it[k] !== fresh[k]) { it[k] = fresh[k]; changed = true; }
      }
    });
    if (changed) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} }
  };

  // ── 對外動作 ──
  async function add(sku, qty = 1, opts = {}) {
    sku = String(sku || ''); qty = clampQty(qty) || 1;
    if (!sku) return false;
    const color = cleanColor(opts && opts.color);
    await loadShop();
    const p = cat(sku);
    const c = read();
    const found = c.find((x) => sameLine(x, sku, color));
    if (!found && !p) { console.warn('[HHCart] 找不到商品：' + sku); return false; }
    if (p && p.ok === false) { location.href = LINE; return false; }
    const max = maxOf(sku);
    if (found) found.qty = Math.min(max, clampQty(found.qty) + qty);
    else c.push({ ...itemFrom(sku, p), qty: Math.min(max, qty), ...(color ? { color } : {}), ...(color && opts.img ? { img: String(opts.img) } : {}) });
    write(c);
    if (!(opts && opts.quiet)) toast((found ? found.name : p.n) + (color ? '・' + color : ''), sku);
    return true;
  }
  function set(sku, qty, color) {
    const c = read();
    const it = color === undefined ? c.find((x) => x.sku === sku) : c.find((x) => sameLine(x, sku, color));
    if (!it) return;
    const q = Math.min(maxOf(sku), clampQty(qty));
    write(q ? c.map((x) => (x === it ? { ...x, qty: q } : x)) : c.filter((x) => x !== it));
  }
  const remove = (sku, color) => write(read().filter((x) => !(color === undefined ? x.sku === sku : sameLine(x, sku, color))));
  const items = () => read().map((x) => ({ ...x }));
  const count = () => read().reduce((a, x) => a + (clampQty(x.qty)), 0);

  // 常一起買：依序合併每一項商品的建議（x），去掉已在車裡的、不能直接買的
  function suggest(skus, n = 3) {
    const inCart = new Set(read().map((x) => x.sku));
    const from = skus || [...inCart];
    const out = [];
    for (const s of from) for (const x of ((cat(s) || {}).x || [])) {
      const p = cat(x);
      if (p && p.ok !== false && p.st !== 0 && !inCart.has(x) && !from.includes(x) && !out.includes(x)) out.push(x);
    }
    return out.slice(0, n);
  }

  // 運費試算：與正式站相同的規則（課本未滿門檻、而且車裡沒有走宅配的東西 ⇒ 加一次 7-11 運費）。實際金額以結帳頁為準。
  function totals(c = read()) {
    const R = (shop && shop.rules) || {};
    let sub = 0, bookSum = 0, anyHome = false;
    c.forEach((it) => { const t = it.price * it.qty; sub += t; if (it.book) bookSum += t; if (it.home) anyHome = true; });
    const needFee = R.bookFee > 0 && bookSum > 0 && !anyHome && (R.bookFreeOver == null || bookSum < R.bookFreeOver);
    const allDigital = c.length > 0 && c.every((it) => it.digital);
    return { sub, bookSum, anyHome, needFee, fee: needFee ? R.bookFee : 0, allDigital, R };
  }

  // ── 結帳交接 ──
  function colorNote(c = read()) {
    const parts = c.filter((x) => x.color).map((x) => `${(cat(x.sku) || {}).cn || x.name} ${x.color}${x.qty > 1 ? ' ×' + x.qty : ''}`);
    if (!parts.length) return '';
    const s = '顏色：' + parts.join('；');
    return s.length > 300 ? s.slice(0, 299) + '…' : s;
  }
  function checkoutForm() {
    const api = shop && shop.api ? String(shop.api).replace(/\/$/, '') : '';
    if (!api) return null;
    const c = read();
    const merged = [];
    c.forEach((x) => { const m = merged.find((y) => y.sku === x.sku); if (m) m.qty = Math.min(99, m.qty + x.qty); else merged.push({ sku: x.sku, qty: x.qty }); });
    const fm = d.createElement('form');
    fm.method = 'post'; fm.action = api + '/checkout';
    fm.hidden = true;
    const field = (name, value) => { const i = d.createElement('input'); i.type = 'hidden'; i.name = name; i.value = value; fm.appendChild(i); };
    field('items', JSON.stringify(merged));
    const note = colorNote(c);
    if (note) field('note', note);
    return fm;
  }

  // ── 樣式（hhc- 開頭；顏色一律用 tokens.css 的變數）──
  const STYLE = `
.hhc-back{position:fixed;inset:0;z-index:80;background:rgba(14,26,43,.5);opacity:0;transition:opacity var(--t-med) var(--ease);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
.hhc-back.on{opacity:1}
.hhc-panel{position:fixed;z-index:81;top:0;right:0;bottom:0;width:min(100%,460px);display:flex;flex-direction:column;background:var(--ivory);color:var(--text);box-shadow:var(--sh-3);transform:translateX(104%);transition:transform var(--t-med) var(--ease);outline:none}
.hhc-panel.on{transform:none}
.hhc-panel[hidden],.hhc-back[hidden],.hhc-ft[hidden]{display:none}
.hhc-hd{display:flex;align-items:center;gap:var(--s-3);padding:var(--s-4) var(--s-5);border-bottom:1px solid var(--hair);background:var(--paper)}
.hhc-hd h2{margin:0;font-size:var(--fs-xl)}
.hhc-hd .hhc-n{font:500 var(--fs-sm)/1 var(--f-sans);color:var(--text-3)}
.hhc-x{margin-left:auto;display:grid;place-items:center;width:48px;height:48px;border:0;border-radius:50%;background:none}
.hhc-x:hover{background:var(--hair)}
.hhc-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:var(--s-4) var(--s-5)}
.hhc-prog{margin:0 0 var(--s-4);padding:var(--s-3) var(--s-4);border-radius:var(--r-md);background:var(--paper);border:1px solid var(--hair);font-size:var(--fs-sm);line-height:1.6}
.hhc-prog b{color:var(--gold-dk)}
.hhc-bar{height:6px;margin-top:var(--s-2);border-radius:3px;background:var(--sand);overflow:hidden}
.hhc-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold-lt),var(--gold));border-radius:3px;transition:width var(--t-slow) var(--ease)}
.hhc-list{list-style:none;margin:0;padding:0}
.hhc-it{display:grid;grid-template-columns:72px 1fr;gap:var(--s-2) var(--s-4);padding:var(--s-4) 0;border-bottom:1px solid var(--hair)}
.hhc-it:first-child{padding-top:0}
.hhc-th{width:72px;height:96px;border-radius:var(--r-sm);overflow:hidden;background:var(--sand);display:grid;place-items:center;color:var(--gold-dk)}
.hhc-th img{width:100%;height:100%;object-fit:cover}
.hhc-nm{margin:0;font:700 var(--fs-sm)/1.5 var(--f-serif);color:var(--text)}
.hhc-nm a{text-decoration:none}
.hhc-nm a:hover{text-decoration:underline}
.hhc-sh{margin:.2em 0 0;font-size:var(--fs-xs);color:var(--text-3);line-height:1.5}
.hhc-warn{color:var(--rose);font-weight:700}
.hhc-col{display:inline-flex;align-items:center;gap:.35em;margin-top:.35em;padding:.15em .7em;border-radius:var(--r-pill);background:rgba(201,160,78,.16);color:var(--gold-dk);font-size:var(--fs-xs);font-weight:700}
.hhc-x-sec{margin-top:var(--s-5)}
.hhc-x-sec h3{font-size:var(--fs-md);margin:0 0 var(--s-3);display:flex;align-items:baseline;gap:.5em}
.hhc-x-sec h3 small{font:500 var(--fs-xs)/1 var(--f-sans);color:var(--text-3)}
.hhc-xl{list-style:none;margin:0;padding:0;display:grid;gap:var(--s-2)}
.hhc-xi{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:var(--s-3);padding:var(--s-2);border:1px solid var(--hair);border-radius:var(--r-md);background:var(--paper)}
.hhc-xi .hhc-th{width:52px;height:68px}
.hhc-xi .hhc-nm{font-size:.95rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hhc-xi .hhc-sh{margin-top:.1em;font-size:var(--fs-sm);color:var(--text-2);font-weight:700}
.hhc-xadd{min-height:48px;min-width:48px;padding:0 1em;border-radius:var(--r-pill);border:1.5px solid var(--gold);background:transparent;color:var(--gold-dk);font-weight:700;font-size:var(--fs-sm);white-space:nowrap;transition:background var(--t-fast),color var(--t-fast)}
.hhc-xadd:hover{background:var(--gold);color:var(--ink)}
.hhc-order{display:inline-flex;align-items:center;gap:.4em;min-height:44px;color:var(--gold-dk);font-weight:700;font-size:var(--fs-sm)}
.hhc-row{grid-column:1/-1;display:flex;align-items:center;gap:var(--s-3)}
.hhc-step{display:inline-flex;align-items:center;border:1px solid var(--hair);border-radius:var(--r-pill);background:var(--paper)}
.hhc-step button{width:44px;height:44px;border:0;background:none;border-radius:50%;font-size:1.25rem;line-height:1;display:grid;place-items:center}
.hhc-step button:hover:not(:disabled){background:var(--sand)}
.hhc-step button:disabled{opacity:.35;cursor:default}
.hhc-step output{min-width:2.2em;text-align:center;font-weight:700;font-variant-numeric:tabular-nums}
.hhc-rm{border:0;background:none;padding:.6em .4em;min-height:44px;font-size:var(--fs-sm);color:var(--text-3);text-decoration:underline;text-underline-offset:.2em}
.hhc-rm:hover{color:var(--rose)}
.hhc-lt{margin-left:auto;font:600 1.3rem/1 var(--f-latin);font-variant-numeric:tabular-nums}
.hhc-empty{text-align:center;padding:var(--s-8) var(--s-4) var(--s-6);color:var(--text-2)}
.hhc-empty .hhc-mk{width:84px;height:84px;margin:0 auto var(--s-4);border-radius:50%;display:grid;place-items:center;background:var(--paper);border:1px solid var(--hair);color:var(--gold-dk)}
.hhc-empty h3{font-size:var(--fs-lg);margin-bottom:.4em}
.hhc-empty .btn-row{justify-content:center;margin-top:var(--s-5)}
.hhc-ft{padding:var(--s-4) var(--s-5) calc(var(--s-4) + env(safe-area-inset-bottom));border-top:1px solid var(--hair);background:var(--paper)}
.hhc-sub{display:flex;justify-content:space-between;gap:var(--s-3);margin:0;font-size:var(--fs-sm);color:var(--text-2);font-variant-numeric:tabular-nums}
.hhc-total{display:flex;justify-content:space-between;align-items:baseline;margin:.15em 0 var(--s-3);font-weight:700}
.hhc-total b{font:600 1.7rem/1.1 var(--f-latin);font-variant-numeric:tabular-nums}
.hhc-orderp{margin:var(--s-5) 0 0;text-align:center}
.hhc-fine{margin:var(--s-3) 0 0;font-size:var(--fs-xs);line-height:1.6;color:var(--text-3);text-align:center}
.hhc-fine a{color:var(--gold-dk)}
.hhc-toast{position:fixed;z-index:79;left:50%;bottom:calc(var(--dock-h) + env(safe-area-inset-bottom) + 14px);transform:translate(-50%,24px);opacity:0;pointer-events:none;width:min(calc(100% - 24px),440px);display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-3) var(--s-3) var(--s-4);border-radius:var(--r-lg);background:var(--ink);color:var(--on-dark);box-shadow:var(--sh-3);transition:transform var(--t-med) var(--ease-spring),opacity var(--t-med) var(--ease)}
.hhc-toast.on{transform:translate(-50%,0);opacity:1;pointer-events:auto}
.hhc-toast .hhc-ok{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:rgba(230,201,135,.16);color:var(--gold-lt)}
.hhc-toast p{margin:0;flex:1;min-width:0;font-size:var(--fs-sm);line-height:1.45}
.hhc-toast p b{display:block;font-size:var(--fs-md)}
.hhc-toast p span{display:block;color:var(--on-dark-2);font-size:var(--fs-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hhc-toast .btn{flex:none;min-height:46px;padding:.5em 1.1em;font-size:var(--fs-sm)}
body.hhc-lock{overflow:hidden}
@media (min-width:1080px){.hhc-toast{left:auto;right:24px;bottom:24px;transform:translate(0,24px)}.hhc-toast.on{transform:none}}
`;

  const IC = {
    close: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    harp: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 21V4c5 0 9 3 12 9l-12 8zM6 4c0 0 2-1 4 0M9 6v11M12 8.5v6.5M15 11.5v3"/></svg>',
    check: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    line: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.2.9c0 .3-.2 1 .9.5s6-3.5 8.2-6.1C21.4 14 22 12.6 22 11c0-4.4-4.5-8-10-8z"/></svg>',
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

  // ── 抽屜 ──
  let back, panel, bodyEl, footEl, countEl, toastEl, toastTimer, lastFocus;
  function mount() {
    if (panel) return;
    const st = d.createElement('style'); st.id = 'hhc-style'; st.textContent = STYLE; d.head.appendChild(st);
    back = d.createElement('div'); back.className = 'hhc-back'; back.hidden = true;
    panel = d.createElement('aside');
    panel.className = 'hhc-panel'; panel.hidden = true; panel.tabIndex = -1;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'hhc-title');
    panel.innerHTML = `<div class="hhc-hd"><h2 id="hhc-title">購物車</h2><span class="hhc-n" data-hhc-n></span>
      <button class="hhc-x" type="button" data-hhc-close aria-label="關閉購物車">${IC.close}</button></div>
      <div class="hhc-body" data-hhc-body></div><div class="hhc-ft" data-hhc-ft></div>`;
    bodyEl = panel.querySelector('[data-hhc-body]'); footEl = panel.querySelector('[data-hhc-ft]'); countEl = panel.querySelector('[data-hhc-n]');
    toastEl = d.createElement('div'); toastEl.className = 'hhc-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    d.body.append(back, panel, toastEl);
    back.addEventListener('click', close);
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') { // 焦點留在抽屜裡
        const f = [...panel.querySelectorAll('a[href],button:not(:disabled),input,[tabindex="0"]')].filter((x) => x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && d.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  const orderUrl = () => (shop && shop.order) || '';
  const orderLink = () => (orderUrl() ? `<a class="hhc-order" href="${esc(orderUrl())}" rel="nofollow">查詢訂單／重新下載電子書 →</a>` : '');
  // 常一起買（只列真實商品與真實價格；已在車裡的不列）
  function crossHtml() {
    const xs = suggest();
    if (!xs.length) return '';
    return `<section class="hhc-x-sec" aria-labelledby="hhc-x-h"><h3 id="hhc-x-h">常一起買<small>一鍵加入</small></h3><ul class="hhc-xl">${xs.map((x) => {
      const p = cat(x);
      return `<li class="hhc-xi"><div class="hhc-th">${p.i ? `<img src="${esc(p.i)}" width="52" height="68" alt="" loading="lazy" decoding="async">` : IC.harp}</div>
        <div><p class="hhc-nm"><a href="/shop/#p-${esc(x)}" data-hhc-go>${esc(p.n)}</a></p><p class="hhc-sh">${ntd(p.p)}</p></div>
        <button type="button" class="hhc-xadd" data-hhc-xadd="${esc(x)}" aria-label="加入 ${esc(p.n)}">＋ 加入</button></li>`;
    }).join('')}</ul></section>`;
  }

  function paint() {
    if (!panel) return;
    const c = read(), n = c.reduce((a, x) => a + x.qty, 0);
    countEl.textContent = n ? `共 ${n} 件` : '';
    if (!c.length) {
      bodyEl.innerHTML = `<div class="hhc-empty"><div class="hhc-mk">${IC.harp}</div><h3>購物車還是空的</h3>
        <p>豎琴、課本、電子書與琴弦配件，都可以在商店直接下單。</p>
        <div class="btn-row"><a class="btn btn-gold" href="/shop/" data-hhc-shop>逛逛商店</a><a class="btn btn-ghost" href="/harps/">看豎琴型號</a></div>
        ${orderLink()}</div>`;
      footEl.hidden = true;
      return;
    }
    footEl.hidden = false;
    const t = totals(c);
    const gone = shop ? c.filter((it) => !cat(it.sku)) : [];
    let prog = '';
    if (t.bookSum > 0 && t.R.bookFee > 0 && t.R.bookFreeOver != null && !t.allDigital) {
      if (t.anyHome) prog = '<p class="hhc-prog">車裡有宅配的商品，<b>整張訂單一起寄、免運</b>。</p>';
      else if (t.needFee) {
        const pct = Math.min(100, Math.round((t.bookSum / t.R.bookFreeOver) * 100));
        prog = `<div class="hhc-prog">課本再買 <b>${ntd(t.R.bookFreeOver - t.bookSum)}</b> 就免運<small style="display:block;color:var(--text-3)">課本滿 ${ntd(t.R.bookFreeOver)} 免運；未滿收 7-11 運費 ${ntd(t.R.bookFee)}</small>
          <div class="hhc-bar" aria-hidden="true"><i style="width:${pct}%"></i></div></div>`;
      } else prog = `<p class="hhc-prog">課本已滿 ${ntd(t.R.bookFreeOver)}，<b>免運</b>。</p>`;
    }
    bodyEl.innerHTML = prog + '<ul class="hhc-list">' + c.map((it) => {
      const p = cat(it.sku);
      const img = (it.color && it.img) || (p && p.i) || it.img;
      const max = p && p.st != null ? Math.min(99, p.st) : 99;
      const ship = it.digital ? '電子書・付款後立即下載' : (p && p.sl) || (it.home ? '宅配到府・免運' : '');
      return `<li class="hhc-it" data-key="${esc(lineKey(it))}">
        <div class="hhc-th">${img ? `<img src="${esc(img)}" width="72" height="96" alt="" loading="lazy" decoding="async">` : IC.harp}</div>
        <div><p class="hhc-nm"><a href="/shop/#p-${esc(it.sku)}" data-hhc-go>${esc(it.name)}</a></p>
          ${it.color ? `<span class="hhc-col">顏色：${esc(it.color)}</span>` : ''}
          <p class="hhc-sh">${ntd(it.price)}${ship ? '・' + esc(ship) : ''}</p>
          ${shop && !p ? '<p class="hhc-sh hhc-warn">這項商品目前沒有販售，請移除後再結帳。</p>' : ''}</div>
        <div class="hhc-row">
          <div class="hhc-step" role="group" aria-label="${esc(it.name + (it.color ? ' ' + it.color : ''))} 數量">
            <button type="button" data-hhc-dec aria-label="減少一件"${it.qty <= 1 ? ' disabled' : ''}>−</button>
            <output aria-live="polite">${it.qty}</output>
            <button type="button" data-hhc-inc aria-label="增加一件"${it.qty >= max ? ' disabled' : ''}>＋</button>
          </div>
          <button type="button" class="hhc-rm" data-hhc-rm>移除</button>
          <span class="hhc-lt">${ntd(it.price * it.qty)}</span>
        </div></li>`;
    }).join('') + '</ul>' + crossHtml() + (orderUrl() ? `<p class="hhc-orderp">${orderLink()}</p>` : '');
    const shipText = t.allDigital ? '不需配送' : t.needFee ? ntd(t.fee) : '免運';
    const api = shop && shop.api;
    footEl.innerHTML = `<p class="hhc-sub"><span>小計 ${ntd(t.sub)}</span><span>運費 ${shipText}</span></p>
      <p class="hhc-total"><span>合計</span><b>${ntd(t.sub + t.fee)}</b></p>
      ${shop && !api
        ? `<a class="btn btn-line btn-lg btn-block" href="${LINE}" rel="noopener">${IC.line}用 LINE 告訴老師這張清單</a>
           <p class="hhc-fine">線上刷卡即將開放，目前請用 LINE 或電話訂購。</p>`
        : `<button type="button" class="btn btn-gold btn-lg btn-block" data-hhc-checkout${gone.length || !shop ? ' disabled' : ''}>前往結帳</button>
           <p class="hhc-fine">下一步填收件資料，再到統一金流（PAYUNi）付款，我們不經手卡號；金額以結帳頁為準。
           不習慣刷卡？<a href="${LINE}" rel="noopener">用 LINE 訂購</a></p>`}`;
  }

  function onPanelClick(e) {
    const t = e.target;
    if (t.closest('[data-hhc-close]')) return close();
    if (t.closest('[data-hhc-go]') && location.pathname === '/shop/') return close(false);
    if (t.closest('[data-hhc-shop]') && location.pathname === '/shop/') { e.preventDefault(); return close(); }
    if (t.closest('[data-hhc-checkout]')) return checkout(t.closest('[data-hhc-checkout]'));
    const xb = t.closest('[data-hhc-xadd]');
    if (xb) { add(xb.dataset.hhcXadd, 1, { quiet: true }).then(() => { const h = panel.querySelector('.hhc-list'); if (h) h.lastElementChild && h.lastElementChild.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); panel.focus({ preventScroll: true }); }); return; }
    const li = t.closest('.hhc-it'); if (!li) return;
    const key = li.dataset.key, it = read().find((x) => lineKey(x) === key); if (!it) return;
    const sku = it.sku, color = it.color || '';
    if (t.closest('[data-hhc-inc]')) set(sku, it.qty + 1, color);
    else if (t.closest('[data-hhc-dec]')) set(sku, it.qty - 1, color);
    else if (t.closest('[data-hhc-rm]')) remove(sku, color);
    else return;
    const again = [...panel.querySelectorAll('.hhc-it')].find((el) => el.dataset.key === key);
    const btn2 = again && again.querySelector(t.closest('[data-hhc-inc]') ? '[data-hhc-inc]' : '[data-hhc-dec]');
    if (btn2 && !btn2.disabled) btn2.focus(); else panel.focus();
  }

  function checkout(btn) {
    if (!read().length) return;
    const fm = checkoutForm();
    if (!fm) { location.href = LINE; return; }
    btn.disabled = true; btn.textContent = '前往結帳頁…';
    d.body.appendChild(fm);
    fm.submit();
    // 使用者按「上一頁」回來時（bfcache）按鈕要能再按
    addEventListener('pageshow', () => { btn.disabled = false; btn.textContent = '前往結帳'; fm.remove(); }, { once: true });
  }

  function open() {
    mount(); refresh(); paint();
    loadShop().then(() => { refresh(); paint(); });
    if (!panel.hidden) return;
    lastFocus = d.activeElement;
    back.hidden = false; panel.hidden = false;
    d.body.classList.add('hhc-lock');
    requestAnimationFrame(() => requestAnimationFrame(() => { back.classList.add('on'); panel.classList.add('on'); }));
    hideToast();
    setTimeout(() => panel.focus({ preventScroll: true }), reduce ? 0 : 60);
  }
  function close(restore = true) {
    if (!panel || panel.hidden) return;
    back.classList.remove('on'); panel.classList.remove('on');
    d.body.classList.remove('hhc-lock');
    if (location.hash === '#cart') try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    const done = () => { back.hidden = true; panel.hidden = true; };
    reduce ? done() : setTimeout(done, 380);
    if (restore && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function toast(name, sku) {
    mount();
    toastEl.innerHTML = `<span class="hhc-ok">${IC.check}</span><p><b>已加入購物車</b><span>${esc(name)}</span></p>
      <button type="button" class="btn btn-gold" data-hhc-open>去結帳</button>`;
    toastEl.querySelector('[data-hhc-open]').onclick = open;
    toastEl.dataset.sku = sku;
    requestAnimationFrame(() => toastEl.classList.add('on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4500);
  }
  function hideToast() { if (toastEl) toastEl.classList.remove('on'); clearTimeout(toastTimer); }
  const toastHold = () => clearTimeout(toastTimer);

  // ── 全頁接線 ──
  const isCartLink = (a) => {
    if (!a || !a.getAttribute) return false;
    const h = a.getAttribute('href') || '';
    return h === '#cart' || /^(https?:\/\/[^/]*taiwanharp\.org)?\/shop\/#cart$/.test(h);
  };
  d.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (isCartLink(a) && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); open(); return; }
    const b = e.target.closest && e.target.closest('[data-hh-add]');
    if (b) { e.preventDefault(); add(b.getAttribute('data-hh-add'), b.getAttribute('data-qty') || 1, { color: b.getAttribute('data-color') || '' }); }
  });
  const onHash = () => { if (location.hash === '#cart') open(); };
  addEventListener('hashchange', onHash);
  addEventListener('storage', (e) => { if (e.key === KEY) paint(); });

  window.HHCart = { add, remove, set, items, count, open, close, suggest, checkoutForm, totals: () => totals(), justPaid, ready: loadShop, catalog: (sku) => cat(sku) };

  const init = () => {
    mount();
    toastEl.addEventListener('pointerenter', toastHold);
    toastEl.addEventListener('pointerleave', () => { toastTimer = setTimeout(hideToast, 2000); });
    refresh();
    if (justPaid) dispatchEvent(new Event('hh-cart'));
    onHash();
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})();
