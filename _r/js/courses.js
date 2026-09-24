// 課程頁：主視覺捲走之後，底部出現預約列（課名＋價格／下一個日期＋LINE 預約）。
// 頁尾的預約區塊出現時收起來，避免同一個畫面兩組一樣的按鈕。
(() => {
  const bar = document.querySelector('[data-bookbar]');
  const hero = document.querySelector('[data-hero]');
  if (!bar || !hero || !('IntersectionObserver' in window)) return;
  const ends = [...document.querySelectorAll('.cta-band, .site-ft')];
  let heroGone = false, endSeen = false;
  const paint = () => {
    const show = heroGone && !endSeen;
    bar.hidden = false;
    bar.classList.toggle('on', show);
    bar.setAttribute('aria-hidden', String(!show));
    bar.querySelectorAll('a').forEach((a) => { a.tabIndex = show ? 0 : -1; });
    document.body.classList.toggle('bookbar-on', show);
  };
  new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; paint(); }).observe(hero);
  const seen = new Set();
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
    endSeen = seen.size > 0; paint();
  });
  ends.forEach((el) => io.observe(el));
  paint();
})();
