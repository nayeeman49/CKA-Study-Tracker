'use strict';
/* CKA Study Tracker – single-page front end (no build step) */
const $app = document.getElementById('app');
const S = { timer: null, visited: {}, res: null, sideTab: 'videos', user: null, cur: null, items: new Map(), order: [], prog: {}, plan: {}, log: [], stats: null, calMonth: null, calSel: null };

// ---------- utils ----------
const kindLbl = k => (k === 'lab' ? 'Q&A' : k);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `${m}m`;
const fmtDay = s => parseDay(s).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
let toastT;
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

async function api(method, url, body) {
  const sep = url.includes('?') ? '&' : '?';
  const full = method === 'GET' ? `${url}${sep}today=${today()}` : url;
  const r = await fetch(full, { method, headers: body ? { 'Content-Type': 'application/json' } : (method !== 'GET' ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : (method !== 'GET' ? '{}' : undefined) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && S.user) { S.user = null; render(); }
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}
const domainOf = id => S.cur.domains.find(d => d.id === id);

async function loadProgress() {
  const j = await api('GET', '/api/progress');
  S.timer = j.timer ? { ...j.timer, syncedAt: Date.now() } : null;
  S.visited = j.visited || {}; S.prog = j.progress; S.plan = j.plan; S.log = j.log; S.stats = j.stats;
}

// ---------- boot ----------
async function boot() {
  const hashLesson = location.hash.match(/^#\/lesson\/(.+)$/);
  if (hashLesson) prefetchLesson(decodeURIComponent(hashLesson[1]));   // start the lesson request alongside the rest
  const [cur, res, me] = await Promise.all([
    fetch('/api/curriculum').then(r => r.json()), fetch('/api/resources').then(r => r.json()), api('GET', '/api/me')]);
  S.cur = cur; S.res = res;
  for (const s of S.cur.sections) for (const l of s.lessons) { S.items.set(l.id, { ...l, section: s.title }); S.order.push(l.id); }
  S.user = me.user;
  if (S.user) await loadProgress();
  window.addEventListener('hashchange', render);
  render();
  setInterval(checkReminder, 30000);
  setInterval(() => { if (S.user) tickTimer(); }, 1000);
  if (S.user && S.timer && S.timer.state === 'running' && tElapsed() > 3 * 3600 * 1000) setTimeout(() => stopDialog(true), 600);
  let lastSync = 0;
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible' || !S.user || Date.now() - lastSync < 3000) return;
    lastSync = Date.now();
    const r = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (!['curriculum', 'notes', '', 'calendar'].includes(r)) return;
    try { await loadProgress(); render(); } catch {}
  });
}

// ---------- layout ----------
// Set to your Ko-fi / Buy Me a Coffee page, e.g. 'https://ko-fi.com/yourname'. Leave '' to hide the button.
const SUPPORT_URL = 'https://ko-fi.com/nayeeman49';

function shell(active, inner) {
  const st = S.stats;
  return `
  <header class="nav"><div class="nav-in">
    <a class="brand" href="#/" aria-label="CKA Study Tracker home">${logoSvg()}<span><b>CKA</b> Study Tracker</span></a>
    ${[['', 'Dashboard'], ['curriculum', 'Curriculum'], ['calendar', 'Calendar'], ['resources', 'Resources'], ['discussions', 'Discussions'], ['community', 'Community']]
      .map(([h, t]) => `<a class="tab ${h === 'curriculum' ? 'hero' : ''} ${active === h ? 'on' : ''}" href="#/${h}">${h === 'curriculum' ? '<span class="hero-ic">✦</span>' : ''}${t}</a>`).join('')}
    <span class="sp"></span>
    <button class="timer-pill ${S.timer ? (S.timer.state === 'running' ? 'on' : 'paused') : ''}" data-timer="open" title="Study timer">⏱ <span data-clock-short>${S.timer ? fmtClock(tElapsed()) : 'Timer'}</span></button>
    <span class="chip" title="Current study streak">🔥 ${st ? st.streak : 0} day${st && st.streak === 1 ? '' : 's'}</span>
    <a class="tab ${active === 'settings' ? 'on' : ''}" href="#/settings">${esc(S.user.displayName)}</a>
  </div></header>
  <main>${inner}</main>
  <footer class="site-foot"><span>Free study tool. Not affiliated with or endorsed by the Linux Foundation or CNCF.</span>${SUPPORT_URL ? `<a class="coffee" href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">☕ Support this project</a>` : ''}</footer>`;
}

// ---------- router ----------
let lastRouteKey = null;
function render() {
  const key = (S.user ? 'u:' : 'g:') + location.hash.replace(/#\/?$/, '#');
  const changed = key !== lastRouteKey, first = lastRouteKey === null;
  lastRouteKey = key;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = async () => {
    await renderNow();
    const app = document.getElementById('app');
    if (changed) {
      app.classList.remove('route-enter'); void app.offsetWidth; app.classList.add('route-enter');
      [...app.querySelectorAll('.card,.nudge,h1,.item,details.sec,.auth,.cal button.day')].slice(0, 12).forEach((el, i) => el.style.setProperty('--d', Math.min(i, 6)));
      countUp(app);
    } else app.classList.remove('route-enter');
  };
    return run();
}
function countUp(root) {
  root.querySelectorAll('.stat .big').forEach(el => {
    if (el.children.length) return;
    const m = el.textContent.match(/^(\D*?)(\d+)(%?)$/); if (!m) return;
    const end = +m[2]; if (end < 2) return; const t0 = performance.now(), dur = 350;
    const step = now => { const k = Math.min(1, (now - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = m[1] + v + m[3]; if (k < 1) requestAnimationFrame(step); };
    el.textContent = m[1] + '0' + m[3]; requestAnimationFrame(step);
  });
}
async function renderNow() {
  if (window.stopIntro) window.stopIntro();
  if (!S.user) {
    const seen = (() => { try { return sessionStorage.getItem('introSeen'); } catch { return '1'; } })();
    if (!seen || location.hash === '#/intro') {
      return renderIntro(mode => { try { sessionStorage.setItem('introSeen', '1'); } catch {} if (location.hash === '#/intro') history.replaceState(null, '', '#/'); const go = () => { renderAuth(mode); window.scrollTo(0, 0); }; if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(go); else go(); });
    }
    return renderAuth();
  }
  const hash = location.hash.replace(/^#\/?/, '');
  const [route, ...rest] = hash.split('/');
  try {
    if (route === '' || route === undefined) return renderDashboard();
    if (route === 'curriculum') return renderCurriculum();
    if (route === 'calendar') return renderCalendar();
    if (route === 'resources') return renderResources();
    if (route === 'notes') return await renderNotes(decodeURIComponent(rest.join('/')));
    if (route === 'community') return await renderCommunity();
    if (route === 'discussions') return await renderDiscussions(rest);
    if (route === 'u') return await renderProfile(decodeURIComponent(rest[0] || ''));
    if (route === 'lesson') return await renderLesson(rest.join('/'));
    if (route === 'settings') return renderSettings();
    renderDashboard();
  } catch (e) { $app.innerHTML = shell('', `<div class="card"><h2>Something went wrong</h2><p>${esc(e.message)}</p></div>`); }
}

// ---------- auth ----------
function renderAuth(mode = 'login') {
  $app.innerHTML = `
  <div class="auth card">
    ${logoSvg('authlogo draw')}<h1>CKA Study Tracker</h1>
    <p class="muted">Work through the Certified Kubernetes Administrator syllabus, keep a streak, and study alongside others.</p>
    <form id="authForm" autocomplete="on">
      <label for="u">Username</label><input id="u" name="username" type="text" autocomplete="username" required>
      ${mode === 'signup' ? `<label for="dn">Display name <span class="muted">(optional)</span></label><input id="dn" type="text" maxlength="40">` : ''}
      <label for="p">Password</label><input id="p" name="password" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required minlength="${mode === 'signup' ? 8 : 1}">
      <div class="err" id="err"></div>
      <div class="row" style="margin-top:.6rem"><button class="btn" type="submit">${mode === 'signup' ? 'Create account' : 'Log in'}</button>
      <button class="btn ghost" type="button" id="swap">${mode === 'signup' ? 'I have an account' : 'Create an account'}</button></div>
    </form>
    <p class="small muted" style="margin:1rem 0 0"><a href="#/intro">▶ Watch the cluster intro</a></p>
  </div>`;
  { const app = document.getElementById('app'); app.classList.remove('route-enter'); void app.offsetWidth; app.classList.add('route-enter'); }
  document.getElementById('swap').onclick = () => renderAuth(mode === 'signup' ? 'login' : 'signup');
  document.getElementById('authForm').onsubmit = async e => {
    e.preventDefault();
    const body = { username: u.value, password: p.value };
    if (mode === 'signup') body.displayName = document.getElementById('dn').value;
    try {
      const j = await api('POST', mode === 'signup' ? '/api/signup' : '/api/login', body);
      S.user = j.user; await loadProgress(); location.hash = '#/'; render();
    } catch (er) { document.getElementById('err').textContent = er.message; }
  };
}

// ---------- shared widgets ----------
function level(min, goal = 30) { return !min ? 0 : min < goal * .5 ? 1 : min < goal ? 2 : min < goal * 1.5 ? 3 : 4; }
function heatmap(activity, goal, weeks = 20) {
  const t = today();
  const dow = (parseDay(t).getDay() + 6) % 7; // Mon=0
  const start = addDays(t, -(dow + (weeks - 1) * 7));
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i);
    if (d > t) { cells += '<i style="visibility:hidden"></i>'; continue; }
    const a = activity[d];
    cells += `<i data-l="${level(a?.minutes, goal)}" title="${fmtDay(d)}: ${a ? fmtMin(a.minutes) + ', ' + a.items + ' item' + (a.items === 1 ? '' : 's') : 'no study'}"></i>`;
  }
  return `<div class="heat" aria-label="Study activity, last ${weeks} weeks">${cells}</div>`;
}
function domainBars(domains) {
  return S.cur.domains.filter(d => d.weight).map(d => {
    const x = domains[d.id]; const pct = x.totalMin ? Math.round(100 * x.doneMin / x.totalMin) : 0;
    return `<div class="dom"><div class="top"><span><span class="dot" style="background:${d.color};display:inline-block"></span> ${esc(d.name)} <span class="muted">· ${d.weight}% of exam</span></span><b>${pct}%</b></div>
      <div class="bar"><i style="width:${pct}%;background:${d.color}"></i></div></div>`;
  }).join('');
}

// ---------- dashboard ----------
function nudge() {
  const st = S.stats, goal = S.user.dailyGoalMin, t = today();
  const minsToday = st.activity[t]?.minutes || 0;
  if (st.totalDone === 0 && !st.totalMinutes) return { cls: '', html: `👋 <b>Welcome!</b> Pick your first lesson and get a day-one streak going.`, cta: ['Start learning', '#/curriculum'] };
  if (st.studiedToday && minsToday >= goal) return { cls: 'ok', html: `✅ <b>Daily goal hit</b> — ${fmtMin(minsToday)} today. ${st.streak > 1 ? `That's a ${st.streak}-day streak.` : ''}` };
  if (st.studiedToday) return { cls: 'ok', html: `👍 <b>${fmtMin(goal - minsToday)} to go</b> for today's ${fmtMin(goal)} goal.` };
  if (st.streak > 0) return { cls: 'bad', html: `🔥 <b>Your ${st.streak}-day streak ends tonight.</b> Even one short lab keeps it alive.`, cta: ['Pick something', '#/curriculum'] };
  const gap = st.lastActive ? diffDays(st.lastActive, t) : null;
  return { cls: 'warn', html: `⏰ <b>No study logged today.</b>${gap ? ` Last session was ${gap} day${gap === 1 ? '' : 's'} ago.` : ''} Start a new streak now.`, cta: ['Pick something', '#/curriculum'] };
}
function nextUp(n = 4) {
  const t = today();
  const planned = Object.entries(S.plan).filter(([id]) => !S.prog[id]).sort((a, b) => a[1].localeCompare(b[1]) || S.order.indexOf(a[0]) - S.order.indexOf(b[0]));
  const due = planned.filter(([, d]) => d <= t).map(([id, d]) => ({ id, d, late: d < t }));
  if (due.length) return due.slice(0, n);
  return S.order.filter(id => !S.prog[id]).slice(0, n).map(id => ({ id, d: null }));
}
function renderDashboard() {
  const st = S.stats, u = S.user, nd = nudge();
  const examLine = (() => {
    if (!u.examDate) return `<a href="#/settings">Set your exam date</a> to get a pacing target.`;
    const left = diffDays(today(), u.examDate);
    if (left < 0) return `Exam date has passed — <a href="#/settings">update it</a>.`;
    const remainMin = [...S.items.values()].filter(i => !S.prog[i.id]).reduce((a, i) => a + i.minutes, 0);
    const need = Math.ceil(remainMin / Math.max(1, left - 3));
    return `<b>${left}</b> day${left === 1 ? '' : 's'} to go · need ≈ <b>${fmtMin(need)}/day</b> to finish by 3 days before` +
      (need > u.dailyGoalMin ? ` <span class="chip" style="color:var(--bad)">above your ${fmtMin(u.dailyGoalMin)} goal</span>` : '');
  })();
  const todo = nextUp().map(({ id, d, late }) => {
    const it = S.items.get(id);
    return `<div class="item"><input type="checkbox" data-act="done" data-id="${esc(id)}" aria-label="Mark ${esc(it.title)} done">
      <div class="t"><a href="#/lesson/${esc(id)}" target="_blank" rel="noopener">${esc(it.title)}</a><div class="muted small">${esc(it.section)} · ${fmtMin(it.minutes)}${late ? ' · <span style="color:var(--bad)">overdue</span>' : ''}</div></div>
      <span class="chip ${it.kind}">${kindLbl(it.kind)}</span></div>`;
  }).join('');
  $app.innerHTML = shell('', `
    <div class="nudge ${nd.cls}"><div>${nd.html}</div>${nd.cta ? `<a class="btn sm" href="${nd.cta[1]}">${nd.cta[0]}</a>` : ''}</div>
    <div class="hero-row">
    <div class="card timer-hero"><h2 style="margin-top:0">⏱ Study timer</h2><div data-timer-root>${timerBody()}</div></div>
    <div class="stats2">
      <div class="card stat"><div class="big"><span class="fl">🔥</span> ${st.streak}</div><div class="lbl">day streak · best ${st.longest}</div><button class="btn ghost sm" data-reset="streak" style="margin-top:.5rem">↺ Reset streak</button></div>
      <div class="card stat"><div class="big">${st.readiness}%</div><div class="lbl">exam-weighted readiness</div></div>
      <div class="card stat"><div class="big">${st.totalDone}<span class="muted" style="font-size:1rem">/${st.totalItems}</span></div><div class="lbl">lessons &amp; labs done</div></div>
      <div class="card stat"><div class="big">${fmtMin(st.weekMinutes)}</div><div class="lbl">studied in the last 7 days</div></div>
    </div></div>
    <div style="margin-top:1rem">${scheduleCard(schedInfo())}</div>
    <div class="grid g2" style="margin-top:1rem">
      ${schedInfo().has ? '' : `      <div class="card"><h2>${S.stats.studiedToday ? 'Up next' : 'Today'}</h2><div style="margin:0 -1.2rem">${todo || '<p class="muted" style="padding:0 1.2rem">Everything is done — time for mock exams! 🎉</p>'}</div>
        <p class="small muted" style="margin:.8rem 0 0">${examLine}</p></div>
`}
      <div class="card"><h2>Log time manually</h2>
        <p class="muted small" style="margin-top:0">Did a lab on a real cluster or read the docs away from the app? Log it so it counts toward your streak.</p>
        <form id="logForm" class="row"><input type="number" id="logMin" min="1" max="720" placeholder="Minutes" style="width:110px" required>
        <input type="text" id="logNote" maxlength="200" placeholder="What did you do? (optional)" style="flex:1;min-width:140px"><button class="btn">Add</button></form></div>
    </div>
    <div class="grid g2" style="margin-top:1rem">
      <div class="card"><h2>Progress by exam domain</h2>${domainBars(st.domains)}</div>
      <div class="card"><h2>Last 20 weeks</h2>${heatmap(st.activity, u.dailyGoalMin)}<p class="small muted">Darker = closer to (or beyond) your ${fmtMin(u.dailyGoalMin)} daily goal.</p></div>
    </div>`);
  document.getElementById('logForm').onsubmit = async e => {
    e.preventDefault();
    try { await api('POST', '/api/log', { day: today(), minutes: +logMin.value, note: logNote.value }); await loadProgress(); toast('Logged ✔'); render(); }
    catch (er) { toast(er.message); }
  };
}

// ---------- completing items ----------
async function setDone(id, done, minutes) {
  await api('PUT', '/api/progress/' + id.split('/').map(encodeURIComponent).join('/'), { done, day: today(), minutes });
  await loadProgress();
  if (done) {
    const s = S.stats; toast(s.streak > 1 ? `Done! 🔥 ${s.streak}-day streak` : 'Done! ✔');
  }
}
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-act="done"]'); if (!el) return;
  try { await setDone(el.dataset.id, el.checked); render(); } catch (er) { toast(er.message); el.checked = !el.checked; }
});

// ---------- curriculum ----------
const cf = { q: '', domain: '', hide: false };
function renderCurriculum() {
  const keep = id => { const it = S.items.get(id); return (!cf.domain || it.domain === cf.domain) && (!cf.hide || !S.prog[id]) && (!cf.q || it.title.toLowerCase().includes(cf.q.toLowerCase())); };
  const openState = new Set([...document.querySelectorAll('details.sec[open]')].map(d => d.dataset.sec));
  const secs = S.cur.sections.map(s => {
    const all = s.lessons, shown = all.filter(l => keep(l.id)); if (!shown.length) return '';
    const done = all.filter(l => S.prog[l.id]).length, opened = all.filter(l => S.visited[l.id]).length, pct = Math.round(100 * done / all.length);
    return `<details class="sec" data-sec="${esc(s.id)}" ${(openState.has(s.id) || cf.q || cf.domain) ? 'open' : ''}><summary>${esc(s.title)} <span class="muted small">${done}/${all.length} done · <span class="vdot on" style="vertical-align:middle"></span> ${opened} opened</span>${s.notes ? `<a class="chip" href="#/notes/${encodeURIComponent(s.id)}" onclick="event.stopPropagation()" title="Read the written study notes for this section">📖 Notes</a>` : ''}<div class="bar"><i style="width:${pct}%"></i></div></summary>
      ${shown.map(l => `<div class="item ${S.prog[l.id] ? 'done' : ''}"><input type="checkbox" data-act="done" data-id="${esc(l.id)}" ${S.prog[l.id] ? 'checked' : ''} aria-label="Mark ${esc(l.title)} done">
        <span class="vdot ${S.visited[l.id] ? 'on' : ''}" title="${S.visited[l.id] ? 'Opened' : 'Not opened yet'}"></span>
        <span class="dot" style="background:${domainOf(l.domain).color}" title="${esc(domainOf(l.domain).name)}"></span>
        <div class="t"><a href="#/lesson/${esc(l.id)}" target="_blank" rel="noopener">${esc(l.title)}</a></div>
        ${S.plan[l.id] && !S.prog[l.id] ? `<span class="chip" title="Scheduled">📅 ${fmtDay(S.plan[l.id])}</span>` : ''}
        ${l.isNew ? '<span class="chip" style="color:var(--brand)">new</span>' : ''}<span class="chip ${l.kind}">${kindLbl(l.kind)}</span><span class="muted small" style="width:3.2em;text-align:right">${fmtMin(l.minutes)}</span></div>`).join('')}</details>`;
  }).join('');
  $app.innerHTML = shell('curriculum', `
    <h1>Curriculum</h1>
    <div class="filters">
      <input type="search" id="cq" placeholder="Search lessons…" value="${esc(cf.q)}" style="max-width:260px">
      <select id="cd"><option value="">All domains</option>${S.cur.domains.map(d => `<option value="${d.id}" ${cf.domain === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
      <label class="row" style="margin:0;font-weight:500"><input type="checkbox" id="ch" ${cf.hide ? 'checked' : ''} style="width:auto"> Hide completed</label>
    </div>${secs || '<p class="muted">Nothing matches.</p>'}`);
  cq.oninput = e => { cf.q = e.target.value; const p = e.target.selectionStart; renderCurriculum(); const n = document.getElementById('cq'); n.focus(); n.setSelectionRange(p, p); };
  cd.onchange = e => { cf.domain = e.target.value; renderCurriculum(); };
  ch.onchange = e => { cf.hide = e.target.checked; renderCurriculum(); };
}

// ---------- lesson ----------
const lessonUrl = id => '/api/lesson/' + id.split('/').map(encodeURIComponent).join('/') + '?today=' + today();
const _pf = new Set();
function prefetchLesson(id) { if (_pf.has(id) || !S.items.has(id) && S.items.size) return; _pf.add(id); fetch(lessonUrl(id), { credentials: 'same-origin' }).catch(() => {}); }
document.addEventListener('pointerover', e => { const a = e.target.closest && e.target.closest('a[href^="#/lesson/"]'); if (a) prefetchLesson(decodeURIComponent(a.getAttribute('href').slice(9))); }, { passive: true });

function addCopyButtons() {
  document.querySelectorAll('.lesson pre').forEach(pre => {
    if (pre.parentElement.classList.contains('codewrap')) return;
    const w = document.createElement('div'); w.className = 'codewrap';
    pre.parentNode.insertBefore(w, pre); w.appendChild(pre);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'copybtn'; b.title = 'Copy'; b.setAttribute('aria-label', 'Copy code');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    b.addEventListener('click', async () => {
      const text = (pre.querySelector('code') || pre).innerText.replace(/\n$/, '');
      try { await navigator.clipboard.writeText(text); }
      catch { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
      b.classList.add('ok'); b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove('ok'); b.innerHTML = b._orig; }, 1400);
    });
    b._orig = b.innerHTML;
    w.appendChild(b);
  });
}

async function renderLesson(id) {
  if (!S.items.has(id)) { location.hash = '#/curriculum'; return; }
  if (!_pf.has(id)) $app.innerHTML = shell('curriculum', '<p class="muted">Loading…</p>');
  const j = await api('GET', '/api/lesson/' + id.split('/').map(encodeURIComponent).join('/'));
  if (!S.visited[id]) { S.visited[id] = true; api('POST', '/api/visit/' + id.split('/').map(encodeURIComponent).join('/'), {}).catch(() => {}); }
  const i = S.order.indexOf(id), prev = S.order[i - 1], next = S.order[i + 1], it = j.item, done = !!S.prog[id];
  $app.innerHTML = shell('curriculum', `
    <div class="with-side"><div class="lesson">
      <p class="small muted"><a href="#/curriculum">Curriculum</a> › ${esc(it.section)} · <span class="chip ${it.kind}">${kindLbl(it.kind)}</span> · ≈ ${fmtMin(it.minutes)} · ${esc(domainOf(it.domain).name)}</p>
      <div class="title-row"><h1>${esc(it.title)}</h1>${(j.embeds || []).length ? '<button type="button" class="btn ghost sm skipvid" id="skipVid" title="Jump to the video">🎬 Skip to video ↓</button>' : ''}</div>
      ${it.kind !== 'lesson' ? `<div class="labnote" role="note">ℹ️ <span><b>Quick note:</b> these are practice questions and answers, not hands-on labs. The real labs are in the CKA course on <a href="https://learn.kodekloud.com/learn/courses/cka-certification-course-certified-kubernetes-administrator" target="_blank" rel="noopener noreferrer">KodeKloud</a> or <a href="https://www.udemy.com/course/certified-kubernetes-administrator-with-practice-tests/" target="_blank" rel="noopener noreferrer">Udemy</a>. Try each question yourself first, then open the answer.</span></div>` : ''}
      ${j.guideHtml ? `<section class="guide"><div class="guide-h">${it.kind !== 'lesson' ? (j.guideHtml.includes('<details') ? '❓ Questions and answers <span class="muted small">click a question to show the answer</span>' : '📝 Approach and tips') : '📝 Study guide <span class="muted small">how it works and how to do the task</span>'}</div><div class="md">${j.guideHtml}</div></section>${it.kind !== 'lesson' ? '' : '<h2 class="muted" style="margin-top:2rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em">Additional explanation and material:</h2>'}` : ''}
      <div class="md">${j.html.replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>/, '')}</div>
      ${(j.embeds || []).map(v => `<section class="embed" data-vid><h3>🎬 ${esc(v.title)}</h3><div class="ratio"><iframe src="https://www.youtube-nocookie.com/embed/${esc(v.youtubeId)}" title="${esc(v.title)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="small muted"><a href="https://www.youtube.com/watch?v=${esc(v.youtubeId)}" target="_blank" rel="noopener">Watch on YouTube ↗</a></p></section>`).join('')}
      <div class="sticky-bar">
        ${prev ? `<a class="btn ghost sm" href="#/lesson/${esc(prev)}" target="_blank" rel="noopener">← Prev</a>` : ''}
        <button class="btn ghost sm" data-timer="${S.timer ? 'open' : 'start'}" data-label="${esc(it.title)}">${S.timer ? '⏱ ' + (S.timer.state === 'running' ? 'Timer running' : 'Timer paused') : '⏱ Start timer'}</button>
        <button class="btn" id="doneBtn">${done ? '✔ Completed (click to undo)' : 'Mark complete'}</button>
        ${next ? `<a class="btn ghost sm" href="#/lesson/${esc(next)}" target="_blank" rel="noopener">Next →</a>` : ''}
      </div>
    </div>${sidebar(it.domain, it.sectionId)}</div>`);
  wireSide();
  document.querySelectorAll('.lesson .md a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  addCopyButtons();
  { const sb = document.getElementById('skipVid'); if (sb) sb.addEventListener('click', () => { const t = document.querySelector('.lesson .embed'); if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'center' }); }); }
  doneBtn.onclick = async () => { try { await setDone(id, !done); render(); if (!done && next) toast('Marked complete ✔ — use “Next →” to open the next page in a new tab'); } catch (er) { toast(er.message); } };
  window.scrollTo(0, 0);
}

// ---------- calendar ----------
function renderCalendar() {
  const t = today();
  if (!S.calMonth) S.calMonth = t.slice(0, 7);
  if (!S.calSel) S.calSel = t;
  const [y, m] = S.calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1), lead = (first.getDay() + 6) % 7;
  const start = addDays(ymd(first), -lead);
  const plannedBy = {}; for (const [id, d] of Object.entries(S.plan)) if (!S.prog[id]) (plannedBy[d] ||= []).push(id);
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i), a = S.stats.activity[d], pl = plannedBy[d]?.length || 0, plMin = (plannedBy[d] || []).reduce((x, id) => x + (S.items.get(id)?.minutes || 0), 0), inMonth = d.slice(0, 7) === S.calMonth;
    if (i >= 35 && !inMonth) break;
    cells += `<button class="day ${inMonth ? '' : 'out'} ${d === t ? 'today' : ''} ${d === S.calSel ? 'sel' : ''}" data-day="${d}" data-l="${level(a?.minutes, S.user.dailyGoalMin)}" aria-label="${fmtDay(d)}">
      <span class="n">${+d.slice(8)}</span><span class="m">${a ? fmtMin(a.minutes) : ''}</span>
      ${pl ? `<span class="pl ${d < t ? 'late' : ''}" title="${plural(pl, 'module')} to complete (${fmtMin(plMin)})">${pl} mod${pl === 1 ? '' : 's'}</span>` : ''}${d === S.user.examDate ? '<span class="exam" title="Exam day">🎯</span>' : ''}</button>`;
  }
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const rem = S.cur && localStorage.getItem('remind') ? JSON.parse(localStorage.getItem('remind')) : null;
  $app.innerHTML = shell('calendar', `
    <div class="row space"><h1 style="margin:0">Calendar</h1>
      <div class="row"><button class="btn sm" id="autoPlan">✨ Build study schedule</button><button class="btn ghost sm" id="remindBtn">🔔 Reminders</button></div></div>
    ${behindHtml(schedInfo(), true)}
    <p class="muted small">Shading shows minutes studied. Orange badges show how many modules to complete that day (red = overdue). Click a day to review, schedule or log.</p>
    <div class="grid split" id="calGrid">
      <div class="card">
        <div class="row space" style="margin-bottom:.6rem"><button class="btn ghost sm" id="pm" aria-label="Previous month">‹</button><b>${label}</b><span class="row"><button class="btn ghost sm" id="tm">Today</button><button class="btn ghost sm" id="nm" aria-label="Next month">›</button></span></div>
        <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="dow">${d}</div>`).join('')}${cells}</div>
      </div>
      <div class="card side" id="dayPanel">${dayPanel(S.calSel)}</div>
    </div>`);
  const go = n => { const d = new Date(y, m - 1 + n, 1); S.calMonth = ymd(d).slice(0, 7); renderCalendar(); };
  pm.onclick = () => go(-1); nm.onclick = () => go(1); tm.onclick = () => { S.calMonth = t.slice(0, 7); S.calSel = t; renderCalendar(); };
  document.querySelectorAll('button.day').forEach(b => b.onclick = () => { S.calSel = b.dataset.day; renderCalendar(); });
  autoPlan.onclick = () => autoPlanDialog(false); if (document.getElementById('resched')) resched.onclick = () => autoPlanDialog(true); remindBtn.onclick = reminderDialog;
  wireDayPanel();
}
function dayPanel(d) {
  const t = today(), a = S.stats.activity[d];
  const doneItems = Object.entries(S.prog).filter(([, p]) => p.day === d).map(([id]) => id);
  const planned = Object.entries(S.plan).filter(([id, pd]) => pd === d && !S.prog[id]).map(([id]) => id);
  const logs = S.log.filter(l => l.day === d);
  const choices = S.order.filter(id => !S.prog[id] && S.plan[id] !== d);
  const li = (id, extra = '') => `<div class="li"><div class="t"><a href="#/lesson/${esc(id)}" target="_blank" rel="noopener">${esc(S.items.get(id).title)}</a><div class="muted small">${fmtMin(S.items.get(id).minutes)}</div></div>${extra}</div>`;
  return `<h2>${fmtDay(d)}${d === t ? ' · today' : ''}${d === S.user.examDate ? ' 🎯 exam day' : ''}</h2>
    <p class="muted small" style="margin-top:-.3rem">${a ? `${fmtMin(a.minutes)} studied` : 'Nothing logged'}</p>
    ${doneItems.length ? `<h3>Completed</h3>${doneItems.map(id => li(id, '<span title="Done">✔</span>')).join('')}` : ''}
    ${logs.length ? `<h3 style="margin-top:.8rem">Logged time</h3>${logs.map(l => `<div class="li"><div class="t">${fmtMin(l.minutes)}${l.note ? ' · ' + esc(l.note) : ''}</div><button class="btn ghost sm" data-act="dellog" data-id="${l.id}" aria-label="Delete">✕</button></div>`).join('')}` : ''}
    ${planned.length ? `<h3 style="margin-top:.8rem">Scheduled</h3>${planned.map(id => li(id, `<input type="checkbox" data-act="done" data-id="${esc(id)}" aria-label="Mark done">
        ${d < t ? `<button class="btn ghost sm" data-act="mv" data-id="${esc(id)}">→ today</button>` : ''}<button class="btn ghost sm" data-act="unplan" data-id="${esc(id)}" aria-label="Unschedule">✕</button>`)).join('')}` : ''}
    ${d >= t ? `<h3 style="margin-top:.8rem">Schedule something</h3>
      <div class="row"><select id="addSel" style="flex:1;min-width:0">${S.cur.sections.map(s => { const o = s.lessons.filter(l => choices.includes(l.id)); return o.length ? `<optgroup label="${esc(s.title)}">${o.map(l => `<option value="${esc(l.id)}">${esc(l.title)} (${fmtMin(l.minutes)})</option>`).join('')}</optgroup>` : ''; }).join('')}</select>
      <button class="btn sm" data-act="addplan">Add</button></div>` : ''}
    <h3 style="margin-top:.8rem">Log time</h3>
    <form id="dayLog" class="row"><input type="number" id="dlMin" min="1" max="720" placeholder="min" style="width:80px" required><input type="text" id="dlNote" placeholder="note" maxlength="200" style="flex:1;min-width:0"><button class="btn sm">Log</button></form>`;
}
function wireDayPanel() {
  const d = S.calSel;
  const panel = document.getElementById('dayPanel');
  const refresh = async () => { await loadProgress(); renderCalendar(); };
  panel.onclick = async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    try {
      if (b.dataset.act === 'unplan') { await api('PUT', '/api/plan', { itemId: b.dataset.id, day: null }); await refresh(); }
      else if (b.dataset.act === 'mv') { await api('PUT', '/api/plan', { itemId: b.dataset.id, day: today() }); S.calSel = today(); await refresh(); }
      else if (b.dataset.act === 'dellog') { await api('DELETE', '/api/log/' + b.dataset.id); await refresh(); }
      else if (b.dataset.act === 'addplan') { const v = document.getElementById('addSel').value; if (v) { await api('PUT', '/api/plan', { itemId: v, day: d }); await refresh(); } }
    } catch (er) { toast(er.message); }
  };
  const f = document.getElementById('dayLog');
  f.onsubmit = async e => { e.preventDefault(); try { await api('POST', '/api/log', { day: d > today() ? today() : d, minutes: +dlMin.value, note: dlNote.value }); toast('Logged ✔'); await refresh(); } catch (er) { toast(er.message); } };
}

