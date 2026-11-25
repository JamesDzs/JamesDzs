/* ---------- views.js ---------- */
function dayLabel(meta) { return meta.day ? 'Day ' + meta.day : 'Example'; }
function ptag(pid, text) { return '<span class="ptag" style="--ph:' + phaseVar(pid) + '">' + esc(text || (PHASE[pid] ? PHASE[pid].name : '')) + '</span>'; }
function continueTarget(meta) {
  const ids = lessonIds(meta);
  const l = ids.findIndex((x) => !S.lessons[x]);
  if (l >= 0) return { href: '#' + ids[l], label: (ids.slice(0, l).some((x) => S.lessons[x]) || l > 0 ? 'Continue with lesson ' : 'Start lesson ') + (l + 1) };
  if (quizBest(meta.id) < 0.7) return { href: '#' + meta.id + '-quiz', label: 'Take the quiz' };
  const d = (meta.drills || []).find((x) => !(S.drills[x.id] && S.drills[x.id].attempts));
  if (d) return { href: '#' + d.id, label: 'Run the drill: ' + d.title };
  return null;
}
function viewHead(eyebrow, title, sub) {
  return '<div class="view-head">' + (eyebrow ? '<div class="eyebrow">' + eyebrow + '</div>' : '') + '<h1 class="view-title">' + esc(title) + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>';
}
function lessonListHTML(meta) {
  const ids = lessonIds(meta);
  const next = ids.findIndex((x) => !S.lessons[x]);
  return '<ol class="lesson-list" aria-label="Lessons">' + (meta.lessons || []).map((l, i) => {
    const done = !!S.lessons[ids[i]];
    return '<li class="' + (done ? 'done' : i === next ? 'next' : '') + '"><a href="#' + ids[i] + '"><span class="tick" aria-hidden="true">' + (done ? '&#10003;' : i + 1) + '</span><span class="lt">' + esc(l.title) + '<span>' + (done ? 'Completed' : i === next ? 'Up next' : 'Not started') + '</span></span><span class="lm">' + (l.minutes ? l.minutes + ' min' : '') + '</span></a></li>';
  }).join('') + '</ol>';
}

/* ---------- trace strip (Today) ---------- */
function traceStrip(cur) {
  const cps = new Set(CHECKS.map((c) => c.afterDay));
  return '<div><div class="strip" role="list" aria-label="Thirty days, filled by mastery">' + DAYS.map((d) => {
    const m = d.available ? mastery(d) : 0;
    return '<a role="listitem" href="#' + d.id + '" style="--ph:' + phaseVar(d.phase) + '" class="' + (d.available ? '' : 'missing ') + (cur && cur.id === d.id ? 'current ' : '') + (cps.has(d.day) && d.day < 30 ? 'cp-after' : '') + '" title="Day ' + d.day + ': ' + esc(d.title) + ' (' + STATUS_TEXT[dayStatus(d)] + ', ' + pct(m) + '%)" aria-label="Day ' + d.day + ', ' + esc(d.title) + ', ' + STATUS_TEXT[dayStatus(d)] + '"><i style="height:' + Math.max(m > 0 ? 8 : 0, pct(m)) + '%"></i></a>';
  }).join('') + '</div><div class="strip-scale" aria-hidden="true">' + DAYS.map((d) => '<span>' + (d.day === 1 || d.day % 5 === 0 ? d.day : '') + '</span>').join('') + '</div></div>';
}

