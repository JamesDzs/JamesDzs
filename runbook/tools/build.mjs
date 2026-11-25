#!/usr/bin/env node
// Build the single-page app: runbook/index.html (publishable) and runbook/preview.html (local testing).
// Usage: node tools/build.mjs [--dev]   (--dev adds data/d00.json as an "Example" day)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEV = process.argv.includes('--dev');
const JS_ORDER = ['util.js', 'store.js', 'content.js', 'blocks.js', 'quiz.js', 'drill.js', 'tutor.js', 'views.js', 'main.js'];

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const plan = JSON.parse(read('plan.json'));
const pad = (n) => String(n).padStart(2, '0');

function dayFile(id) {
  const p = join(ROOT, 'data', id + '.json');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.warn(`warn: ${id}.json is not valid JSON yet (${e.message}); treated as not written`); return null; }
}
function metaFrom(planDay, d) {
  const id = planDay.id;
  if (!d || !Array.isArray(d.lessons) || !Array.isArray(d.quiz)) {
    return { id, day: planDay.day, phase: planDay.phase, title: planDay.title, tagline: planDay.tagline, available: false,
      lessons: planDay.lessons.map((l, i) => ({ id: `${id}-l${i + 1}`, title: l.title, scope: l.scope })), drills: [] };
  }
  return {
    id, day: planDay.day, phase: planDay.phase, title: planDay.title, tagline: d.tagline || planDay.tagline, available: true,
    minutes: d.minutes || null,
    lessons: d.lessons.map((l, i) => ({ id: l.id || `${id}-l${i + 1}`, title: l.title, minutes: l.minutes || null })),
    quizCount: d.quiz.length, drillCount: (d.drills || []).length,
    fieldGuideCount: (d.fieldGuide || []).length, glossaryCount: (d.glossary || []).length,
    drills: (d.drills || []).map((x) => ({ id: x.id, title: x.title })),
    ...(d.example ? { example: true } : {})
  };
}

const days = plan.days.map((pd) => metaFrom(pd, dayFile(pd.id)));
if (DEV) {
  const ex = dayFile('d00');
  if (ex) days.unshift(metaFrom({ id: 'd00', day: 0, phase: ex.phase || 'p1', title: ex.title, tagline: ex.tagline, lessons: [] }, ex));
}
const curriculum = { title: plan.title, built: new Date().toISOString(), dev: DEV, phases: plan.phases, checkpoints: plan.checkpoints, days };

const css = read('src/app.css');
const js = '(function () {\n"use strict";\n' + JS_ORDER.map((f) => `/* ===== ${f} ===== */\n` + read('src/' + f)).join('\n') + '\n})();\n';
const safeJs = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const safeJson = JSON.stringify(curriculum).replace(/</g, '\\u003c');
const safeCss = css.replace(/<\/style/gi, '<\\/style');

let html = read('src/index.html');
const put = (marker, value) => {
  if (!html.includes(marker)) throw new Error('missing marker ' + marker);
  html = html.split(marker).join(value);
};
put('/*__CSS__*/', safeCss);
put('/*__CURRICULUM__*/', safeJson);
put('/*__JS__*/', safeJs);

writeFileSync(join(ROOT, 'index.html'), html);
const skeleton = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
writeFileSync(join(ROOT, 'preview.html'), skeleton + html + '</body></html>');

const avail = days.filter((d) => d.available && d.day > 0).length;
console.log(`built index.html (${(html.length / 1024).toFixed(1)} KiB) and preview.html; ${avail}/30 days written${DEV ? '; dev build includes d00' : ''}`);
