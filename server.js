'use strict';
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { marked } = require('marked');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DOCS_DIR = path.join(__dirname, 'content', 'docs');
fs.mkdirSync(DATA_DIR, { recursive: true });

const curriculum = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'curriculum.json'), 'utf8'));
const items = new Map();
for (const s of curriculum.sections) for (const l of s.lessons) items.set(l.id, { ...l, section: s.title, sectionId: s.id });
const DOMAIN_IDS = curriculum.domains.map(d => d.id);

// ---------- database ----------
const db = new DatabaseSync(path.join(DATA_DIR, 'cka.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  exam_date TEXT,
  daily_goal_min INTEGER NOT NULL DEFAULT 30,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  day TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS study_log (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS plan (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS visits (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  first_opened INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE TABLE IF NOT EXISTS timer (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL,            -- 'running' | 'paused'
  elapsed_ms INTEGER NOT NULL,    -- time accumulated before the current run
  started_at INTEGER,             -- ms timestamp of the current run start (running only)
  label TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_user_day ON study_log(user_id, day);
CREATE INDEX IF NOT EXISTS idx_progress_user_day ON progress(user_id, day);
`);
for (const col of ['plan_rest TEXT', 'plan_end TEXT', 'streak_from TEXT', 'reset_day TEXT', 'reset_min INTEGER DEFAULT 0']) {
  try { db.exec('ALTER TABLE users ADD COLUMN ' + col); } catch { /* already there */ }
}

// ---------- helpers ----------
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDay = s => typeof s === 'string' && DAY_RE.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const addDays = (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const serverToday = () => new Date().toISOString().slice(0, 10);
// Client sends its local date. Accept only if within a day or so of server UTC date (covers all timezones).
const clientDay = s => (isDay(s) && Math.abs(diffDays(serverToday(), s)) <= 1) ? s : serverToday();

function hashPassword(pw, salt) { return crypto.scryptSync(pw, salt, 64).toString('hex'); }
const sha = t => crypto.createHash('sha256').update(t).digest('hex');

// tiny in-memory rate limiter for auth endpoints
const hits = new Map();
function limited(key, max = 10, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  return arr.length > max;
}

function parseCookies(req) {
  const out = {};
  for (const p of (req.headers.cookie || '').split(';')) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return out;
}
const SECURE = process.env.COOKIE_SECURE === '1';
function setSession(res, token) {
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 90}${SECURE ? '; Secure' : ''}`);
}

const q = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (username, display_name, salt, pass_hash, created_at) VALUES (?,?,?,?,?)'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, created_at) VALUES (?,?,?)'),
  sessionUser: db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?'),
  delSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  progressFor: db.prepare('SELECT item_id, day, minutes, completed_at FROM progress WHERE user_id = ?'),
  logFor: db.prepare('SELECT id, day, minutes, note FROM study_log WHERE user_id = ? ORDER BY day DESC, id DESC'),
  planFor: db.prepare('SELECT item_id, day FROM plan WHERE user_id = ?'),
  allUsers: db.prepare('SELECT id, username, display_name, is_public FROM users'),
};

function auth(req, res, next) {
  const tok = parseCookies(req).sid;
  const u = tok && q.sessionUser.get(sha(tok));
  if (!u) return res.status(401).json({ error: 'Not signed in' });
  req.user = u;
  next();
}

// ---------- stats ----------
function userStats(userId, today) {
  const prog = q.progressFor.all(userId);
  const logs = db.prepare('SELECT day, minutes FROM study_log WHERE user_id = ?').all(userId);
  const activity = {}; // day -> { minutes, items }
  for (const p of prog) {
    const a = activity[p.day] || (activity[p.day] = { minutes: 0, items: 0 });
    a.minutes += p.minutes; a.items += 1;
  }
  for (const l of logs) {
    const a = activity[l.day] || (activity[l.day] = { minutes: 0, items: 0 });
    a.minutes += l.minutes;
  }
  const urow = q.userById.get(userId) || {};
  if (urow.reset_day && activity[urow.reset_day]) activity[urow.reset_day].minutes = Math.max(0, activity[urow.reset_day].minutes - (urow.reset_min || 0));
  const days = new Set(Object.keys(activity));
  const sdays = new Set([...days].filter(d => !urow.streak_from || d >= urow.streak_from));
  let streak = 0;
  let cursor = sdays.has(today) ? today : (sdays.has(addDays(today, -1)) ? addDays(today, -1) : null);
  while (cursor && sdays.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  const sorted = [...days].sort();
  const ssorted = [...sdays].sort();
  let longest = 0, run = 0, prev = null;
  for (const d of ssorted) { run = (prev && diffDays(prev, d) === 1) ? run + 1 : 1; longest = Math.max(longest, run); prev = d; }
  let weekMinutes = 0;
  for (let i = 0; i < 7; i++) weekMinutes += (activity[addDays(today, -i)] || { minutes: 0 }).minutes;
  // per-domain progress by (planned) minutes
  const doneIds = new Set(prog.filter(p => items.has(p.item_id)).map(p => p.item_id));
  const domains = {};
  for (const d of curriculum.domains) domains[d.id] = { done: 0, total: 0, doneMin: 0, totalMin: 0 };
  for (const it of items.values()) {
    const d = domains[it.domain];
    d.total++; d.totalMin += it.minutes;
    if (doneIds.has(it.id)) { d.done++; d.doneMin += it.minutes; }
  }
  let readiness = 0;
  for (const d of curriculum.domains) if (d.weight) {
    const x = domains[d.id];
    readiness += d.weight * (x.totalMin ? x.doneMin / x.totalMin : 0);
  }
  const totalDone = doneIds.size;
  const totalMinutes = Object.values(activity).reduce((a, b) => a + b.minutes, 0);
  return {
    streak, longest, weekMinutes, totalDone, totalItems: items.size, totalMinutes,
    readiness: Math.round(readiness), domains, activity,
    studiedToday: days.has(today), lastActive: sorted[sorted.length - 1] || null,
  };
}

const publicUser = u => ({ id: u.id, username: u.username, displayName: u.display_name, isPublic: !!u.is_public });
const meUser = u => ({ ...publicUser(u), examDate: u.exam_date, dailyGoalMin: u.daily_goal_min,
  planRest: u.plan_rest ? u.plan_rest.split(',').filter(Boolean).map(Number) : [], planEnd: u.plan_end || null });

// ---------- app ----------
const app = express();
app.disable('x-powered-by');
try { app.use(require('compression')()); } catch { /* optional: npm i compression */ }
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  // Basic CSRF guard: mutating requests must be JSON (can't be sent cross-site by a plain form).
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'JSON required' });
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
let guides = {};
try { guides = JSON.parse(fs.readFileSync(path.join(__dirname, 'content', 'guides.json'), 'utf8')); } catch (e) { console.warn('No guides.json found; run: node scripts/build-guides.js'); }
const loadEmbeds = () => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'embeds.json'), 'utf8')); } catch { return {}; } };
const resources = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'resources.json'), 'utf8'));
app.get('/api/resources', (req, res) => res.json(resources));
app.get('/api/curriculum', (req, res) => res.json(curriculum));

