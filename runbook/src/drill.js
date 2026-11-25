/* ---------- drill.js: incident simulations ---------- */
function startDrill(root, day, drill, opts) {
  const st = { step: 0, first: [], tried: new Set(), solved: false, perm: null, evidence: [], log: [] };
  if (drill.artifact) st.evidence.push({ label: 'Initial evidence', art: drill.artifact });
  const total = (drill.steps || []).length;
  function render() {
    const done = st.step >= total;
    let html = '<div class="drill">' +
      '<div class="brief">' + md(drill.brief) + '</div>' +
      '<div class="evidence">' + st.evidence.map((e) => '<div class="ev-item"><div class="blk-cap">' + esc(e.label) + '</div>' + (e.text ? '<div class="brief" style="font-size:16px">' + md(e.text) + '</div>' : '') + (e.art ? renderCode(e.art) : '') + '</div>').join('') + '</div>';
    if (st.log.length) html += '<ol class="step-log" aria-label="Decisions so far">' + st.log.map((l, i) => '<li><span class="sq">Step ' + (i + 1) + ': ' + md(l.q) + '</span><span><b>' + md(l.a) + '</b>' + (l.first ? '' : ' <span class="chip chip-warn">after a retry</span>') + '</span></li>').join('') + '</ol>';
    if (!done) {
      const s = drill.steps[st.step];
      if (!st.perm) st.perm = shuffledPerm(s.options.length);
      html += '<div class="qcard panel"><div class="qprog"><span class="num">Step ' + (st.step + 1) + ' of ' + total + '</span><div class="meter" aria-hidden="true"><i style="width:' + (100 * st.step / total) + '%"></i></div></div>' +
        '<div class="q" id="dq">' + md(s.q) + '</div><div class="opts" role="group" aria-labelledby="dq">' + st.perm.map((oi, pos) => {
          let cls = 'opt', tag = '';
          if (st.solved && oi === s.answer) { cls += ' right'; tag = 'Best move'; }
          else if (st.tried.has(oi)) { cls += ' wrong'; tag = 'Not this one'; }
          else if (st.solved) cls += ' dim';
          return '<button type="button" class="' + cls + '" data-oi="' + oi + '"' + (st.solved || st.tried.has(oi) ? ' aria-disabled="true"' : '') + '><span class="k">' + (pos + 1) + '</span><span>' + md(s.options[oi]) + '</span>' + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</button>';
        }).join('') + '</div><div class="dfb" aria-live="polite">' + feedback(s) + '</div>' +
        (st.solved ? '<div class="qactions"><button type="button" class="btn btn-primary" data-next>' + (st.step + 1 < total ? 'Next step' : 'Read the debrief') + '</button></div>' : '') + '</div>';
    } else {
      const score = total ? st.first.filter(Boolean).length / total : 0;
      html += '<div class="debrief"><div class="blk-cap" style="margin:0">Debrief</div>' + md(drill.debrief) + '</div>' +
        '<div class="row"><span class="chip ' + (score >= 0.8 ? 'chip-ok' : 'chip-warn') + '">' + st.first.filter(Boolean).length + ' of ' + total + ' steps right on the first try</span></div>' +
        '<div class="row"><button type="button" class="btn" data-restart>Run this drill again</button>' + (opts && opts.after ? opts.after() : '') + '</div>';
    }
    root.innerHTML = html + '</div>';
  }
  function feedback(s) {
    if (st.solved) return '<div class="fb ok"><div class="fb-h"><span class="mark">&#10003;</span>Good call</div><div>' + md(s.explain) + '</div></div>';
    if (st.tried.size) return '<div class="fb bad"><div class="fb-h"><span class="mark">&#215;</span>Not the best next move</div><div>Ask what that would tell you that you do not already know, and what it costs. Cheap evidence that halves the search space usually comes first. Choose again.</div></div>';
    return '';
  }
  root.onclick = (e) => {
    if (e.target.closest('[data-restart]')) { startDrill(root, day, drill, opts); return; }
    if (e.target.closest('[data-next]')) {
      st.step++; st.tried = new Set(); st.solved = false; st.perm = null; render();
      if (st.step >= total) { const score = total ? st.first.filter(Boolean).length / total : 0; recordResult('drills', drill.id, score); announce('Drill finished. ' + st.first.filter(Boolean).length + ' of ' + total + ' first-try answers.'); }
      const f = $('.qcard .opt, .debrief', root); if (f) { f.setAttribute('tabindex', f.getAttribute('tabindex') || '-1'); f.focus(); }
      return;
    }
    const o = e.target.closest('.opt'); if (!o || st.solved || st.step >= total) return;
    const s = drill.steps[st.step], oi = +o.dataset.oi;
    if (st.tried.has(oi)) return;
    if (oi === s.answer) {
      st.solved = true; st.first[st.step] = st.tried.size === 0;
      st.log.push({ q: s.q, a: s.options[s.answer], first: st.tried.size === 0 });
      if (s.reveal || s.artifact) st.evidence.push({ label: 'New evidence after step ' + (st.step + 1), text: s.reveal, art: s.artifact });
      render(); announce('Good call. ' + plain(s.explain));
      const nb = $('[data-next]', root); if (nb) nb.focus({ preventScroll: true });
    } else {
      st.tried.add(oi); render(); announce('Not the best next move. Choose again.');
    }
  };
  render();
}
