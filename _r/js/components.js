// 共用元件的互動（配合 /_r/styles/components.css）：橫向軌道箭頭＋進度條、YouTube 點了才載入。
(() => {
  const d = document;
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 橫向軌道 */
  d.querySelectorAll('[data-rail]').forEach((track) => {
    const root = track.closest('[data-rail-root]') || track.parentElement;
    const prev = root.querySelector('[data-rail-prev]'), next = root.querySelector('[data-rail-next]'), bar = root.querySelector('[data-rail-bar]');
    const step = () => {
      const c = track.firstElementChild;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return c ? c.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    };
    const go = (dir) => track.scrollBy({ left: dir * step(), behavior: smooth ? 'smooth' : 'auto' });
    prev && prev.addEventListener('click', () => go(-1));
    next && next.addEventListener('click', () => go(1));
    const paint = () => {
      const max = track.scrollWidth - track.clientWidth;
      if (prev) prev.disabled = track.scrollLeft < 4;
      if (next) next.disabled = track.scrollLeft > max - 4;
      if (bar) {
        const vis = Math.min(1, track.clientWidth / (track.scrollWidth || 1)), f = max > 0 ? track.scrollLeft / max : 0;
        bar.style.width = vis * 100 + '%';
        bar.style.transform = `translateX(${vis < 1 ? (f * (1 - vis) / vis) * 100 : 0}%)`;
      }
    };
    track.addEventListener('scroll', paint, { passive: true });
    addEventListener('resize', paint);
    paint();
  });

  /* YouTube：點了才載入 iframe */
  const play = (slot, id, title) => {
    const f = d.createElement('iframe');
    f.className = 'yt-frame';
    if (slot.id) f.id = slot.id;
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    f.title = title || 'YouTube 影片';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    f.allowFullscreen = true;
    slot.replaceWith(f);
    return f;
  };
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-yt]');
    if (!b) return;
    const into = b.getAttribute('data-yt-into');
    const slot = into ? d.querySelector(into) : b;
    if (!slot) return;
    e.preventDefault();
    play(slot, b.getAttribute('data-yt'), b.getAttribute('data-title'));
    d.querySelectorAll('[data-yt-into]').forEach((x) => x.removeAttribute('aria-current'));
    if (into) b.setAttribute('aria-current', 'true');
  });
})();