/* ---------- Today ---------- */
function renderToday(main) {
  const cur = currentDay();
  const pace = paceInfo();
  const done = doneCount();
  const due = dueCards();
  const ws = weakSpots();
  let html = '<div class="view">';
  if (!S.settings.setup) {
    html += '<form class="setup" id="setup-form"><div><div class="eyebrow">First run</div><h2 class="sec-title" style="margin-top:6px">Set up your thirty days</h2></div>' +
      '<p class="small muted" style="max-width:var(--measure)">The start date sets your pace. Nothing is locked: open any day in any order. The note helps the tutor tie answers to your own work.</p>' +
      '<div class="setup-grid"><div class="field"><label for="setup-start">Start date</label><input type="date" id="setup-start" value="' + esc(S.settings.start || isoDate()) + '" required></div>' +
      '<div class="field"><label for="setup-note">What are you building? <span class="muted">(optional)</span></label><input type="text" id="setup-note" maxlength="300" value="' + esc(S.settings.note) + '" placeholder="For example: a support agent with RAG over our docs, evaluated nightly"></div></div>' +
      '<div class="row"><button type="submit" class="btn btn-primary">Start day 1</button><button type="button" class="btn" data-placement>Save and take the placement test</button><span class="small muted">The placement test asks one question per day and marks the days you likely know.</span></div></form>';
  }
  const ph = PHASE[cur.phase];
  html += '<div class="today-hero" style="--ph:' + phaseVar(cur.phase) + '"><div class="daynum num" aria-label="Day ' + cur.day + ' of 30">' + cur.day + '<small>/30</small></div><div class="t-meta">' +
    '<div class="row">' + ptag(cur.phase) + (cur.minutes ? '<span class="chip">' + cur.minutes + ' min</span>' : '') + '<span class="chip">' + STATUS_TEXT[dayStatus(cur)] + '</span></div>' +
    '<h1>' + esc(cur.title) + '</h1><p class="muted" style="max-width:var(--measure)">' + md(cur.tagline || '') + '</p></div></div>';
  html += '<div class="pace">' + (S.settings.start ? '<span class="chip ' + (pace.diff < 0 ? 'chip-warn' : pace.diff > 0 ? 'chip-ok' : 'chip-accent') + '">' + esc(pace.text) + '</span><span>Calendar day ' + Math.max(1, Math.min(pace.cal, 99)) + ' since ' + esc(fmtDate(S.settings.start)) + ', ' + plural(done, 'day') + ' done.</span>' : '<span>' + plural(done, 'day') + ' done.</span>') +
    (S.settings.start && pace.diff !== 0 ? '<button type="button" class="btn btn-quiet btn-sm" data-shift>Shift my start date</button>' : '') + '</div><div id="shift-slot"></div>';

  html += '<div class="grid2"><div class="sec">';
  if (cur.available) {
    const ct = continueTarget(cur);
    html += '<div class="sec-head"><h2 class="sec-title">Today\'s lessons</h2><a href="#' + cur.id + '" class="small">Open day ' + cur.day + '</a></div>' + lessonListHTML(cur) +
      '<div class="row">' + (ct ? '<a class="btn btn-primary" href="' + ct.href + '">' + esc(ct.label) + '</a>' : '') + '<a class="btn" href="#' + cur.id + '-quiz">Quiz' + (S.quiz[cur.id] ? ', best ' + pct(S.quiz[cur.id].best) + '%' : '') + '</a></div>';
  } else {
    const nextAvail = DAYS.find((d) => d.available && !isDayDone(d));
    html += '<div class="missing-day"><div class="eyebrow">Day ' + cur.day + ' is not written yet</div><p>The lessons for this day are still being written. Its plan is below. ' + (nextAvail ? 'You can keep going with another day in the meantime.' : '') + '</p>' +
      '<ol>' + cur.lessons.map((l) => '<li>' + esc(l.title) + '</li>').join('') + '</ol>' +
      (nextAvail ? '<div><a class="btn btn-primary" href="#' + nextAvail.id + '">Go to day ' + nextAvail.day + ': ' + esc(nextAvail.title) + '</a></div>' : '') + '</div>';
  }
  html += '</div><div class="sec">';
  html += '<div class="panel sec"><div class="sec-head"><h2 class="sec-title">Review</h2><a class="small" href="#review">Open review</a></div>' +
    (due.length ? '<p><b class="num">' + due.length + '</b> ' + (due.length === 1 ? 'card is' : 'cards are') + ' due today.</p><div><a class="btn btn-primary" href="#review">Review ' + Math.min(20, due.length) + ' cards</a></div>'
      : Object.keys(S.review).length ? '<p class="muted">Nothing is due today. The next card is due ' + esc(fmtDate(nextDueDate())) + '.</p>' : '<p class="muted">Cards appear here after you answer quiz questions. Each one returns on a schedule: 1, 2, 4, 7, then 14 days.</p>') + '</div>';
  html += '<div class="stats"><div class="stat"><b>' + streak() + '</b><span>day streak</span></div><div class="stat"><b>' + done + '<span class="muted" style="font-size:.6em">/30</span></b><span>days done</span></div><div class="stat"><b>' + Object.keys(S.lessons).length + '</b><span>lessons read</span></div></div>';
  html += '<div class="sec"><h2 class="sec-title">Weak spots</h2>' + (ws.length ? '<ul class="weak">' + ws.map((w) => '<li><span>' + (w.kind === 'tag' ? '<code class="mono small">' + esc(w.label) + '</code>' : esc(w.label)) + '</span><div class="meter" title="' + pct(w.acc) + '% right"><i style="width:' + pct(w.acc) + '%"></i></div><a class="btn btn-sm" href="#practice-' + (w.kind === 'tag' ? 'tag-' + w.key : w.key) + '">Practice</a></li>').join('') + '</ul>'
    : '<p class="small muted">Topics where you get fewer than 80 percent right show up here once you have answered a few questions on them.</p>') + '</div>';
  html += '</div></div>';
  html += '<div class="sec rule-top"><div class="sec-head"><h2 class="sec-title">Your trace</h2><a class="small" href="#path">Open the full path</a></div>' + traceStrip(cur) + '</div>';
  main.innerHTML = html + '</div>';

  const f = $('#setup-form', main);
  if (f) {
    const save = () => setSettings({ start: $('#setup-start').value || isoDate(), note: $('#setup-note').value.trim(), setup: true });
    f.addEventListener('submit', (e) => { e.preventDefault(); save(); announce('Saved. Day 1 starts ' + fmtDate(S.settings.start) + '.'); });
    $('[data-placement]', f).addEventListener('click', () => { save(); location.hash = 'test-placement'; });
  }
  const sh = $('[data-shift]', main);
  if (sh) sh.addEventListener('click', () => {
    const newStart = addDays(isoDate(), -done);
    const slot = $('#shift-slot');
    slot.innerHTML = '<div class="panel panel-tight row"><span>Move your start date to <b>' + esc(fmtDate(newStart)) + '</b> so that today is day ' + Math.min(30, done + 1) + '.</span><button type="button" class="btn btn-sm btn-primary" data-do>Shift start date</button><button type="button" class="btn btn-sm" data-no>Keep it</button></div>';
    $('[data-do]', slot).addEventListener('click', () => { setSettings({ start: newStart }); announce('Start date moved to ' + fmtDate(newStart)); });
    $('[data-no]', slot).addEventListener('click', () => { slot.innerHTML = ''; sh.focus(); });
  });
}

