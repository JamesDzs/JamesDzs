/* ---------- quiz.js: one engine for day quizzes, tests, placement, practice, review ---------- */
const LEVEL = { 1: 'Recall', 2: 'Apply', 3: 'Diagnose' };
const Quiz = { s: null };

function qTypeLabel(t) { return { mcq: 'Choose one', multi: 'Select all that apply', order: 'Put in order', match: 'Match', open: 'Written answer' }[t] || t; }

function startQuiz(root, cfg) {
  const s = { cfg: cfg, root: root, idx: 0, results: [], ui: null };
  Quiz.s = s;
  if (!cfg.questions.length) {
    root.innerHTML = '<div class="empty"><b>No questions available.</b><span>' + esc(cfg.emptyText || 'The days this test draws from are not written yet.') + '</span>' + (cfg.back ? '<a class="btn" href="' + esc(cfg.back.href) + '">' + esc(cfg.back.label) + '</a>' : '') + '</div>';
    return;
  }
  renderQ(s);
}
function initUI(q) {
  const ui = { answered: false, correct: false };
  if (q.type === 'mcq' || q.type === 'multi') { ui.perm = shuffledPerm(q.options.length); ui.sel = q.type === 'mcq' ? null : new Set(); }
  if (q.type === 'order') ui.arr = shuffledPerm(q.items.length, true);
  if (q.type === 'match') { ui.rperm = shuffledPerm(q.pairs.length, true); ui.choice = q.pairs.map(() => ''); }
  if (q.type === 'open') { ui.compared = false; ui.text = ''; }
  return ui;
}
function renderQ(s) {
  const item = s.cfg.questions[s.idx], q = item.q;
  s.ui = initUI(q);
  const total = s.cfg.questions.length, right = s.results.filter((r) => r.correct).length;
  const meta = DAY[item.day];
  s.root.innerHTML = '<div class="quiz">' +
    '<div class="qprog"><span class="num">Question ' + (s.idx + 1) + ' of ' + total + '</span><div class="meter" aria-hidden="true"><i style="width:' + (100 * s.idx / total) + '%"></i></div><span class="num">' + right + ' right</span></div>' +
    '<div class="qcard">' +
    '<div class="qmeta"><span class="chip">' + esc(LEVEL[q.level] || 'Question') + '</span><span class="chip">' + esc(qTypeLabel(q.type)) + '</span>' +
    (meta ? '<a class="ptag" style="--ph:' + phaseVar(meta.phase) + '" href="#' + meta.id + '">' + (meta.day ? 'Day ' + meta.day : 'Example') + '</a>' : '') + '</div>' +
    (q.context ? '<div class="qcontext">' + md(q.context) + '</div>' : '') +
    (q.artifact ? renderCode(q.artifact) : '') +
    '<div class="q" id="qtext">' + md(q.q) + '</div>' +
    '<div class="qbody"></div>' +
    '<div class="qfb"></div>' +
    '<div class="qactions"><button type="button" class="btn btn-primary" data-act="submit">Check answer</button><span class="kbd-hint">' + keyHint(q) + '</span></div>' +
    '</div>' + (s.cfg.tutor !== false ? '<div class="tutor-slot"></div>' : '') + '</div>';
  renderBody(s);
  updateSubmit(s);
  const first = $('.qbody button, .qbody select, .qbody textarea', s.root);
  if (s.idx > 0 && first) first.focus({ preventScroll: false });
}
function keyHint(q) {
  if (q.type === 'mcq') return '<kbd>1</kbd>&ndash;<kbd>' + q.options.length + '</kbd> to choose, <kbd>Enter</kbd> to check';
  if (q.type === 'multi') return '<kbd>1</kbd>&ndash;<kbd>' + q.options.length + '</kbd> to toggle, <kbd>Enter</kbd> to check';
  if (q.type === 'order') return 'Move items with the arrow buttons';
  return '';
}
function renderBody(s) {
  const q = s.cfg.questions[s.idx].q, ui = s.ui, body = $('.qbody', s.root);
  if (q.type === 'mcq' || q.type === 'multi') {
    body.innerHTML = '<div class="opts" role="' + (q.type === 'mcq' ? 'radiogroup' : 'group') + '" aria-labelledby="qtext">' + ui.perm.map((oi, pos) => {
      const sel = q.type === 'mcq' ? ui.sel === oi : ui.sel.has(oi);
      let cls = 'opt', tag = '', why = '';
      if (ui.answered) {
        const isAns = q.type === 'mcq' ? oi === q.answer : q.answers.indexOf(oi) >= 0;
        if (isAns && sel) { cls += ' right'; tag = q.type === 'multi' ? 'Correct pick' : 'Correct'; }
        else if (isAns && !sel) { cls += q.type === 'multi' ? ' missed' : ' right'; tag = q.type === 'multi' ? 'Missed' : 'Correct answer'; }
        else if (!isAns && sel) { cls += ' wrong'; tag = q.type === 'multi' ? 'Extra pick' : 'Your answer'; if (q.type === 'mcq' && q.why && q.why[oi]) why = q.why[oi]; }
        else cls += ' dim';
      } else if (sel) cls += ' sel';
      return '<button type="button" class="' + cls + '" data-oi="' + oi + '" role="' + (q.type === 'mcq' ? 'radio' : 'checkbox') + '" aria-checked="' + sel + '"' + (ui.answered ? ' aria-disabled="true"' : '') + '>' +
        '<span class="k">' + (pos + 1) + '</span><span>' + md(q.options[oi]) + '</span>' +
        (tag ? '<span class="tag">' + tag + '</span>' : '') + (why ? '<span class="why">' + md(why) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  } else if (q.type === 'order') {
    const n = ui.arr.length;
    body.innerHTML = '<ol class="order-list" aria-labelledby="qtext">' + ui.arr.map((ii, pos) =>
      '<li class="' + (ui.answered ? (ii === pos ? 'right' : 'wrong') : '') + '" data-pos="' + pos + '"><span class="pos">' + (pos + 1) + '</span><span>' + md(q.items[ii]) + '</span>' +
      (ui.answered ? '<span class="pos">' + (ii === pos ? 'in place' : 'belongs at ' + (ii + 1)) + '</span>' :
        '<span class="mv"><button type="button" data-mv="-1" aria-label="Move up: ' + esc(plain(q.items[ii])) + '"' + (pos === 0 ? ' disabled' : '') + '>&uarr;</button><button type="button" data-mv="1" aria-label="Move down: ' + esc(plain(q.items[ii])) + '"' + (pos === n - 1 ? ' disabled' : '') + '>&darr;</button></span>') +
      '</li>').join('') + '</ol>' +
      (ui.answered && !ui.correct ? '<div class="model-ans"><div class="blk-cap">The right order</div><ol style="margin:0;padding-left:22px">' + q.items.map((x) => '<li>' + md(x) + '</li>').join('') + '</ol></div>' : '');
  } else if (q.type === 'match') {
    body.innerHTML = '<div class="match-list">' + q.pairs.map((p, li) => {
      const ch = ui.choice[li];
      const state = ui.answered ? (String(li) === ch ? ' right' : ' wrong') : '';
      return '<div class="match-row' + state + '"><label class="ml" for="m' + s.idx + '-' + li + '">' + md(p[0]) + '</label>' +
        '<select id="m' + s.idx + '-' + li + '" data-li="' + li + '"' + (ui.answered ? ' disabled' : '') + '><option value="">Choose a match</option>' +
        ui.rperm.map((ri) => '<option value="' + ri + '"' + (ch === String(ri) ? ' selected' : '') + '>' + esc(plain(q.pairs[ri][1])) + '</option>').join('') + '</select>' +
        (ui.answered && String(li) !== ch ? '<div class="mfix">Match: ' + md(p[1]) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  } else if (q.type === 'open') {
    body.innerHTML = '<div class="field"><label for="open-' + s.idx + '">Your answer</label><textarea id="open-' + s.idx + '" placeholder="Write a few sentences in your own words."' + (ui.compared ? ' readonly' : '') + '>' + esc(ui.text) + '</textarea></div>' +
      (ui.compared ? '<div class="model-ans"><div class="blk-cap">Model answer</div>' + md(q.model) + '</div>' +
        '<div class="field"><span class="lbl">Tick the points your answer covers</span><ul class="rubric">' + q.rubric.map((r, i) =>
          '<li><label><input type="checkbox" data-rb="' + i + '"' + (ui.answered ? ' disabled' : '') + (ui.ticks && ui.ticks[i] ? ' checked' : '') + '><span>' + md(r) + '</span></label></li>').join('') + '</ul>' +
        '<span class="hint">It counts as correct when you tick at least 60 percent of the points.</span></div>' +
        (!ui.answered ? '<div class="row tutor-only"><button type="button" class="btn btn-sm" data-act="grade">Grade with Claude</button><span class="grade-note small muted"></span></div>' : '') +
        '<div class="grade-fb"></div>' : '');
  }
}
function updateSubmit(s) {
  const btn = $('[data-act="submit"]', s.root); if (!btn) return;
  const q = s.cfg.questions[s.idx].q, ui = s.ui;
  if (ui.answered) { btn.textContent = s.idx + 1 < s.cfg.questions.length ? 'Next question' : 'See results'; btn.disabled = false; return; }
  if (q.type === 'open') { btn.textContent = ui.compared ? 'Record my grade' : 'Compare with model answer'; btn.disabled = !ui.compared && !ui.text.trim(); return; }
  btn.textContent = 'Check answer';
  btn.disabled = q.type === 'mcq' ? ui.sel === null : q.type === 'multi' ? ui.sel.size === 0 : q.type === 'match' ? ui.choice.some((c) => c === '') : false;
}
function answerSummary(q, ui) {
  if (q.type === 'mcq') return ui.sel === null ? '' : plain(q.options[ui.sel]);
  if (q.type === 'multi') return Array.from(ui.sel).map((i) => plain(q.options[i])).join('; ');
  if (q.type === 'order') return ui.arr.map((i) => plain(q.items[i])).join(' > ');
  if (q.type === 'match') return q.pairs.map((p, i) => plain(p[0]) + ' = ' + (ui.choice[i] === '' ? '?' : plain(q.pairs[+ui.choice[i]][1]))).join('; ');
  return ui.text;
}
function correctSummary(q) {
  if (q.type === 'mcq') return plain(q.options[q.answer]);
  if (q.type === 'multi') return q.answers.map((i) => plain(q.options[i])).join('; ');
  if (q.type === 'order') return q.items.map(plain).join(' > ');
  if (q.type === 'match') return q.pairs.map((p) => plain(p[0]) + ' = ' + plain(p[1])).join('; ');
  return plain(q.model);
}
function submitQ(s) {
  const item = s.cfg.questions[s.idx], q = item.q, ui = s.ui;
  if (ui.answered) { s.idx++; if (s.idx < s.cfg.questions.length) renderQ(s); else finishQuiz(s); return; }
  if (q.type === 'open' && !ui.compared) {
    const ta = $('textarea', s.root); ui.text = ta ? ta.value : ui.text;
    if (!ui.text.trim()) return;
    ui.compared = true; ui.ticks = q.rubric.map(() => false); renderBody(s); updateSubmit(s);
    announce('Model answer shown. Tick the rubric points your answer covers, then record your grade.');
    const cb = $('.rubric input', s.root); if (cb) cb.focus();
    return;
  }
  let ok = false;
  if (q.type === 'mcq') ok = ui.sel === q.answer;
  else if (q.type === 'multi') ok = ui.sel.size === q.answers.length && q.answers.every((a) => ui.sel.has(a));
  else if (q.type === 'order') ok = ui.arr.every((v, i) => v === i);
  else if (q.type === 'match') ok = ui.choice.every((c, i) => c === String(i));
  else if (q.type === 'open') { const t = ui.ticks.filter(Boolean).length; ok = t / q.rubric.length >= 0.6; ui.score = t / q.rubric.length; }
  ui.answered = true; ui.correct = ok;
  s.results.push({ id: q.id, day: item.day, level: q.level, correct: ok, q: q, given: answerSummary(q, ui) });
  reviewAnswer(q.id, ok);
  renderBody(s);
  let extra = '';
  if (q.type === 'multi' && !ok) {
    const missed = q.answers.filter((a) => !ui.sel.has(a)).length, extraN = Array.from(ui.sel).filter((a) => q.answers.indexOf(a) < 0).length;
    extra = '<div class="small">' + [missed ? plural(missed, 'correct option') + ' missed' : '', extraN ? plural(extraN, 'extra pick') : ''].filter(Boolean).join(', ') + '.</div>';
  }
  if (q.type === 'open') extra = '<div class="small">You ticked ' + ui.ticks.filter(Boolean).length + ' of ' + q.rubric.length + ' points.</div>';
  const fb = $('.qfb', s.root);
  fb.innerHTML = '<div class="fb ' + (ok ? 'ok' : 'bad') + '"><div class="fb-h"><span class="mark">' + (ok ? '&#10003;' : '&#215;') + '</span>' + (ok ? 'Correct' : 'Incorrect') + '</div>' + extra +
    (q.explain ? '<div>' + md(q.explain) + '</div>' : '') +
    (!ok && s.cfg.tutor !== false ? '<div class="tutor-only"><button type="button" class="btn btn-sm" data-act="askwhy">Ask why</button></div>' : '') + '</div>';
  announce((ok ? 'Correct. ' : 'Incorrect. ') + plain(q.explain || ''));
  updateSubmit(s);
  const btn = $('[data-act="submit"]', s.root); if (btn) btn.focus({ preventScroll: true });
}
function finishQuiz(s) {
  const res = s.results, total = res.length, right = res.filter((r) => r.correct).length, score = total ? right / total : 0;
  const cfg = s.cfg;
  if (cfg.onFinish) cfg.onFinish(score, res);
  const group = (keyFn, labelFn) => {
    const g = {}; res.forEach((r) => { const k = keyFn(r); (g[k] = g[k] || { n: 0, r: 0 }); g[k].n++; if (r.correct) g[k].r++; });
    return Object.keys(g).sort().map((k) => '<div class="bk-row"><span>' + labelFn(k) + '</span><div class="meter"><i style="width:' + pct(g[k].r / g[k].n) + '%;background:' + (g[k].r / g[k].n >= 0.8 ? 'var(--ok)' : g[k].r / g[k].n >= 0.5 ? 'var(--warn)' : 'var(--bad)') + '"></i></div><span class="num">' + g[k].r + '/' + g[k].n + '</span></div>').join('');
  };
  const days = new Set(res.map((r) => r.day));
  const pass = cfg.passMark ? (score >= cfg.passMark ? '<span class="chip chip-ok">Passed the ' + pct(cfg.passMark) + '% mark</span>' : '<span class="chip chip-warn">Below the ' + pct(cfg.passMark) + '% mark</span>') : '';
  const missed = res.filter((r) => !r.correct);
  s.root.innerHTML = '<div class="results">' +
    '<div class="row" style="align-items:flex-end;gap:18px"><div class="score-big num">' + pct(score) + '%<small>' + right + ' of ' + total + '</small></div><div class="row">' + pass + '</div></div>' +
    (cfg.resultExtra ? cfg.resultExtra(score, res) : '') +
    '<div class="breakdown"><div class="sec"><h3 class="sec-title" style="font-size:16px">By level</h3><div class="bk-rows">' + group((r) => String(r.level || 2), (k) => esc(LEVEL[k] || k)) + '</div></div>' +
    (days.size > 1 ? '<div class="sec"><h3 class="sec-title" style="font-size:16px">By day</h3><div class="bk-rows">' + group((r) => r.day, (k) => '<a href="#' + k + '">' + (DAY[k] && DAY[k].day ? 'Day ' + DAY[k].day : 'Example') + '</a> <span class="muted small">' + esc(DAY[k] ? DAY[k].title : '') + '</span>') + '</div></div>' : '') +
    '</div>' +
    '<div class="sec"><h3 class="sec-title" style="font-size:16px">' + (missed.length ? 'Missed questions' : 'Nothing missed') + '</h3>' +
    (missed.length ? '<ul class="missed">' + missed.map((r) => '<li><span class="mq">' + md(r.q.q) + '</span>' + (r.given ? '<span class="small muted">Your answer: ' + esc(r.given) + '</span>' : '') + '<span class="ma">Answer: ' + esc(correctSummary(r.q)) + '</span>' + (r.q.explain ? '<span>' + md(r.q.explain) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="muted">Every answer was right.</p>') +
    '</div>' +
    '<div class="row"><button type="button" class="btn btn-primary" data-act="retake">' + esc(cfg.retakeLabel || 'Retake') + '</button>' + (cfg.after ? cfg.after(score) : '') + (cfg.back ? '<a class="btn" href="' + esc(cfg.back.href) + '">' + esc(cfg.back.label) + '</a>' : '') + '</div>' +
    '</div>';
  announce('Finished. Score ' + pct(score) + ' percent, ' + right + ' of ' + total + '.');
  const rb = $('[data-act="retake"]', s.root); if (rb) rb.focus();
}
/* Delegated handlers (installed once). */
document.addEventListener('click', (e) => {
  const s = Quiz.s; if (!s || !s.root.isConnected || !s.root.contains(e.target)) return;
  const q = s.idx < s.cfg.questions.length ? s.cfg.questions[s.idx].q : null;
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'submit') return submitQ(s);
    if (a === 'retake') { const cfg = s.cfg.retake ? s.cfg.retake() : s.cfg; return startQuiz(s.root, cfg); }
    if (a === 'grade') return gradeOpen(s, act);
    if (a === 'askwhy') return askWhy(s);
  }
  if (!q || s.ui.answered) return;
  const opt = e.target.closest('.qbody .opt');
  if (opt) { pickOpt(s, +opt.dataset.oi); return; }
  const mv = e.target.closest('[data-mv]');
  if (mv) { const pos = +mv.closest('li').dataset.pos; moveItem(s, pos, +mv.dataset.mv); }
});
document.addEventListener('change', (e) => {
  const s = Quiz.s; if (!s || !s.root.contains(e.target) || !s.ui || s.ui.answered) return;
  if (e.target.matches('select[data-li]')) { s.ui.choice[+e.target.dataset.li] = e.target.value; updateSubmit(s); }
  if (e.target.matches('input[data-rb]')) { s.ui.ticks[+e.target.dataset.rb] = e.target.checked; }
});
document.addEventListener('input', (e) => {
  const s = Quiz.s; if (!s || !s.root.contains(e.target) || !s.ui) return;
  if (e.target.matches('.qbody textarea') && !s.ui.compared) { s.ui.text = e.target.value; updateSubmit(s); }
});
document.addEventListener('keydown', (e) => {
  const s = Quiz.s; if (!s || !s.root.isConnected || e.altKey || e.ctrlKey || e.metaKey) return;
  if (s.idx >= s.cfg.questions.length) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
  if (e.target.closest && e.target.closest('.tutor')) return;
  const q = s.cfg.questions[s.idx].q;
  if (/^[1-9]$/.test(e.key) && !s.ui.answered && (q.type === 'mcq' || q.type === 'multi')) {
    const pos = +e.key - 1; if (pos < s.ui.perm.length) { e.preventDefault(); pickOpt(s, s.ui.perm[pos], true); }
  } else if (e.key === 'Enter' && ((tag !== 'button' && tag !== 'a') || e.target.closest('.qbody .opt'))) {
    const btn = $('[data-act="submit"]', s.root); if (btn && !btn.disabled) { e.preventDefault(); submitQ(s); }
  }
});
function pickOpt(s, oi, fromKey) {
  const q = s.cfg.questions[s.idx].q;
  if (q.type === 'mcq') s.ui.sel = oi; else if (s.ui.sel.has(oi)) s.ui.sel.delete(oi); else s.ui.sel.add(oi);
  renderBody(s); updateSubmit(s);
  const b = $('.qbody .opt[data-oi="' + oi + '"]', s.root); if (b && !fromKey) b.focus();
  announce(plain(q.options[oi]) + (q.type === 'multi' && !s.ui.sel.has(oi) ? ' cleared' : ' selected'));
}
function moveItem(s, pos, d) {
  const a = s.ui.arr, to = pos + d; if (to < 0 || to >= a.length) return;
  [a[pos], a[to]] = [a[to], a[pos]];
  renderBody(s);
  const q = s.cfg.questions[s.idx].q;
  const li = $$('.order-list li', s.root)[to]; if (li) { li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 400); const b = $('[data-mv="' + d + '"]', li); (b && !b.disabled ? b : $('[data-mv]:not([disabled])', li)).focus(); }
  announce(plain(q.items[a[to]]) + ' moved to position ' + (to + 1));
}
async function gradeOpen(s, btn) {
  const q = s.cfg.questions[s.idx].q, ui = s.ui;
  const note = $('.grade-note', s.root), out = $('.grade-fb', s.root);
  const sample = tutorSample(); if (!sample) return;
  btn.disabled = true; note.textContent = 'Claude is reading your answer...';
  const prompt = 'You grade a learner\'s written answer against a rubric for a course on backend and AI systems. Judge each rubric point independently: met is true only when the learner\'s answer clearly states that point in any words.\n\n' +
    'Question: ' + plain(q.q) + (q.context ? '\nContext: ' + plain(q.context) : '') +
    '\n\nRubric points (' + q.rubric.length + '):\n' + q.rubric.map((r, i) => (i + 1) + '. ' + plain(r)).join('\n') +
    '\n\nModel answer: ' + plain(q.model) + '\n\nLearner\'s answer: ' + ui.text.slice(0, 4000) +
    '\n\nReply with only JSON of this shape: {"met": [true, false, ...], "feedback": "two or three plain sentences on what the answer got right and what it missed"}. The met array has exactly ' + q.rubric.length + ' booleans, in rubric order.';
  try {
    const r = await sample.json(prompt, { modelTier: 'quick' });
    if (!r || !Array.isArray(r.met) || r.met.length !== q.rubric.length || r.met.some((x) => typeof x !== 'boolean') || typeof r.feedback !== 'string') throw { code: 'invalid_json' };
    if (s.ui !== ui || ui.answered) return;
    ui.ticks = r.met.slice();
    $$('.rubric input', s.root).forEach((cb, i) => { cb.checked = !!r.met[i]; });
    note.textContent = 'Claude ticked ' + r.met.filter(Boolean).length + ' of ' + r.met.length + ' points. Adjust the ticks if you disagree, then record your grade.';
    out.innerHTML = '<div class="fb ok" style="background:var(--sunk)"><div class="blk-cap" style="margin:0">Claude\'s feedback</div><div class="tutor-msg">' + mdBlocks(r.feedback) + '</div></div>';
  } catch (e) {
    note.textContent = sampleErrorText(e, 'The grade came back in an unexpected form. Try again.');
  } finally { if (btn.isConnected) btn.disabled = !tutorSample(); }
}
function askWhy(s) {
  const item = s.cfg.questions[s.idx], q = item.q;
  const slot = $('.tutor-slot', s.root); if (!slot) return;
  const ctxText = 'Question: ' + plain(q.q) + (q.context ? '\nContext: ' + plain(q.context) : '') + (q.artifact ? '\nArtifact:\n' + q.artifact.code : '') +
    '\nCorrect answer: ' + correctSummary(q) + '\nExplanation: ' + plain(q.explain || q.model || '');
  const panel = mountTutor(slot, { title: 'Quiz question from ' + (DAY[item.day] ? DAY[item.day].title : 'the course'), text: ctxText, quick: false });
  panel.ask('I answered "' + (s.ui ? answerSummary(q, s.ui) : '') + '". Why is that wrong, and what should I notice next time?', 'Why was my answer wrong?');
}
