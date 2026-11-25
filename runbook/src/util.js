/* ---------- util.js: escaping, inline marks, DOM helpers, dates ---------- */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]); }

/* Inline marks: **bold**, *italic*, `code`. Everything else is escaped first. */
function md(s) {
  const parts = String(s == null ? '' : s).split(/(`[^`\n]+`)/);
  return parts.map((p) => {
    if (p.length > 1 && p[0] === '`' && p[p.length - 1] === '`') return '<code>' + esc(p.slice(1, -1)) + '</code>';
    return esc(p)
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, '$1<em>$2</em>');
  }).join('');
}
/* Plain text answer from Claude: escape, inline marks, paragraphs and simple lists. */
function mdBlocks(s) {
  const lines = String(s || '').replace(/\r/g, '').split('\n');
  let out = '', list = null, para = [];
  const flushP = () => { if (para.length) { out += '<p>' + md(para.join(' ')) + '</p>'; para = []; } };
  const flushL = () => { if (list) { out += '<' + list.t + '>' + list.items.map((i) => '<li>' + md(i) + '</li>').join('') + '</' + list.t + '>'; list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    const b = line.match(/^[-*•]\s+(.*)$/), n = line.match(/^\d+[.)]\s+(.*)$/);
    if (b || n) {
      flushP();
      const t = b ? 'ul' : 'ol';
      if (!list || list.t !== t) { flushL(); list = { t, items: [] }; }
      list.items.push((b || n)[1]);
    } else if (!line) { flushP(); flushL(); }
    else { flushL(); para.push(line.replace(/^#+\s*/, '')); }
  }
  flushP(); flushL();
  return out;
}
function plain(s) { return String(s || '').replace(/\*\*|`/g, '').replace(/\*([^*]+)\*/g, '$1'); }

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function announce(msg) { const l = $('#live'); if (!l) return; l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); }

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function dayId(n) { return 'd' + pad2(n); }
function isoDate(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function addDays(s, n) { const d = parseDate(s) || new Date(); d.setDate(d.getDate() + n); return isoDate(d); }
function daysBetween(a, b) { const da = parseDate(a), db = parseDate(b); if (!da || !db) return 0; return Math.round((db - da) / 86400000); }
function fmtDate(s) { const d = parseDate(s); if (!d) return ''; return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function pct(x) { return Math.round((x || 0) * 100); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function range(n) { return Array.from({ length: n }, (_, i) => i); }
function shuffledPerm(n, avoidIdentity) {
  let p = shuffle(range(n));
  if (avoidIdentity && n > 1) { let tries = 0; while (p.every((v, i) => v === i) && tries++ < 10) p = shuffle(range(n)); }
  return p;
}
function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
function withTimeout(p, ms) { return Promise.race([p, new Promise((res) => setTimeout(() => res(undefined), ms))]); }
