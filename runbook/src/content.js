/* ---------- content.js: curriculum index, day files, derived progress ---------- */
const CUR = JSON.parse(document.getElementById('curriculum').textContent);
const PHASES = CUR.phases;
const PHASE = {}; PHASES.forEach((p, i) => { PHASE[p.id] = Object.assign({ n: i + 1 }, p); });
const ALL_DAYS = CUR.days.slice().sort((a, b) => a.day - b.day);
const DAYS = ALL_DAYS.filter((d) => d.day >= 1);
const DAY = {}; ALL_DAYS.forEach((d) => { DAY[d.id] = d; });
const CHECKS = CUR.checkpoints;
function phaseVar(pid) { return 'var(--' + (PHASE[pid] ? pid : 'p6') + ')'; }
function phaseOfDay(id) { return PHASE[(DAY[id] || {}).phase] || null; }

/* ----- day files: fetched on demand, cached in memory ----- */
const dayCache = new Map();
const dayLoads = new Map();
const QINDEX = {}; // qid -> {q, day}
const dayLoadListeners = [];
function loadDay(id) {
  if (dayCache.has(id)) return Promise.resolve(dayCache.get(id));
  if (dayLoads.has(id)) return dayLoads.get(id);
  const meta = DAY[id];
  if (!meta || !meta.available) return Promise.resolve(null);
  const p = fetch('data/' + id + '.json', { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then((d) => {
    if (!d || !Array.isArray(d.lessons) || !Array.isArray(d.quiz)) throw new Error('This day file is not in the expected shape.');
    d.lessons = d.lessons || []; d.quiz = d.quiz || []; d.drills = d.drills || []; d.fieldGuide = d.fieldGuide || []; d.glossary = d.glossary || [];
    d.quiz.forEach((q) => { QINDEX[q.id] = { q: q, day: id }; });
    dayCache.set(id, d);
    dayLoads.delete(id);
    dayLoadListeners.forEach((fn) => { try { fn(id); } catch (e) { console.warn(e); } });
    return d;
  }).catch((e) => { dayLoads.delete(id); throw e; });
  dayLoads.set(id, p);
  return p;
}
const BG = { started: false, done: 0, total: 0, failed: 0 };
function loadAllDays() {
  if (BG.started) return;
  BG.started = true;
  const ids = ALL_DAYS.filter((d) => d.available).map((d) => d.id);
  BG.total = ids.length;
  let i = 0;
  const worker = () => {
    if (i >= ids.length) return Promise.resolve();
    const id = ids[i++];
    return loadDay(id).then(() => { BG.done++; }, () => { BG.failed++; }).then(() => { refreshLoadNotes(); return worker(); });
  };
  Promise.all([worker(), worker(), worker()]).then(() => refreshLoadNotes());
}
function loadedCountText() {
  const n = ALL_DAYS.filter((d) => d.available && dayCache.has(d.id)).length;
  const avail = ALL_DAYS.filter((d) => d.available).length;
  let t = 'Loaded ' + n + ' of ' + avail + ' written days';
  const unwritten = DAYS.filter((d) => !d.available).length;
  if (unwritten) t += ' (' + unwritten + ' not written yet)';
  if (BG.failed) t += ', ' + BG.failed + ' failed to load';
  return t;
}
function refreshLoadNotes() { $$('[data-loadnote]').forEach((el) => { el.textContent = loadedCountText(); }); }
function ensureDays(ids) { return Promise.all(ids.filter((id) => DAY[id] && DAY[id].available).map((id) => loadDay(id).catch(() => null))); }

/* ----- derived progress ----- */
function lessonIds(meta) { return (meta.lessons || []).map((l, i) => l.id || meta.id + '-l' + (i + 1)); }
function lessonsDoneFrac(meta) { const ids = lessonIds(meta); if (!ids.length) return 0; return ids.filter((x) => S.lessons[x]).length / ids.length; }
function quizBest(id) { const r = S.quiz[id]; return r ? r.best || 0 : 0; }
function drillIds(meta) { return (meta.drills || []).map((d) => d.id); }
function drillsDoneFrac(meta) { const ids = drillIds(meta); if (!ids.length) return 0; return ids.filter((x) => S.drills[x] && S.drills[x].attempts).length / ids.length; }
function mastery(meta) { return 0.4 * lessonsDoneFrac(meta) + 0.4 * quizBest(meta.id) + 0.2 * drillsDoneFrac(meta); }
function isDayDone(meta) { const ids = lessonIds(meta); return ids.length > 0 && ids.every((x) => S.lessons[x]) && quizBest(meta.id) >= 0.7; }
function dayStatus(meta) {
  if (!meta.available) return 'unwritten';
  if (isDayDone(meta)) return 'done';
  if (mastery(meta) > 0 || (S.apply[meta.id] && S.apply[meta.id].done)) return 'started';
  return 'new';
}
const STATUS_TEXT = { unwritten: 'not written', done: 'done', started: 'in progress', new: 'not started' };
function currentDay() { return DAYS.find((d) => !isDayDone(d)) || DAYS[DAYS.length - 1]; }
function doneCount() { return DAYS.filter(isDayDone).length; }
function calendarDay() { if (!S.settings.start) return 1; return daysBetween(S.settings.start, isoDate()) + 1; }
function paceInfo() {
  const cal = calendarDay(), done = doneCount();
  if (!S.settings.start) return { text: 'No start date set', diff: 0, cal: cal };
  if (cal < 1) return { text: 'Starts ' + fmtDate(S.settings.start), diff: 0, cal: cal };
  const target = Math.min(cal, 30);
  const ahead = done - target, behind = (target - 1) - done;
  if (ahead > 0) return { text: plural(ahead, 'day') + ' ahead', diff: ahead, cal: cal };
  if (behind > 0) return { text: plural(behind, 'day') + ' behind', diff: -behind, cal: cal };
  return { text: 'On pace', diff: 0, cal: cal };
}
function streak() {
  let n = 0; let d = isoDate();
  if (!S.activity[d]) d = addDays(d, -1);
  while (S.activity[d]) { n++; d = addDays(d, -1); }
  return n;
}
function dueCards() { const t = isoDate(); return Object.keys(S.review).filter((k) => S.review[k].due <= t).sort((a, b) => (S.review[a].due < S.review[b].due ? -1 : 1)); }
function nextDueDate() { const t = isoDate(); let m = null; Object.values(S.review).forEach((c) => { if (c.due > t && (!m || c.due < m)) m = c.due; }); return m; }
function weakSpots() {
  const byDay = {}, byTag = {};
  Object.keys(S.review).forEach((qid) => {
    const c = S.review[qid]; const d = qid.slice(0, 3);
    if (!DAY[d]) return;
    (byDay[d] = byDay[d] || { seen: 0, right: 0 }); byDay[d].seen += c.seen || 0; byDay[d].right += c.right || 0;
    const qi = QINDEX[qid];
    if (qi && qi.q.tags) qi.q.tags.forEach((t) => { (byTag[t] = byTag[t] || { seen: 0, right: 0, days: new Set() }); byTag[t].seen += c.seen || 0; byTag[t].right += c.right || 0; byTag[t].days.add(d); });
  });
  const out = [];
  Object.keys(byDay).forEach((d) => { const v = byDay[d]; if (v.seen >= 3) out.push({ kind: 'day', key: d, label: 'Day ' + DAY[d].day + ': ' + DAY[d].title, acc: v.right / v.seen, seen: v.seen }); });
  Object.keys(byTag).forEach((t) => { const v = byTag[t]; if (v.seen >= 2) out.push({ kind: 'tag', key: t, label: t, acc: v.right / v.seen, seen: v.seen }); });
  return out.filter((x) => x.acc < 0.8).sort((a, b) => a.acc - b.acc || b.seen - a.seen).slice(0, 5);
}