/* ---------- Path: the trace waterfall ---------- */
function renderPath(main) {
  const cur = currentDay();
  const cps = CHECKS;
  const pos = (d) => (100 * d / 30);
  const cpLines = cps.map((c) => '<span class="cpl" style="left:' + pos(c.afterDay) + '%"></span>').join('');
  const famil = (S.placement && S.placement.byDay) || {};
  let rows = '';
  PHASES.forEach((p) => {
    const ds = DAYS.filter((d) => d.phase === p.id);
    const m = ds.length ? ds.reduce((a, d) => a + (d.available ? mastery(d) : 0), 0) / ds.length : 0;
    const nDone = ds.filter(isDayDone).length;
    rows += '<div class="tr is-phase" style="--ph:' + phaseVar(p.id) + '"><span class="tid">' + p.id.toUpperCase() + '</span><span class="tname">' + esc(p.name) + '</span><span class="tstat">' + nDone + '/' + ds.length + ' done</span>' +
      '<div class="track"><span class="grid"></span>' + cpLines + '<span class="span" style="left:' + pos(p.from - 1) + '%;width:' + pos(p.to - p.from + 1) + '%"><i style="width:' + pct(m) + '%"></i></span></div></div>';
    ds.forEach((d) => {
      const st = dayStatus(d), mm = d.available ? mastery(d) : 0, q = S.quiz[d.id];
      const right = d.day > 24;
      rows += '<a class="tr' + (d.available ? '' : ' is-missing') + (cur.id === d.id ? ' is-current' : '') + '" href="#' + d.id + '" style="--ph:' + phaseVar(d.phase) + '" aria-label="Day ' + d.day + ': ' + esc(d.title) + '. ' + STATUS_TEXT[st] + (q ? ', best quiz ' + pct(q.best) + ' percent' : '') + '">' +
        '<span class="tid">' + d.id + '</span><span class="tname">' + esc(d.title) + (famil[d.id] ? '<span class="famil">likely familiar</span>' : '') + '</span>' +
        '<span class="tstat' + (st === 'done' ? ' done' : '') + '">' + (st === 'unwritten' ? 'not written' : st === 'done' ? 'done' : q ? 'quiz ' + pct(q.best) + '%' : st === 'started' ? pct(mm) + '%' : '&nbsp;') + '</span>' +
        '<div class="track"><span class="grid"></span>' + cpLines + '<span class="span" style="left:' + pos(d.day - 1) + '%;width:' + pos(1) + '%"><i style="width:' + pct(mm) + '%"></i></span>' +
        (d.available && mm > 0 ? '<span class="span-label" style="' + (right ? 'right:' + (100 - pos(d.day - 1)) + '%;padding-right:6px' : 'left:' + pos(d.day) + '%') + '">' + pct(mm) + '%</span>' : '') + '</div></a>';
    });
  });
  const axis = '<div class="axis"><span class="edge" style="left:0%;transform:none">0</span>' + [5, 10, 15, 20, 25].map((n) => '<span style="left:' + pos(n) + '%">' + n + '</span>').join('') + '<span class="edge" style="left:100%;transform:translateX(-100%)">30</span>' +
    cps.map((c) => '<span class="cp" style="left:' + pos(c.afterDay) + '%;' + (c.afterDay === 30 ? 'transform:translateX(-100%)' : '') + '">' + esc(c.id === 'final' ? 'F' : c.id) + '</span>').join('') + '</div>';
  const ex = ALL_DAYS.filter((d) => d.day === 0);
  main.innerHTML = '<div class="view">' + viewHead('Thirty days', 'The path', 'Each phase is a parent span and each day a child span on a thirty-day axis. A span fills as you master the day: lessons count 40 percent, your best quiz score 40, drills 20. Dashed lines mark the checkpoints.') +
    '<div class="trace-legend">' + PHASES.map((p) => '<span><span class="sw" style="background:' + phaseVar(p.id) + '"></span>' + esc(p.name) + '</span>').join('') + '<span><span class="sw" style="border:1px dashed var(--accent);width:0;height:12px"></span>checkpoint</span></div>' +
    '<div class="trace" role="list"><div class="trace-head" aria-hidden="true"><span>Span</span><span>Title</span><span class="th-stat" style="text-align:right">Status</span>' + axis + '</div>' + rows + '</div>' +
    '<div class="row small muted">' + cps.map((c) => '<a href="#test-' + c.id + '">' + esc(c.title) + '</a> <span>after day ' + c.afterDay + '</span>').join('<span aria-hidden="true">&middot;</span>') + '</div>' +
    (ex.length ? '<div class="panel panel-tight row"><span class="chip">Example</span><a href="#' + ex[0].id + '">' + esc(ex[0].title) + '</a><span class="small muted">A sample day for testing. It is not part of the thirty.</span></div>' : '') +
    '</div>';
}

/* ---------- Day ---------- */
function dayHeadHTML(meta) {
  const ph = PHASE[meta.phase];
  return '<div class="day-head" style="--ph:' + phaseVar(meta.phase) + '"><div class="daynum num" aria-hidden="true">' + (meta.day ? pad2(meta.day) : 'Ex') + '</div><div class="view-head">' +
    '<div class="row"><a class="dayid" href="#path">' + esc(meta.id) + '</a>' + ptag(meta.phase) + (meta.minutes ? '<span class="chip">' + meta.minutes + ' min</span>' : '') + '</div>' +
    '<h1>' + esc(dayLabel(meta)) + ': ' + esc(meta.title) + '</h1>' + (meta.tagline ? '<p class="tagline">' + md(meta.tagline) + '</p>' : '') + '</div></div>';
}
function fgRowHTML(r, meta, withDay) {
  return '<details><summary><span class="sym">' + md(r.symptom) + '</span>' + (withDay ? '<span class="ptag" style="--ph:' + phaseVar(meta.phase) + '">' + esc(meta.id) + '</span>' : '<span></span>') + '</summary><dl class="body">' +
    '<dt>Likely causes</dt><dd><ul>' + (r.causes || []).map((c) => '<li>' + md(c) + '</li>').join('') + '</ul></dd>' +
    '<dt>Look first</dt><dd>' + md(r.look) + '</dd><dt>Confirm</dt><dd>' + md(r.confirm) + '</dd><dt>Fix</dt><dd class="fix">' + md(r.fix) + '</dd>' +
    (withDay ? '<dt>Lesson</dt><dd><a href="#' + meta.id + '">' + esc(dayLabel(meta)) + ': ' + esc(meta.title) + '</a></dd>' : '') + '</dl></details>';
}
function missingDayHTML(meta) {
  return '<div class="missing-day"><div class="eyebrow">Not written yet</div><p>This day is planned but its lessons are still being written. Here is what it will cover. Come back later, or keep going with another day.</p>' +
    '<ol>' + (meta.lessons || []).map((l) => '<li>' + esc(l.title) + (l.scope ? '<span>' + esc(l.scope) + '</span>' : '') + '</li>').join('') + '</ol>' +
    '<div class="row"><a class="btn" href="#path">Back to the path</a></div></div>';
}
function renderDay(main, id) {
  const meta = DAY[id];
  main.innerHTML = '<div class="view">' + dayHeadHTML(meta) + '<div id="day-body">' + (meta.available ? '<p class="muted">Loading the day...</p>' : missingDayHTML(meta)) + '</div></div>';
  if (!meta.available) return;
  loadDay(id).then((d) => {
    const body = $('#day-body'); if (!body) return;
    const ap = S.apply[id] && S.apply[id].done;
    const qr = S.quiz[id];
    const m = mastery(meta);
    let html = '<div class="view">';
    html += '<div class="grid2"><div class="sec"><p class="why">' + md(d.why) + '</p><div class="sec"><h2 class="sec-title">By the end of today you can</h2><ul class="objectives">' + (d.objectives || []).map((o) => '<li>' + md(o) + '</li>').join('') + '</ul></div></div>' +
      '<div class="sec"><div class="panel sec"><div class="sec-head"><h2 class="sec-title">Mastery</h2><span class="num mono">' + pct(m) + '%</span></div><div class="meter" style="height:8px"><i style="width:' + pct(m) + '%;background:' + phaseVar(meta.phase) + '"></i></div>' +
      '<p class="small muted">' + (isDayDone(meta) ? 'Day done.' : 'A day is done when every lesson is complete and your best quiz score is at least 70 percent.') + (S.placement && S.placement.byDay && S.placement.byDay[id] ? ' The placement test marked this day as likely familiar.' : '') + '</p>' +
      (continueTarget(meta) ? '<div><a class="btn btn-primary" href="' + continueTarget(meta).href + '">' + esc(continueTarget(meta).label) + '</a></div>' : '') + '</div></div></div>';
    html += '<div class="sec"><h2 class="sec-title">Lessons</h2>' + lessonListHTML(Object.assign({}, meta, { lessons: d.lessons.map((l) => ({ id: l.id, title: l.title, minutes: l.minutes })) })) + '</div>';
    html += '<div class="sec"><h2 class="sec-title">Practice</h2><div class="entry-row">' +
      '<a class="entry" href="#' + id + '-quiz"><span class="eyebrow">Quiz</span><span class="et">' + d.quiz.length + ' questions</span><span class="em">' + (qr ? 'Best ' + pct(qr.best) + '%, last ' + pct(qr.last) + '%, ' + plural(qr.attempts, 'attempt') : 'Not taken yet. Pass mark 80 percent.') + '</span></a>' +
      d.drills.map((x) => { const r = S.drills[x.id]; return '<a class="entry" href="#' + x.id + '"><span class="eyebrow">Incident drill</span><span class="et">' + md(x.title) + '</span><span class="em">' + (r ? 'Best ' + pct(r.best) + '% first-try, ' + plural(r.attempts, 'run') : 'Not run yet') + '</span></a>'; }).join('') + '</div></div>';
    if (d.apply) html += '<div class="sec panel"><div class="sec-head"><div><div class="eyebrow">Apply it to your project &middot; ' + (d.apply.minutes || 15) + ' min</div><h2 class="sec-title" style="margin-top:6px">' + md(d.apply.title) + '</h2></div>' +
      '<button type="button" class="btn ' + (ap ? 'btn-primary' : '') + '" data-apply aria-pressed="' + !!ap + '">' + (ap ? 'Done. Mark as not done' : 'Mark as done') + '</button></div>' +
      '<ol class="apply-steps">' + (d.apply.steps || []).map((s) => '<li>' + md(s) + '</li>').join('') + '</ol></div>';
    if (d.fieldGuide.length) html += '<div class="sec"><div class="sec-head"><h2 class="sec-title">Field guide</h2><a class="small" href="#guide">All days</a></div><div class="fg">' + d.fieldGuide.map((r) => fgRowHTML(r, meta, false)).join('') + '</div></div>';
    if (d.glossary.length) html += '<div class="sec"><h2 class="sec-title">Glossary</h2><dl class="gloss">' + d.glossary.map((g) => '<div><dt>' + md(g.term) + '</dt><dd>' + md(g.def) + '</dd><span></span></div>').join('') + '</dl></div>';
    body.innerHTML = html + '</div>';
    const ab = $('[data-apply]', body);
    if (ab) ab.addEventListener('click', () => { const v = !(S.apply[id] && S.apply[id].done); setApply(id, v); ab.setAttribute('aria-pressed', String(v)); ab.classList.toggle('btn-primary', v); ab.textContent = v ? 'Done. Mark as not done' : 'Mark as done'; announce(v ? 'Exercise marked done' : 'Exercise marked not done'); });
  }).catch((e) => {
    const body = $('#day-body'); if (body) body.innerHTML = '<div class="empty"><b>This day did not load.</b><span>' + esc(String(e && e.message || e)) + '. Check your connection, then reload the page.</span></div>';
  });
}

