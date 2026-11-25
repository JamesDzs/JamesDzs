/* ---------- store.js: one versioned state object, localStorage, merge, account sync ---------- */
const LS_KEY = 'rb_state_v1';
const BOXES = [1, 2, 4, 7, 14];

function freshState(resetAt) {
  return {
    v: 1, resetAt: resetAt || 0,
    settings: { start: null, note: '', setup: false, ts: 0 },
    lessons: {},   // lessonId -> ts completed
    apply: {},     // dayId -> {done, ts}
    quiz: {},      // dayId -> {best, last, attempts, ts}
    tests: {},     // c1..final, custom -> {best, last, attempts, ts}
    drills: {},    // drillId -> {best, last, attempts, ts}
    placement: null, // {ts, score, total, byDay: {d01: 1|0}}
    activity: {},  // 'YYYY-MM-DD' -> ts
    review: {}     // questionId -> {box, due, seen, right, last}
  };
}
function normalize(o) {
  const f = freshState();
  if (!o || typeof o !== 'object' || o.v !== 1) return f;
  for (const k of Object.keys(f)) if (o[k] == null || typeof o[k] !== typeof f[k]) o[k] = f[k];
  if (o.placement !== null && typeof o.placement !== 'object') o.placement = null;
  o.settings = Object.assign({}, f.settings, o.settings);
  return o;
}
let S = (function () { try { return normalize(JSON.parse(lsGet(LS_KEY) || 'null')); } catch (e) { return freshState(); } })();

function saveLocal() { lsSet(LS_KEY, JSON.stringify(S)); }
const listeners = [];
function onState(fn) { listeners.push(fn); }
function commit(opts) {
  saveLocal();
  Sync.schedule();
  if (!(opts && opts.quiet)) listeners.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
}
function touchActivity() { S.activity[isoDate()] = Date.now(); }

/* ----- mutations ----- */
function setSettings(patch) { S.settings = Object.assign({}, S.settings, patch, { ts: Date.now() }); commit(); }
function completeLesson(id) { if (!S.lessons[id]) { S.lessons[id] = Date.now(); touchActivity(); commit({ quiet: true }); } }
function setApply(day, done) { S.apply[day] = { done: !!done, ts: Date.now() }; if (done) touchActivity(); commit({ quiet: true }); }
function recordResult(bucket, key, score) {
  const prev = S[bucket][key] || { best: 0, last: 0, attempts: 0 };
  S[bucket][key] = { best: Math.max(prev.best || 0, score), last: score, attempts: (prev.attempts || 0) + 1, ts: Date.now() };
  touchActivity(); commit({ quiet: true });
}
function recordPlacement(p) { S.placement = Object.assign({ ts: Date.now() }, p); touchActivity(); commit({ quiet: true }); }
/* Leitner boxes: first answer wrong -> 1, right -> 2; right moves up, wrong returns to 1. */
function reviewAnswer(qid, right) {
  const today = isoDate();
  const c = S.review[qid];
  let box;
  if (!c) box = right ? 2 : 1;
  else box = right ? Math.min(5, (c.box || 1) + 1) : 1;
  S.review[qid] = { box, due: addDays(today, BOXES[box - 1]), seen: ((c && c.seen) || 0) + 1, right: ((c && c.right) || 0) + (right ? 1 : 0), last: Date.now() };
  touchActivity();
  commit({ quiet: true });
}
function resetAll() {
  const now = Date.now();
  const note = S.settings.note;
  S = freshState(now);
  S.settings = { start: null, note: note, setup: false, ts: now };
  commit();
}

