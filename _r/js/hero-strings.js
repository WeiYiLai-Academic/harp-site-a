// 首頁主視覺：一排可以撥的琴弦（canvas）＋ Karplus-Strong 撥弦合成（Web Audio，不用音檔）。
// 27 條弦、C 大調 C3–A6（和 Hope Harp 27 同音域）；C 弦紅、F 弦銀，跟真的豎琴一樣好認。
// - 滑鼠劃過就撥；手機要「橫著劃」才撥（直的交給瀏覽器捲動頁面），點一下也會撥最近的那條。
// - 使用者手勢之前不建立 AudioContext、不出聲；「聲音 開／關」按鈕記在 localStorage。
// - 看不到（捲走、切分頁）就停 rAF；減少動態 ⇒ 靜態琴弦、沒有自動呼吸，撥弦只亮一下＋出聲。
(() => {
  const hero = document.querySelector('[data-hero]');
  const cv = hero && hero.querySelector('[data-strings-cv]');
  const stage = hero && hero.querySelector('[data-stage]');
  if (!cv || !stage || !cv.getContext) return;
  const cx = cv.getContext('2d');
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = mq.matches;

  /* ── 顏色（取 tokens） ─────────────────── */
  const css = getComputedStyle(document.documentElement);
  const hex = (n, f) => {
    const v = (css.getPropertyValue(n).trim() || f).replace('#', '');
    return [0, 2, 4].map((k) => parseInt(v.slice(k, k + 2), 16));
  };
  const COL = { gold: hex('--gold', '#C9A04E'), goldLt: hex('--gold-lt', '#E6C987'), wood: hex('--wood', '#8B5E3C'), woodLt: hex('--wood-lt', '#C89B6D'), rose: hex('--rose', '#B4526A'), silver: hex('--on-dark-2', '#BFC6D2') };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  /* ── 琴弦資料 ───────────────────────────── */
  const N = 27, SEMI = [0, 2, 4, 5, 7, 9, 11];
  const S = [];
  for (let i = 0; i < N; i++) {
    const deg = i % 7, oct = 3 + Math.floor(i / 7);
    S.push({
      i, freq: 440 * 2 ** ((12 * (oct + 1) + SEMI[deg] - 69) / 12),
      col: deg === 0 ? COL.rose : deg === 3 ? COL.silver : COL.goldLt, base: deg === 0 ? 0.95 : deg === 3 ? 0.6 : 0.62,
      x: 0, top: 0, bot: 0, len: 0, w: 1,
      amp: 0, t0: -1e9, c1: 1, c2: 0, dir: 1, tau: 1, fv: 8, glow: 0, g0: -1e9, lastNote: 0,
    });
  }

  /* ── 版面：canvas 蓋住撥弦區（上方多留空間給漂浮的音符） ── */
  let W = 0, H = 0, dpr = 1, sp = 10, Lmax = 1, stat = null, statCx = null;
  const PAD_TOP = 150, PAD_X = 24;
  // 琴頸曲線（正規化座標 t→y，Catmull-Rom 穿過關鍵點）：琴柱頂最高 → 下凹 → 右肩隆起 → 落到琴膝
  const NECK = [0, 0.15, 0.2, 0.16, 0.12, 0.19, 0.33]; // t = 0, 1/6, … 1
  const neckAt = (t) => {
    const n = NECK.length - 1, f = Math.min(n - 1e-6, Math.max(0, t * n)), j = Math.floor(f), u = f - j;
    const p0 = NECK[Math.max(0, j - 1)], p1 = NECK[j], p2 = NECK[j + 1], p3 = NECK[Math.min(n, j + 2)];
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
  };
  let geo = null;

  function layout() {
    const hr = hero.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const left = Math.max(0, sr.left - hr.left - PAD_X), top = Math.max(0, sr.top - hr.top - PAD_TOP);
    W = Math.round(Math.min(hr.width - left, sr.width + PAD_X * 2)); H = Math.round(sr.bottom - hr.top - top);
    if (W < 50 || H < 50) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    Object.assign(cv.style, { left: left + 'px', top: top + 'px', width: W + 'px', height: H + 'px', right: 'auto', bottom: 'auto' });
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    // 撥弦區在 canvas 裡的位置（底部留給提示列）
    const ox = sr.left - hr.left - left, oy = sr.top - hr.top - top;
    const x0 = ox + sr.width * 0.12, x1 = ox + sr.width * 0.93;
    const yT = oy + 6, yB = oy + sr.height - 70, h = yB - yT;
    sp = (x1 - x0) / (N - 1);
    S.forEach((s, i) => {
      const t = i / (N - 1);
      s.x = x0 + t * (x1 - x0);
      s.top = yT + h * neckAt(t);
      s.bot = yB - t * 0.46 * h;
      s.len = s.bot - s.top;
      s.w = 2.1 - 1.2 * t;
    });
    Lmax = S[0].len;
    S.forEach((s) => { const r = s.len / Lmax; s.tau = 0.55 + 1.1 * r; s.fv = 5.5 + 7 * (1 - r); });
    geo = { x0, x1, yT, yB, h };
    buildStatic();
    return true;
  }

  // 靜態層：琴柱、琴頸、音板、弦栓 ⇒ 每格只要 drawImage 一次
  function buildStatic() {
    stat = stat || document.createElement('canvas');
    stat.width = cv.width; stat.height = cv.height;
    const c = (statCx = stat.getContext('2d'));
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const { x0, x1, yT, yB, h } = geo;
    // 琴身後面一圈很淡的光
    const g = c.createRadialGradient((x0 + x1) / 2, yT + h * 0.45, 10, (x0 + x1) / 2, yT + h * 0.45, h * 0.75);
    g.addColorStop(0, rgba(COL.gold, 0.1)); g.addColorStop(1, rgba(COL.gold, 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const pX = x0 - sp * 1.6;
    const kneeX = x1 + sp * 1.1, kneeY = S[N - 1].bot + 4;
    // 音板（弦的下端）
    let lg = c.createLinearGradient(pX, yB, kneeX, kneeY);
    lg.addColorStop(0, rgba(COL.wood, 0.85)); lg.addColorStop(0.6, rgba(COL.woodLt, 0.7)); lg.addColorStop(1, rgba(COL.gold, 0.6));
    c.strokeStyle = lg; c.lineWidth = Math.max(7, sp * 0.8);
    c.beginPath(); c.moveTo(pX + 2, yB + 10); c.lineTo(kneeX, kneeY); c.stroke();
    // 琴柱
    lg = c.createLinearGradient(0, yT, 0, yB);
    lg.addColorStop(0, rgba(COL.gold, 0.75)); lg.addColorStop(1, rgba(COL.wood, 0.55));
    c.strokeStyle = lg; c.lineWidth = Math.max(6, sp * 0.62);
    c.beginPath(); c.moveTo(pX, yT - 4); c.bezierCurveTo(pX - sp * 0.5, yT + h * 0.35, pX - sp * 0.3, yT + h * 0.75, pX + 2, yB + 12); c.stroke();
    // 琴柱頂端的小捲曲
    c.lineWidth = Math.max(3, sp * 0.3); c.strokeStyle = rgba(COL.goldLt, 0.7);
    c.beginPath(); c.arc(pX + 4, yT - 10, Math.max(5, sp * 0.55), Math.PI * 0.6, Math.PI * 2.1); c.stroke();
    // 琴頸（沿著每條弦的上端，最後彎下來接到音板）
    lg = c.createLinearGradient(pX, 0, kneeX, 0);
    lg.addColorStop(0, rgba(COL.goldLt, 0.85)); lg.addColorStop(0.5, rgba(COL.gold, 0.8)); lg.addColorStop(1, rgba(COL.woodLt, 0.75));
    c.strokeStyle = lg; c.lineWidth = Math.max(7, sp * 0.75);
    c.beginPath(); c.moveTo(pX, yT - 6);
    for (let k = 0; k <= 60; k++) { const t = k / 60; c.lineTo(x0 + t * (x1 - x0), yT + h * neckAt(t) - 8); }
    c.quadraticCurveTo(kneeX + sp * 0.35, S[N - 1].top - 6, kneeX, kneeY); c.stroke();
    // 高光
    c.strokeStyle = rgba([255, 243, 214], 0.35); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(pX + 2, yT - 9);
    for (let k = 0; k <= 60; k++) { const t = k / 60; c.lineTo(x0 + t * (x1 - x0), yT + h * neckAt(t) - 10.5); }
    c.stroke();
    // 弦栓與音板孔
    S.forEach((s) => {
      c.fillStyle = rgba(COL.goldLt, 0.95); c.beginPath(); c.arc(s.x, s.top - 1, Math.max(1.5, sp * 0.13), 0, 7); c.fill();
      c.fillStyle = rgba(COL.woodLt, 0.9); c.beginPath(); c.arc(s.x, s.bot + 1, Math.max(1.2, sp * 0.1), 0, 7); c.fill();
    });
  }

  /* ── 音符（向量畫，不靠字型） ───────────── */
  const sprites = [];
  function buildSprites() {
    const sz = 40;
    [0, 1].forEach((kind) => {
      const c = document.createElement('canvas'); c.width = c.height = sz * dpr;
      const g = c.getContext('2d'); g.scale(dpr, dpr);
      g.fillStyle = g.strokeStyle = rgba(COL.goldLt, 1); g.lineWidth = 2; g.lineCap = 'round';
      g.shadowColor = rgba(COL.gold, 0.9); g.shadowBlur = 8;
      const head = (x, y) => { g.save(); g.translate(x, y); g.rotate(-0.45); g.beginPath(); g.ellipse(0, 0, 5.2, 3.8, 0, 0, 7); g.fill(); g.restore(); };
      if (kind === 0) { // ♪
        head(15, 28); g.beginPath(); g.moveTo(19.6, 26.5); g.lineTo(19.6, 9); g.bezierCurveTo(22, 14, 28, 15, 27, 22); g.stroke();
      } else { // ♫
        head(11, 29); head(27, 26); g.beginPath(); g.moveTo(15.6, 27.5); g.lineTo(15.6, 11); g.moveTo(31.6, 24.5); g.lineTo(31.6, 8); g.stroke();
        g.lineWidth = 3.4; g.beginPath(); g.moveTo(15.6, 11); g.lineTo(31.6, 8); g.stroke();
      }
      sprites[kind] = c;
    });
  }
  const notes = [];
  function spawnNote(x, y, strength) {
    if (reduce || notes.length > 36) return;
    notes.push({ x, y, vx: (Math.random() - 0.5) * 14, vy: -(34 + Math.random() * 30), age: 0, life: 1.6 + Math.random() * 0.9,
      rot: (Math.random() - 0.5) * 0.5, vr: (Math.random() - 0.5) * 0.6, k: Math.random() < 0.6 ? 0 : 1, sc: 0.55 + strength * 0.45, ph: Math.random() * 6 });
  }

  /* ── 撥弦 ───────────────────────────────── */
  let lastUser = -1e9, lastNoteAt = 0;
  function pluck(s, p, strength, dir, sound, delay = 0, user = true) {
    const now = performance.now();
    p = Math.min(0.85, Math.max(0.15, p));
    // 兩個振動模態，係數依撥的位置；正規化成「撥的那一點位移＝amp」
    const a1 = Math.sin(Math.PI * p), a2 = Math.sin(2 * Math.PI * p) / 4;
    const norm = a1 * Math.sin(Math.PI * p) + a2 * Math.sin(2 * Math.PI * p) || 1;
    s.c1 = a1 / norm; s.c2 = a2 / norm;
    const cur = s.amp * Math.exp(-(now - s.t0) / 1000 / s.tau);
    const maxA = Math.min(16, sp * 1.05);
    s.amp = Math.min(maxA, cur * 0.5 + maxA * (0.3 + 0.7 * strength) * (reduce ? 0 : 1));
    s.t0 = now; s.dir = dir || (Math.random() < 0.5 ? -1 : 1);
    s.glow = Math.min(1, 0.4 + strength * 0.7); s.g0 = now;
    if (user) {
      lastUser = now;
      if (now - s.lastNote > 160 && now - lastNoteAt > 45 && Math.random() < 0.3 + strength * 0.4) { s.lastNote = lastNoteAt = now; spawnNote(s.x, s.top + p * s.len, strength); }
    }
    if (sound) Audio.play(s.i, strength, delay);
    kick();
  }

  /* ── 聲音：Karplus-Strong ─────────────── */
  const Audio = (() => {
    let ac = null, out = null, send = null, on = true;
    const bufs = [], voices = [];
    try { on = localStorage.getItem('hh_harp_sound') !== 'off'; } catch (e) {}
    function impulse(sec) {
      const sr = ac.sampleRate, n = Math.floor(sr * sec), b = ac.createBuffer(2, n, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch); let lp = 0;
        for (let k = 0; k < n; k++) { lp += 0.35 * ((Math.random() * 2 - 1) - lp); d[k] = lp * Math.pow(1 - k / n, 3.2); }
      }
      return b;
    }
    function make(i) {
      const sr = ac.sampleRate, f = S[i].freq;
      const st = f < 400 ? 0.5 : Math.max(0.2, 0.5 - 0.3 * (f - 400) / 1400); // 高音的平均濾波少一點，不要一撥就沒聲音
      const L = Math.max(2, Math.floor(sr / f - st));
      const dur = 1.3 + 2.1 * (1 - i / (N - 1));
      const len = Math.floor(sr * dur), out = new Float32Array(len), buf = new Float32Array(L);
      // 激發：柔化的雜訊（手指撥＝比 pick 暗）＋撥弦位置的梳狀濾波
      let lp = 0, mean = 0;
      for (let k = 0; k < L; k++) { lp += 0.5 * ((Math.random() * 2 - 1) - lp); buf[k] = lp; mean += lp; }
      mean /= L; for (let k = 0; k < L; k++) buf[k] -= mean;
      const off = Math.max(1, Math.round(L * 0.14)), tmp = buf.slice();
      for (let k = 0; k < L; k++) buf[k] = tmp[k] - 0.6 * tmp[(k + off) % L];
      const loss = Math.pow(0.001, 1 / (dur * f));
      let k = 0, peak = 0;
      const w = 2 * Math.PI * f / sr, bodyTau = sr * (0.25 + 0.5 * (1 - i / N));
      for (let n = 0; n < len; n++) {
        const k2 = k + 1 === L ? 0 : k + 1;
        const y = buf[k];
        buf[k] = loss * ((1 - st) * buf[k] + st * buf[k2]);
        k = k2;
        const v = y + 0.22 * Math.sin(w * n) * Math.exp(-n / bodyTau); // 一點點基音，聲音比較圓
        out[n] = v; const a = v < 0 ? -v : v; if (a > peak) peak = a;
      }
      const fadeIn = Math.floor(sr * 0.002), fadeOut = Math.floor(sr * 0.08), g = 0.9 / (peak || 1);
      for (let n = 0; n < len; n++) {
        let e = g;
        if (n < fadeIn) e *= n / fadeIn;
        if (n > len - fadeOut) e *= (len - n) / fadeOut;
        out[n] *= e;
      }
      const ab = ac.createBuffer(1, len, sr); ab.getChannelData(0).set(out);
      return { buf: ab, rate: f / (sr / (L + st)) };
    }
    return {
      get on() { return on; },
      get live() { return !!ac && ac.state === 'running'; },
      set(v) { on = v; try { localStorage.setItem('hh_harp_sound', v ? 'on' : 'off'); } catch (e) {} },
      unlock() { // 只在使用者手勢的事件裡呼叫
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!ac) {
          try { ac = new AC(); } catch (e) { return; }
          const comp = ac.createDynamicsCompressor();
          comp.threshold.value = -14; comp.ratio.value = 4;
          out = ac.createGain(); out.gain.value = 0.42;
          const rev = ac.createConvolver(); rev.buffer = impulse(2.6);
          send = ac.createGain(); send.gain.value = 0.32;
          send.connect(rev); rev.connect(out); out.connect(comp); comp.connect(ac.destination);
        }
        if (ac.state === 'suspended') ac.resume().catch(() => {});
      },
      play(i, strength, delay) {
        if (!on || !ac || ac.state !== 'running') return;
        const b = bufs[i] || (bufs[i] = make(i));
        const t = ac.currentTime + Math.min(0.08, Math.max(0, delay || 0));
        const src = ac.createBufferSource(); src.buffer = b.buf; src.playbackRate.value = b.rate;
        const g = ac.createGain(); g.gain.value = 0.16 + 0.3 * strength;
        let node = g;
        if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = (i / (N - 1)) * 1.1 - 0.55; g.connect(p); node = p; }
        src.connect(g); node.connect(out); node.connect(send);
        // 同一條弦重撥：舊的聲音快速收掉；同時發聲上限 18
        for (let v = voices.length - 1; v >= 0; v--) {
          if (voices[v].i === i || voices.length > 18 && v === 0) { voices[v].g.gain.setTargetAtTime(0, t, 0.02); try { voices[v].src.stop(t + 0.15); } catch (e) {} voices.splice(v, 1); }
        }
        const voice = { i, src, g }; voices.push(voice);
        src.onended = () => { const k = voices.indexOf(voice); if (k >= 0) voices.splice(k, 1); try { node.disconnect(); } catch (e) {} };
        src.start(t);
      },
    };
  })();

  /* ── 聲音開關 ───────────────────────────── */
  const btn = hero.querySelector('[data-sound]'), btnTxt = hero.querySelector('[data-sound-txt]');
  // 提示文字依「實際在用的」指標換：先看裝置，真的有人用手指或滑鼠之後以那個為準
  const hint = hero.querySelector('[data-hint]');
  let mouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const paintBtn = () => {
    if (hint) hint.textContent = !mouse ? '手指橫著劃過琴弦試試看' : Audio.live || !Audio.on ? '用滑鼠劃過琴弦試試看' : '點一下琴弦，再用滑鼠劃過去';
    if (!btn) return;
    btn.setAttribute('aria-pressed', Audio.on); btnTxt.textContent = Audio.on ? '聲音 開' : '聲音 關';
    btn.classList.toggle('live', Audio.on && Audio.live);
  };
  if (btn) btn.addEventListener('click', () => { Audio.unlock(); Audio.set(!Audio.on); paintBtn(); if (Audio.on) setTimeout(() => strum(true), 60); });
  // 任何使用者手勢都可以解鎖聲音（瀏覽器規定）；解鎖後就不再掛著
  const gestures = ['pointerup', 'keydown', 'touchend'];
  const onGesture = (e) => {
    if (!e.isTrusted) return;
    if (e.type === 'keydown' && (e.key === 'Escape' || e.key === 'Tab')) return;
    if (!Audio.on) return;
    Audio.unlock();
    setTimeout(() => { paintBtn(); if (Audio.live) gestures.forEach((g) => removeEventListener(g, onGesture, true)); }, 50);
  };
  gestures.forEach((g) => addEventListener(g, onGesture, true));
  paintBtn();

  // 輕輕一個滑音（開聲音時的確認；也用在自動「呼吸」）
  function strum(sound) {
    const start = 8 + Math.floor(Math.random() * 6), n = 6, up = Math.random() < 0.7;
    for (let k = 0; k < n; k++) {
      const s = S[up ? start + k : start + n - 1 - k];
      if (sound) pluck(s, 0.5, 0.45, up ? 1 : -1, true, k * 0.07, false);
      else setTimeout(() => pluck(s, 0.35 + Math.random() * 0.3, 0.2, up ? 1 : -1, false, 0, false), k * 90);
    }
  }

  /* ── 指標：劃過就撥 ─────────────────────── */
  const ptrs = new Map();
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function cross(ax, ay, bx, by, dt) {
    const dx = bx - ax; if (Math.abs(dx) < 0.01) return;
    const lo = Math.min(ax, bx), hi = Math.max(ax, bx), dir = dx > 0 ? 1 : -1;
    const speed = Math.abs(dx) / Math.max(8, dt); // px/ms
    const strength = Math.min(1, 0.3 + speed * 0.35);
    const hit = [];
    for (const s of S) {
      if (s.x > lo && s.x <= hi) {
        const f = (s.x - ax) / dx, y = ay + f * (by - ay);
        if (y >= s.top - 4 && y <= s.bot + 4) hit.push([s, (y - s.top) / s.len, f]);
      }
    }
    hit.forEach(([s, p, f]) => pluck(s, p, strength, dir, true, f * Math.min(dt, 60) / 1000));
  }
  function nearest(x, y) {
    let best = null, bd = Math.max(12, sp * 0.6);
    for (const s of S) { const d = Math.abs(s.x - x); if (d < bd && y >= s.top - 12 && y <= s.bot + 12) { bd = d; best = s; } }
    return best;
  }
  stage.addEventListener('pointerdown', (e) => {
    if ((e.pointerType === 'mouse') !== mouse) { mouse = e.pointerType === 'mouse'; paintBtn(); }
    if (e.target.closest('button, a')) return;
    const [x, y] = pos(e);
    ptrs.set(e.pointerId, { x, y, t: e.timeStamp, sx: x, sy: y, st: e.timeStamp, mode: e.pointerType === 'mouse' ? 'h' : null });
    if (e.pointerType === 'mouse') { Audio.on && Audio.unlock(); const s = nearest(x, y); if (s) pluck(s, (y - s.top) / s.len, 0.7, 0, true); setTimeout(paintBtn, 60); }
  });
  stage.addEventListener('pointermove', (e) => {
    const [x, y] = pos(e);
    let p = ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') ptrs.set(e.pointerId, { x, y, t: e.timeStamp, sx: x, sy: y, st: e.timeStamp, mode: 'h' }); return; }
    if (!p.mode) { // 觸控：先判斷是橫劃（撥弦）還是直劃（捲頁）
      const dx = x - p.sx, dy = y - p.sy;
      if (Math.abs(dx) + Math.abs(dy) < 8) return;
      p.mode = Math.abs(dx) > Math.abs(dy) * 0.8 ? 'h' : 'v';
      if (p.mode === 'h') { cross(p.sx, p.sy, x, y, e.timeStamp - p.st); p.x = x; p.y = y; p.t = e.timeStamp; }
      return;
    }
    if (p.mode === 'h') cross(p.x, p.y, x, y, e.timeStamp - p.t);
    p.x = x; p.y = y; p.t = e.timeStamp;
  });
  const end = (e) => {
    const p = ptrs.get(e.pointerId);
    if (p && e.type === 'pointerup' && e.pointerType !== 'mouse' && !p.mode && e.timeStamp - p.st < 500) {
      // 點一下：撥最近的那條（這時聲音也剛解鎖）
      Audio.on && Audio.unlock();
      const s = nearest(p.sx, p.sy);
      if (s) setTimeout(() => pluck(s, (p.sy - s.top) / s.len, 0.7, 0, true), 0);
      setTimeout(paintBtn, 60);
    }
    if (e.pointerType !== 'mouse' || e.type === 'pointerleave' || e.type === 'pointercancel') ptrs.delete(e.pointerId);
  };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => stage.addEventListener(t, end));

  /* ── 繪製 ───────────────────────────────── */
  let raf = 0, visible = true, last = 0, nextBreath = performance.now() + 2200;
  const SEG = 16;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    if (stat) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.drawImage(stat, 0, 0); cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    cx.globalCompositeOperation = 'lighter'; cx.lineCap = 'round';
    const T = now / 1000;
    const sweep = ((T / 7.5) % 1) * (N + 12) - 6; // 一道很淡的光慢慢掃過琴弦
    let busy = false;
    for (const s of S) {
      const tau = (now - s.t0) / 1000;
      const e = s.amp * Math.exp(-tau / s.tau);
      const gl = s.glow * Math.exp(-(now - s.g0) / 900);
      let a = s.base;
      if (!reduce) a += 0.08 * Math.sin(T * 1.1 + s.i * 0.55) + 0.3 * Math.exp(-((s.i - sweep) ** 2) / 5);
      a = Math.min(1, a + gl * 0.6);
      cx.beginPath();
      if (e > 0.15) {
        busy = true;
        const w1 = 2 * Math.PI * s.fv * tau, c1 = s.c1 * Math.cos(w1), c2 = s.c2 * Math.cos(2 * w1);
        for (let k = 0; k <= SEG; k++) {
          const u = k / SEG, d = e * s.dir * (c1 * Math.sin(Math.PI * u) + c2 * Math.sin(2 * Math.PI * u));
          k ? cx.lineTo(s.x + d, s.top + u * s.len) : cx.moveTo(s.x, s.top);
        }
      } else { cx.moveTo(s.x, s.top); cx.lineTo(s.x, s.bot); }
      if (gl > 0.02) {
        busy = true;
        cx.strokeStyle = rgba(COL.goldLt, 0.16 * gl); cx.lineWidth = 7 + 6 * gl; cx.stroke();
        cx.strokeStyle = rgba(COL.goldLt, 0.3 * gl); cx.lineWidth = 3.2; cx.stroke();
      }
      cx.strokeStyle = rgba(gl > 0.3 ? COL.goldLt : s.col, a); cx.lineWidth = s.w; cx.stroke();
    }
    cx.globalCompositeOperation = 'source-over';
    // 音符往上漂
    for (let k = notes.length - 1; k >= 0; k--) {
      const n = notes[k]; n.age += dt;
      if (n.age > n.life) { notes.splice(k, 1); continue; }
      n.x += (n.vx + Math.sin(n.age * 2.4 + n.ph) * 10) * dt; n.y += n.vy * dt; n.rot += n.vr * dt;
      const q = n.age / n.life, al = q < 0.15 ? q / 0.15 : 1 - (q - 0.15) / 0.85;
      const sz = 40 * n.sc;
      cx.globalAlpha = Math.max(0, al) * 0.95;
      cx.save(); cx.translate(n.x, n.y); cx.rotate(n.rot); cx.drawImage(sprites[n.k], -sz / 2, -sz / 2, sz, sz); cx.restore();
    }
    cx.globalAlpha = 1;
    if (notes.length) busy = true;
    // 沒人撥的時候偶爾自己「呼吸」一下（沒有聲音）
    if (!reduce && now > nextBreath && now - lastUser > 5000) {
      nextBreath = now + 3800 + Math.random() * 3500;
      if (Math.random() < 0.5) strum(false);
      else pluck(S[Math.floor(Math.random() * N)], 0.3 + Math.random() * 0.4, 0.25, 0, false, 0, false);
    }
    if (visible && (!reduce || busy)) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }

  function init() {
    if (!layout()) return;
    buildSprites();
    kick();
  }
  if ('ResizeObserver' in window) {
    let rt = 0;
    new ResizeObserver(() => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { if (layout()) kick(); }); }).observe(hero);
  } else addEventListener('resize', () => { if (layout()) kick(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting && !document.hidden; if (visible) kick(); }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) kick(); });
  mq.addEventListener && mq.addEventListener('change', (e) => { reduce = e.matches; kick(); });
  // 字型載入完成、版面位移後再量一次
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (layout()) kick(); });
  init();
})();
