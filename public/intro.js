// Scroll-driven cluster animation shown to visitors before they log in.
// One <canvas> is redrawn every frame from a single smoothed scroll value (0..1).
(() => {
  const W = 1000, H = 620;
  const C = { bg1: '#0a1230', bg2: '#050a1c', blue: '#326ce5', sky: '#7aa7ff', ice: '#e8eefc', amber: '#ffb454', line: 'rgba(122,167,255,.55)' };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = t => t * t * (3 - 2 * t);
  const back = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const lerp = (a, b, t) => a + (b - a) * t;
  let raf = 0;

  const CAPTIONS = [
    [0, .15, '', ''],
    [.16, .34, 'The control plane decides', 'The API server, etcd, scheduler and controller manager hold the cluster’s desired state and work to match it.'],
    [.36, .53, 'Nodes do the work', 'Every worker node runs a kubelet and kube-proxy, and reports back to the API server.'],
    [.55, .77, 'Pods land where they fit', 'Apply a manifest and the scheduler picks a node for each pod.'],
    [.79, .92, 'Services route the traffic', 'A Service gives a set of pods one stable address and spreads requests across them.'],
  ];

  window.stopIntro = () => { cancelAnimationFrame(raf); raf = 0; };

  window.renderIntro = function renderIntro(onChoose) {
    window.stopIntro();
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('app').innerHTML = `
    <div class="intro" id="intro">
      <div class="intro-top"><span class="intro-brand">${logoSvg()}CKA Study Tracker</span>
        <span class="intro-links"><button class="il" data-go="skip">Skip intro</button><button class="il solid" data-go="login">Log in</button></span></div>
      <div class="intro-stage"><canvas id="introCv" aria-label="Animated Kubernetes cluster that assembles as you scroll" role="img"></canvas>
        <div class="intro-copy" id="introCopy"><div class="cap hero" data-i="0">${logoSvg('hero-logo draw')}<h1 class="wm-big"><span>CKA</span> Study Tracker</h1>
            <p class="tag">Prepare for the Certified Kubernetes Administrator exam with a plan built around your exam date, detailed documentation for every topic, and a daily streak that keeps you consistent.</p>
            <div class="cta"><button class="btn big" data-go="signup">Create a free account</button><button class="btn ghost big" data-go="login">Log in</button></div></div>
          ${CAPTIONS.slice(1).map(([, , h, t], i) => `<div class="cap" data-i="${i + 1}"><h2>${h}</h2><p>${t}</p></div>`).join('')}
          <div class="cap final" data-i="5"><h2>Now run it yourself</h2><p>Track every lesson and lab, keep a daily streak, and follow a schedule that ends on your exam date.</p>
            <div class="cta"><button class="btn big" data-go="signup">Create a free account</button><button class="btn ghost big" data-go="login">Log in</button></div></div></div>
        <ol class="intro-rail" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(i => `<li data-r="${i}"></li>`).join('')}</ol>
        <div class="intro-hint" id="introHint">Scroll to see how a cluster fits together<span></span></div></div>
      <div class="intro-track" id="introTrack"></div>
    </div>`;
    const root = document.getElementById('intro');
    root.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (!b) return; window.stopIntro(); onChoose(b.dataset.go === 'signup' ? 'signup' : 'login'); });

    const cv = document.getElementById('introCv'), ctx = cv.getContext('2d');
    const caps = [...root.querySelectorAll('.cap')], rail = [...root.querySelectorAll('[data-r]')], hint = document.getElementById('introHint');
    let cw = 0, ch = 0, dpr = 1, cur = reduce ? 1 : 0, target = 0;
    const stars = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.3 % 100) / 100, y: (i * 53.7 % 100) / 100, r: .4 + (i % 5) * .25, s: .2 + (i % 7) * .06 }));

    const size = () => { if (!document.body.contains(cv)) return; dpr = Math.min(2, devicePixelRatio || 1); cw = cv.clientWidth; ch = cv.clientHeight; cv.width = cw * dpr; cv.height = ch * dpr; };
    const scroll = () => { const tr = document.getElementById('introTrack'); if (!tr) return; const max = tr.offsetHeight - innerHeight; target = reduce ? 1 : clamp(scrollY / Math.max(1, max)); };
    addEventListener('resize', size); addEventListener('scroll', scroll, { passive: true });
    size(); scroll();

    // ----- scene geometry (virtual 1000 x 620) -----
    const API = { x: 500, y: 150 }, ETCD = { x: 335, y: 150 }, SCH = { x: 668, y: 100 }, CTL = { x: 668, y: 200 };
    const NODES = [200, 500, 800].map((cx, i) => ({ cx, y: 392, w: 250, h: 190, name: 'Node ' + (i + 1) }));
    const slot = (n, k) => ({ x: NODES[n].cx - 52 + (k % 2) * 104, y: NODES[n].y + 78 + Math.floor(k / 2) * 52 });
    const PODS = []; for (let k = 0; k < 4; k++) for (let n = 0; n < 3; n++) PODS.push({ n, k, ...slot(n, k) });
    const SVC_Y = 335;

    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    const glow = (c, b) => { ctx.shadowColor = c; ctx.shadowBlur = b; };
    const noGlow = () => { ctx.shadowBlur = 0; };
    const label = (t, x, y, size, a, col = C.ice, w = 600) => { ctx.globalAlpha = a; ctx.fillStyle = col; ctx.font = `${w} ${size}px "Bricolage Grotesque", Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.globalAlpha = 1; };
    const dashLine = (x1, y1, x2, y2, t, col = C.line, wd = 2) => { if (t <= 0) return; ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, t), lerp(y1, y2, t)); ctx.stroke(); };

    function helm(x, y, R, rot, draw, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a; ctx.strokeStyle = C.sky; ctx.fillStyle = 'rgba(50,108,229,.16)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; glow(C.blue, 28);
      // heptagon outline drawn progressively
      const pts = Array.from({ length: 7 }, (_, i) => [Math.cos(-Math.PI / 2 + i * 2 * Math.PI / 7) * R, Math.sin(-Math.PI / 2 + i * 2 * Math.PI / 7) * R]);
      ctx.beginPath(); const total = 7 * draw; for (let i = 0; i <= 7; i++) { const [px, py] = pts[i % 7]; if (i === 0) ctx.moveTo(px, py); else if (i <= Math.floor(total)) ctx.lineTo(px, py); else if (i - 1 < total) { const [qx, qy] = pts[i - 1], f = total - (i - 1); ctx.lineTo(lerp(qx, px, f), lerp(qy, py, f)); } }
      ctx.stroke(); if (draw >= 1) ctx.fill();
      ctx.lineWidth = 6; for (let i = 0; i < 7; i++) { const ang = -Math.PI / 2 + i * 2 * Math.PI / 7, f = seg(draw, .3 + i * .06, .55 + i * .06); if (f <= 0) continue; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * R * .62 * f, Math.sin(ang) * R * .62 * f); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, R * .17 * seg(draw, .5, 1), 0, 7); ctx.stroke(); noGlow(); ctx.restore(); ctx.globalAlpha = 1;
    }
    function cyl(x, y, r, a) { ctx.globalAlpha = a; ctx.fillStyle = 'rgba(50,108,229,.28)'; ctx.strokeStyle = C.sky; ctx.lineWidth = 2.5; glow(C.blue, 14);
      ctx.beginPath(); ctx.moveTo(x - r, y - r * .7); ctx.lineTo(x - r, y + r * .7); ctx.ellipse(x, y + r * .7, r, r * .32, 0, Math.PI, 0, true); ctx.lineTo(x + r, y - r * .7); ctx.ellipse(x, y - r * .7, r, r * .32, 0, 0, Math.PI, true); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y - r * .7, r, r * .32, 0, 0, 7); ctx.stroke(); noGlow(); ctx.globalAlpha = 1; }
    function badge(x, y, r, a, txt) { ctx.globalAlpha = a; ctx.fillStyle = 'rgba(50,108,229,.28)'; ctx.strokeStyle = C.sky; ctx.lineWidth = 2.5; glow(C.blue, 14); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); noGlow(); label(txt, x, y + r + 16, 13, a, C.ice, 500); }
    function pod(x, y, t, lit) { if (t <= 0) return; const s = back(t); ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = clamp(t * 2);
      ctx.fillStyle = lit ? 'rgba(122,167,255,.95)' : 'rgba(122,167,255,.55)'; glow(lit ? C.sky : C.blue, lit ? 22 : 10); rr(-34, -17, 68, 34, 9); ctx.fill(); noGlow();
      ctx.fillStyle = C.bg1; ctx.fillRect(-18, -6, 36, 3); ctx.fillRect(-18, 2, 22, 3); ctx.restore(); ctx.globalAlpha = 1; }
    function packet(x, y, a) { ctx.globalAlpha = a; ctx.fillStyle = C.amber; glow(C.amber, 18); ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); noGlow(); ctx.globalAlpha = 1; }

    let t0 = performance.now();
    function frame(now) {
      if (!document.getElementById('introCv')) return;
      const time = (now - t0) / 1000;
      cur += (target - cur) * (reduce ? 1 : .11);
      const p = cur;
      // layout: scene on the right of the copy on wide screens, above it on narrow ones
      const wide = cw > 880, ax = wide ? cw * .36 : 0, ay = wide ? ch * .1 : ch * .09, aw = cw - ax, ah = wide ? ch * .8 : ch * .38;
      const sc = Math.min(aw / W, ah / H) * (1 + .06 * seg(p, .92, 1)), ox = ax + (aw - W * sc) / 2, oy = ay + (ah - H * sc) / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cw, ch);
      const g = ctx.createRadialGradient(cw * .62, ch * .4, 0, cw * .62, ch * .4, Math.max(cw, ch) * .8); g.addColorStop(0, C.bg1); g.addColorStop(1, C.bg2); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = C.ice; for (const s of stars) { ctx.globalAlpha = .12 + .25 * Math.abs(Math.sin(time * s.s + s.x * 9)); ctx.beginPath(); ctx.arc(s.x * cw, ((s.y + p * s.s * .6) % 1) * ch, s.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);

      const bob = Math.sin(time * 1.2) * 2.5;
      // 0 — helm wheel: draws itself on load, spins with scroll, then shrinks into the API server
      const drawIn = reduce ? 1 : ease(clamp(time / 1.6)), toApi = ease(seg(p, .12, .24));
      if (toApi < 1) helm(lerp(500, API.x, toApi), lerp(310 + bob, API.y, toApi), lerp(118, 34, toApi), p * 5 + time * .15 * (1 - toApi), drawIn, 1 - toApi * .15);
      // 1 — control plane
      const cp = ease(seg(p, .15, .27)); if (cp > 0) { ctx.globalAlpha = cp; ctx.strokeStyle = 'rgba(122,167,255,.45)'; ctx.fillStyle = 'rgba(50,108,229,.07)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); rr(235, 36, 530, 236, 22); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); label('Control plane', 500, 62, 17, cp, C.sky, 700); ctx.globalAlpha = 1; }
      const fly = ease(seg(p, .2, .33));
      if (fly > 0) {
        const items = [[ETCD, -260, 40], [SCH, 300, -80], [CTL, 300, 90]];
        dashLine(API.x, API.y, ETCD.x + 36, ETCD.y, fly); dashLine(API.x, API.y, SCH.x - 34, SCH.y + 4, fly); dashLine(API.x, API.y, CTL.x - 34, CTL.y - 4, fly);
        cyl(lerp(ETCD.x + items[0][1], ETCD.x, fly), ETCD.y + bob * .5, 34, fly); label('etcd', ETCD.x, ETCD.y + 58, 14, fly, C.ice, 500);
        badge(lerp(SCH.x + items[1][1], SCH.x, fly), SCH.y - bob * .4, 26, fly, 'scheduler'); badge(lerp(CTL.x + items[2][1], CTL.x, fly), CTL.y + bob * .4, 26, fly, 'controller manager');
        // API server core
        ctx.globalAlpha = fly; ctx.fillStyle = 'rgba(50,108,229,.35)'; ctx.strokeStyle = C.sky; ctx.lineWidth = 3; glow(C.blue, 26); ctx.beginPath(); ctx.arc(API.x, API.y, 44, 0, 7); ctx.fill(); ctx.stroke(); noGlow();
        label('API', API.x, API.y - 5, 17, fly, C.ice, 800); label('server', API.x, API.y + 14, 13, fly, C.ice, 500);
      }
      // 2 — worker nodes
      const nd = ease(seg(p, .36, .5));
      NODES.forEach((n, i) => { const a = clamp(nd * 1.6 - i * .3); if (a <= 0) return; const e = ease(a), y = n.y + (1 - e) * 60; ctx.globalAlpha = e; ctx.fillStyle = 'rgba(8,16,44,.65)'; ctx.strokeStyle = 'rgba(122,167,255,.6)'; ctx.lineWidth = 2; rr(n.cx - n.w / 2, y, n.w, n.h, 18); ctx.fill(); ctx.stroke();
        label(n.name, n.cx - n.w / 2 + 48, y + 26, 15, e, C.ice, 700); label('kubelet', n.cx + 12, y + 26, 12, e, C.sky, 500); label('kube-proxy', n.cx + 76, y + 26, 12, e, C.sky, 500); ctx.globalAlpha = 1;
        dashLine(API.x + (n.cx - API.x) * .0, API.y + 44, n.cx, n.y - 6 + (1 - e) * 60, seg(p, .42, .54), C.line, 2); });
      // 3 — pods, each preceded by an amber “manifest” packet that travels API → node
      const T0 = .55, T1 = .76, step = (T1 - T0) / PODS.length;
      PODS.forEach((pd, i) => { const ts = T0 + i * step, k = seg(p, ts - .03, ts), land = seg(p, ts, ts + .035);
        if (k > 0 && land < 1) { const e = ease(k), x = lerp(API.x, pd.x, e), y = lerp(API.y + 44, pd.y, e) - Math.sin(e * Math.PI) * 24; packet(x, y, 1 - land); }
        pod(pd.x, pd.y + (land > 0 ? bob * .3 * (pd.n % 2 ? 1 : -1) : 0), back(land) * (land > 0 ? 1 : 0), p > .8); });
      // 4 — service + traffic
      const sv = ease(seg(p, .78, .88));
      if (sv > 0) { ctx.globalAlpha = sv; ctx.strokeStyle = C.amber; ctx.lineWidth = 3; glow(C.amber, 14); ctx.beginPath(); ctx.moveTo(110, SVC_Y); ctx.lineTo(lerp(110, 890, sv), SVC_Y); ctx.stroke(); noGlow(); label('Service', 150, SVC_Y - 16, 14, sv, C.amber, 700); label('users', 880, SVC_Y - 16, 13, sv, C.ice, 500); ctx.globalAlpha = 1;
        for (let i = 0; i < 22; i++) { const q = (time * .22 + i / 22) % 1; let x, y; if (q < .5) { x = lerp(900, [200, 500, 800][i % 3], ease(q * 2)); y = SVC_Y; } else { const n = i % 3, d = (q - .5) * 2, s = PODS.filter(z => z.n === n)[i % 4]; x = lerp([200, 500, 800][n], s.x, d); y = lerp(SVC_Y, s.y - 18, d); } packet(x, y, sv * (q > .93 ? (1 - q) * 14 : 1)); } }

      ctx.restore();

      // overlay text + rail + hint
      caps.forEach((el, i) => { const [a, b] = i < 5 ? [CAPTIONS[i][0], CAPTIONS[i][1]] : [.94, 1.01]; const fin = i === 0 ? 1 : seg(p, a, a + .03), fout = i < 5 ? 1 - seg(p, b - .02, b + .02) : 1, v = Math.min(fin, fout);
        el.style.opacity = v.toFixed(3); el.style.transform = `translateY(${((1 - fin) * 18 + (1 - fout) * -14).toFixed(1)}px)`; el.style.pointerEvents = v > .6 ? 'auto' : 'none'; });
      const idx = p < .155 ? 0 : p < .355 ? 1 : p < .545 ? 2 : p < .785 ? 3 : p < .935 ? 4 : 5; rail.forEach((r, i) => r.classList.toggle('on', i <= idx));
      hint.style.opacity = String(1 - seg(p, .01, .05));
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    window.scrollTo(0, 0);
  };
})();