/* ----- merge: union of completed items, newest wins per key, reset tombstone ----- */
function tsOf(v) { if (typeof v === 'number') return v; if (v && typeof v === 'object') return v.ts || v.last || 0; return 0; }
function mergeMap(a, b, R, pick) {
  const out = {};
  const keys = new Set(Object.keys(a || {}).concat(Object.keys(b || {})));
  keys.forEach((k) => {
    const x = a && a[k], y = b && b[k];
    let v = x == null ? y : y == null ? x : pick(x, y);
    if (v != null && tsOf(v) >= R) out[k] = v;
  });
  return out;
}
const newer = (x, y) => (tsOf(y) > tsOf(x) ? y : x);
const pickResult = (x, y) => { const n = newer(x, y); return Object.assign({}, n, { best: Math.max(x.best || 0, y.best || 0), attempts: Math.max(x.attempts || 0, y.attempts || 0) }); };
function mergeState(a, b) {
  const R = Math.max(a.resetAt || 0, b.resetAt || 0);
  const r = freshState(R);
  const sa = a.settings, sb = b.settings;
  r.settings = Object.assign({}, freshState().settings, sb && tsOf(sb) > tsOf(sa) ? sb : sa);
  r.lessons = mergeMap(a.lessons, b.lessons, R, (x, y) => Math.min(x, y));
  r.apply = mergeMap(a.apply, b.apply, R, newer);
  r.quiz = mergeMap(a.quiz, b.quiz, R, pickResult);
  r.tests = mergeMap(a.tests, b.tests, R, pickResult);
  r.drills = mergeMap(a.drills, b.drills, R, pickResult);
  r.activity = mergeMap(a.activity, b.activity, R, (x, y) => Math.max(x, y));
  r.review = mergeMap(a.review, b.review, R, newer);
  const pa = a.placement, pb = b.placement;
  const p = pa && pb ? newer(pa, pb) : pa || pb || null;
  r.placement = p && tsOf(p) >= R ? p : null;
  return r;
}
function stableStr(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stableStr).join(',') + ']';
  return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStr(v[k])).join(',') + '}';
}

/* ----- account sync through the db + user capabilities ----- */
const DOCS = ['progress', 'review'];
function docPart(name, st) {
  if (name === 'review') return { v: 1, resetAt: st.resetAt, review: st.review };
  const o = Object.assign({}, st); delete o.review; return o;
}
function partIsEmpty(name, st) { return stableStr(docPart(name, st)) === stableStr(docPart(name, freshState(st.resetAt))) && !st.settings.ts; }

const Sync = {
  kind: 'local', text: 'Saved in this browser only', detail: 'Progress is kept in this browser. Account sync is not available in this view.',
  refs: null, loaded: {}, last: {}, writing: {}, dirty: {}, halted: false, retried: {},
  schedule: function () { /* replaced once sync starts */ },
  set: function (kind, text, detail) {
    this.kind = kind; this.text = text; this.detail = detail || '';
    const pill = $('#sync-pill');
    if (pill) { pill.dataset.state = kind; $('#sync-text').textContent = text; pill.title = detail || text; }
    const ps = $('#prefs-sync'); if (ps) renderSyncBox(ps);
  }
};