// --- auth ---
app.post('/api/signup', (req, res) => {
  if (limited('signup:' + req.ip, 8)) return res.status(429).json({ error: 'Too many attempts, try later' });
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const displayName = String(req.body.displayName || username).trim().slice(0, 40);
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(username)) return res.status(400).json({ error: 'Username: 3–24 letters, numbers, _ or -' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (q.userByName.get(username)) return res.status(409).json({ error: 'That username is taken' });
  const salt = crypto.randomBytes(16).toString('hex');
  const info = q.insertUser.run(username, displayName || username, salt, hashPassword(password, salt), Date.now());
  const token = crypto.randomBytes(32).toString('hex');
  q.insertSession.run(sha(token), Number(info.lastInsertRowid), Date.now());
  setSession(res, token);
  res.json({ user: meUser(q.userById.get(Number(info.lastInsertRowid))) });
});

app.post('/api/login', (req, res) => {
  if (limited('login:' + req.ip, 15)) return res.status(429).json({ error: 'Too many attempts, try later' });
  const u = q.userByName.get(String(req.body.username || '').trim());
  const pw = String(req.body.password || '');
  // constant-ish time even for unknown users
  const salt = u ? u.salt : 'x'.repeat(32);
  const hash = hashPassword(pw, salt);
  if (!u || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.pass_hash, 'hex'))) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  q.insertSession.run(sha(token), u.id, Date.now());
  setSession(res, token);
  res.json({ user: meUser(u) });
});

