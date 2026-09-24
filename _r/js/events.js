// 活動頁：
// 1. 電腦版把 [data-open-desktop] 的 <details> 預設打開（手機維持收合，頁面短一點）
// 2. 活動行事曆依類型篩選（沒有 JS 時全部顯示，篩選按鈕保持隱藏）
(() => {
  if (matchMedia('(min-width: 760px)').matches) document.querySelectorAll('details[data-open-desktop]').forEach((d) => { d.open = true; });

  const box = document.querySelector('[data-filters]');
  const tl = document.querySelector('[data-timeline]');
  if (!box || !tl) return;
  const empty = document.querySelector('[data-empty]');
  const btns = [...box.querySelectorAll('[data-f]')];
  box.hidden = false;
  const apply = (f) => {
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
    let shown = 0;
    tl.querySelectorAll('[data-mo]').forEach((mo) => {
      let n = 0;
      mo.querySelectorAll('[data-cat]').forEach((ev) => {
        const ok = f === 'all' || ev.dataset.cat === f;
        ev.hidden = !ok;
        if (ok) { n++; ev.classList.add('in'); }
      });
      mo.hidden = !n; shown += n;
    });
    if (empty) empty.hidden = shown > 0;
  };
  btns.forEach((b) => b.addEventListener('click', () => apply(b.dataset.f)));
})();
