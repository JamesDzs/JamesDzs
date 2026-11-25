/* ---------- tutor.js: the sample capability ---------- */
const Tutor = { sample: null, off: false };
const TUTOR_RULES = 'You are the tutor inside a thirty-day course on backend and AI systems called the Thirty-Day Backend Runbook. ' +
  'The learner builds AI and agent projects, reads Python, and spends most of his time testing, evaluating and debugging. ' +
  'He wants ideas, mechanisms, tradeoffs and failure signatures so that when something breaks he knows where to look. He does not want to learn to write the code. ' +
  'Answer at concept level, concisely: usually under 180 words. Where it helps, name the tradeoff and what a failure looks like from outside (a status code, a log line, a metric, a trace). ' +
  'No code tutorials. Write plain text. You may use **bold**, *italic* and `code` marks and short lists that start with "- ". No headings, tables or code blocks. ' +
  'If the question is outside the lesson, answer briefly and connect it back. The course material for this conversation follows.';

function tutorSample() { return Tutor.off ? null : Tutor.sample; }
function initTutor() {
  const dev = lsGet('rb_dev_tutor') === '1';
  const C = window.claude;
  const enable = (fn) => { Tutor.sample = fn; document.documentElement.classList.add('has-tutor'); };
  if (C && typeof C.use === 'function') {
    withTimeout(C.use('sample'), 10000).then((fn) => { if (fn) enable(fn); else if (dev) enable(mockSample()); }, () => { if (dev) enable(mockSample()); });
  } else if (dev) enable(mockSample());
}
function disableTutor() { Tutor.off = true; document.documentElement.classList.remove('has-tutor'); }
function sampleErrorText(e, fallback) {
  const code = (e && e.code) || 'upstream_error';
  if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].indexOf(code) >= 0) { disableTutor(); return 'Claude is not available on this page.'; }
  if (code === 'rate_limited') return 'Claude is busy right now. Try again in a moment.';
  if (code === 'session_expired') return 'Your Claude session expired. Sign in again, then try again.';
  if (code === 'refused') return 'Claude declined that request. Try rephrasing it.';
  if (code === 'prompt_too_large') return 'That was too much text to send. Ask a shorter question.';
  if (code === 'invalid_json') return fallback || 'The answer came back in an unexpected form. Try again.';
  if (code === 'cancelled') return 'Stopped.';
  return 'The answer was interrupted. Try again.';
}
/* Local testing only: a canned tutor when localStorage.rb_dev_tutor === "1" and no capability exists. */
function mockSample() {
  const canned = 'Here is a **canned answer** for local testing. A real answer would come from Claude.\n\n- The first point mentions `retry-after`.\n- The second point says where to *look* first.';
  const fn = function (input, opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      let i = 0;
      const iv = setInterval(() => {
        if (opts.signal && opts.signal.aborted) { clearInterval(iv); reject({ code: 'cancelled', message: 'aborted', text: canned.slice(0, i) }); return; }
        const prev = canned.slice(0, i); i = Math.min(canned.length, i + 24);
        const text = canned.slice(0, i);
        if (opts.onText) opts.onText({ text: text, delta: text.slice(prev.length) });
        if (i >= canned.length) { clearInterval(iv); resolve({ text: canned, truncated: false, modelTierApplied: 'default' }); }
      }, 25);
    });
  };
  fn.json = function (input) {
    const m = /Rubric points \((\d+)\)/.exec(typeof input === 'string' ? input : '');
    const n = m ? +m[1] : 3;
    return new Promise((r) => setTimeout(() => r({ met: range(n).map((i) => i % 2 === 0), feedback: 'Canned grade for local testing. Your answer covered the **first** point and missed the second.' }), 150));
  };
  fn.limits = () => Promise.resolve({ maxPromptBytes: 262144 });
  return fn;
}

/* A tutor panel. ctx: {title, text, quick}. Returns {ask(question, shown)}. Turns live with the panel. */
const QUICK_PROMPTS = ['Explain it with an analogy', 'How would this show up in my logs?', 'Quiz me on this lesson', 'Why does this matter for evals?'];
let tutorN = 0;
function mountTutor(el, ctx) {
  const id = 'tutor-' + (++tutorN);
  const turns = [];
  let ctl = null;
  el.innerHTML = '<section class="tutor tutor-only" aria-labelledby="' + id + '-h"><h3 id="' + id + '-h">Ask the tutor</h3>' +
    '<p class="tutor-note">Claude answers using this ' + (ctx.quick === false ? 'question' : 'lesson') + (S.settings.note ? ' and your project note' : '') + '. Each answer uses your Claude usage.</p>' +
    (ctx.quick === false ? '' : '<div class="quick">' + QUICK_PROMPTS.map((p) => '<button type="button" data-q="' + esc(p) + '">' + esc(p) + '</button>').join('') + '</div>') +
    '<div class="tutor-log" aria-live="polite"></div>' +
    '<form><label class="sr-only" for="' + id + '-in">Your question</label><input type="text" id="' + id + '-in" placeholder="Ask about this ' + (ctx.quick === false ? 'question' : 'lesson') + '" autocomplete="off"><button type="submit" class="btn btn-sm btn-primary">Ask</button></form>' +
    '<div class="row"><button type="button" class="btn btn-sm" data-stop hidden>Stop</button><span class="tutor-note" data-status></span></div></section>';
  const log = $('.tutor-log', el), input = $('input', el), stop = $('[data-stop]', el), status = $('[data-status]', el), askBtn = $('form button', el);
  const busy = (b) => { askBtn.disabled = b; $$('.quick button', el).forEach((x) => { x.disabled = b; }); stop.hidden = !b; };
  async function ask(question, shown) {
    const sample = tutorSample();
    if (!sample || !question.trim() || ctl) return;
    status.textContent = '';
    const me = document.createElement('div'); me.className = 'tutor-msg me'; me.textContent = shown || question; log.appendChild(me);
    const ai = document.createElement('div'); ai.className = 'tutor-msg ai'; ai.textContent = 'Thinking...'; log.appendChild(ai);
    log.scrollTop = log.scrollHeight;
    const head = TUTOR_RULES + '\n\nTopic: ' + plain(ctx.title || '') + '\n\n' + String(ctx.text || '').slice(0, 4500) +
      (S.settings.note ? '\n\nWhat the learner is building: ' + S.settings.note.slice(0, 600) : '');
    const msgs = [{ role: 'user', content: head }].concat(turns.slice(-6), [{ role: 'user', content: question }]);
    ctl = new AbortController(); busy(true);
    try {
      const r = await sample(msgs, { cache: false, signal: ctl.signal, onText: (u) => { ai.innerHTML = mdBlocks(u.text); log.scrollTop = log.scrollHeight; } });
      ai.innerHTML = mdBlocks(r.text);
      if (r.truncated) status.textContent = 'The answer was cut short. Ask for less at a time.';
      turns.push({ role: 'user', content: question }, { role: 'assistant', content: r.text });
    } catch (e) {
      if (e && e.text && e.code !== 'refused') ai.innerHTML = mdBlocks(e.text); else ai.remove();
      status.textContent = sampleErrorText(e);
    } finally { ctl = null; busy(false); }
  }
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); });
  stop.addEventListener('click', () => { if (ctl) ctl.abort(); });
  $('form', el).addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; ask(v); });
  return { ask: ask };
}