app.post('/api/logout', (req, res) => {
  const tok = parseCookies(req).sid;
  if (tok) q.delSession.run(sha(tok));
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const tok = parseCookies(req).sid;
  const u = tok && q.sessionUser.get(sha(tok));
  res.json({ user: u ? meUser(u) : null });
});

app.patch('/api/me', auth, (req, res) => {
  const b = req.body || {};
  const u = req.user;
  const examDate = b.examDate === null || b.examDate === '' ? null : (b.examDate !== undefined ? b.examDate : u.exam_date);
  if (examDate !== null && !isDay(examDate)) return res.status(400).json({ error: 'Invalid exam date' });
  const goal = b.dailyGoalMin !== undefined ? Math.round(Number(b.dailyGoalMin)) : u.daily_goal_min;
  if (!(goal >= 5 && goal <= 600)) return res.status(400).json({ error: 'Daily goal must be 5–600 minutes' });
  const isPublic = b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : u.is_public;
  const displayName = b.displayName !== undefined ? String(b.displayName).trim().slice(0, 40) || u.username : u.display_name;
  db.prepare('UPDATE users SET exam_date=?, daily_goal_min=?, is_public=?, display_name=? WHERE id=?')
    .run(examDate, goal, isPublic, displayName, u.id);
  res.json({ user: meUser(q.userById.get(u.id)) });
});

// --- progress ---
app.get('/api/progress', auth, (req, res) => {
  const today = clientDay(req.query.today);
  const prog = {};
  for (const p of q.progressFor.all(req.user.id)) prog[p.item_id] = { day: p.day, minutes: p.minutes };
  const plan = {};
  for (const p of q.planFor.all(req.user.id)) plan[p.item_id] = p.day;
  const visited = {};
  for (const v of db.prepare('SELECT item_id FROM visits WHERE user_id = ?').all(req.user.id)) visited[v.item_id] = true;
  res.json({ progress: prog, plan, visited, timer: timerFor(req.user.id), log: q.logFor.all(req.user.id), stats: userStats(req.user.id, today) });
});

app.put('/api/progress/:section/:id', auth, (req, res) => handleProgress(req, res, req.params.section + '/' + req.params.id));
app.put('/api/progress/:section/:sub/:id', auth, (req, res) => handleProgress(req, res, [req.params.section, req.params.sub, req.params.id].join('/')));
app.put('/api/progress/:a/:b/:c/:d', auth, (req, res) => handleProgress(req, res, [req.params.a, req.params.b, req.params.c, req.params.d].join('/')));
app.put('/api/progress/:a/:b/:c/:d/:e', auth, (req, res) => handleProgress(req, res, [req.params.a, req.params.b, req.params.c, req.params.d, req.params.e].join('/')));

function handleProgress(req, res, itemId) {
  const it = items.get(itemId);
  if (!it) return res.status(404).json({ error: 'Unknown item' });
  if (req.body.done) {
    const day = clientDay(req.body.day);
    const minutes = Math.max(1, Math.min(600, Math.round(Number(req.body.minutes) || it.minutes)));
    db.prepare('INSERT INTO progress (user_id,item_id,day,minutes,completed_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET day=excluded.day, minutes=excluded.minutes, completed_at=excluded.completed_at')
      .run(req.user.id, itemId, day, minutes, Date.now());
    db.prepare('DELETE FROM plan WHERE user_id=? AND item_id=?').run(req.user.id, itemId);
  } else {
    db.prepare('DELETE FROM progress WHERE user_id=? AND item_id=?').run(req.user.id, itemId);
  }
  res.json({ ok: true, stats: userStats(req.user.id, clientDay(req.body.today || req.body.day)) });
}