// ---- dialogs (native <dialog>) ----
function openDialog(html, onMount) {
  const dlg = document.createElement('dialog');
  dlg.style.cssText = 'border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);max-width:440px;width:92vw;padding:1.2rem';
  dlg.innerHTML = html; document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal(); onMount(dlg); return dlg;
}
// ---- schedule helpers ----
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function schedInfo() {
  const t = today(), byDay = {};
  for (const [id, d] of Object.entries(S.plan)) if (!S.prog[id] && S.items.has(id)) (byDay[d] ||= []).push(id);
  const ids = Object.keys(S.plan).filter(id => S.items.has(id));
  const late = Object.entries(byDay).filter(([d]) => d < t).flatMap(([, v]) => v);
  const sorted = Object.keys(byDay).sort();
  return { byDay, late, today: byDay[t] || [], total: ids.length, done: ids.filter(id => S.prog[id]).length, has: ids.length > 0, days: sorted.filter(d => d > t), end: S.user.planEnd };
}
function behindHtml(si, btn) {
  if (!si.late.length) return '';
  const first = Object.keys(si.byDay).filter(d => d < today()).sort()[0];
  return `<div class="nudge behind" role="alert"><div>⚠ <b>You're behind schedule</b> — ${plural(si.late.length, 'module')} should have been finished already (since ${fmtDay(first)}).</div>${btn ? '<button class="btn sm" id="resched">↻ Reschedule</button>' : '<a class="btn sm" href="#/calendar">Fix in calendar</a>'}</div>`;
}
function scheduleCard(si) {
  if (!si.has) return `<div class="card"><h2 style="margin-top:0">📅 Your study schedule</h2><p class="muted">You haven't built a schedule yet. Tell us your rest days and how long you want to take, and we'll split the whole syllabus across the calendar.</p><a class="btn" href="#/calendar">Build my schedule</a></div>`;
  const t = today(), pct = Math.round(100 * si.done / si.total);
  const up = si.days.slice(0, 5).map(d => `<div class="row space small" style="padding:.25rem 0;border-top:1px solid var(--line)"><span>${fmtDay(d)}</span><b>${plural(si.byDay[d].length, 'module')}</b></div>`).join('');
  return `<div class="card"><div class="row space"><h2 style="margin:0">📅 Your study schedule</h2><a class="btn ghost sm" href="#/calendar">Open calendar</a></div>
    ${behindHtml(si, false)}
    <div class="small muted" style="margin:.7rem 0 .2rem">${si.done} of ${si.total} scheduled modules done${si.end ? ` · target finish ${fmtDay(si.end)}` : ''}</div><div class="bar"><i style="width:${pct}%"></i></div>
    ${si.late.length ? `<h3 style="margin:1rem 0 .3rem;color:var(--bad)">Overdue · ${plural(si.late.length, 'module')}</h3>${si.late.slice(0, 6).map(id => `<div class="item"><input type="checkbox" data-act="done" data-id="${esc(id)}" aria-label="Mark ${esc(S.items.get(id).title)} done"><div class="t"><a href="#/lesson/${esc(id)}" target="_blank" rel="noopener">${esc(S.items.get(id).title)}</a><div class="muted small">was due ${fmtDay(S.plan[id])}</div></div></div>`).join('')}${si.late.length > 6 ? `<p class="small muted">+ ${si.late.length - 6} more in the calendar</p>` : ''}` : ''}
    <h3 style="margin:1rem 0 .3rem">Today · ${plural(si.today.length, 'module')} to complete</h3>
    ${si.today.length ? si.today.map(id => `<div class="item"><input type="checkbox" data-act="done" data-id="${esc(id)}" aria-label="Mark ${esc(S.items.get(id).title)} done"><div class="t"><a href="#/lesson/${esc(id)}" target="_blank" rel="noopener">${esc(S.items.get(id).title)}</a><div class="muted small">${fmtMin(S.items.get(id).minutes)}</div></div></div>`).join('')
      : `<p class="muted small" style="margin:.2rem 0">${si.late.length ? 'Nothing new today — catch up on the overdue modules first.' : si.days.length ? '✅ Nothing scheduled for today (rest day or all done).' : '🎉 Schedule complete.'}</p>`}
    ${up ? `<h3 style="margin:1rem 0 .3rem">Coming up</h3>${up}` : ''}</div>`;
}
function autoPlanDialog(resched) {
  const remMin = [...S.items.values()].filter(i => !S.prog[i.id]).reduce((x, i) => x + i.minutes, 0);
  const left = S.user.examDate ? diffDays(today(), S.user.examDate) : null;
  const keepDays = S.user.planEnd ? Math.max(1, diffDays(today(), S.user.planEnd) + 1) : 30;
  const presets = [[7, '1 week'], [14, '2 weeks'], [30, '1 month'], [60, '2 months'], [90, '3 months'], [180, '6 months']];
  const rest0 = resched === true ? S.user.planRest || [] : [];
  openDialog(`<h2>${resched === true ? '↻ Reschedule' : '✨ Build'} my study schedule</h2>
    <p class="muted small" style="margin-top:0">${resched === true ? 'Unfinished modules will be re-spread starting today.' : 'Your whole syllabus will be split into daily modules.'} (${plural([...S.items.values()].filter(i => !S.prog[i.id]).length, 'module')} left · ${fmtMin(remMin)})</p>
    <label>1. Which rest days do you require?</label><div class="row" id="rd">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((n, i) => `<label class="row" style="margin:0;font-weight:500"><input type="checkbox" value="${i}" style="width:auto" ${rest0.includes(i) ? 'checked' : ''}> ${n}</label>`).join('')}</div>
    <label style="margin-top:.8rem">2. How much time do you require to complete?</label>
    <div class="row" id="pre" style="gap:.4rem">${presets.map(([d, l]) => `<button type="button" class="btn ghost sm" data-d="${d}">${l}</button>`).join('')}${left > 3 ? `<button type="button" class="btn ghost sm" data-d="${left - 3}">Before my exam</button>` : ''}</div>
    <div class="row" style="margin-top:.5rem"><span class="small muted">or</span><input type="number" id="pd" min="1" max="730" value="${resched === true ? keepDays : 30}" style="width:90px"><span class="small muted">days from today</span></div>
    <div class="card" id="prev" style="margin-top:1rem;background:var(--bg)"></div>
    <div class="row" style="margin-top:1rem"><button class="btn" id="go">${resched === true ? 'Reschedule' : 'Build schedule'}</button><button class="btn ghost" id="x">Cancel</button><button class="btn ghost" id="clr" style="margin-left:auto">Clear</button></div>
    <p class="err" id="perr"></p>`, dlg => {
    const pd = dlg.querySelector('#pd');
    const rests = () => [...dlg.querySelectorAll('#rd input:checked')].map(i => +i.value);
    const countMods = () => [...S.items.values()].filter(i => !S.prog[i.id]).length;
    const preview = () => {
      const n = Math.max(1, Math.min(730, +pd.value || 1)), rest = rests();
      let study = 0; for (let k = 0; k < n; k++) { const dw = new Date(new Date().setDate(new Date().getDate() + k)).getDay(); if (!(rest.includes(dw) && rest.length < 7)) study++; }
      study = Math.max(1, study); const per = Math.ceil(remMin / study), mods = Math.ceil(countMods() / study);
      const end = new Date(); end.setDate(end.getDate() + n - 1);
      dlg.querySelector('#prev').innerHTML = `<b>≈ ${plural(mods, 'module')} per study day</b> (${fmtMin(per)}) over ${study} study days<br><span class="muted small">Finishes ${end.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${per > 180 ? ' · ⚠ that is an intense pace' : per > S.user.dailyGoalMin ? ` · above your ${fmtMin(S.user.dailyGoalMin)} daily goal` : ''}</span>`;
      dlg.querySelectorAll('#pre button').forEach(b => b.classList.toggle('on', +b.dataset.d === n));
    };
    dlg.querySelectorAll('#pre button').forEach(b => b.onclick = () => { pd.value = b.dataset.d; preview(); });
    pd.oninput = preview; dlg.querySelector('#rd').onchange = preview; preview();
    dlg.querySelector('#x').onclick = () => dlg.close();
    dlg.querySelector('#clr').onclick = async () => { await api('DELETE', '/api/plan'); S.user.planEnd = null; await loadProgress(); dlg.close(); render(); toast('Schedule cleared'); };
    dlg.querySelector('#go').onclick = async () => {
      try {
        const r = await api('POST', '/api/plan/auto', { today: today(), restDays: rests(), days: +pd.value });
        S.user.planRest = r.planRest; S.user.planEnd = r.planEnd;
        await loadProgress(); dlg.close(); S.calMonth = today().slice(0, 7); S.calSel = today(); render();
        toast(`Scheduled ${plural(r.scheduled, 'module')} — about ${plural(Math.ceil(r.scheduled / Math.max(1, Math.round(r.totalMin / Math.max(1, r.perDay)))), 'module')}/day, finishing ${fmtDay(r.finishDay)}`);
      } catch (er) { dlg.querySelector('#perr').textContent = er.message; }
    };
  });
}

