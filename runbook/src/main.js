/* ---------- main.js: hash router and boot ---------- */
let currentRoute = '';
const PASSIVE = /^(today|path|tests|review|prefs|guide|glossary|d\d\d)$/;
function navKey(r) {
  if (r === 'today' || r === '') return 'today';
  if (r === 'path' || /^d\d\d/.test(r)) return 'path';
  if (r === 'tests' || /^test-|^practice/.test(r)) return 'tests';
  return r;
}
function updateNav() {
  const k = navKey(currentRoute);
  $$('.nav a').forEach((a) => { if (a.dataset.nav === k) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const n = dueCards().length, b = $('#nav-due');
  if (b) { b.hidden = !n; b.textContent = n > 99 ? '99+' : String(n); }
}
function route(first) {
  const r = (location.hash || '').replace(/^#/, '') || 'today';
  currentRoute = r;
  Quiz.s = null;
  const main = $('#main');
  let m;
  try {
    if (r === 'today') renderToday(main);
    else if (r === 'path') renderPath(main);
    else if (r === 'tests') renderTests(main);
    else if (r === 'review') renderReview(main);
    else if (r === 'guide') renderGuide(main);
    else if (r === 'glossary') renderGlossary(main);
    else if (r === 'prefs') renderPrefs(main);
    else if (r === 'practice') renderPractice(main, null);
    else if ((m = /^practice-(d\d\d|tag-[a-z0-9-]+)$/.exec(r))) renderPractice(main, m[1]);
    else if ((m = /^test-(c\d+|final|placement)$/.exec(r))) renderTest(main, m[1]);
    else if ((m = /^(d\d\d)$/.exec(r)) && DAY[m[1]]) renderDay(main, m[1]);
    else if ((m = /^(d\d\d)-l(\d+)$/.exec(r)) && DAY[m[1]]) renderLesson(main, m[1], +m[2]);
    else if ((m = /^(d\d\d)-quiz$/.exec(r)) && DAY[m[1]]) renderDayQuiz(main, m[1]);
    else if ((m = /^(d\d\d)-x(\d+)$/.exec(r)) && DAY[m[1]]) renderDrill(main, m[1], +m[2]);
    else main.innerHTML = notFoundHTML();
  } catch (e) {
    console.error(e);
    main.innerHTML = '<div class="empty"><b>This view failed to draw.</b><span>' + esc(e.message) + '</span><a class="btn" href="#today">Go to today</a></div>';
  }
  updateNav();
  document.title = 'Thirty-Day Backend Runbook';
  if (!first) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
}
window.addEventListener('hashchange', () => route(false));
onState(() => {
  updateNav();
  if (!PASSIVE.test(currentRoute)) return;
  const y = window.scrollY;
  const active = document.activeElement && document.activeElement.id;
  route(true);
  window.scrollTo(0, y);
  if (active) { const el = document.getElementById(active); if (el) el.focus({ preventScroll: true }); }
});
/* Weak spots by tag need the day files; redraw Today once they arrive (debounced, never mid-typing in setup). */
const refreshToday = debounce(() => {
  if (currentRoute !== 'today' || $('#setup-form') || $('#shift-slot .panel')) return;
  const y = window.scrollY; route(true); window.scrollTo(0, y);
}, 800);
dayLoadListeners.push((id) => {
  if (currentRoute === 'guide') drawGuide();
  if (currentRoute === 'glossary') drawGlossary();
  if (currentRoute === 'today' && Object.keys(S.review).some((q) => q.slice(0, 3) === id)) refreshToday();
});

route(true);
setTimeout(() => {
  startSync();
  initTutor();
  loadAllDays();
}, 0);