// --- study timer (server-side so it survives refreshes, other tabs and devices) ---
function timerFor(userId) {
  const t = db.prepare('SELECT * FROM timer WHERE user_id = ?').get(userId);
  if (!t) return null;
  const elapsedMs = t.elapsed_ms + (t.state === 'running' ? Date.now() - t.started_at : 0);
  return { state: t.state, label: t.label, day: t.day, elapsedMs };
}
app.post('/api/timer/start', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM timer WHERE user_id = ?').get(req.user.id);
  if (!t) {
    const label = String(req.body.label || '').trim().slice(0, 120);
    db.prepare('INSERT INTO timer (user_id,state,elapsed_ms,started_at,label,day) VALUES (?,?,?,?,?,?)')
      .run(req.user.id, 'running', 0, Date.now(), label, clientDay(req.body.day));
  } else if (t.state === 'paused') {
    db.prepare("UPDATE timer SET state='running', started_at=? WHERE user_id=?").run(Date.now(), req.user.id);
  }
  res.json({ timer: timerFor(req.user.id) });
});
app.post('/api/timer/pause', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM timer WHERE user_id = ?').get(req.user.id);
  if (t && t.state === 'running') {
    db.prepare("UPDATE timer SET state='paused', elapsed_ms=?, started_at=NULL WHERE user_id=?")
      .run(t.elapsed_ms + Date.now() - t.started_at, req.user.id);
  }
  res.json({ timer: timerFor(req.user.id) });
});
// Stop the timer. With save=true the session is added to the study log (minutes may be edited by the user).
app.post('/api/timer/stop', auth, (req, res) => {
  const t = db.prepare('SELECT * FROM timer WHERE user_id = ?').get(req.user.id);
  if (!t) return res.json({ timer: null, saved: 0 });
  let saved = 0;
  if (req.body.save) {
    const tracked = Math.round(timerFor(req.user.id).elapsedMs / 60000);
    const asked = Math.round(Number(req.body.minutes));
    const minutes = Math.max(1, Math.min(720, asked >= 1 ? asked : tracked));
    const label = String(req.body.label ?? t.label).trim().slice(0, 150);
    db.prepare('INSERT INTO study_log (user_id,day,minutes,note,created_at) VALUES (?,?,?,?,?)')
      .run(req.user.id, t.day, minutes, '⏱ ' + (label || 'Study session'), Date.now());
    saved = minutes;
  }
  db.prepare('DELETE FROM timer WHERE user_id = ?').run(req.user.id);
  res.json({ timer: null, saved });
});

