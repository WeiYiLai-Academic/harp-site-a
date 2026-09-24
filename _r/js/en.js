// English home (/en/): add-to-cart with English labels.
// (The hero audio button gets its English labels from data-play / data-pause; hero-audio.js is shared.)
(() => {
  const d = document;

  /* ── Add to cart (cart.js provides window.HHCart; without it, go to the shop) ── */
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const sku = b.getAttribute('data-add');
    const cart = window.HHCart;
    if (!cart || typeof cart.add !== 'function') { location.href = '/shop/#p-' + encodeURIComponent(sku); return; }
    const label = b.querySelector('span');
    if (!b._label) b._label = label ? label.textContent : '';
    Promise.resolve(cart.add(sku, 1)).then((ok) => {
      if (ok === false) return;
      b.classList.add('added');
      if (label) label.textContent = 'Added to cart';
      clearTimeout(b._t);
      b._t = setTimeout(() => { b.classList.remove('added'); if (label) label.textContent = b._label; }, 1800);
    }).catch(() => {});
  });
})();
