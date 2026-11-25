/* ---------- blocks.js: lesson content blocks ---------- */
const REG = { flows: {}, checks: {}, n: 0 };
const LANG_LABEL = { http: 'HTTP', sql: 'SQL', log: 'Log', json: 'JSON', python: 'Python', shell: 'Shell', text: 'Text', yaml: 'YAML', trace: 'Trace', plan: 'Query plan', diff: 'Diff' };
const CALLOUT_LABEL = { insight: 'Key idea', pitfall: 'Pitfall', debug: 'When it breaks, check', rule: 'Rule of thumb', ai: 'In AI systems' };

function lineClass(lang, line, i) {
  if (lang === 'diff') { if (/^\+(?!\+\+)/.test(line)) return 'add'; if (/^-(?!--)/.test(line)) return 'del'; if (/^@@/.test(line)) return 'hd'; }
  if (lang === 'http' && /^(HTTP\/\d|(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \S)/.test(line)) return 'hd';
  if (/^\s*(#|--|\/\/)/.test(line) && lang !== 'json' && lang !== 'http' && lang !== 'diff' && lang !== 'plan') return 'cm';
  if ((lang === 'log' || lang === 'text' || lang === 'trace' || lang === 'python' || lang === 'shell') && /\b(ERROR|FATAL|CRITICAL|Traceback|PANIC)\b|level=error|\bOOMKilled\b/.test(line)) return 'er';
  return '';
}
function renderCode(c, opts) {
  opts = opts || {};
  const lang = c.lang || 'text';
  const lines = String(c.code || '').replace(/\n$/, '').split('\n');
  const body = lines.map((l, i) => { const cls = lineClass(lang, l, i); return '<span class="ln' + (cls ? ' ' + cls : '') + '" data-n="' + (i + 1) + '">' + esc(l) + '</span>'; }).join('\n');
  const title = c.title || opts.title || '';
  let html = '<figure class="code blk" style="margin:0"><div class="code-head"><span class="ct">' + esc(title) + '</span><span class="cl">' + esc(LANG_LABEL[lang] || lang) + '</span></div>' +
    '<pre tabindex="0" aria-label="' + esc((title ? title + ', ' : '') + (LANG_LABEL[lang] || lang)) + '"><code>' + body + '</code></pre>';
  if (Array.isArray(c.notes) && c.notes.length) html += '<ol class="code-notes" aria-label="What to notice">' + c.notes.map((n) => '<li><span>' + md(n) + '</span></li>').join('') + '</ol>';
  return html + '</figure>';
}
function renderFlowDetail(steps, i) {
  const s = steps[i];
  return '<div class="fd"><div class="blk-cap">Step ' + (i + 1) + ' of ' + steps.length + ' &middot; ' + esc(s.actor) + '</div>' + md(s.detail || s.label) + '</div>' +
    (s.fail ? '<div class="ff"><div class="blk-cap">What breaking here looks like</div>' + md(s.fail) + '</div>'
      : '<div class="ff none"><div class="blk-cap">What breaking here looks like</div>No distinct failure at this step.</div>');
}
function renderBlock(b) {
  const k = 'b' + (++REG.n);
  switch (b.t) {
    case 'p': return '<p class="blk">' + md(b.text) + '</p>';
    case 'h': return '<h2 class="blk">' + md(b.text) + '</h2>';
    case 'list': {
      const tag = b.style === 'number' ? 'ol' : 'ul';
      return '<' + tag + ' class="blk">' + (b.items || []).map((x) => '<li>' + md(x) + '</li>').join('') + '</' + tag + '>';
    }
    case 'callout': {
      const kind = CALLOUT_LABEL[b.kind] ? b.kind : 'insight';
      return '<aside class="callout blk ' + kind + '" aria-label="' + esc(CALLOUT_LABEL[kind]) + '"><span class="co-lbl">' + esc(CALLOUT_LABEL[kind]) + '</span>' +
        (b.title ? '<div class="co-title">' + md(b.title) + '</div>' : '') + '<div>' + md(b.text) + '</div></aside>';
    }
    case 'compare': {
      const cols = b.columns || [];
      let t = '<div class="blk">' + (b.caption ? '<div class="blk-cap">' + md(b.caption) + '</div>' : '') +
        '<div class="table-wrap" tabindex="0" role="region" aria-label="' + esc(plain(b.caption || 'Comparison table')) + '"><table class="cmp"><thead><tr>' +
        cols.map((c, i) => '<th scope="col">' + (i === 0 && !c ? '<span class="sr-only">Aspect</span>' : md(c)) + '</th>').join('') + '</tr></thead><tbody>' +
        (b.rows || []).map((r) => '<tr>' + r.map((cell, i) => (i === 0 ? '<th scope="row">' + md(cell) + '</th>' : '<td>' + md(cell) + '</td>')).join('') + '</tr>').join('') +
        '</tbody></table></div>';
      if (b.verdict) t += '<p class="verdict"><b>Verdict</b>' + md(b.verdict) + '</p>';
      return t + '</div>';
    }
    case 'tradeoff':
      return '<div class="blk"><div class="blk-cap">Tradeoff' + (b.title ? ': ' + md(b.title) : '') + '</div><div class="tradeoff-opts">' +
        (b.options || []).map((o) => '<div class="topt"><h3>' + md(o.name) + '</h3>' +
          '<div><div class="lbl">You gain</div><ul class="gain">' + (o.gain || []).map((g) => '<li><span>' + md(g) + '</span></li>').join('') + '</ul></div>' +
          '<div><div class="lbl">You pay</div><ul class="cost">' + (o.cost || []).map((g) => '<li><span>' + md(g) + '</span></li>').join('') + '</ul></div>' +
          (o.choose ? '<div class="choose"><div class="lbl" style="margin-bottom:4px">Choose when</div>' + md(o.choose) + '</div>' : '') + '</div>').join('') +
        '</div></div>';
    case 'flow': {
      const steps = b.steps || [];
      REG.flows[k] = steps;
      return '<div class="flow blk" data-flow="' + k + '"><div class="flow-head"><h3>' + md(b.title || 'Sequence') + '</h3>' +
        '<div class="row"><button type="button" class="btn btn-sm" data-flow-prev>Previous step</button><button type="button" class="btn btn-sm" data-flow-next>Next step</button></div></div>' +
        '<ol class="flow-steps" aria-label="Steps. Select one to see its detail.">' + steps.map((s, i) =>
          '<li><button type="button" data-i="' + i + '"' + (i === 0 ? ' aria-current="step"' : ' tabindex="-1"') + '><span class="n">' + (i + 1) + '</span><span class="actor">' + esc(s.actor) + '</span><span class="lab">' + md(s.label) + '</span>' + (s.fail ? '<span class="fmark">can fail</span>' : '<span></span>') + '</button></li>').join('') +
        '</ol><div class="flow-detail" aria-live="polite">' + (steps.length ? renderFlowDetail(steps, 0) : '') + '</div></div>';
    }
    case 'layers':
      return '<div class="layers blk"><h3>' + md(b.title || 'Layers') + '</h3><div class="blk-cap" style="margin:0">Top of the stack first</div><div class="layer-stack">' +
        (b.layers || []).map((l) => '<div class="layer"><div class="ln">' + md(l.name) + '</div><div>' + md(l.role) + '</div>' +
          (l.breaks ? '<div class="lb"><b>Breaks</b>' + md(l.breaks) + '</div>' : '') + '</div>').join('') + '</div></div>';
    case 'code': return renderCode(b);
    case 'analogy': return '<div class="analogy blk"><div class="blk-cap">Analogy</div>' + md(b.text) + '</div>';
    case 'check': {
      REG.checks[k] = b;
      return '<div class="inline-q blk" data-check="' + k + '"><div class="blk-cap" style="margin:0">Check yourself</div><div class="q">' + md(b.q) + '</div><div class="opts">' +
        (b.options || []).map((o, i) => '<button type="button" class="opt" data-i="' + i + '"><span class="k">' + String.fromCharCode(65 + i) + '</span><span>' + md(o) + '</span></button>').join('') +
        '</div><div class="fbwrap" aria-live="polite"></div></div>';
    }
    case 'reveal':
      return '<div class="reveal blk" data-reveal><div class="blk-cap" style="margin:0">Think first</div><div>' + md(b.prompt) + '</div>' +
        '<div><button type="button" class="btn btn-sm" data-reveal-btn aria-expanded="false">Reveal the answer</button></div><div class="ans" hidden>' + md(b.answer) + '</div></div>';
    default: return '';
  }
}

function selectFlowStep(root, i) {
  const steps = REG.flows[root.dataset.flow]; if (!steps) return;
  i = Math.max(0, Math.min(steps.length - 1, i));
  $$('.flow-steps button', root).forEach((b, j) => { if (j === i) { b.setAttribute('aria-current', 'step'); b.tabIndex = 0; } else { b.removeAttribute('aria-current'); b.tabIndex = -1; } });
  $('.flow-detail', root).innerHTML = renderFlowDetail(steps, i);
  root.dataset.cur = i;
  return i;
}
/* Event delegation for interactive blocks inside a root element. */
function wireBlocks(root) {
  root.addEventListener('click', (e) => {
    const fs = e.target.closest('.flow-steps button');
    if (fs) { selectFlowStep(fs.closest('[data-flow]'), +fs.dataset.i); return; }
    const fp = e.target.closest('[data-flow-prev],[data-flow-next]');
    if (fp) { const f = fp.closest('[data-flow]'); const i = selectFlowStep(f, (+f.dataset.cur || 0) + (fp.hasAttribute('data-flow-next') ? 1 : -1)); return void i; }
    const co = e.target.closest('[data-check] .opt');
    if (co) {
      const box = co.closest('[data-check]'); if (box.dataset.done) return;
      const b = REG.checks[box.dataset.check]; const i = +co.dataset.i; const ok = i === b.answer;
      box.dataset.done = '1';
      $$('.opt', box).forEach((o, j) => { o.setAttribute('aria-disabled', 'true'); if (j === b.answer) o.classList.add('right'); else if (j === i) o.classList.add('wrong'); else o.classList.add('dim'); });
      $('.fbwrap', box).innerHTML = '<div class="fb ' + (ok ? 'ok' : 'bad') + '"><div class="fb-h"><span class="mark">' + (ok ? '&#10003;' : '&#215;') + '</span>' + (ok ? 'Correct' : 'Not quite') + '</div><div>' + md(b.explain) + '</div></div>';
      announce((ok ? 'Correct. ' : 'Not quite. ') + plain(b.explain));
      return;
    }
    const rv = e.target.closest('[data-reveal-btn]');
    if (rv) { const a = $('.ans', rv.closest('[data-reveal]')); a.hidden = !a.hidden; rv.setAttribute('aria-expanded', String(!a.hidden)); rv.textContent = a.hidden ? 'Reveal the answer' : 'Hide the answer'; }
  });
  root.addEventListener('keydown', (e) => {
    const fs = e.target.closest && e.target.closest('.flow-steps button');
    if (!fs) return;
    const f = fs.closest('[data-flow]'); let i = +fs.dataset.i;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') i++;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') i--;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = 99;
    else return;
    e.preventDefault();
    const j = selectFlowStep(f, i);
    $$('.flow-steps button', f)[j].focus();
  });
}
/* Flatten a lesson for the tutor prompt. */
function lessonText(lesson) {
  const out = [];
  (lesson.blocks || []).forEach((b) => {
    switch (b.t) {
      case 'p': case 'analogy': out.push(plain(b.text)); break;
      case 'h': out.push('## ' + plain(b.text)); break;
      case 'list': (b.items || []).forEach((x) => out.push('- ' + plain(x))); break;
      case 'callout': out.push('[' + b.kind + '] ' + plain(b.title) + ': ' + plain(b.text)); break;
      case 'compare': out.push('Table ' + plain(b.caption || '') + ': ' + (b.columns || []).join(' | ')); (b.rows || []).forEach((r) => out.push(r.map(plain).join(' | '))); if (b.verdict) out.push('Verdict: ' + plain(b.verdict)); break;
      case 'tradeoff': out.push('Tradeoff ' + plain(b.title || '')); (b.options || []).forEach((o) => out.push(o.name + ': gain ' + o.gain.join('; ') + '. cost ' + o.cost.join('; ') + '. ' + o.choose)); break;
      case 'flow': out.push('Flow ' + plain(b.title || '')); (b.steps || []).forEach((s, i) => out.push((i + 1) + '. ' + s.actor + ': ' + plain(s.label) + '. ' + plain(s.detail || '') + (s.fail ? ' Fails: ' + plain(s.fail) : ''))); break;
      case 'layers': (b.layers || []).forEach((l) => out.push(l.name + ': ' + plain(l.role) + (l.breaks ? ' Breaks: ' + plain(l.breaks) : ''))); break;
      case 'code': out.push('Artifact (' + b.lang + '):\n' + b.code); (b.notes || []).forEach((n) => out.push('Note: ' + plain(n))); break;
      case 'check': out.push('Check: ' + plain(b.q) + ' Answer: ' + plain((b.options || [])[b.answer] || '')); break;
      case 'reveal': out.push('Think: ' + plain(b.prompt) + ' Answer: ' + plain(b.answer)); break;
    }
  });
  return out.join('\n');
}