app.post('/api/log', auth, (req, res) => {
  const day = clientDay(req.body.day);
  const minutes = Math.round(Number(req.body.minutes));
  if (!(minutes >= 1 && minutes <= 720)) return res.status(400).json({ error: 'Minutes must be 1–720' });
  const note = String(req.body.note || '').slice(0, 200);
  db.prepare('INSERT INTO study_log (user_id,day,minutes,note,created_at) VALUES (?,?,?,?,?)').run(req.user.id, day, minutes, note, Date.now());
  res.json({ ok: true, stats: userStats(req.user.id, day) });
});
// Reset today's timer: discards a running/paused timer and today's logged time (lesson completions are kept).
app.post('/api/reset/today', auth, (req, res) => {
  const day = clientDay(req.body.day);
  db.prepare('DELETE FROM timer WHERE user_id = ?').run(req.user.id);
  db.prepare('DELETE FROM study_log WHERE user_id = ? AND day = ?').run(req.user.id, day);
  const base = q.progressFor.all(req.user.id).filter(p => p.day === day).reduce((a, p) => a + p.minutes, 0);
  db.prepare('UPDATE users SET reset_day = ?, reset_min = ? WHERE id = ?').run(day, base, req.user.id);
  res.json({ ok: true, timer: null, log: q.logFor.all(req.user.id), stats: userStats(req.user.id, day) });
});
// Reset the streak to 0: only activity from the restart day onwards counts (today if nothing is logged yet, otherwise tomorrow).
app.post('/api/reset/streak', auth, (req, res) => {
  const day = clientDay(req.body.day);
  const had = userStats(req.user.id, day).studiedToday;
  db.prepare('UPDATE users SET streak_from = ? WHERE id = ?').run(had ? addDays(day, 1) : day, req.user.id);
  res.json({ ok: true, stats: userStats(req.user.id, day) });
});
app.delete('/api/log/:id', auth, (req, res) => {
  db.prepare('DELETE FROM study_log WHERE id=? AND user_id=?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

// --- study plan (calendar scheduling) ---
app.put('/api/plan', auth, (req, res) => {
  const { itemId, day } = req.body;
  if (!items.has(itemId)) return res.status(404).json({ error: 'Unknown item' });
  if (day === null) db.prepare('DELETE FROM plan WHERE user_id=? AND item_id=?').run(req.user.id, itemId);
  else if (isDay(day)) db.prepare('INSERT INTO plan (user_id,item_id,day) VALUES (?,?,?) ON CONFLICT(user_id,item_id) DO UPDATE SET day=excluded.day').run(req.user.id, itemId, day);
  else return res.status(400).json({ error: 'Invalid day' });
  res.json({ ok: true });
});

// Spread all remaining items (in course order) over the days between today and the exam date,
// respecting the daily goal. Leaves the last 3 days before the exam for review.
app.post('/api/plan/auto', auth, (req, res) => {
  const today = clientDay(req.body.today);
  const u = req.user;
  const goal = u.daily_goal_min;
  const done = new Set(q.progressFor.all(u.id).map(p => p.item_id));
  const remaining = [...items.values()].filter(i => !done.has(i.id));
  const lastDay = u.exam_date ? addDays(u.exam_date, -3) : null;
  const rest = new Set(Array.isArray(req.body.restDays) ? req.body.restDays.map(Number) : []); // 0=Sun..6=Sat
  const rows = [];
  const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();
  const isRest = d => rest.has(dow(d)) && rest.size < 7;
  const nextStudy = d => { while (isRest(d)) d = addDays(d, 1); return d; };
  const span = Math.round(Number(req.body.days));
  const total = remaining.reduce((a, i) => a + i.minutes, 0);
  let day = nextStudy(today), perDay = goal;
  if (span >= 1 && span <= 730) {
    // fit everything into `span` calendar days: even load over the available study days
    let n = 0; for (let d = today, k = 0; k < span; k++, d = addDays(d, 1)) if (!isRest(d)) n++;
    n = Math.max(1, n); perDay = Math.ceil(total / n);
    let cum = 0, idx = 0;
    for (const it of remaining) {
      while (idx < n - 1 && cum >= (idx + 1) * perDay) { idx++; day = nextStudy(addDays(day, 1)); }
      rows.push([it.id, day]); cum += it.minutes;
    }
  } else {
    let used = 0;
    for (const it of remaining) {
      if (used > 0 && used + it.minutes > goal) { day = nextStudy(addDays(day, 1)); used = 0; }
      rows.push([it.id, day]); used += it.minutes;
    }
  }
  const finishDay = rows.length ? rows[rows.length - 1][1] : today;
  const fits = !lastDay || diffDays(finishDay, lastDay) >= 0;
  db.prepare('UPDATE users SET plan_rest=?, plan_end=? WHERE id=?')
    .run([...rest].join(','), span >= 1 && span <= 730 ? addDays(today, span - 1) : finishDay, u.id);
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM plan WHERE user_id=?').run(u.id);
    const ins = db.prepare('INSERT INTO plan (user_id,item_id,day) VALUES (?,?,?)');
    for (const [id, d] of rows) ins.run(u.id, id, d);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  const needPerDay = (u.exam_date && remaining.length)
    ? Math.ceil(remaining.reduce((a, i) => a + i.minutes, 0) / Math.max(1, diffDays(today, lastDay) + 1)) : null;
  res.json({ scheduled: rows.length, finishDay, fits, needPerDay, perDay, totalMin: total, planRest: [...rest], planEnd: span >= 1 && span <= 730 ? addDays(today, span - 1) : finishDay });
});
app.delete('/api/plan', auth, (req, res) => { db.prepare('DELETE FROM plan WHERE user_id=?').run(req.user.id); db.prepare('UPDATE users SET plan_end=NULL WHERE id=?').run(req.user.id); res.json({ ok: true }); });

// --- community ---
function rankedUsers(today) {
  return q.allUsers.all().filter(u => u.is_public).map(u => {
    const s = userStats(u.id, today);
    return {
      username: u.username, displayName: u.display_name, streak: s.streak, longest: s.longest,
      weekMinutes: s.weekMinutes, totalDone: s.totalDone, totalItems: s.totalItems, readiness: s.readiness,
      studiedToday: s.studiedToday,
    };
  });
}
app.get('/api/leaderboard', auth, (req, res) => {
  const today = clientDay(req.query.today);
  const users = rankedUsers(today);
  const me = req.user.username;
  if (!req.user.is_public) { // private users see only themselves flagged
    const s = userStats(req.user.id, today);
    users.push({ username: me, displayName: req.user.display_name, streak: s.streak, longest: s.longest, weekMinutes: s.weekMinutes, totalDone: s.totalDone, totalItems: s.totalItems, readiness: s.readiness, studiedToday: s.studiedToday, private: true });
  }
  res.json({ users, me });
});

app.get('/api/feed', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, u.display_name AS displayName, p.item_id AS itemId, p.completed_at AS at
    FROM progress p JOIN users u ON u.id = p.user_id
    WHERE u.is_public = 1 OR u.id = ?
    ORDER BY p.completed_at DESC LIMIT 30`).all(req.user.id);
  res.json({ feed: rows.map(r => ({ ...r, title: items.get(r.itemId)?.title || r.itemId, kind: items.get(r.itemId)?.kind })) });
});


// --- discussions (live chat rooms) ---
db.exec(`
CREATE TABLE IF NOT EXISTS disc_messages (
  id INTEGER PRIMARY KEY, channel TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS disc_messages_ch ON disc_messages(channel, id);
`);
const CHANNELS = [
  { id: 'general', icon: '💬', name: 'General', desc: 'Anything about the CKA or this app that does not fit another channel.' },
  { id: 'getting-started', icon: '🚀', name: 'Getting started', desc: 'New to Kubernetes? Ask beginner questions, pick a study plan, choose a lab setup.' },
  { id: 'core-concepts', icon: '🧩', name: 'Core concepts & architecture', desc: 'Pods, ReplicaSets, Deployments, Services, namespaces, control plane components.' },
  { id: 'scheduling', icon: '📅', name: 'Scheduling', desc: 'Taints, tolerations, affinity, resource limits, DaemonSets, static pods.' },
  { id: 'app-config', icon: '⚙️', name: 'Configuration & app lifecycle', desc: 'ConfigMaps, Secrets, env vars, rollouts, probes, multi-container pods.' },
  { id: 'security', icon: '🔐', name: 'Security & RBAC', desc: 'Certificates, kubeconfig, RBAC, service accounts, security contexts, network policies.' },
  { id: 'storage', icon: '💾', name: 'Storage', desc: 'Volumes, PersistentVolumes, PVCs, StorageClasses, CSI.' },
  { id: 'networking', icon: '🌐', name: 'Networking & Ingress', desc: 'CNI, services, DNS, CoreDNS, Ingress, Gateway API.' },
  { id: 'cluster-ops', icon: '🛠️', name: 'Install, upgrade & etcd', desc: 'kubeadm installs, HA clusters, upgrades, drain/cordon, etcd backup and restore.' },
  { id: 'troubleshooting', icon: '🔍', name: 'Troubleshooting', desc: 'Broken pods, nodes, control plane and network. Share errors and how you fixed them.' },
  { id: 'labs', icon: '🧪', name: 'Labs & practice tests', desc: 'Stuck on a lab or mock exam question? Ask here (describe the task, not the answer key).' },
  { id: 'exam-tips', icon: '🎯', name: 'Exam tips & strategy', desc: 'Time management, kubectl speed tricks, the exam environment, booking and renewals.' },
  { id: 'study-groups', icon: '🤝', name: 'Study groups & accountability', desc: 'Find a study buddy, share your schedule, keep each other on track.' },
  { id: 'wins', icon: '🏆', name: 'Wins & exam results', desc: 'Passed? Hit a streak milestone? Celebrate here.' },
];
const CHAN = new Map(CHANNELS.map(c => [c.id, c]));
const cleanText = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const discLimiter = new Map();
function discRate(req, res, next) { // max 30 messages per minute per user
  const now = Date.now(), arr = (discLimiter.get(req.user.id) || []).filter(t => now - t < 60000);
  if (arr.length >= 30) return res.status(429).json({ error: 'You are sending messages too fast. Wait a moment.' });
  arr.push(now); discLimiter.set(req.user.id, arr); next();
}
const msgOut = r => ({ id: r.id, body: r.body, createdAt: r.createdAt, author: { username: r.username, displayName: r.display_name } });
app.get('/api/discussions', auth, (req, res) => {
  const rows = db.prepare('SELECT channel, COUNT(*) AS n, MAX(created_at) AS last FROM disc_messages GROUP BY channel').all();
  const m = new Map(rows.map(r => [r.channel, r]));
  res.json({ channels: CHANNELS.map(c => ({ ...c, messages: m.get(c.id)?.n || 0, lastAt: m.get(c.id)?.last || null })) });
});
app.get('/api/discussions/channel/:ch', auth, (req, res) => {
  const ch = CHAN.get(req.params.ch); if (!ch) return res.status(404).json({ error: 'Unknown channel' });
  const after = Number(req.query.after) || 0;
  const sel = 'SELECT m.id, m.body, m.created_at AS createdAt, u.username, u.display_name FROM disc_messages m JOIN users u ON u.id = m.user_id';
  const rows = after
    ? db.prepare(sel + ' WHERE m.channel = ? AND m.id > ? ORDER BY m.id LIMIT 200').all(ch.id, after)
    : db.prepare(sel + ' WHERE m.channel = ? ORDER BY m.id DESC LIMIT 150').all(ch.id).reverse();
  res.json({ channel: ch, me: req.user.username, messages: rows.map(msgOut) });
});
app.post('/api/discussions/channel/:ch', auth, discRate, (req, res) => {
  const ch = CHAN.get(req.params.ch); if (!ch) return res.status(404).json({ error: 'Unknown channel' });
  const body = cleanText(req.body?.body, 3000); if (!body) return res.status(400).json({ error: 'Write a message first.' });
  const r = db.prepare('INSERT INTO disc_messages (channel, user_id, body, created_at) VALUES (?,?,?,?)').run(ch.id, req.user.id, body, Date.now());
  res.json({ id: Number(r.lastInsertRowid) });
});
app.delete('/api/discussions/message/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM disc_messages WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: r.changes > 0 });
});

app.get('/api/users/:username', auth, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u || (!u.is_public && u.id !== req.user.id)) return res.status(404).json({ error: 'User not found or private' });
  const s = userStats(u.id, clientDay(req.query.today));
  res.json({ user: publicUser(u), joined: u.created_at, examDate: u.exam_date, stats: s });
});

// --- lesson content ---
const renderer = new marked.Renderer();
const lessonCache = new Map();
function renderedLesson(id) {
  let c = lessonCache.get(id);
  if (c) return c;
  const file = path.join(DOCS_DIR, id + '.md');
  if (!file.startsWith(DOCS_DIR) || !fs.existsSync(file)) return null;
  let md = fs.readFileSync(file, 'utf8');
  // rewrite repo-relative image paths to our static images folder
  md = md.replace(/\(((?:\.\.\/)+)images\//g, '(/content/images/')
         .replace(/src="((?:\.\.\/)+)images\//g, 'src="/content/images/');
  md = stripKodeKloud(md);
  c = { html: marked.parse(md, { renderer, gfm: true, breaks: false }), guideHtml: guides[id] ? marked.parse(guides[id], { gfm: true }) : '' };
  lessonCache.set(id, c);
  return c;
}
app.get('/api/lesson/*', auth, (req, res) => {
  const id = req.params[0];
  const it = items.get(id);
  if (!it) return res.status(404).json({ error: 'Unknown lesson' });
  const c = renderedLesson(id);
  if (!c) return res.status(404).json({ error: 'Missing file' });
  // Cacheable (so hover-prefetch makes the lesson open instantly); the visit is recorded by POST /api/visit.
  res.setHeader('Cache-Control', 'private, max-age=120');
  res.json({ item: it, html: c.html, guideHtml: c.guideHtml, embeds: loadEmbeds()[id] || [] });
});
// Opening a lesson counts as a visit (shown as a green dot in the lists).
app.post('/api/visit/*', auth, (req, res) => {
  const id = req.params[0];
  if (!items.has(id)) return res.status(404).json({ error: 'Unknown lesson' });
  db.prepare('INSERT OR IGNORE INTO visits (user_id, item_id, first_opened) VALUES (?,?,?)').run(req.user.id, id, Date.now());
  res.json({ ok: true });
});

// Remove links that point at KodeKloud's site ("Take me to Video Tutorial" lines and inline lecture/lab links).
function stripKodeKloud(md) {
  return md
    .split('\n')
    .filter(line => !/^\s*[-*]?\s*(take me to|go to)\b.*\]\(https?:\/\/[\w.-]*kodekloud\.com[^)]*\)/i.test(line))
    .join('\n')
    .replace(/^(\s*(?:#+\s*)?Solutions?\b[^\n]*?)(?:the\s+)?practice tests?/gim, '$1KodeKloud Lab')
    .replace(/\[([^\]]*)\]\(https?:\/\/[\w.-]*kodekloud\.com[^)]*\)/gi, '$1');
}

app.get('/api/notes', auth, (req, res) => {
  const id = String(req.query.id || '');
  const sec = curriculum.sections.find(s => s.id === id);
  if (!sec) return res.status(404).json({ error: 'Unknown section' });
  const file = path.join(__dirname, 'content', 'notes', id.replace(/\//g, '__') + '.md');
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'No notes for this section yet' });
  const html = marked.parse(fs.readFileSync(file, 'utf8'), { gfm: true });
  res.json({ section: { id: sec.id, title: sec.title, count: sec.lessons.length }, html });
});

app.use('/content/images', express.static(path.join(__dirname, 'content', 'images'), { maxAge: '7d', immutable: true }));
// Assets are requested as /file.js?v=<mtime>; versioned URLs are cached for a year, so repeat loads are instant
// and a changed file gets a new URL automatically.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true, index: false,
  setHeaders: (res, file) => {
    if (res.req.query.v) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    else res.setHeader('Cache-Control', /\.(jpe?g|png|svg|webp)$/.test(file) ? 'public, max-age=86400' : 'no-cache');
  },
}));
function indexHtml() {
  const dir = path.join(__dirname, 'public');
  let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  return html.replace(/(href|src)="(\/(?:style\.css|logo\.js|intro\.js|app\.js))"/g, (m, a, f) => {
    let v = 0; try { v = Math.round(fs.statSync(path.join(dir, f)).mtimeMs); } catch {}
    return `${a}="${f}?v=${v}"`;
  });
}
app.get('*', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.type('html').send(indexHtml()); });

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });
app.listen(PORT, () => console.log(`CKA tracker on http://localhost:${PORT}`));
