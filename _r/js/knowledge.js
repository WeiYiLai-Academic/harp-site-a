// 豎琴知識：索引頁的搜尋＋分類篩選；文章頁的閱讀進度條＋目錄高亮。
(() => {
  const d = document;

  // ── 索引：搜尋與分類 ──
  const grid = d.querySelector('[data-grid]');
  if (grid) {
    const input = d.querySelector('[data-search]');
    const chips = [...d.querySelectorAll('.k-chip')];
    const cards = [...grid.querySelectorAll('.k-card')];
    const feat = d.querySelector('[data-feat]');
    const count = d.querySelector('[data-count]');
    const empty = d.querySelector('[data-empty]');
    let tag = '';
    const apply = () => {
      const q = (input.value || '').trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      const filtering = !!(q || tag);
      grid.classList.toggle('filtering', filtering);
      if (feat) feat.hidden = filtering;
      let n = 0;
      cards.forEach((c) => {
        const ok = (!tag || c.dataset.tag === tag) && terms.every((t) => c.dataset.q.includes(t));
        c.hidden = !ok;
        if (ok && (filtering || !c.classList.contains('is-feat'))) n++;
      });
      count.textContent = (filtering ? n : cards.length) + ' 篇';
      empty.hidden = n > 0;
    };
    chips.forEach((b) => b.addEventListener('click', () => {
      tag = b.dataset.tag;
      chips.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      apply();
    }));
    input.addEventListener('input', apply);
    // 網址帶 ?q=（例如搜尋引擎的站內搜尋框）⇒ 直接放進搜尋框並篩選
    try {
      const q0 = new URLSearchParams(location.search).get('q');
      if (q0) { input.value = q0; apply(); }
    } catch { /* 沒有就算了 */ }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  }

  // ── 文章：進度條＋目錄 ──
  const art = d.querySelector('[data-article]');
  if (art) {
    const bar = d.querySelector('[data-progress]');
    let raf = 0;
    const paint = () => {
      raf = 0;
      const r = art.getBoundingClientRect();
      const total = r.height - innerHeight * 0.6;
      const p = Math.min(1, Math.max(0, -r.top / (total > 0 ? total : 1)));
      if (bar) bar.style.transform = `scaleX(${p})`;
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    addEventListener('resize', paint);
    paint();

    const links = [...d.querySelectorAll('[data-toc] a')];
    const heads = links.map((a) => d.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    if (links.length && 'IntersectionObserver' in window) {
      const setOn = (id) => links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
      const io = new IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) setOn(e.target.id); });
      }, { rootMargin: '-15% 0px -70% 0px' });
      heads.forEach((h) => io.observe(h));
    }
    // 固定列（和課程頁同一個 .book-bar）：文章抬頭捲走後出現；看到文末銷售框或頁尾就收起來，避免同一畫面兩組按鈕
    const bb = d.querySelector('[data-bookbar]'), hero = d.querySelector('[data-hero]');
    if (bb && hero && 'IntersectionObserver' in window) {
      let heroGone = false;
      const seen = new Set();
      const set = () => {
        const show = heroGone && !seen.size;
        bb.hidden = false;
        bb.classList.toggle('on', show);
        bb.setAttribute('aria-hidden', String(!show));
        bb.querySelectorAll('a').forEach((a) => { a.tabIndex = show ? 0 : -1; });
        d.body.classList.toggle('bookbar-on', show);
      };
      new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; set(); }).observe(hero);
      const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target))); set(); });
      d.querySelectorAll('.art-cta, .site-ft').forEach((el) => io.observe(el));
      set();
    }
    // 手機目錄：點了之後收起來
    const m = d.querySelector('.toc-m');
    if (m) m.addEventListener('click', (e) => { if (e.target.closest('a')) m.open = false; });
  }
})();
