/* Scroll-driven engineering backgrounds.
   profile   — profilometer traces extracted from Ammar's confocal maps (turned vs belt-finished)
   grains    — Johnson–Mehl nucleation & growth: an etched-steel microstructure forming
   blueprint — technical drawing (insert, weld, femoral head, gear) drawn by scroll
   fem       — his Abaqus models: chip formation and frictional heating
   spray     — cold-spray particles building a coating
*/
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 700px)").matches;
  const root = document.getElementById("bgfx");
  if (!root) return;
  const layers = {};
  root.querySelectorAll("[data-scene]").forEach(el => (layers[el.dataset.scene] = el));
  let active = null;
  const runners = {};

  /* ---------- scene switching ---------- */
  const MAP = [["top", "profile"], ["about", "profile"], ["education", "grains"], ["research", "profile"],
    ["projects", "blueprint"], ["experience", "spray"], ["skills", "spray"], ["leadership", "spray"], ["contact", "fem"]];
  function setScene(name) {
    if (name === active) return;
    active = name;
    for (const k in layers) layers[k].classList.toggle("on", k === name);
    for (const k in runners) runners[k].run(k === name);
  }
  function pick() {
    const y = innerHeight * 0.45;
    let cur = "profile";
    for (const [id, sc] of MAP) {
      const el = id === "top" ? document.querySelector("main") : document.getElementById(id);
      if (el && el.getBoundingClientRect().top <= y) cur = sc;
    }
    // inside the projects grid, switch to the Abaqus films for the second half
    const pr = document.getElementById("projects");
    if (cur === "blueprint" && pr) {
      const r = pr.getBoundingClientRect(), p = (y - r.top) / r.height;
      layers.blueprint.style.setProperty("--p", Math.max(0, Math.min(1, p * 3)).toFixed(3));
      if (p > 0.55) cur = "fem";
    }
    setScene(cur);
  }
  addEventListener("scroll", () => requestAnimationFrame(pick), { passive: true });
  addEventListener("resize", pick);

  /* ---------- 1. profilometer: real 2D profiles extracted from Ammar's confocal maps ---------- */
  (function profile() {
    const host = layers.profile; if (!host) return;
    const cv = document.createElement("canvas"); host.appendChild(cv);
    const g = cv.getContext("2d"); let Wd, Ht, on = false, raf, D = null, t0 = 0, row = 0;
    const dpr = Math.min(devicePixelRatio, 1.5), LX = 828.4, ZR = 6; // x: µm span of the map; z: ±µm shown
    const fr = document.documentElement.lang === "fr";
    fetch("bg-profiles.json").then(r => r.json()).then(j => { D = j; if (on || reduce) draw(performance.now()); }).catch(() => { });
    function size() { Wd = innerWidth; Ht = innerHeight; cv.width = Wd * dpr; cv.height = Ht * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    const ra = p => { const m = p.reduce((a, b) => a + b, 0) / p.length; return p.reduce((a, b) => a + Math.abs(b - m), 0) / p.length; };
    function panel(x0, y0, w, h, prof, frac, col, title, ghost) {
      const zy = z => y0 + h / 2 - (z / ZR) * (h / 2), xx = i => x0 + (i / (prof.length - 1)) * w;
      // grid
      g.strokeStyle = "rgba(255,159,67,.10)"; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k <= 8; k++) { const x = x0 + w * k / 8; g.moveTo(x, y0); g.lineTo(x, y0 + h); }
      for (let k = -ZR; k <= ZR; k += 2) { g.moveTo(x0, zy(k)); g.lineTo(x0 + w, zy(k)); }
      g.stroke();
      g.strokeStyle = "rgba(255,159,67,.35)"; g.beginPath(); g.moveTo(x0, zy(0)); g.lineTo(x0 + w, zy(0)); g.stroke();
      // axis labels
      g.fillStyle = "rgba(168,162,158,.75)"; g.font = "11px 'JetBrains Mono',monospace";
      for (let k = -ZR; k <= ZR; k += 3) g.fillText((k > 0 ? "+" : "") + k, x0 - 30, zy(k) + 4);
      for (let k = 0; k <= 8; k += 2) g.fillText(Math.round(LX * k / 8), x0 + w * k / 8 - 8, y0 + h + 16);
      g.fillText("z µm", x0 - 30, y0 - 8); g.fillText("x µm", x0 + w - 28, y0 + h + 30);
      g.fillStyle = col; g.font = "600 13px Inter,sans-serif"; g.fillText(title, x0, y0 - 8);
      // previous profile (ghost)
      if (ghost) { g.strokeStyle = "rgba(168,162,158,.18)"; g.lineWidth = 1; g.beginPath(); ghost.forEach((z, i) => i ? g.lineTo(xx(i), zy(z)) : g.moveTo(xx(i), zy(z))); g.stroke(); }
      // live trace
      const n = Math.max(2, Math.floor(frac * prof.length));
      g.save(); g.shadowColor = col; g.shadowBlur = 10; g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i < n; i++) { const X = xx(i), Y = zy(prof[i]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      g.stroke(); g.restore();
      // stylus
      const sx = xx(n - 1), sy = zy(prof[n - 1]);
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, y0 - 4); g.lineTo(sx, sy - 6); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(sx - 4, sy - 9); g.lineTo(sx + 4, sy - 9); g.lineTo(sx, sy - 1); g.fill();
      // readout
      const r = ra(prof.slice(0, n));
      g.fillStyle = col; g.font = "600 12px 'JetBrains Mono',monospace";
      g.fillText("Ra " + r.toFixed(2) + " µm", x0 + w - 110, y0 - 8);
    }
    function draw(now) {
      g.clearRect(0, 0, Wd, Ht);
      if (D) {
        const period = 7000, el = now - t0, frac = reduce ? 1 : Math.min(1, el / (period * .8));
        if (!reduce && el > period) { t0 = now; row = (row + 1) % D.turned.length; }
        const L = document.documentElement.lang === "fr";
        const wide = Wd > 900, x0 = wide ? Wd * .44 : 46, w = wide ? Wd * .52 : Wd - 64;
        const h = Math.min(Ht * .26, 220), gap = Ht * .12;
        const y1 = Ht * .5 - h - gap / 2, y2 = Ht * .5 + gap / 2;
        const prev = (row + D.turned.length - 1) % D.turned.length;
        panel(x0, y1, w, h, D.turned[row], frac, "#ffb347", L ? "Rechargé laser · tourné" : "Laser-cladded · turned", D.turned[prev]);
        panel(x0, y2, w, h, D.belt[row], frac, "#7dd3fc", L ? "Rechargé laser · toilé (superfinition)" : "Laser-cladded · belt-finished", D.belt[prev]);
      }
      if (on && !reduce) raf = requestAnimationFrame(draw);
    }
    size(); addEventListener("resize", () => { size(); if (reduce) draw(0); });
    runners.profile = { run(v) { on = v; cancelAnimationFrame(raf); if (v) { t0 = performance.now(); raf = requestAnimationFrame(draw); } } };
  })();

  /* ---------- 2. microstructure: Johnson–Mehl nucleation & growth ---------- */
  (function grains() {
    const host = layers.grains; if (!host) return;
    const cv = document.createElement("canvas"); host.appendChild(cv);
    const g = cv.getContext("2d");
    const SW = small ? 300 : 560; let SH, arrive, owner, shade, img, N, start, on = false, raf;
    function build() {
      SH = Math.round(SW * innerHeight / innerWidth);
      cv.width = SW; cv.height = SH; img = g.createImageData(SW, SH);
      N = small ? 70 : 140;
      const seeds = Array.from({ length: N }, () => [Math.random() * SW, Math.random() * SH, Math.random() * 3.2]);
      shade = seeds.map(() => [Math.random(), Math.random() < .22]); // tone, pearlite colony
      arrive = new Float32Array(SW * SH); owner = new Uint16Array(SW * SH);
      const v = SW / 30;
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        let best = 1e9, bi = 0;
        for (let i = 0; i < N; i++) { const s = seeds[i], t = s[2] + Math.hypot(x - s[0], y - s[1]) / v; if (t < best) { best = t; bi = i; } }
        arrive[y * SW + x] = best; owner[y * SW + x] = bi;
      }
      start = performance.now();
    }
    function frame(now) {
      const t = reduce ? 99 : ((now - start) / 1000) % 16, fade = t > 13 ? 1 - (t - 13) / 3 : 1, D = img.data;
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        const i = y * SW + x, o = owner[i], k = i * 4;
        if (arrive[i] > t) { D[k] = 13; D[k + 1] = 27; D[k + 2] = 42; D[k + 3] = 255; continue; }
        const edge = (x < SW - 1 && owner[i + 1] !== o) || (y < SH - 1 && owner[i + SW] !== o);
        const front = arrive[i] > t - .25;
        const [tone, pearl] = shade[o];
        let c = pearl ? ((x + y * 2) % 4 < 2 ? 70 : 120) : 135 + tone * 70;
        if (edge) c = 28;
        let R = c * .78, G = c * .86, B = c;
        if (front) { R = 255; G = 150; B = 70; }
        D[k] = 13 + (R - 13) * fade; D[k + 1] = 27 + (G - 27) * fade; D[k + 2] = 42 + (B - 42) * fade; D[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      if (t > 15.9) build();
      if (on && !reduce) raf = requestAnimationFrame(frame);
    }
    build();
    addEventListener("resize", () => { build(); frame(performance.now()); });
    runners.grains = { run(v) { on = v; cancelAnimationFrame(raf); if (v) raf = requestAnimationFrame(frame); } };
  })();

  /* ---------- 3. blueprint: drawn with scroll (pure CSS var --p) ---------- */
  (function blueprint() {
    const host = layers.blueprint; if (!host) return;
    host.querySelectorAll("path,circle,line,polyline,polygon,ellipse").forEach(el => {
      let L = 400; try { L = el.getTotalLength(); } catch (e) { }
      el.style.strokeDasharray = L; el.style.setProperty("--L", L);
    });
    runners.blueprint = { run() { } };
  })();

  /* ---------- 4. Abaqus films ---------- */
  (function fem() {
    const host = layers.fem; if (!host) return;
    const vids = [...host.querySelectorAll("video")];
    runners.fem = { run(v) { vids.forEach(x => { if (v && !reduce) { const p = x.play(); if (p) p.catch(() => { }); } else x.pause(); }); } };
  })();

  /* ---------- 5. cold-spray particles building a coating ---------- */
  (function spray() {
    const host = layers.spray; if (!host) return;
    const cv = document.createElement("canvas"); host.appendChild(cv);
    const g = cv.getContext("2d"); let Wd, Ht, P = [], layer, on = false, raf, last = 0;
    const dpr = Math.min(devicePixelRatio, 1.5);
    function size() { Wd = innerWidth; Ht = innerHeight; cv.width = Wd * dpr; cv.height = Ht * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); layer = new Float32Array(Math.ceil(Wd / 4) + 1); }
    function spawn() {
      const nx = Wd * (.5 + .45 * Math.sin(performance.now() / 3000)), a = Math.PI / 2 + (Math.random() - .5) * .35;
      P.push({ x: nx + (Math.random() - .5) * 10, y: Ht * .12, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, r: 1 + Math.random() * 1.6, h: Math.random() });
    }
    function frame(now) {
      const dt = Math.min(2, (now - last) / 16.7 || 1); last = now;
      g.fillStyle = "rgba(15,17,21,.28)"; g.fillRect(0, 0, Wd, Ht);
      const n = small ? 4 : 10; for (let i = 0; i < n; i++) spawn();
      const base = Ht - 4;
      // nozzle
      const nx = Wd * (.5 + .45 * Math.sin(now / 3000));
      g.fillStyle = "rgba(255,159,67,.25)"; g.beginPath(); g.moveTo(nx - 14, Ht * .02); g.lineTo(nx + 14, Ht * .02); g.lineTo(nx + 5, Ht * .12); g.lineTo(nx - 5, Ht * .12); g.fill();
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.x += p.vx * dt; p.y += p.vy * dt;
        const col = Math.max(0, Math.min(layer.length - 1, Math.round(p.x / 4)));
        if (p.y >= base - layer[col]) { for (let k = -2; k <= 2; k++) { const j = col + k; if (j >= 0 && j < layer.length) layer[j] = Math.min(Ht * .22, layer[j] + .18 * (1 - Math.abs(k) / 3)); } P.splice(i, 1); continue; }
        g.fillStyle = p.h < .5 ? "rgba(255,179,71,.9)" : "rgba(255,159,67,.85)";
        g.beginPath(); g.arc(p.x, p.y, p.r * 1.4, 0, 6.283); g.fill();
      }
      // coating build-up
      const grd = g.createLinearGradient(0, base - Ht * .2, 0, base);
      grd.addColorStop(0, "rgba(201,164,106,.55)"); grd.addColorStop(1, "rgba(122,94,38,.75)");
      g.fillStyle = grd; g.beginPath(); g.moveTo(0, Ht);
      for (let j = 0; j < layer.length; j++) g.lineTo(j * 4, base - layer[j]);
      g.lineTo(Wd, Ht); g.fill();
      if (Math.max(...layer) > Ht * .2) layer.fill(0);
      if (on && !reduce) raf = requestAnimationFrame(frame);
    }
    size(); addEventListener("resize", size);
    runners.spray = { run(v) { on = v; cancelAnimationFrame(raf); if (v) { last = performance.now(); raf = requestAnimationFrame(frame); } } };
    if (reduce) frame(performance.now());
  })();

  document.addEventListener("visibilitychange", () => { for (const k in runners) runners[k].run(!document.hidden && k === active); });
  pick();
})();
