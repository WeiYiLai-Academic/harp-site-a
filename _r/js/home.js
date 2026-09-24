// 首頁互動：加入購物車、選琴小幫手。（橫向軌道與 YouTube 在共用的 components.js）
(() => {
  const d = document;

  /* ── 加入購物車（cart.js 由商店提供；沒載入就帶去商店） ── */
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const sku = b.getAttribute('data-add');
    const cart = window.HHCart;
    if (!cart || typeof cart.add !== 'function') { location.href = '/shop/#p-' + encodeURIComponent(sku); return; }
    const label = b.querySelector('span');
    if (!b._label) b._label = label ? label.textContent : '';
    Promise.resolve(cart.add(sku, 1)).then((ok) => {
      if (ok === false) return; // cart.js 自己會顯示原因
      b.classList.add('added');
      if (label) label.textContent = '已加入購物車';
      clearTimeout(b._t);
      b._t = setTimeout(() => { b.classList.remove('added'); if (label) label.textContent = b._label; }, 1800);
    }).catch(() => {});
  });

  /* ── 選琴小幫手：三題都答完 ⇒ 依分數排序，顯示第一名卡片＋第二選擇 ── */
  const form = d.querySelector('[data-finder]');
  if (!form) return;
  let score, order;
  try { score = JSON.parse(form.dataset.score); order = JSON.parse(form.dataset.order); } catch (e) { return; }
  const root = form.closest('section');
  const wait = root.querySelector('[data-fd-wait]'), alt = root.querySelector('[data-fd-alt]');
  const altLink = root.querySelector('[data-fd-alt-link]'), altPrice = root.querySelector('[data-fd-alt-price]');
  const picks = [...root.querySelectorAll('[data-pick]')];
  const update = () => {
    const fd = new FormData(form), ans = ['who', 'goal', 'carry'].map((k) => [k, fd.get(k)]);
    if (ans.some(([, v]) => !v)) return;
    const total = (key) => ans.reduce((s, [k, v]) => s + ((score[k][v] || {})[key] || 0), 0);
    let ranked = order.map((key, i) => ({ key, i, s: total(key) })).sort((a, b) => b.s - a.s || a.i - b.i).map((r) => r.key);
    const who = fd.get('who'), goal = fd.get('goal');
    const toFront = (key) => { ranked = [key, ...ranked.filter((k) => k !== key)]; };
    const out = (score.notTopTwo || {})[who];
    if (out) ranked = [...ranked.filter((k) => !out.includes(k)), ...ranked.filter((k) => out.includes(k))];
    const only = (score.firstOnly || {})[who];
    if (only && !only.includes(ranked[0])) toFront(ranked.find((k) => only.includes(k)));
    const not = (score.notFirst || {})[who];
    if (not && not.includes(ranked[0])) toFront(ranked.find((k) => !not.includes(k)));
    const fix = (score.fixed || []).find((f) => f.who === who && f.goal === goal);
    if (fix) ranked = [...fix.top, ...ranked.filter((k) => !fix.top.includes(k))];
    const [best, second] = ranked.map((key) => ({ key }));
    picks.forEach((p) => { p.hidden = p.dataset.pick !== best.key; });
    wait.hidden = true;
    const s2 = picks.find((p) => p.dataset.pick === second.key);
    if (s2) {
      alt.hidden = false;
      altLink.textContent = s2.dataset.name;
      altLink.href = '/harps/#' + second.key;
      altPrice.textContent = '・' + s2.querySelector('.price').textContent;
    }
  };
  form.addEventListener('change', update);
  update();
})();
