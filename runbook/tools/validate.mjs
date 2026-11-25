#!/usr/bin/env node
// Validates day content files against runbook/SCHEMA.md.
// Usage: node runbook/tools/validate.mjs runbook/data/d01.json [more files...]
//        node runbook/tools/validate.mjs --all
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'plan.json'), 'utf8'));

const LANGS = ['http', 'sql', 'log', 'json', 'python', 'shell', 'text', 'yaml', 'trace', 'plan', 'diff'];
const CALLOUTS = ['insight', 'pitfall', 'debug', 'rule', 'ai'];
const BLOCKS = ['p', 'h', 'list', 'callout', 'compare', 'tradeoff', 'flow', 'layers', 'code', 'analogy', 'check', 'reveal'];
const QTYPES = ['mcq', 'multi', 'order', 'match', 'open'];

let errors = [];
let warnings = [];
let where = '';
const err = (m) => errors.push(`${where}: ${m}`);
const warn = (m) => warnings.push(`${where}: ${m}`);

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const words = (s) => (typeof s === 'string' ? s.trim().split(/\s+/).filter(Boolean).length : 0);

function keys(obj, required, optional = []) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) { err('expected an object'); return false; }
  for (const k of required) if (!(k in obj)) err(`missing "${k}"`);
  for (const k of Object.keys(obj)) if (!required.includes(k) && !optional.includes(k)) err(`unknown key "${k}"`);
  return true;
}
function str(obj, k, { max, minWords } = {}) {
  if (!(k in obj)) return;
  if (!isStr(obj[k])) { err(`"${k}" must be a non-empty string`); return; }
  text(obj[k], k);
  if (max && obj[k].length > max) err(`"${k}" is ${obj[k].length} chars, max ${max}`);
  if (minWords && words(obj[k]) < minWords) err(`"${k}" has ${words(obj[k])} words, needs at least ${minWords}`);
}
function strArr(obj, k, min, max) {
  if (!(k in obj)) return;
  const a = obj[k];
  if (!Array.isArray(a) || a.some((x) => !isStr(x))) { err(`"${k}" must be an array of non-empty strings`); return; }
  if (a.length < min || a.length > max) err(`"${k}" has ${a.length} items, expected ${min} to ${max}`);
  a.forEach((x) => text(x, k));
}
// Inline markup rules for prose strings.
function text(s, k) {
  if (/<\/?[a-zA-Z][^>]*>/.test(s.replace(/`[^`]*`/g, ''))) err(`"${k}" contains HTML tags; use **bold**, *italic*, \`code\` only`);
  if (/\]\(/.test(s)) err(`"${k}" contains a markdown link; links are not supported`);
  if (/^#{1,6}\s/m.test(s)) err(`"${k}" contains a markdown heading; use an "h" block`);
  if ((s.match(/`/g) || []).length % 2) err(`"${k}" has an unbalanced backtick`);
  if ((s.replace(/`[^`]*`/g, '').match(/\*\*/g) || []).length % 2) err(`"${k}" has unbalanced **bold** markers`);
  if (/\n/.test(s)) err(`"${k}" contains a newline; split into separate blocks or items`);
  if (/—/.test(s)) warn(`"${k}" uses an em dash; prefer a comma, colon, or two sentences`);
}
function artifact(a, label) {
  const w = where; where = `${w} ${label}`;
  if (keys(a, ['lang', 'code'], ['title', 'notes'])) {
    if (!LANGS.includes(a.lang)) err(`lang "${a.lang}" not in ${LANGS.join(', ')}`);
    if (typeof a.code !== 'string' || !a.code.trim()) err('"code" must be a non-empty string');
    else {
      const lines = a.code.split('\n');
      if (lines.length > 28) err(`code has ${lines.length} lines, max 28`);
      if (a.code.length > 1800) err(`code is ${a.code.length} chars, max 1800`);
      if (lines.some((l) => l.length > 110)) warn('a code line is longer than 110 chars');
    }
    if ('title' in a && !isStr(a.title)) err('"title" must be a non-empty string');
    if ('notes' in a) strArr(a, 'notes', 1, 6);
  }
  where = w;
}
function choice(o, { minOpt = 3, maxOpt = 4 } = {}) {
  if (!Array.isArray(o.options) || o.options.some((x) => !isStr(x))) { err('"options" must be an array of strings'); return; }
  if (o.options.length < minOpt || o.options.length > maxOpt) err(`has ${o.options.length} options, expected ${minOpt} to ${maxOpt}`);
  if (new Set(o.options.map((x) => x.trim().toLowerCase())).size !== o.options.length) err('duplicate options');
  o.options.forEach((x) => {
    text(x, 'options');
    if (/\b(all|none) of the above\b|\bboth [a-d] and [a-d]\b|\boption [a-d]\b/i.test(x)) err(`option refers to other options by position: "${x}"`);
  });
  if (!Number.isInteger(o.answer) || o.answer < 0 || o.answer >= o.options.length) err('"answer" must be a valid option index');
  else {
    const others = o.options.filter((_, i) => i !== o.answer);
    const mean = others.reduce((s, x) => s + x.length, 0) / others.length;
    if (o.options[o.answer].length > mean * 1.7 && o.options[o.answer].length - mean > 30) warn('the correct option is much longer than the distractors');
  }
}

function block(b, i, counts) {
  const w = where; where = `${w} block[${i}]`;
  if (b === null || typeof b !== 'object' || !BLOCKS.includes(b.t)) { err(`"t" must be one of ${BLOCKS.join(', ')}`); where = w; return 0; }
  counts[b.t] = (counts[b.t] || 0) + 1;
  let n = 0;
  switch (b.t) {
    case 'p': keys(b, ['t', 'text']); str(b, 'text'); n = words(b.text); if (n > 110) warn(`paragraph has ${n} words; keep under about 90`); break;
    case 'h': keys(b, ['t', 'text']); str(b, 'text', { max: 70 }); break;
    case 'analogy': keys(b, ['t', 'text']); str(b, 'text'); n = words(b.text); break;
    case 'list':
      keys(b, ['t', 'items'], ['style']); strArr(b, 'items', 2, 8);
      if ('style' in b && !['bullet', 'number'].includes(b.style)) err('"style" must be bullet or number');
      n = (b.items || []).reduce((s, x) => s + words(x), 0); break;
    case 'callout':
      keys(b, ['t', 'kind', 'title', 'text']);
      if (!CALLOUTS.includes(b.kind)) err(`callout kind must be one of ${CALLOUTS.join(', ')}`);
      counts['callout:' + b.kind] = (counts['callout:' + b.kind] || 0) + 1;
      str(b, 'title', { max: 70 }); str(b, 'text'); n = words(b.text); break;
    case 'compare':
      keys(b, ['t', 'columns', 'rows'], ['caption', 'verdict']);
      if (!Array.isArray(b.columns) || b.columns.length < 3 || b.columns.length > 4 || b.columns.some((c) => typeof c !== 'string')) err('"columns" must be 3 or 4 strings (first may be "")');
      if (!Array.isArray(b.rows) || b.rows.length < 3 || b.rows.length > 8) err('"rows" must have 3 to 8 rows');
      else b.rows.forEach((r, j) => {
        if (!Array.isArray(r) || r.length !== (b.columns || []).length || r.some((c) => !isStr(c))) err(`row ${j} must have ${(b.columns || []).length} non-empty strings`);
        else { r.forEach((c) => text(c, 'rows')); n += r.reduce((s, x) => s + words(x), 0); if (r.some((c) => words(c) > 28)) warn(`row ${j} has a cell over 28 words; table cells must stay short`); }
      });
      str(b, 'caption', { max: 90 }); str(b, 'verdict'); n += words(b.verdict); break;
    case 'tradeoff':
      keys(b, ['t', 'title', 'options']); str(b, 'title', { max: 80 });
      if (!Array.isArray(b.options) || b.options.length < 2 || b.options.length > 4) err('"options" must have 2 to 4 entries');
      else b.options.forEach((o, j) => {
        const w2 = where; where = `${w2} option[${j}]`;
        if (keys(o, ['name', 'gain', 'cost', 'choose'])) { str(o, 'name', { max: 50 }); strArr(o, 'gain', 1, 4); strArr(o, 'cost', 1, 4); str(o, 'choose'); n += words(o.choose) + [...(o.gain || []), ...(o.cost || [])].reduce((s, x) => s + words(x), 0); }
        where = w2;
      });
      break;
    case 'flow':
      keys(b, ['t', 'title', 'steps']); str(b, 'title', { max: 80 });
      if (!Array.isArray(b.steps) || b.steps.length < 3 || b.steps.length > 9) err('"steps" must have 3 to 9 entries');
      else b.steps.forEach((s, j) => {
        const w2 = where; where = `${w2} step[${j}]`;
        if (keys(s, ['actor', 'label', 'detail'], ['fail'])) { str(s, 'actor', { max: 28 }); str(s, 'label', { max: 60 }); str(s, 'detail'); str(s, 'fail'); n += words(s.detail) + words(s.fail); }
        where = w2;
      });
      break;
    case 'layers':
      keys(b, ['t', 'title', 'layers']); str(b, 'title', { max: 80 });
      if (!Array.isArray(b.layers) || b.layers.length < 3 || b.layers.length > 7) err('"layers" must have 3 to 7 entries');
      else b.layers.forEach((s, j) => {
        const w2 = where; where = `${w2} layer[${j}]`;
        if (keys(s, ['name', 'role'], ['breaks'])) { str(s, 'name', { max: 40 }); str(s, 'role'); str(s, 'breaks'); n += words(s.role) + words(s.breaks); }
        where = w2;
      });
      break;
    case 'code': {
      const { t, ...rest } = b; artifact(rest, 'code'); n = (b.notes || []).reduce((s, x) => s + words(x), 0); break;
    }
    case 'check': keys(b, ['t', 'q', 'options', 'answer', 'explain']); str(b, 'q'); choice(b); str(b, 'explain', { minWords: 8 }); n = words(b.q) + words(b.explain); break;
    case 'reveal': keys(b, ['t', 'prompt', 'answer']); str(b, 'prompt'); str(b, 'answer', { minWords: 8 }); n = words(b.prompt) + words(b.answer); break;
  }
  where = w;
  return n;
}

function question(q, dayId, idx, relaxed) {
  const base = ['id', 'type', 'level', 'tags', 'q'];
  const opt = ['diagnostic', 'context', 'artifact'];
  if (q === null || typeof q !== 'object') { err('question must be an object'); return; }
  if (!QTYPES.includes(q.type)) { err(`"type" must be one of ${QTYPES.join(', ')}`); return; }
  const extra = { mcq: ['options', 'answer', 'explain'], multi: ['options', 'answers', 'explain'], order: ['items', 'explain'], match: ['pairs', 'explain'], open: ['rubric', 'model'] }[q.type];
  keys(q, [...base, ...extra], q.type === 'mcq' ? [...opt, 'why'] : opt);
  const want = `${dayId}-q${String(idx + 1).padStart(2, '0')}`;
  if (q.id !== want) err(`id should be "${want}", got "${q.id}"`);
  if (![1, 2, 3].includes(q.level)) err('"level" must be 1, 2, or 3');
  if (!Array.isArray(q.tags) || q.tags.length < 1 || q.tags.length > 4 || q.tags.some((t) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t))) err('"tags" must be 1 to 4 lowercase-kebab strings');
  str(q, 'q'); str(q, 'context');
  if ('artifact' in q) artifact(q.artifact, 'artifact');
  if ('diagnostic' in q && (q.diagnostic !== true || q.type !== 'mcq')) err('"diagnostic" may only be true, on an mcq');
  if (q.type !== 'open') str(q, 'explain', { minWords: relaxed ? 8 : 18 });
  if (q.type === 'mcq') {
    choice(q, { minOpt: 4, maxOpt: 4 });
    if ('why' in q) {
      if (!Array.isArray(q.why) || q.why.length !== 4 || q.why.some((x) => typeof x !== 'string')) err('"why" must be an array of 4 strings (use "" at the correct index)');
      else q.why.forEach((x, i) => { if (i !== q.answer && !isStr(x)) err(`"why[${i}]" is empty for a wrong option`); if (isStr(x)) text(x, 'why'); });
    }
  }
  if (q.type === 'multi') {
    if (!Array.isArray(q.options) || q.options.length < 4 || q.options.length > 6 || q.options.some((x) => !isStr(x))) err('"options" must be 4 to 6 strings');
    else if (new Set(q.options).size !== q.options.length) err('duplicate options');
    const a = q.answers;
    if (!Array.isArray(a) || a.length < 2 || new Set(a).size !== a.length || a.some((x) => !Number.isInteger(x) || x < 0 || x >= (q.options || []).length)) err('"answers" must be 2 or more unique valid indices');
    else if (a.length === (q.options || []).length) err('"answers" must not include every option');
  }
  if (q.type === 'order') { strArr(q, 'items', 4, 6); if (Array.isArray(q.items) && new Set(q.items).size !== q.items.length) err('duplicate items'); }
  if (q.type === 'match') {
    const p = q.pairs;
    if (!Array.isArray(p) || p.length < 4 || p.length > 5 || p.some((x) => !Array.isArray(x) || x.length !== 2 || !isStr(x[0]) || !isStr(x[1]))) err('"pairs" must be 4 or 5 [left, right] string pairs');
    else {
      if (new Set(p.map((x) => x[0])).size !== p.length || new Set(p.map((x) => x[1])).size !== p.length) err('lefts and rights must each be unique');
      if (p.some((x) => x[0].length > 70 || x[1].length > 110)) warn('match pair text is long; keep left under 70 and right under 110 chars');
    }
  }
  if (q.type === 'open') { strArr(q, 'rubric', 3, 5); str(q, 'model', { minWords: relaxed ? 15 : 35 }); }
}

function drill(d, dayId, idx) {
  if (!keys(d, ['id', 'title', 'brief', 'steps', 'debrief'], ['artifact'])) return;
  const want = `${dayId}-x${idx + 1}`;
  if (d.id !== want) err(`id should be "${want}", got "${d.id}"`);
  str(d, 'title', { max: 80 }); str(d, 'brief', { minWords: 25 }); str(d, 'debrief', { minWords: 30 });
  if ('artifact' in d) artifact(d.artifact, 'artifact');
  if (!Array.isArray(d.steps) || d.steps.length < 3 || d.steps.length > 5) { err('"steps" must have 3 to 5 entries'); return; }
  d.steps.forEach((s, j) => {
    const w = where; where = `${w} step[${j}]`;
    if (keys(s, ['q', 'options', 'answer', 'explain'], ['reveal', 'artifact'])) { str(s, 'q'); choice(s); str(s, 'explain', { minWords: 12 }); str(s, 'reveal'); if ('artifact' in s) artifact(s.artifact, 'artifact'); }
    where = w;
  });
}

function validateDay(file) {
  const name = path.basename(file);
  where = name;
  let d;
  try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(`invalid JSON: ${e.message}`); return null; }
  if (!keys(d, ['id', 'day', 'phase', 'title', 'tagline', 'minutes', 'why', 'objectives', 'lessons', 'fieldGuide', 'glossary', 'apply', 'quiz', 'drills'], ['example'])) return null;
  const isExample = d.example === true;
  const isCapstone = d.day === 30;
  if (!/^d\d\d$/.test(d.id) || Number(d.id.slice(1)) !== d.day) err('"id" must be dNN matching "day"');
  if (name !== `${d.id}.json`) err(`file name should be ${d.id}.json`);
  const p = plan.days.find((x) => x.id === d.id);
  if (!isExample) {
    if (!p) err(`${d.id} is not in plan.json`);
    else {
      if (d.phase !== p.phase) err(`phase should be ${p.phase}`);
      if (d.title !== p.title) err(`title must match plan.json exactly: "${p.title}"`);
    }
  }
  str(d, 'title', { max: 64 }); str(d, 'tagline', { max: 150 }); str(d, 'why', { minWords: isExample ? 10 : 30 });
  if (!Number.isInteger(d.minutes) || d.minutes < 15 || d.minutes > 90) err('"minutes" must be an integer from 15 to 90');
  strArr(d, 'objectives', 3, 5);

  // lessons
  const nLessons = isExample ? [1, 4] : isCapstone ? [3, 3] : [4, 4];
  const dayCounts = {};
  if (!Array.isArray(d.lessons) || d.lessons.length < nLessons[0] || d.lessons.length > nLessons[1]) err(`expected ${nLessons[0]} to ${nLessons[1]} lessons`);
  else d.lessons.forEach((l, i) => {
    where = `${name} lesson[${i}]`;
    if (!keys(l, ['id', 'title', 'minutes', 'blocks'])) return;
    if (l.id !== `${d.id}-l${i + 1}`) err(`id should be "${d.id}-l${i + 1}"`);
    str(l, 'title', { max: 70 });
    if (p && !isExample && p.lessons[i] && l.title !== p.lessons[i].title) err(`title must match plan.json exactly: "${p.lessons[i].title}"`);
    if (!Number.isInteger(l.minutes) || l.minutes < 3 || l.minutes > 15) err('"minutes" must be an integer from 3 to 15');
    if (!Array.isArray(l.blocks) || l.blocks.length < (isExample ? 3 : 7)) { err(`needs at least ${isExample ? 3 : 7} blocks`); return; }
    const counts = {};
    let n = 0;
    l.blocks.forEach((b, j) => { n += block(b, j, counts); });
    for (const k of Object.keys(counts)) dayCounts[k] = (dayCounts[k] || 0) + counts[k];
    if (!isExample) {
      if (n < 380) err(`lesson has about ${n} words of prose; needs at least 380`);
      if (n > 950) warn(`lesson has about ${n} words; aim for 450 to 750`);
      if (l.blocks[0].t !== 'p') warn('a lesson should open with a "p" block');
      if (!(counts.check || counts.reveal)) err('lesson needs at least one "check" or "reveal" block');
      if (!isCapstone && !(counts.compare || counts.tradeoff)) err('lesson needs at least one "compare" or "tradeoff" block');
      if (!(counts['callout:debug'] || counts['callout:pitfall'])) err('lesson needs at least one callout of kind "debug" or "pitfall"');
      if ((counts.p || 0) > l.blocks.length * 0.6) warn('lesson is mostly plain paragraphs; use more structured blocks');
    }
  });
  where = name;
  if (!isExample && !isCapstone) {
    if (!(dayCounts.flow || dayCounts.layers)) err('day needs at least one "flow" or "layers" block');
    if ((dayCounts.code || 0) < 2) err('day needs at least two "code" blocks (artifacts to read: an HTTP exchange, a log, a plan, a trace)');
    if (!dayCounts.tradeoff) err('day needs at least one "tradeoff" block');
    if (!dayCounts['callout:debug']) err('day needs at least one "debug" callout');
  }

  // field guide
  where = `${name} fieldGuide`;
  const fg = isExample ? [2, 10] : [6, 10];
  if (!Array.isArray(d.fieldGuide) || d.fieldGuide.length < fg[0] || d.fieldGuide.length > fg[1]) err(`expected ${fg[0]} to ${fg[1]} rows`);
  else d.fieldGuide.forEach((r, i) => {
    where = `${name} fieldGuide[${i}]`;
    if (keys(r, ['symptom', 'causes', 'look', 'confirm', 'fix'])) { str(r, 'symptom', { max: 140 }); strArr(r, 'causes', 1, 4); str(r, 'look'); str(r, 'confirm'); str(r, 'fix'); }
  });

  // glossary
  where = `${name} glossary`;
  const gl = isExample ? [3, 14] : [8, 14];
  if (!Array.isArray(d.glossary) || d.glossary.length < gl[0] || d.glossary.length > gl[1]) err(`expected ${gl[0]} to ${gl[1]} terms`);
  else {
    d.glossary.forEach((g, i) => { where = `${name} glossary[${i}]`; if (keys(g, ['term', 'def'])) { str(g, 'term', { max: 48 }); str(g, 'def'); if (words(g.def) > 45) warn('definition over 45 words'); } });
    where = `${name} glossary`;
    if (new Set(d.glossary.map((g) => String(g.term).toLowerCase())).size !== d.glossary.length) err('duplicate terms');
  }

  // apply
  where = `${name} apply`;
  if (keys(d.apply, ['title', 'minutes', 'steps'])) {
    str(d.apply, 'title', { max: 80 }); strArr(d.apply, 'steps', 2, 5);
    if (!Number.isInteger(d.apply.minutes) || d.apply.minutes < 5 || d.apply.minutes > 30) err('"minutes" must be an integer from 5 to 30');
  }

  // quiz
  where = `${name} quiz`;
  const nQ = isExample ? [5, 12] : isCapstone ? [15, 15] : [12, 12];
  if (!Array.isArray(d.quiz) || d.quiz.length < nQ[0] || d.quiz.length > nQ[1]) err(`expected ${nQ[0] === nQ[1] ? nQ[0] : nQ[0] + ' to ' + nQ[1]} questions`);
  else {
    d.quiz.forEach((q, i) => { where = `${name} quiz[${i}]`; question(q, d.id, i, isExample); });
    where = `${name} quiz`;
    const by = (t) => d.quiz.filter((q) => q.type === t).length;
    for (const t of QTYPES) if (by(t) < 1) err(`needs at least one "${t}" question`);
    if (!isExample) {
      if (by('mcq') < 6) err('needs at least 6 mcq questions');
      if (by('open') > 2) err('at most 2 open questions');
      if (d.quiz.filter((q) => q.level === 3).length < 4) err('needs at least 4 level-3 (diagnose) questions');
      if (d.quiz.filter((q) => q.level === 1).length > 4) err('at most 4 level-1 (recall) questions');
      if (d.quiz.filter((q) => q.context || q.artifact).length < 4) err('needs at least 4 questions with "context" or "artifact"');
      if (d.quiz.filter((q) => q.artifact).length < 2) err('needs at least 2 questions with an "artifact" to read');
      const diag = d.quiz.filter((q) => q.diagnostic).length;
      if (!isCapstone && diag !== 1) err(`exactly one question must have "diagnostic": true (found ${diag})`);
      const mcq = d.quiz.filter((q) => q.type === 'mcq');
      if (mcq.filter((q) => Array.isArray(q.why)).length < Math.ceil(mcq.length / 2)) err('at least half of the mcq questions need a "why" array');
    }
  }

  // drills
  where = `${name} drills`;
  const nD = isExample ? [1, 2] : isCapstone ? [6, 6] : [2, 2];
  if (!Array.isArray(d.drills) || d.drills.length < nD[0] || d.drills.length > nD[1]) err(`expected ${nD[0] === nD[1] ? nD[0] : nD[0] + ' to ' + nD[1]} drills`);
  else d.drills.forEach((x, i) => { where = `${name} drills[${i}]`; drill(x, d.id, i); });

  where = name;
  const total = JSON.stringify(d).length;
  return { id: d.id, lessons: (d.lessons || []).length, quiz: (d.quiz || []).length, drills: (d.drills || []).length, kb: Math.round(total / 1024) };
}

const args = process.argv.slice(2);
let files = args.filter((a) => !a.startsWith('--'));
if (args.includes('--all')) files = fs.readdirSync(path.join(ROOT, 'data')).filter((f) => /^d\d\d\.json$/.test(f)).sort().map((f) => path.join(ROOT, 'data', f));
if (!files.length) { console.error('usage: validate.mjs <file...> | --all'); process.exit(2); }

let bad = 0;
for (const f of files) {
  errors = []; warnings = [];
  const stats = validateDay(f);
  const tag = errors.length ? 'FAIL' : 'ok  ';
  console.log(`${tag} ${path.basename(f)}${stats ? `  lessons=${stats.lessons} quiz=${stats.quiz} drills=${stats.drills} size=${stats.kb}KB` : ''}  errors=${errors.length} warnings=${warnings.length}`);
  errors.forEach((e) => console.log(`  ERROR ${e}`));
  if (!args.includes('--quiet')) warnings.forEach((e) => console.log(`  warn  ${e}`));
  if (errors.length) bad++;
}
process.exit(bad ? 1 : 0);
