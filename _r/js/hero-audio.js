// 首頁（中文與 /en/）主視覺的「聽聽豎琴的聲音」：播放正式站已經在用的真實豎琴錄音。
// - 不自動播放：只有使用者按了按鈕才開始（preload="none"，按之前一個位元組都不下載）
// - 音量 0.3、循環；暫停時記在 localStorage（與正式站同一個 key：taiwanharp-bgm-off）
// - 文字由按鈕的 data-play / data-pause 提供（中英文頁共用這支）
(() => {
  const btn = document.querySelector('[data-harp-audio]');
  if (!btn) return;
  const KEY = 'taiwanharp-bgm-off';
  const label = btn.querySelector('[data-harp-audio-txt]');
  let a = null;
  const ui = () => {
    const on = !!a && !a.paused;
    btn.setAttribute('aria-pressed', on);
    if (label) label.textContent = on ? btn.dataset.pause : btn.dataset.play;
  };
  const save = (off) => { try { off ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch (e) {} };
  btn.addEventListener('click', () => {
    if (!a) {
      a = new Audio();
      a.preload = 'none'; a.loop = true; a.volume = 0.3;
      a.src = btn.dataset.src;
      a.addEventListener('play', ui); a.addEventListener('pause', ui); a.addEventListener('ended', ui);
    }
    if (a.paused) { save(false); a.play().then(ui).catch(ui); } else { save(true); a.pause(); }
    ui();
  });
  ui();
})();