/* ---------- Lesson reader ---------- */
function renderLesson(main, id, k) {
  const meta = DAY[id];
  if (!meta.available) { renderDay(main, id); return; }
  main.innerHTML = '<div class="view"><p class="muted">Loading the lesson...</p></div>';
  loadDay(id).then((d) => {
    if (!main.isConnected || currentRoute !== id + '-l' + k) return;
    const L = d.lessons[k - 1];
    if (!L) { main.innerHTML = notFoundHTML(); return; }
    const n = d.lessons.length, done = !!S.lessons[L.id];
    const prev = d.lessons[k - 2], next = d.lessons[k];
    const nextHref = next ? '#' + next.id : '#' + id + '-quiz';
    const nextLabel = next ? 'Complete lesson and go to lesson ' + (k + 1) : 'Complete lesson and take the quiz';
    REG.flows = {}; REG.checks = {};
    main.innerHTML = '<div class="reader"><article class="article">' +
      '<div class="view-head"><div class="row"><a class="dayid" href="#' + id + '">' + esc(dayLabel(meta)) + '</a>' + ptag(meta.phase) + '<span class="chip">Lesson ' + k + ' of ' + n + '</span>' + (L.minutes ? '<span class="chip">' + L.minutes + ' min</span>' : '') + (done ? '<span class="chip chip-ok">Completed</span>' : '') + '</div>' +
      '<h1>' + md(L.title) + '</h1></div>' +
      (L.blocks || []).map(renderBlock).join('') +
      '<div class="lesson-foot"><div class="row"><button type="button" class="btn btn-primary" data-complete>' + esc(done ? (next ? 'Go to lesson ' + (k + 1) : 'Go to the quiz') : nextLabel) + '</button>' + (done ? '' : '<span class="small muted">Marks this lesson done.</span>') + '</div>' +
      '<nav class="pager" aria-label="Lessons">' + (prev ? '<a href="#' + prev.id + '"><span>Previous</span><b>' + md(prev.title) + '</b></a>' : '<a href="#' + id + '"><span>Back to</span><b>' + esc(dayLabel(meta)) + ' overview</b></a>') +
      (next ? '<a class="nx" href="#' + next.id + '"><span>Next</span><b>' + md(next.title) + '</b></a>' : '<a class="nx" href="#' + id + '-quiz"><span>Next</span><b>Day quiz</b></a>') + '</nav></div>' +
      '</article><aside aria-label="Lesson tools"><div class="sec"><div class="eyebrow">' + esc(dayLabel(meta)) + ': ' + esc(meta.title) + '</div><ol class="outline">' + d.lessons.map((l, i) => '<li class="' + (S.lessons[l.id] ? 'done' : '') + '"><a href="#' + l.id + '"' + (i === k - 1 ? ' aria-current="page"' : '') + '><span class="o-tick">' + (S.lessons[l.id] ? '&#10003;' : i + 1) + '</span><span>' + md(l.title) + '</span></a></li>').join('') +
      '<li><a href="#' + id + '-quiz"><span class="o-tick">Q</span><span>Quiz' + (S.quiz[id] ? ' (best ' + pct(S.quiz[id].best) + '%)' : '') + '</span></a></li>' +
      d.drills.map((x, i) => '<li><a href="#' + x.id + '"><span class="o-tick">X' + (i + 1) + '</span><span>' + md(x.title) + '</span></a></li>').join('') + '</ol></div><div id="tutor-slot"></div></aside></div>';
    wireBlocks($('.article', main));
    mountTutor($('#tutor-slot', main), { title: meta.title + ': ' + L.title, text: lessonText(L) });
    $('[data-complete]', main).addEventListener('click', () => { completeLesson(L.id); announce('Lesson complete'); location.hash = nextHref.slice(1); });
  }).catch((e) => { main.innerHTML = '<div class="empty"><b>This lesson did not load.</b><span>' + esc(String(e && e.message || e)) + '</span></div>'; });
}