// ---- reminders ----
function getRemind() { try { return JSON.parse(localStorage.getItem('remind')) || { enabled: false, time: '19:00' }; } catch { return { enabled: false, time: '19:00' }; } }
function checkReminder() {
  if (!S.user || !S.stats) return;
  const r = getRemind(); if (!r.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const now = new Date(), hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  if (hhmm >= r.time && !S.stats.studiedToday && localStorage.getItem('remindedOn') !== today()) {
    localStorage.setItem('remindedOn', today());
    const n = new Notification('Time to study for the CKA ☸️', { body: S.stats.streak ? `Keep your ${S.stats.streak}-day streak alive!` : 'Start a streak today.' });
    n.onclick = () => { window.focus(); location.hash = '#/'; };
  }
}
function icsFile(time) {
  const [h, m] = time.split(':'); const d = today().replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CKA Tracker//EN', 'BEGIN:VEVENT', `UID:cka-study-${Date.now()}@cka-tracker`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART:${d}T${h}${m}00`, `DTEND:${d}T${h}${m}00`.replace(/(\d\d)00$/, '$100'),
    'RRULE:FREQ=DAILY', 'SUMMARY:CKA study session ☸️', `DESCRIPTION:Open the tracker: ${location.origin}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:CKA study time', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' })); a.download = 'cka-study-reminder.ics'; a.click();
}
function reminderDialog() {
  const r = getRemind();
  openDialog(`<h2>Reminders</h2>
    <label for="rt">Remind me at</label><input type="time" id="rt" value="${r.time}">
    <div class="row" style="margin-top:1rem"><button class="btn" id="en">${r.enabled ? 'Save' : 'Enable browser reminder'}</button>
    ${r.enabled ? '<button class="btn ghost" id="off">Turn off</button>' : ''}<button class="btn ghost" id="ics">Add to my calendar (.ics)</button></div>
    <p class="muted small">Browser reminders fire only while this tab is open and you haven't studied yet that day. The .ics gives you a repeating daily alarm in Google/Apple/Outlook Calendar that works even when the tab is closed.</p>
    <button class="btn ghost sm" id="x">Close</button>`, dlg => {
    dlg.querySelector('#x').onclick = () => dlg.close();
    dlg.querySelector('#ics').onclick = () => icsFile(dlg.querySelector('#rt').value || '19:00');
    const off = dlg.querySelector('#off'); if (off) off.onclick = () => { localStorage.setItem('remind', JSON.stringify({ ...r, enabled: false })); dlg.close(); toast('Reminders off'); };
    dlg.querySelector('#en').onclick = async () => {
      const perm = typeof Notification === 'undefined' ? 'denied' : (Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission());
      if (perm !== 'granted') { toast('Notifications are blocked — use the .ics option instead.'); return; }
      localStorage.setItem('remind', JSON.stringify({ enabled: true, time: dlg.querySelector('#rt').value || '19:00' })); dlg.close(); toast('Reminder saved');
    };
  });
}


// ---------- discussions ----------
const timeAgo = ms => { const d = Math.max(0, Date.now() - ms), m = Math.floor(d / 60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; const dd = Math.floor(h / 24); if (dd < 30) return dd + 'd ago'; return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); };
function fmtPost(src) { // safe: escape everything, then support ```blocks``` and `inline code`
  return String(src).split('```').map((seg, i) => {
    if (i % 2) return `<pre><code>${esc(seg.replace(/^[a-z]*\n/, '').replace(/\n$/, ''))}</code></pre>`;
    return esc(seg).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
  }).join('');
}
const avatar = a => `<span class="avatar">${esc(a.displayName[0]?.toUpperCase() || '?')}</span>`;
const who = a => `<a href="#/u/${encodeURIComponent(a.username)}">${avatar(a)}${esc(a.displayName)}</a>`;
const DISC_WARN = '<div class="disc-warn" role="note">⚠️ <span><b>Please keep your questions to the relevant channel.</b> Pick the channel that matches your topic so others can find and answer it.</span></div>';
async function renderDiscussions(rest) {
  clearInterval(window.__chatTimer);
  if (rest[0] && rest[0] !== 't') return renderChannel(decodeURIComponent(rest[0]));
  $app.innerHTML = shell('discussions', '<p class="muted">Loading…</p>');
  const { channels } = await api('GET', '/api/discussions');
  $app.innerHTML = shell('discussions', `
    <h1>Discussions</h1>
    ${DISC_WARN}
    <p class="muted" style="margin-top:.2rem">Each channel is a live chat. Join one and ask anything about that topic. Be kind and share what you tried.</p>
    <div class="chan-grid">${channels.map(c => `
      <a class="card chan" href="#/discussions/${esc(c.id)}">
        <div class="chan-ic">${c.icon}</div>
        <div class="chan-tx"><h2>${esc(c.name)}</h2><p>${esc(c.desc)}</p>
          <span class="small muted">${c.messages ? `${c.messages} message${c.messages === 1 ? '' : 's'} · active ${timeAgo(c.lastAt)}` : 'No messages yet · say hello'}</span></div>
      </a>`).join('')}</div>`);
}
async function renderChannel(id) {
  $app.innerHTML = shell('discussions', '<p class="muted">Loading…</p>');
  let R; try { R = await api('GET', '/api/discussions/channel/' + encodeURIComponent(id)); } catch (e) { return $app.innerHTML = shell('discussions', `<p><a href="#/discussions">← Discussions</a></p><div class="card"><p>${esc(e.message)}</p></div>`); }
  const c = R.channel, me = R.me, myHash = location.hash; let last = 0;
  const msgHtml = m => `<div class="msg ${m.author.username === me ? 'mine' : ''}" data-id="${m.id}">${avatar(m.author)}
      <div class="msg-main"><div class="msg-head"><a href="#/u/${encodeURIComponent(m.author.username)}">${esc(m.author.displayName)}</a><span class="muted small">${timeAgo(m.createdAt)}</span>${m.author.username === me ? `<button class="linkbtn" data-del="${m.id}">Delete</button>` : ''}</div>
      <div class="msg-body">${fmtPost(m.body)}</div></div></div>`;
  $app.innerHTML = shell('discussions', `
    <p class="small"><a href="#/discussions">← All channels</a></p>
    <h1 style="margin-bottom:.2rem">${c.icon} ${esc(c.name)}</h1><p class="muted" style="margin:0 0 .5rem">${esc(c.desc)}</p>
    ${DISC_WARN}
    <div class="card chat">
      <div class="chat-log" id="chatLog"></div>
      <form id="chatForm" class="chat-form"><textarea id="chatIn" class="chat-in" rows="2" maxlength="3000" placeholder="Ask a question or join the conversation… (Enter to send, Shift+Enter for a new line)"></textarea><button class="btn" type="submit">Send</button></form>
      <div class="err" id="chatErr"></div>
    </div>`);
  const log = document.getElementById('chatLog'), input = document.getElementById('chatIn'), err = document.getElementById('chatErr');
  const add = (msgs, stick) => {
    msgs = msgs.filter(m => m.id > last); if (!msgs.length) return;
    const near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    const empty = log.querySelector('.chat-empty'); if (empty) empty.remove();
    log.insertAdjacentHTML('beforeend', msgs.map(msgHtml).join('')); last = msgs[msgs.length - 1].id;
    if (stick || near) log.scrollTop = log.scrollHeight;
  };
  if (!R.messages.length) log.innerHTML = '<p class="muted chat-empty">No messages yet. Start the conversation!</p>';
  add(R.messages, true);
  const send = async () => {
    const body = input.value.trim(); if (!body) return; err.textContent = ''; input.value = '';
    try { await api('POST', '/api/discussions/channel/' + encodeURIComponent(id), { body }); await poll(true); }
    catch (x) { err.textContent = x.message; input.value = body; }
  };
  const poll = async stick => {
    if (location.hash !== myHash || !document.body.contains(log)) return clearInterval(window.__chatTimer);
    try { const r = await api('GET', `/api/discussions/channel/${encodeURIComponent(id)}?after=${last}`); add(r.messages, stick); } catch {}
  };
  document.getElementById('chatForm').onsubmit = e => { e.preventDefault(); send(); };
  input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
  log.onclick = async e => {
    const b = e.target.closest('[data-del]'); if (!b || !confirm('Delete this message?')) return;
    await api('DELETE', '/api/discussions/message/' + b.dataset.del); b.closest('.msg').remove();
  };
  window.__chatTimer = setInterval(() => poll(false), 3000);
  input.focus({ preventScroll: true });
}