function startSync() {
  Sync.set('local', 'Saved in this browser only', 'Progress is kept in this browser. Account sync is not available in this view.');
  const C = window.claude;
  if (!C || typeof C.use !== 'function') return;
  Sync.set('working', 'Connecting', 'Looking for your Claude account.');
  withTimeout(Promise.all([C.use('db'), C.use('user')]), 10000).then(async (pair) => {
    const db = pair && pair[0], user = pair && pair[1];
    if (!db || !user) { Sync.set('local', 'Saved in this browser only', 'This view cannot reach your Claude account, so progress stays in this browser.'); return; }
    let uid = null;
    try { uid = await withTimeout(user.id(), 10000); } catch (e) { uid = null; }
    if (!uid) { Sync.set('local', 'Saved in this browser only', 'Sign in to Claude to keep progress in sync between devices.'); return; }
    try {
      Sync.refs = {};
      DOCS.forEach((n) => { Sync.refs[n] = db.collection('data/users/' + uid).doc(n); });
    } catch (e) { Sync.set('paused', 'Sync paused', 'The account store rejected the path. Progress is saved in this browser.'); return; }
    Sync.schedule = debounce(flushSync, 1500);
    const timer = setTimeout(() => {
      if (!(Sync.loaded.progress && Sync.loaded.review)) Sync.set('paused', 'Sync paused', 'Your Claude account did not answer within 10 seconds. Progress is saved in this browser and will sync when it answers.');
    }, 10000);
    DOCS.forEach((n) => {
      Sync.refs[n].onSnapshot((snap) => {
        if (snap.metadata && snap.metadata.hasPendingWrites) return;
        const data = snap.exists ? snap.data() : null;
        if (!(snap.metadata && snap.metadata.fromCache)) {
          Sync.loaded[n] = true;
          Sync.last[n] = data ? stableStr(data) : null;
          if (Sync.loaded.progress && Sync.loaded.review) { clearTimeout(timer); if (!Sync.halted) Sync.set('synced', 'Synced to your Claude account', 'Progress follows you between devices signed in to this Claude account.'); }
        }
        if (data) {
          const before = stableStr(S);
          const merged = mergeState(S, normalizePart(n, data));
          if (stableStr(merged) !== before) { S = merged; saveLocal(); listeners.forEach((fn) => { try { fn({ remote: true }); } catch (e) { console.warn(e); } }); }
        }
        if (Sync.loaded[n]) Sync.schedule();
      }, (err) => {
        clearTimeout(timer);
        syncError(err, n);
      });
    });
  }).catch(() => Sync.set('local', 'Saved in this browser only', 'This view cannot reach your Claude account, so progress stays in this browser.'));
}
function normalizePart(name, data) {
  const f = freshState(data.resetAt || 0);
  if (name === 'review') { f.review = data.review && typeof data.review === 'object' ? data.review : {}; f.settings.ts = -1; return f; }
  const o = Object.assign(f, data); o.review = {};
  return normalize(o);
}
function syncError(err, name) {
  const code = (err && err.code) || 'unavailable';
  if (code === 'invalid_argument') { Sync.halted = true; Sync.set('paused', 'Sync paused', 'Your Claude account would not accept this save, so progress stays in this browser.'); }
  else if (code === 'quota_exceeded') { Sync.halted = true; Sync.set('paused', 'Sync paused', 'The account store is full. Progress is saved in this browser.'); }
  else if (code === 'resource_exhausted') { Sync.set('paused', 'Sync paused', 'Too many saves in a short time. The next change will try again.'); }
  else if (code === 'revoked' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') { Sync.halted = true; Sync.set('local', 'Saved in this browser only', 'Account sync was switched off for this page. Progress is saved in this browser.'); }
  else { Sync.set('paused', 'Sync paused', 'Your Claude account is not reachable right now. Progress is saved in this browser.'); }
}
async function flushSync() {
  if (Sync.halted || !Sync.refs) return;
  for (const n of DOCS) {
    if (!Sync.loaded[n]) continue;
    if (Sync.writing[n]) { Sync.dirty[n] = true; continue; }
    const body = docPart(n, S), ser = stableStr(body);
    if (ser === Sync.last[n]) continue;
    if (Sync.last[n] == null && partIsEmpty(n, S)) continue;
    Sync.writing[n] = true;
    try {
      await Sync.refs[n].set(JSON.parse(JSON.stringify(body)));
      Sync.last[n] = ser; Sync.retried[n] = false;
      if (!Sync.halted) Sync.set('synced', 'Synced to your Claude account', 'Progress follows you between devices signed in to this Claude account.');
    } catch (e) {
      const code = (e && e.code) || 'unavailable';
      if ((code === 'unavailable' || !e || !e.code) && !Sync.retried[n]) {
        Sync.retried[n] = true; Sync.dirty[n] = true;
        setTimeout(() => Sync.schedule(), 1500 + Math.random() * 2500);
      } else syncError(e, n);
    } finally {
      Sync.writing[n] = false;
      if (Sync.dirty[n]) { Sync.dirty[n] = false; Sync.schedule(); }
    }
  }
}
function renderSyncBox(el) {
  el.innerHTML = '<div class="row"><span class="chip ' + (Sync.kind === 'synced' ? 'chip-ok' : Sync.kind === 'paused' ? 'chip-warn' : '') + '">' + esc(Sync.text) + '</span></div><p class="small muted">' + esc(Sync.detail) + '</p>';
}