/* ---------- Day quiz & drills ---------- */
function quizShell(main, eyebrowHTML, title, sub) {
  main.innerHTML = '<div class="view">' + viewHead(eyebrowHTML, title, sub) + '<div id="quiz-root"><p class="muted">Loading questions...</p></div></div>';
  return $('#quiz-root', main);
}
function renderDayQuiz(main, id) {
  const meta = DAY[id];
  if (!meta.available) { renderDay(main, id); return; }
  const root = quizShell(main, '<a href="#' + id + '">' + esc(dayLabel(meta)) + '</a> &middot; ' + esc(meta.title), 'Quiz', 'One question at a time. Pass mark 80 percent. Every answer also enters your review deck.');
  loadDay(id).then((d) => {
    if (!root.isConnected) return;
    const mk = () => ({
      kind: 'day', title: 'Quiz', questions: d.quiz.map((q) => ({ q: q, day: id })), passMark: 0.8,
      onFinish: (score) => recordResult('quiz', id, score),
      back: { href: '#' + id, label: 'Back to ' + dayLabel(meta).toLowerCase() },
      after: () => (d.drills[0] ? '<a class="btn" href="#' + d.drills[0].id + '">Run the drill</a>' : ''),
      retake: () => mk()
    });
    startQuiz(root, mk());
  }).catch((e) => { root.innerHTML = '<div class="empty">The quiz did not load: ' + esc(e.message) + '</div>'; });
}
function renderDrill(main, id, k) {
  const meta = DAY[id];
  if (!meta.available) { renderDay(main, id); return; }
  main.innerHTML = '<div class="view"><p class="muted">Loading the drill...</p></div>';
  loadDay(id).then((d) => {
    if (!main.isConnected || currentRoute !== id + '-x' + k) return;
    const x = d.drills[k - 1];
    if (!x) { main.innerHTML = notFoundHTML(); return; }
    const next = d.drills[k];
    main.innerHTML = '<div class="view">' + viewHead('<a href="#' + id + '">' + esc(dayLabel(meta)) + '</a> &middot; Incident drill ' + k + ' of ' + d.drills.length, plain(x.title), '') + '<div id="drill-root"></div></div>';
    startDrill($('#drill-root', main), d, x, { after: () => (next ? '<a class="btn btn-primary" href="#' + next.id + '">Next drill</a>' : '<a class="btn btn-primary" href="#' + id + '">Back to ' + esc(dayLabel(meta).toLowerCase()) + '</a>') });
  }).catch((e) => { main.innerHTML = '<div class="empty">The drill did not load: ' + esc(e.message) + '</div>'; });
}

