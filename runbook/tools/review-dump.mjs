#!/usr/bin/env node
// Prints the quiz and drills of one or more days in a compact form for answer-key review.
// Usage: node runbook/tools/review-dump.mjs d07 [d08 ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = 'ABCDEF';
const art = (a) => (a ? `  [${a.lang}${a.title ? ' · ' + a.title : ''}]\n${a.code.split('\n').map((l) => '  | ' + l).join('\n')}` : '');

for (const id of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `${id}.json`), 'utf8'));
  console.log(`\n===== ${d.id} · ${d.title} =====`);
  console.log(`Lesson titles: ${d.lessons.map((l) => l.title).join(' | ')}`);
  console.log('\n--- inline checks ---');
  d.lessons.forEach((l) => l.blocks.forEach((b, i) => {
    if (b.t !== 'check') return;
    console.log(`\n${l.id} block[${i}] CHECK: ${b.q}`);
    b.options.forEach((o, j) => console.log(`  ${j === b.answer ? '*' : ' '}${L[j]}. ${o}`));
    console.log(`  explain: ${b.explain}`);
  }));
  console.log('\n--- quiz ---');
  for (const q of d.quiz) {
    console.log(`\n${q.id} [${q.type} L${q.level}${q.diagnostic ? ' DIAGNOSTIC' : ''}]`);
    if (q.context) console.log(`  context: ${q.context}`);
    if (q.artifact) console.log(art(q.artifact));
    console.log(`  Q: ${q.q}`);
    if (q.type === 'mcq') q.options.forEach((o, j) => console.log(`  ${j === q.answer ? '*' : ' '}${L[j]}. ${o}${q.why && q.why[j] ? `   (why wrong: ${q.why[j]})` : ''}`));
    if (q.type === 'multi') q.options.forEach((o, j) => console.log(`  ${q.answers.includes(j) ? '*' : ' '}${L[j]}. ${o}`));
    if (q.type === 'order') q.items.forEach((o, j) => console.log(`  ${j + 1}. ${o}`));
    if (q.type === 'match') q.pairs.forEach((p) => console.log(`  ${p[0]}  =>  ${p[1]}`));
    if (q.type === 'open') { console.log(`  rubric: ${q.rubric.join(' / ')}`); console.log(`  model: ${q.model}`); }
    if (q.explain) console.log(`  explain: ${q.explain}`);
  }
  console.log('\n--- drills ---');
  for (const x of d.drills) {
    console.log(`\n${x.id} · ${x.title}\n  brief: ${x.brief}`);
    if (x.artifact) console.log(art(x.artifact));
    x.steps.forEach((s, i) => {
      console.log(`  step ${i + 1}: ${s.q}`);
      s.options.forEach((o, j) => console.log(`    ${j === s.answer ? '*' : ' '}${L[j]}. ${o}`));
      console.log(`    explain: ${s.explain}`);
      if (s.reveal) console.log(`    reveal: ${s.reveal}`);
      if (s.artifact) console.log(art(s.artifact));
    });
    console.log(`  debrief: ${x.debrief}`);
  }
}