// ---------- community ----------
const lb = { sort: 'streak' };
async function renderCommunity() {
  $app.innerHTML = shell('community', '<p class="muted">Loading…</p>');
  const [L, F] = await Promise.all([api('GET', '/api/leaderboard'), api('GET', '/api/feed')]);
  const keys = { streak: u => u.streak, week: u => u.weekMinutes, progress: u => u.readiness, done: u => u.totalDone };
  const rows = [...L.users].sort((a, b) => keys[lb.sort](b) - keys[lb.sort](a) || b.totalDone - a.totalDone);
  const th = (k, t) => `<th data-sort="${k}" style="${lb.sort === k ? 'color:var(--ink)' : ''}">${t}${lb.sort === k ? ' ▾' : ''}</th>`;
  $app.innerHTML = shell('community', `
    <h1>Community</h1>
    <div class="grid split">
      <div class="card" style="min-width:0;overflow-x:auto"><h2>Leaderboard</h2>
        <table><thead><tr><th>#</th><th>Learner</th>${th('streak', '🔥 Streak')}${th('week', '7-day time')}${th('progress', 'Readiness')}${th('done', 'Done')}</tr></thead><tbody>
        ${rows.map((u, i) => `<tr class="${u.username === L.me ? 'me' : ''}"><td>${i + 1}</td>
          <td><a href="#/u/${encodeURIComponent(u.username)}"><span class="avatar">${esc(u.displayName[0]?.toUpperCase() || '?')}</span>${esc(u.displayName)}</a>${u.private ? ' <span class="chip">private</span>' : ''}${u.studiedToday ? ' <span title="Studied today">✅</span>' : ''}</td>
          <td>${u.streak}</td><td>${fmtMin(u.weekMinutes)}</td>
          <td><div class="bar" style="width:90px;display:inline-block;vertical-align:middle"><i style="width:${u.readiness}%"></i></div> ${u.readiness}%</td><td>${u.totalDone}/${u.totalItems}</td></tr>`).join('')}
        </tbody></table></div>
      <div class="card" style="min-width:0"><h2>Recent activity</h2>
        ${F.feed.length ? F.feed.map(f => `<div class="li" style="padding:.4rem 0;border-top:1px solid var(--line)"><a href="#/u/${encodeURIComponent(f.username)}">${esc(f.displayName)}</a> finished <a href="#/lesson/${esc(f.itemId)}" target="_blank" rel="noopener">${esc(f.title)}</a><div class="muted small">${new Date(f.at).toLocaleString()}</div></div>`).join('') : '<p class="muted">Nothing yet.</p>'}</div>
    </div>`);
  document.querySelectorAll('th[data-sort]').forEach(t => t.onclick = () => { lb.sort = t.dataset.sort; renderCommunity(); });
}
async function renderProfile(name) {
  const j = await api('GET', '/api/users/' + encodeURIComponent(name));
  const s = j.stats;
  $app.innerHTML = shell('community', `
    <p class="small"><a href="#/community">← Community</a></p>
    <h1><span class="avatar">${esc(j.user.displayName[0]?.toUpperCase() || '?')}</span>${esc(j.user.displayName)} <span class="muted small">@${esc(j.user.username)}</span></h1>
    <div class="grid g3">
      <div class="card stat"><div class="big">🔥 ${s.streak}</div><div class="lbl">streak · best ${s.longest}</div></div>
      <div class="card stat"><div class="big">${s.readiness}%</div><div class="lbl">readiness</div></div>
      <div class="card stat"><div class="big">${s.totalDone}/${s.totalItems}</div><div class="lbl">done</div></div>
      <div class="card stat"><div class="big">${fmtMin(s.totalMinutes)}</div><div class="lbl">total study time</div></div>
    </div>
    <div class="grid g2" style="margin-top:1rem"><div class="card"><h2>Domains</h2>${domainBars(s.domains)}</div>
    <div class="card"><h2>Activity</h2>${heatmap(s.activity, 30)}<p class="small muted">Joined ${new Date(j.joined).toLocaleDateString()}${j.examDate ? ` · exam ${fmtDay(j.examDate)}` : ''}</p></div></div>`);
}