/* ---------- Tests ---------- */
function availIn(from, to) { return DAYS.filter((d) => d.day >= from && d.day <= to && d.available); }
function sampleCheckpoint(c) {
  const days = availIn(c.from, c.to).map((d) => d.id).filter((x) => dayCache.has(x));
  const pools = days.map((x) => { const qs = dayCache.get(x).quiz; return shuffle(qs.filter((q) => q.level >= 2)).concat(shuffle(qs.filter((q) => !(q.level >= 2)))); });
  const out = []; let opens = 0; let di = 0; const order = shuffle(range(days.length));
  let guard = 0;
  while (out.length < c.count && pools.some((p) => p.length) && guard++ < 5000) {
    const i = order[di++ % order.length]; const p = pools[i];
    while (p.length) { const q = p.shift(); if (q.type === 'open') { if (opens >= 2) continue; opens++; } out.push({ q: q, day: days[i] }); break; }
  }
  return shuffle(out);
}
function renderTests(main) {
  const rows = DAYS.map((d) => {
    const r = S.quiz[d.id];
    return '<tr><td class="num">' + d.id + '</td><td>' + (d.available ? '<a href="#' + d.id + '-quiz">' + esc(d.title) + '</a>' : '<span class="muted">' + esc(d.title) + '</span>') + '</td><td class="num">' + (r ? pct(r.best) + '%' : '') + '</td><td class="num">' + (r ? pct(r.last) + '%' : '') + '</td><td class="num">' + (r ? r.attempts : '') + '</td><td>' + (d.available ? (r ? (r.best >= 0.8 ? '<span class="chip chip-ok">passed</span>' : '<span class="chip chip-warn">below 80%</span>') : '') : '<span class="chip">not written</span>') + '</td></tr>';
  }).join('');
  const ex = ALL_DAYS.filter((d) => d.day === 0 && d.available);
  const pl = S.placement;
  main.innerHTML = '<div class="view">' + viewHead('Tests', 'Quizzes and checkpoints', 'Day quizzes check one day. Checkpoints sample a fresh set of questions from a range of days each time. Every answer also feeds your review deck.') +
    '<div class="cards3">' +
    '<div class="panel sec"><div class="eyebrow">Placement</div><h2 class="sec-title">Placement test</h2><p class="small muted">One question per written day. Days you get right are marked as likely familiar. Nothing is skipped or locked.</p>' + (pl ? '<p class="small">Last taken ' + esc(fmtDate(isoDate(new Date(pl.ts)))) + ': ' + pl.score + ' of ' + pl.total + ' right.</p>' : '') + '<div><a class="btn btn-primary" href="#test-placement">' + (pl ? 'Take it again' : 'Take the placement test') + '</a></div></div>' +
    '<div class="panel sec"><div class="eyebrow">Practice</div><h2 class="sec-title">Custom practice</h2><p class="small muted">Pick phases or days, 10 or 20 questions, and optionally only the questions you tend to miss.</p><div><a class="btn" href="#practice">Build a practice set</a></div></div>' +
    '</div>' +
    '<div class="sec"><h2 class="sec-title">Checkpoints</h2><div class="cards3">' + CHECKS.map((c) => {
      const r = S.tests[c.id]; const n = availIn(c.from, c.to).length; const span = c.to - c.from + 1;
      return '<div class="panel sec"><div class="row"><span class="dayid">' + esc(c.id) + '</span><span class="small muted">after day ' + c.afterDay + '</span></div><h3 class="sec-title" style="font-size:17px">' + esc(c.title) + '</h3><p class="small muted">' + esc(c.covers) + '. ' + c.count + ' questions' + (n < span ? ', drawn from the ' + n + ' of ' + span + ' days written so far' : '') + '.</p>' +
        (r ? '<p class="small">Best ' + pct(r.best) + '%, last ' + pct(r.last) + '%, ' + plural(r.attempts, 'attempt') + '</p>' : '') +
        '<div>' + (n ? '<a class="btn' + (r ? '' : ' btn-primary') + '" href="#test-' + c.id + '">Start ' + esc(c.title.toLowerCase()) + '</a>' : '<span class="chip">No days written in this range yet</span>') + '</div></div>';
    }).join('') + '</div></div>' +
    '<div class="sec"><h2 class="sec-title">Day quizzes</h2><div class="table-wrap"><table class="test-table"><thead><tr><th>Day</th><th>Title</th><th>Best</th><th>Last</th><th>Tries</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (ex.length ? '<p class="small muted">Example day: <a href="#' + ex[0].id + '-quiz">' + esc(ex[0].title) + '</a></p>' : '') + '</div></div>';
}
function renderTest(main, tid) {
  if (tid === 'placement') return renderPlacement(main);
  const c = CHECKS.find((x) => x.id === tid);
  if (!c) { main.innerHTML = notFoundHTML(); return; }
  const root = quizShell(main, '<a href="#tests">Tests</a> &middot; ' + esc(c.covers), c.title, c.count + ' questions sampled across the days in range, mostly apply and diagnose questions. A new sample each attempt.');
  const ids = availIn(c.from, c.to).map((d) => d.id);
  ensureDays(ids).then(() => {
    if (!root.isConnected) return;
    const mk = () => ({ kind: 'test', questions: sampleCheckpoint(c), passMark: 0.8, onFinish: (score) => recordResult('tests', c.id, score), back: { href: '#tests', label: 'Back to tests' }, retake: () => mk(), retakeLabel: 'Take a new sample', emptyText: 'None of the days this checkpoint covers are written yet.' });
    startQuiz(root, mk());
  });
}
function renderPlacement(main) {
  const root = quizShell(main, '<a href="#tests">Tests</a> &middot; Placement', 'Placement test', 'One question per day. Answer what you can; a wrong answer only means that day is worth reading. Results show by phase.');
  const ids = DAYS.filter((d) => d.available).map((d) => d.id);
  ensureDays(ids).then(() => {
    if (!root.isConnected) return;
    const qs = ids.map((id) => { const d = dayCache.get(id); const q = d && (d.quiz.find((x) => x.diagnostic) || null); return q ? { q: q, day: id } : null; }).filter(Boolean);
    const mk = () => ({
      kind: 'placement', questions: qs.slice(), tutor: false,
      onFinish: (score, res) => { const byDay = {}; res.forEach((r) => { byDay[r.day] = r.correct ? 1 : 0; }); recordPlacement({ score: res.filter((r) => r.correct).length, total: res.length, byDay: byDay }); },
      resultExtra: (score, res) => {
        const fam = res.filter((r) => r.correct).map((r) => DAY[r.day]);
        return '<div class="sec"><h3 class="sec-title" style="font-size:16px">By phase</h3><div class="bk-rows">' + PHASES.map((p) => {
          const rr = res.filter((r) => DAY[r.day].phase === p.id); if (!rr.length) return '';
          const k = rr.filter((r) => r.correct).length;
          return '<div class="bk-row"><span>' + ptag(p.id) + '</span><div class="meter"><i style="width:' + pct(k / rr.length) + '%;background:' + phaseVar(p.id) + '"></i></div><span class="num">' + k + '/' + rr.length + '</span></div>';
        }).join('') + '</div></div>' +
          '<div class="sec"><h3 class="sec-title" style="font-size:16px">Likely familiar</h3>' + (fam.length ? '<p class="small muted">You answered these days\' questions correctly. Skim their lessons and go straight to the quiz if you like. They are marked on the path.</p><ul class="weak">' + fam.map((m) => '<li><span><a href="#' + m.id + '">' + esc(dayLabel(m)) + ': ' + esc(m.title) + '</a></span><span></span><a class="btn btn-sm" href="#' + m.id + '-quiz">Take its quiz</a></li>').join('') + '</ul>' : '<p class="small muted">None yet. Start at day 1 and read each day in order.</p>') + '</div>';
      },
      back: { href: '#today', label: 'Go to today' }, retake: () => mk(), retakeLabel: 'Take it again', emptyText: 'No days are written yet.'
    });
    startQuiz(root, mk());
  });
}
function practicePool(dayIds, weakOnly, tag) {
  let pool = [];
  dayIds.forEach((id) => { const d = dayCache.get(id); if (d) d.quiz.forEach((q) => { if (!tag || (q.tags || []).indexOf(tag) >= 0) pool.push({ q: q, day: id }); }); });
  if (weakOnly) pool = pool.filter((it) => { const c = S.review[it.q.id]; return c && (c.box <= 2 || (c.right || 0) / (c.seen || 1) < 0.7); });
  const score = (it) => { const c = S.review[it.q.id]; return c ? c.box + (c.right || 0) / (c.seen || 1) : 3; };
  return shuffle(pool).sort((a, b) => score(a) - score(b));
}
function renderPractice(main, preset) {
  const avail = DAYS.filter((d) => d.available).concat(ALL_DAYS.filter((d) => d.day === 0 && d.available));
  if (preset) {
    const isTag = preset.indexOf('tag-') === 0, tag = isTag ? preset.slice(4) : null;
    const ids = isTag ? avail.map((d) => d.id) : [preset];
    const title = isTag ? 'Practice: ' + tag : 'Practice: ' + (DAY[preset] ? dayLabel(DAY[preset]) + ', ' + DAY[preset].title : preset);
    const root = quizShell(main, '<a href="#practice">Custom practice</a>', title, 'Up to 10 questions, the ones you miss most first.');
    ensureDays(ids).then(() => {
      if (!root.isConnected) return;
      const mk = () => ({ kind: 'custom', questions: practicePool(ids, false, tag).slice(0, 10), onFinish: (s) => recordResult('tests', 'custom', s), back: { href: '#practice', label: 'Build another set' }, retake: () => mk(), retakeLabel: 'Practice again', emptyText: 'No questions match yet.' });
      startQuiz(root, mk());
    });
    return;
  }
  const saved = (() => { try { return JSON.parse(lsGet('rb_practice') || 'null'); } catch (e) { return null; } })() || { phases: [], days: [], count: 10, weak: false };
  main.innerHTML = '<div class="view">' + viewHead('<a href="#tests">Tests</a>', 'Custom practice', 'Choose phases or single days. Questions you miss most come first.') +
    '<form class="panel sec" id="pf"><fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="margin-bottom:6px">Phases</legend><div class="toggle-group">' + PHASES.map((p) => '<label><input type="checkbox" name="ph" value="' + p.id + '"' + (saved.phases.indexOf(p.id) >= 0 ? ' checked' : '') + '>' + ptag(p.id) + '</label>').join('') + '</div></fieldset>' +
    '<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="margin-bottom:6px">Or single days</legend><div class="toggle-group">' + avail.map((d) => '<label title="' + esc(d.title) + '"><input type="checkbox" name="dy" value="' + d.id + '"' + (saved.days.indexOf(d.id) >= 0 ? ' checked' : '') + '><span class="mono small">' + d.id + '</span></label>').join('') + (avail.length ? '' : '<span class="muted small">No days are written yet.</span>') + '</div></fieldset>' +
    '<fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="margin-bottom:6px">Length</legend><div class="toggle-group"><label><input type="radio" name="ct" value="10"' + (saved.count !== 20 ? ' checked' : '') + '>10 questions</label><label><input type="radio" name="ct" value="20"' + (saved.count === 20 ? ' checked' : '') + '>20 questions</label></div></fieldset>' +
    '<div class="toggle-group"><label><input type="checkbox" id="pf-weak"' + (saved.weak ? ' checked' : '') + '>Weak spots only: questions you missed or that sit in review box 1 or 2</label></div>' +
    '<div class="row"><button type="submit" class="btn btn-primary">Start practice</button><span class="small muted" id="pf-msg" aria-live="polite"></span></div></form><div id="quiz-root"></div></div>';
  $('#pf').addEventListener('submit', (e) => {
    e.preventDefault();
    const phs = $$('input[name="ph"]:checked', main).map((x) => x.value), dys = $$('input[name="dy"]:checked', main).map((x) => x.value);
    const count = +($('input[name="ct"]:checked', main) || { value: 10 }).value, weak = $('#pf-weak').checked;
    lsSet('rb_practice', JSON.stringify({ phases: phs, days: dys, count: count, weak: weak }));
    const ids = Array.from(new Set(avail.filter((d) => phs.indexOf(d.phase) >= 0 && d.day > 0).map((d) => d.id).concat(dys)));
    const msg = $('#pf-msg');
    if (!ids.length) { msg.textContent = 'Choose at least one phase or day that is written.'; return; }
    msg.textContent = 'Loading questions...';
    ensureDays(ids).then(() => {
      const mk = () => ({ kind: 'custom', questions: practicePool(ids, weak).slice(0, count), onFinish: (s) => recordResult('tests', 'custom', s), retake: () => mk(), retakeLabel: 'New set, same choices', emptyText: weak ? 'No weak spots in that selection yet. Turn off "weak spots only" or answer more questions first.' : 'No questions in that selection.' });
      msg.textContent = '';
      const root = $('#quiz-root'); startQuiz(root, mk()); root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ---------- Review ---------- */
function renderReview(main) {
  const due = dueCards();
  const counts = [0, 0, 0, 0, 0]; Object.values(S.review).forEach((c) => { counts[(c.box || 1) - 1]++; });
  const total = Object.keys(S.review).length;
  main.innerHTML = '<div class="view">' + viewHead('Spaced repetition', 'Review', 'Every quiz question you answer joins this deck. A right answer moves a card up a box and pushes it further out; a wrong one sends it back to box 1.') +
    '<div class="panel"><div class="breakdown" style="grid-template-columns:repeat(5,minmax(0,1fr));gap:10px">' + counts.map((n, i) => '<div class="stat"><span class="eyebrow">Box ' + (i + 1) + '</span><b>' + n + '</b><span>every ' + plural(BOXES[i], 'day') + '</span></div>').join('') + '</div></div>' +
    '<div id="quiz-root">' + (due.length ? '<div class="sec"><p><b>' + due.length + '</b> ' + (due.length === 1 ? 'card is' : 'cards are') + ' due. A session takes up to 20.</p><div><button type="button" class="btn btn-primary" id="rv-start">Start review</button></div></div>'
      : '<div class="empty"><b>Nothing is due today.</b><span>' + (total ? 'The next card is due ' + esc(fmtDate(nextDueDate())) + '.' : 'Answer a quiz question anywhere and it will join the deck.') + '</span>' + (total ? '' : '<a class="btn" href="#today">Go to today</a>') + '</div>') + '</div></div>';
  const b = $('#rv-start', main);
  if (b) b.addEventListener('click', () => {
    b.disabled = true; b.textContent = 'Loading cards...';
    const ids = due.slice(0, 20);
    ensureDays(Array.from(new Set(ids.map((x) => x.slice(0, 3))))).then(() => {
      const mk = () => { const list = dueCards().slice(0, 20).map((x) => QINDEX[x]).filter(Boolean).map((qi) => ({ q: qi.q, day: qi.day })); return { kind: 'review', questions: shuffle(list), retake: () => mk(), retakeLabel: 'Review what is still due', back: { href: '#today', label: 'Go to today' }, emptyText: 'Nothing else is due today.' }; };
      startQuiz($('#quiz-root'), mk());
    });
  });
}

/* ---------- Field guide & glossary ---------- */
let guideFilter = { q: '', phase: '' };
function renderGuide(main) {
  main.innerHTML = '<div class="view">' + viewHead('When something is broken', 'Field guide', 'Every symptom from every day in one list. Search by what you see on screen: a status code, an error message, a metric.') +
    '<div class="searchbar"><label class="sr-only" for="guide-q">Search symptoms</label><input type="search" id="guide-q" placeholder="Search: 502, timeout, replica lag, retrieval..." value="' + esc(guideFilter.q) + '" autocomplete="off"></div>' +
    '<div class="toggle-group" role="group" aria-label="Filter by phase"><button type="button" data-ph="" aria-pressed="' + !guideFilter.phase + '">All phases</button>' + PHASES.map((p) => '<button type="button" data-ph="' + p.id + '" aria-pressed="' + (guideFilter.phase === p.id) + '">' + ptag(p.id) + '</button>').join('') + '</div>' +
    '<div class="row"><span class="loadnote" data-loadnote>' + esc(loadedCountText()) + '</span><span class="loadnote" id="guide-count"></span></div><div id="guide-list"></div></div>';
  const inp = $('#guide-q', main);
  inp.addEventListener('input', () => { guideFilter.q = inp.value; drawGuide(); });
  $$('[data-ph]', main).forEach((b) => b.addEventListener('click', () => { guideFilter.phase = b.dataset.ph; $$('[data-ph]', main).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawGuide(); }));
  drawGuide();
}
function drawGuide() {
  const list = $('#guide-list'); if (!list) return;
  const q = guideFilter.q.trim().toLowerCase();
  const items = [];
  ALL_DAYS.forEach((m) => { const d = dayCache.get(m.id); if (!d || (guideFilter.phase && m.phase !== guideFilter.phase)) return; d.fieldGuide.forEach((r) => { const hay = [r.symptom, r.look, r.confirm, r.fix].concat(r.causes || []).join(' ').toLowerCase(); if (!q || q.split(/\s+/).every((w) => hay.indexOf(w) >= 0)) items.push([r, m]); }); });
  const openKeys = new Set($$('details[open]', list).map((x) => x.dataset.k));
  list.innerHTML = items.length ? '<div class="fg">' + items.map(([r, m], i) => fgRowHTML(r, m, true).replace('<details>', '<details data-k="' + esc(m.id + ':' + r.symptom) + '"' + (openKeys.has(m.id + ':' + r.symptom) ? ' open' : '') + '>')).join('') + '</div>' : '<div class="empty">' + (dayCache.size ? 'No symptom matches that search. Try a shorter word, or a status code.' : 'Loading the field guide...') + '</div>';
  $('#guide-count').textContent = items.length ? plural(items.length, 'symptom') + (q || guideFilter.phase ? ' match' : '') : '';
}
let glossQ = '';
function renderGlossary(main) {
  main.innerHTML = '<div class="view">' + viewHead('Terms', 'Glossary', 'Every term defined in the course, with the day that teaches it.') +
    '<div class="searchbar"><label class="sr-only" for="gloss-q">Search terms</label><input type="search" id="gloss-q" placeholder="Search terms and definitions" value="' + esc(glossQ) + '" autocomplete="off"></div>' +
    '<div class="row"><span class="loadnote" data-loadnote>' + esc(loadedCountText()) + '</span></div><div id="gloss-list"></div></div>';
  const inp = $('#gloss-q', main);
  inp.addEventListener('input', () => { glossQ = inp.value; drawGlossary(); });
  drawGlossary();
}
function drawGlossary() {
  const list = $('#gloss-list'); if (!list) return;
  const q = glossQ.trim().toLowerCase();
  const items = [];
  ALL_DAYS.forEach((m) => { const d = dayCache.get(m.id); if (d) d.glossary.forEach((g) => { if (!q || (g.term + ' ' + g.def).toLowerCase().indexOf(q) >= 0) items.push([g, m]); }); });
  items.sort((a, b) => plain(a[0].term).localeCompare(plain(b[0].term)));
  list.innerHTML = items.length ? '<dl class="gloss">' + items.map(([g, m]) => '<div><dt>' + md(g.term) + '</dt><dd>' + md(g.def) + '</dd><a class="ptag" style="--ph:' + phaseVar(m.phase) + '" href="#' + m.id + '">' + esc(m.id) + '</a></div>').join('') + '</dl>' : '<div class="empty">' + (dayCache.size ? 'No term matches that search.' : 'Loading the glossary...') + '</div>';
}

/* ---------- Prefs ---------- */
function renderPrefs(main) {
  main.innerHTML = '<div class="view">' + viewHead('Preferences', 'Prefs', '') +
    '<div class="grid2"><div class="sec">' +
    '<form class="panel sec" id="pref-form"><div class="field"><label for="pref-start">Start date</label><input type="date" id="pref-start" value="' + esc(S.settings.start || isoDate()) + '"><span class="hint">Your pace on Today is measured from this date.</span></div>' +
    '<div class="field"><label for="pref-note">What are you building?</label><textarea id="pref-note" maxlength="300" style="min-height:80px" placeholder="For example: a support agent with RAG over our docs, evaluated nightly">' + esc(S.settings.note) + '</textarea><span class="hint">The tutor reads this note to tie answers to your work.</span></div>' +
    '<div class="row"><button type="submit" class="btn btn-primary">Save preferences</button><span class="small muted" id="pref-msg" aria-live="polite"></span></div></form>' +
    '</div><div class="sec"><div class="panel sec"><h2 class="sec-title">Sync</h2><div id="prefs-sync"></div></div>' +
    '<div class="panel sec"><h2 class="sec-title">Reset</h2><p class="small muted">Erase lessons, scores, drills, review cards and placement results, here and in your Claude account. Your project note stays.</p><div id="reset-slot"><button type="button" class="btn btn-danger" id="reset-1">Reset all progress</button></div></div></div></div></div>';
  renderSyncBox($('#prefs-sync', main));
  $('#pref-form', main).addEventListener('submit', (e) => {
    e.preventDefault();
    S.settings = Object.assign({}, S.settings, { start: $('#pref-start').value || isoDate(), note: $('#pref-note').value.trim(), setup: true, ts: Date.now() });
    commit({ quiet: true });
    $('#pref-msg').textContent = 'Saved';
  });
  const slot = $('#reset-slot', main);
  slot.addEventListener('click', (e) => {
    if (e.target.id === 'reset-1') {
      slot.innerHTML = '<div class="confirm-box" role="group" aria-label="Confirm reset"><b>Erase all progress?</b><span class="small">This cannot be undone. Every completed lesson, score and review card goes.</span><div class="row"><button type="button" class="btn btn-danger solid" id="reset-2">Erase all progress</button><button type="button" class="btn" id="reset-cancel">Keep my progress</button></div></div>';
      $('#reset-cancel', slot).focus();
    } else if (e.target.id === 'reset-cancel') {
      slot.innerHTML = '<button type="button" class="btn btn-danger" id="reset-1">Reset all progress</button>'; $('#reset-1', slot).focus();
    } else if (e.target.id === 'reset-2') {
      resetAll();
      announce('All progress erased');
      const s2 = $('#reset-slot'); if (s2) s2.innerHTML = '<p class="small"><b>Progress erased.</b> <a href="#today">Set up your thirty days again</a>.</p>';
    }
  });
}
function notFoundHTML() { return '<div class="view"><div class="empty"><b>There is no page at this address.</b><a class="btn" href="#today">Go to today</a></div></div>'; }