// ---------- side panel, notes, resources ----------
const linkCard = (v, thumb) => {
  const body = `<b>${esc(v.title)}</b>
  <span class="muted small">${esc(v.by || '')}</span>${v.tag ? `<span class="chip">${esc(v.tag)}</span>` : ''}${v.note ? `<span class="small muted">${esc(v.note)}</span>` : ''}`;
  return thumb && v.img ? `<a class="vid has-img" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer"><img class="vthumb" src="${esc(v.img)}" alt="" loading="lazy"><span class="vbody">${body}</span></a>`
    : `<a class="vid" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${body}</a>`;
};
function sidebar(domainId, sectionId) {
  const sec = S.cur.sections.find(x => x.id === sectionId);
  const docs = (S.res.docsByDomain[domainId] || []).map(([t, u]) => `<a class="vid" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><b>${esc(t)}</b><span class="small muted">kubernetes.io</span></a>`).join('');
  const tab = S.sideTab;
  return `<button class="side-handle" id="sideHandle" aria-controls="sideTabs" aria-expanded="false">📚 Videos · Docs · Practice</button><div class="side-backdrop" id="sideBd"></div>
  <aside class="side-tabs card" id="sideTabs" aria-label="Videos, docs and practice">
    <div class="side-head"><b>Study resources</b><button class="btn ghost sm" id="sideX" aria-label="Close resources">✕</button></div>
    <div class="tabs" role="tablist">${[['videos', '🎬 Videos'], ['docs', '📘 Docs'], ['practice', '🧪 Practice']].map(([k, t]) => `<button role="tab" class="${tab === k ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</div>
    <div data-pane="videos" class="${tab === 'videos' ? '' : 'hide'}">
      <p class="muted small" style="margin-top:0">Follow along with a playlist or course. See <a href="#/resources">all resources</a>.</p>
      ${S.res.videos.map(g => `<h3>${esc(g.group)}</h3>${g.items.map(v => linkCard(v)).join('')}`).join('')}</div>
    <div data-pane="docs" class="${tab === 'docs' ? '' : 'hide'}">
      ${sec && sec.notes ? `<a class="btn sm" href="#/notes/${encodeURIComponent(sec.id)}" style="display:block;text-align:center;margin-bottom:.8rem">📖 Read notes: ${esc(sec.title)}</a>` : ''}
      <h3>Official docs for this domain</h3>${docs}
      <a class="vid" href="https://kubernetes.io/docs/home/" target="_blank" rel="noopener noreferrer"><b>Kubernetes documentation home</b><span class="small muted">kubernetes.io/docs</span></a></div>
    <div data-pane="practice" class="${tab === 'practice' ? '' : 'hide'}">${S.res.practice.map(p => linkCard({ title: p.title, url: p.url, note: p.note })).join('')}</div>
  </aside>`;
}
function wireSide() {
  const box = document.getElementById('sideTabs'); if (!box) return;
  const set = open => { box.classList.toggle('open', open); document.getElementById('sideBd').classList.toggle('on', open); document.getElementById('sideHandle').setAttribute('aria-expanded', String(open)); document.getElementById('sideHandle').classList.toggle('hide', open); };
  document.getElementById('sideHandle').onclick = () => set(true);
  document.getElementById('sideX').onclick = () => set(false);
  document.getElementById('sideBd').onclick = () => set(false);
  document.addEventListener('keydown', function esc(e) { if (!document.body.contains(box)) return document.removeEventListener('keydown', esc); if (e.key === 'Escape') set(false); });
  box.onclick = e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    S.sideTab = b.dataset.tab;
    box.querySelectorAll('button[data-tab]').forEach(x => x.classList.toggle('on', x === b));
    box.querySelectorAll('[data-pane]').forEach(x => x.classList.toggle('hide', x.dataset.pane !== S.sideTab));
  };
}
async function renderNotes(id) {
  const sec = S.cur.sections.find(x => x.id === id);
  if (!sec) { location.hash = '#/curriculum'; return; }
  $app.innerHTML = shell('curriculum', '<p class="muted">Loading…</p>');
  const j = await api('GET', '/api/notes?id=' + encodeURIComponent(id));
  const domain = sec.lessons[0].domain;
  const done = sec.lessons.filter(l => S.prog[l.id]).length;
  $app.innerHTML = shell('curriculum', `<div class="with-side"><div class="lesson">
    <p class="small muted"><a href="#/curriculum">Curriculum</a> › Section notes</p>
    <h1>${esc(sec.title)}</h1>
    <p class="muted small">${done}/${sec.lessons.length} items done in this section. These notes summarise the topic and point to the official Kubernetes docs; use them alongside the lessons below.</p>
    <div class="md">${j.html}</div>
    <h2 style="margin-top:2rem">Lessons in this section</h2>
    <div class="card" style="padding:0">${sec.lessons.map(l => `<div class="item ${S.prog[l.id] ? 'done' : ''}"><input type="checkbox" data-act="done" data-id="${esc(l.id)}" ${S.prog[l.id] ? 'checked' : ''} aria-label="Mark ${esc(l.title)} done"><span class="vdot ${S.visited[l.id] ? 'on' : ''}" title="${S.visited[l.id] ? 'Opened' : 'Not opened yet'}"></span><div class="t"><a href="#/lesson/${esc(l.id)}" target="_blank" rel="noopener">${esc(l.title)}</a></div><span class="chip ${l.kind}">${l.kind}</span></div>`).join('')}</div>
  </div>${sidebar(domain, id)}</div>`);
  document.querySelectorAll('.lesson .md a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  addCopyButtons();
  wireSide(); window.scrollTo(0, 0);
}
function renderResources() {
  const r = S.res;
  $app.innerHTML = shell('resources', `
    <h1>Resources</h1>
    <p class="muted">Video courses, practice environments and official documentation. Courses are not affiliated with this app; check the current price and syllabus version before you buy.</p>
    <div class="card exam-book"><div class="eb-ic">🎓</div><div class="eb-tx"><h2 style="margin:0 0 .3rem">Book the CKA exam</h2>
      <p style="margin:0 0 .6rem">Register and pay for the exam on the official Linux Foundation page.</p>
      <div class="eb-tip">💡 <span><b>Tip:</b> the exam is a big expense, so before you buy, search online for current discount vouchers and coupon codes. The Linux Foundation runs promotions regularly, and a code can save a lot of money.</span></div>
      <a class="btn" href="https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/" target="_blank" rel="noopener noreferrer">Book the CKA exam ↗</a></div></div>
    ${r.videos.map(g => `<h2 style="margin-top:1.4rem">${esc(g.group)}</h2><div class="grid g2">${g.items.map(v => linkCard(v, true)).join('')}</div>`).join('')}
    <h2 style="margin-top:1.4rem">Practice and reference</h2>
    <div class="grid g2">${r.practice.map(p => `${linkCard({ title: p.title, url: p.url, note: p.note })}`).join('')}</div>
    <h2 style="margin-top:1.4rem">Study notes by section</h2>
    <div class="card">${S.cur.sections.filter(s => s.notes).map(s => `<a class="chip" style="margin:.2rem" href="#/notes/${encodeURIComponent(s.id)}">📖 ${esc(s.title)}</a>`).join('')}</div>`);
}

// ---------- study timer ----------
function tElapsed() { const t = S.timer; return t ? t.elapsedMs + (t.state === 'running' ? Date.now() - t.syncedAt : 0) : 0; }
function fmtClock(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; }
function timerBody() {
  const t = S.timer, goal = S.user.dailyGoalMin;
  const saved = S.stats?.activity[today()]?.minutes || 0;
  const total = saved + Math.floor(tElapsed() / 60000);
  const pct = Math.min(100, Math.round(100 * total / goal));
  const sessions = S.log.filter(l => l.day === today() && l.note.startsWith('⏱'));
  const keep = document.getElementById('tlabel')?.value || '';
  return `<div class="clock ${S.timer && S.timer.state === 'running' ? 'run' : ''}" data-clock>${fmtClock(tElapsed())}</div>
    ${t ? `<p class="muted small" style="text-align:center;margin:.1rem 0 .8rem">${esc(t.label || 'Study session')} · ${t.state === 'running' ? '<b style="color:var(--ok)">● running</b>' : '⏸ paused'}</p>`
        : `<input type="text" id="tlabel" maxlength="120" placeholder="What are you studying? (optional)" value="${esc(keep)}" style="margin:.4rem 0 .8rem">`}
    <div class="row" style="justify-content:center">
      ${!t ? '<button class="btn" data-timer="start">▶ Start studying</button>'
        : t.state === 'running' ? '<button class="btn ghost" data-timer="pause">⏸ Pause</button><button class="btn" data-timer="stop">■ End session</button>'
        : '<button class="btn" data-timer="start">▶ Resume</button><button class="btn" data-timer="stop">■ End session</button>'}
    </div>
    <div style="margin-top:1rem"><div class="row space small"><span>Today: <b>${fmtMin(total)}</b> of ${fmtMin(goal)}</span>${(t || total > 0) ? '<button class="btn ghost sm" data-timer="resettoday" title="Clear today\'s timer and logged time">↺ Reset today</button>' : ''}</div><div class="bar" style="margin-top:.3rem"><i style="width:${pct}%"></i></div></div>
    ${sessions.length ? `<div class="small muted" style="margin-top:.8rem">Today's timer sessions</div>${sessions.map(l => `<div class="li" style="display:flex;gap:.5rem;align-items:center;padding:.25rem 0;border-top:1px solid var(--line)"><span style="flex:1;min-width:0" class="small">${fmtMin(l.minutes)} · ${esc(l.note.replace(/^⏱\s*/, ''))}</span><button class="btn ghost sm" data-timer="dellog" data-id="${l.id}" aria-label="Delete session">✕</button></div>`).join('')}` : ''}`;
}
function paintTimer() {
  document.querySelectorAll('[data-timer-root]').forEach(el => { el.innerHTML = timerBody(); });
  const pill = document.querySelector('.timer-pill');
  if (pill) pill.className = 'timer-pill ' + (S.timer ? (S.timer.state === 'running' ? 'on' : 'paused') : '');
  tickTimer();
}
function tickTimer() {
  const c = fmtClock(tElapsed());
  document.querySelectorAll('[data-clock]').forEach(el => { el.textContent = c; });
  document.querySelectorAll('[data-clock-short]').forEach(el => { el.textContent = S.timer ? c : 'Timer'; });
  document.title = S.timer && S.timer.state === 'running' ? `⏱ ${c} · CKA Study Tracker` : 'CKA Study Tracker';
}
async function timerCall(url, body) { const j = await api('POST', url, body); S.timer = j.timer ? { ...j.timer, syncedAt: Date.now() } : null; return j; }
function timerDialog() {
  const dlg = openDialog(`<h2>Study timer</h2><div data-timer-root></div><div class="row" style="margin-top:1rem;justify-content:flex-end"><button class="btn ghost sm" id="tdx">Close</button></div>`, d => { d.querySelector('#tdx').onclick = () => d.close(); });
  paintTimer(); return dlg;
}
function stopDialog(stale) {
  const mins = Math.max(1, Math.round(tElapsed() / 60000));
  openDialog(`<h2>Save this session?</h2>
    ${stale ? `<p class="muted small">The timer has been running for ${fmtClock(tElapsed())}. If you stopped studying earlier, lower the minutes.</p>` : ''}
    <label for="sm">Minutes studied</label><input type="number" id="sm" min="1" max="720" value="${mins}">
    <label for="sl">What did you study?</label><input type="text" id="sl" maxlength="120" value="${esc(S.timer?.label || '')}" placeholder="Study session">
    <div class="row" style="margin-top:1rem"><button class="btn" id="ssave">Save to my study log</button><button class="btn ghost" id="sdisc">Discard</button><button class="btn ghost" id="scan">Cancel</button></div>`, dlg => {
    dlg.querySelector('#scan').onclick = () => dlg.close();
    const finish = async save => {
      try {
        const j = await timerCall('/api/timer/stop', { save, minutes: +dlg.querySelector('#sm').value, label: dlg.querySelector('#sl').value });
        await loadProgress(); dlg.close();
        toast(save ? `Saved ${fmtMin(j.saved)} to your study log ✔` : 'Session discarded');
        const r = location.hash.replace(/^#\/?/, '').split('/')[0];
        if (['', 'calendar'].includes(r)) render(); else paintTimer();
      } catch (er) { toast(er.message); }
    };
    dlg.querySelector('#ssave').onclick = () => finish(true);
    dlg.querySelector('#sdisc').onclick = () => finish(false);
  });
}
function resetDialog(kind) {
  const today_ = kind === 'today';
  openDialog(`<h2>${today_ ? 'Reset today\'s timer?' : 'Reset your streak?'}</h2>
    <p class="muted">${today_ ? 'This stops and discards the running timer and removes all time logged today (timer sessions and manual entries). Completed lessons stay completed.'
      : 'Your streak goes back to 0 and your best streak is recalculated from now. Your progress and logged time are kept. The streak restarts with your next study day.'}</p>
    <div class="row" style="justify-content:flex-end;margin-top:1rem"><button class="btn ghost sm" id="rx">Cancel</button><button class="btn" id="rok">Reset</button></div>`, d => {
    d.querySelector('#rx').onclick = () => d.close();
    d.querySelector('#rok').onclick = async () => {
      try {
        const j = await api('POST', '/api/reset/' + kind, { day: today() });
        if (today_) S.timer = null;
        d.close(); await loadProgress(); render(); toast(today_ ? 'Today\'s timer reset' : 'Streak reset');
      } catch (er) { toast(er.message); }
    };
  });
}
document.addEventListener('click', e => { const r = e.target.closest('[data-reset]'); if (r) resetDialog(r.dataset.reset); });
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-timer]'); if (!b) return;
  const a = b.dataset.timer;
  try {
    if (a === 'open') return timerDialog();
    if (a === 'start') {
      const label = (document.getElementById('tlabel')?.value || b.dataset.label || '').trim();
      await timerCall('/api/timer/start', { label, day: today() }); paintTimer();
      if (b.closest('.sticky-bar')) { b.textContent = '⏱ Timer running'; b.dataset.timer = 'open'; }
    } else if (a === 'pause') { await timerCall('/api/timer/pause', {}); paintTimer(); }
    else if (a === 'stop') stopDialog();
    else if (a === 'resettoday') resetDialog('today');
    else if (a === 'dellog') { await api('DELETE', '/api/log/' + b.dataset.id); await loadProgress(); paintTimer(); }
  } catch (er) { toast(er.message); }
});

// ---------- settings ----------
function renderSettings() {
  const u = S.user;
  $app.innerHTML = shell('settings', `
    <h1>Settings</h1>
    <div class="card" style="max-width:520px"><form id="sf">
      <label for="sd">Display name</label><input id="sd" type="text" maxlength="40" value="${esc(u.displayName)}">
      <label for="se">Exam date</label><input id="se" type="date" value="${u.examDate || ''}">
      <label for="sg">Daily study goal (minutes)</label><input id="sg" type="number" min="5" max="600" value="${u.dailyGoalMin}">
      <label class="row" style="font-weight:500;margin-top:1rem"><input id="sp" type="checkbox" style="width:auto" ${u.isPublic ? 'checked' : ''}> Show me on the leaderboard and let others view my progress</label>
      <div class="row" style="margin-top:1rem"><button class="btn">Save</button><button class="btn ghost" type="button" id="lo">Log out</button></div>
    </form></div>`);
  sf.onsubmit = async e => {
    e.preventDefault();
    try { const j = await api('PATCH', '/api/me', { displayName: sd.value, examDate: se.value || null, dailyGoalMin: +sg.value, isPublic: sp.checked }); S.user = j.user; toast('Saved ✔'); renderSettings(); }
    catch (er) { toast(er.message); }
  };
  lo.onclick = async () => { await api('POST', '/api/logout'); S.user = null; S.stats = null; S.calSel = null; renderAuth(); };
}

boot();

// card spotlight: the glow follows the pointer
let _pm = null;
document.addEventListener('pointermove', e => {
  const c = e.target.closest && e.target.closest('.card, details.sec, .nav a.tab'); if (!c) return;
  if (_pm) { _pm.c = c; _pm.x = e.clientX; _pm.y = e.clientY; return; }
  _pm = { c, x: e.clientX, y: e.clientY };
  requestAnimationFrame(() => { const { c, x, y } = _pm; _pm = null; const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (x - r.left) + 'px'); c.style.setProperty('--my', (y - r.top) + 'px'); });
}, { passive: true });

// button ripple
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('.btn'); if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), x = document.createElement('span');
  x.className = 'rip'; x.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(x); setTimeout(() => x.remove(), 650);
}, { passive: true });
