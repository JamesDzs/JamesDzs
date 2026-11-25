// Smoke test for the Runbook app. Build with `node tools/build.mjs --dev`, serve runbook/ on :8765, then:
//   node tools/smoke.cjs [baseUrl] [shotDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8765/preview.html';
const SHOTS = process.argv[3] || '/tmp/claude-0/-home-user-JamesDzs/c51b0dba-1670-5612-ba60-1e45b8ee412d/scratchpad/shots';
const D00 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'd00.json'), 'utf8'));
fs.mkdirSync(SHOTS, { recursive: true });

const problems = [];
const notes = [];
function fail(msg) { problems.push(msg); console.log('  FAIL ' + msg); }
function ok(msg) { console.log('  ok   ' + msg); }
function expect(cond, msg) { if (cond) ok(msg); else fail(msg); }

async function go(page, hash, sel) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  if (sel) await page.waitForSelector(sel, { timeout: 8000 });
  await page.waitForTimeout(120);
}
async function overflow(page, cfg, label) {
  if (cfg.w > 500) return;
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  if (r.sw > r.iw) fail(`${cfg.name} ${label}: horizontal overflow ${r.sw} > ${r.iw}`);
}
async function shot(page, cfg, label, full) {
  await page.screenshot({ path: path.join(SHOTS, `${cfg.name}-${label}.png`), fullPage: !!full });
}

function newPage(browser, cfg) {
  return browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, colorScheme: cfg.scheme }).then(async (ctx) => {
    await ctx.addInitScript(() => { try { localStorage.setItem('rb_dev_tutor', '1'); } catch (e) { /* */ } });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/fonts\.(googleapis|gstatic)/.test(t) && !/data\/d\d\d\.json/.test(t) && !/Failed to load resource/.test(t)) fail(`${cfg.name} console error: ${t}`); } });
    page.on('pageerror', (e) => fail(`${cfg.name} page error: ${e.message}`));
    page.on('requestfailed', (r) => { const u = r.url(); if (/fonts\.(googleapis|gstatic)/.test(u)) notes.push('font request failed (network): ' + u.slice(0, 80)); else fail(`${cfg.name} request failed: ${u}`); });
    page.on('response', (r) => { const u = r.url(); if (r.status() >= 400 && !/data\/d\d\d\.json/.test(u)) fail(`${cfg.name} HTTP ${r.status()} ${u}`); });
    return { ctx, page };
  });
}

async function answerQuestion(page, q, right) {
  await page.waitForSelector('.qbody', { timeout: 5000 });
  if (q.type === 'mcq') {
    if (right) {
      const pos = await page.$$eval('.qbody .opt', (els, a) => els.findIndex((e) => e.dataset.oi === String(a)), q.answer);
      await page.keyboard.press(String(pos + 1));
      await page.keyboard.press('Enter');
    } else {
      await page.click(`.qbody .opt[data-oi="${(q.answer + 1) % q.options.length}"]`);
      await page.click('[data-act="submit"]');
    }
  } else if (q.type === 'multi') {
    const picks = right ? q.answers : [q.answers[0]];
    for (const i of picks) await page.click(`.qbody .opt[data-oi="${i}"]`);
    await page.click('[data-act="submit"]');
  } else if (q.type === 'order') {
    if (right) {
      for (let i = 0; i < q.items.length; i++) {
        for (let guard = 0; guard < 10; guard++) {
          const texts = await page.$$eval('.order-list li', (els) => els.map((e) => e.children[1].textContent));
          const p = texts.findIndex((t) => t === q.items[i].replace(/\*\*|`/g, ''));
          if (p <= i) break;
          await page.click(`.order-list li[data-pos="${p}"] [data-mv="-1"]`);
        }
      }
    }
    await page.click('[data-act="submit"]');
  } else if (q.type === 'match') {
    for (let i = 0; i < q.pairs.length; i++) await page.selectOption(`select[data-li="${i}"]`, String(right ? i : (i + 1) % q.pairs.length));
    await page.click('[data-act="submit"]');
  } else if (q.type === 'open') {
    await page.fill('.qbody textarea', right ? 'Group failures by error type before reading transcripts; rerun errored cases at the old concurrency.' : 'Not sure.');
    await page.click('[data-act="submit"]');
    await page.waitForSelector('.rubric');
    if (right) {
      await page.click('[data-act="grade"]');
      await page.waitForSelector('.grade-fb .fb', { timeout: 5000 });
      for (const cb of await page.$$('.rubric input')) await cb.check();
    }
    await page.click('[data-act="submit"]');
  }
  await page.waitForSelector('.qfb .fb', { timeout: 4000 });
  const good = await page.$('.qfb .fb.ok');
  expect(!!good === right, `${q.id} (${q.type}) answered ${right ? 'right' : 'wrong'} and graded ${good ? 'right' : 'wrong'}`);
}

async function fullFlow(browser, cfg) {
  console.log(`\n== full flow: ${cfg.name}`);
  const { ctx, page } = await newPage(browser, cfg);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('.today-hero');
  expect(!!(await page.$('#setup-form')), 'first run shows the inline setup card');
  await shot(page, cfg, '01-today-first-run', true);
  await overflow(page, cfg, 'today');
  await page.fill('#setup-note', 'An eval harness for a support agent');
  await page.click('#setup-form button[type="submit"]');
  await page.waitForTimeout(150);
  expect(!(await page.$('#setup-form')), 'setup card closes after saving');

  await go(page, '#path', '.trace .tr');
  expect((await page.$$('.trace a.tr')).length === 30, 'path shows 30 day spans');
  await shot(page, cfg, '02-path', true); await overflow(page, cfg, 'path');

  await go(page, '#d00', '.lesson-list');
  await shot(page, cfg, '03-day-d00', true); await overflow(page, cfg, 'day d00');
  await page.click('[data-apply]');
  expect((await page.getAttribute('[data-apply]', 'aria-pressed')) === 'true', 'apply toggle marks done');

  await go(page, '#d00-l1', '.article .blk');
  await overflow(page, cfg, 'lesson 1');
  await page.click('.flow-steps li:nth-child(2) button');
  await page.keyboard.press('ArrowDown');
  const cur = await page.$eval('.flow-steps button[aria-current="step"] .n', (e) => e.textContent);
  expect(cur === '3', 'flow step-through works by click and arrow key');
  expect(!!(await page.$('.flow-detail .ff')), 'flow shows the failure panel');
  await page.click('[data-check] .opt[data-i="1"]');
  expect(!!(await page.$('[data-check] .fb.bad')), 'inline check gives feedback');
  await page.click('.tutor .quick button');
  await page.waitForFunction(() => { const m = document.querySelector('.tutor-msg.ai'); return m && /canned answer/.test(m.textContent); }, null, { timeout: 5000 });
  ok('tutor panel streams a (mock) answer');
  await shot(page, cfg, '04-lesson-l1', true);
  await page.click('[data-complete]');
  await page.waitForFunction(() => location.hash === '#d00-l2');
  await page.waitForSelector('.article .code');
  await page.click('[data-reveal-btn]');
  expect(await page.isVisible('.reveal .ans'), 'reveal shows the answer');
  await shot(page, cfg, '05-lesson-l2', true); await overflow(page, cfg, 'lesson 2');
  await page.click('[data-complete]');
  await page.waitForFunction(() => location.hash === '#d00-quiz');

  await page.waitForSelector('.qbody');
  for (const q of D00.quiz) {
    await answerQuestion(page, q, true);
    if (q.type === 'match') await shot(page, cfg, '06-quiz-match');
    await page.click('[data-act="submit"]');
  }
  await page.waitForSelector('.score-big');
  expect((await page.textContent('.score-big')).startsWith('100%'), 'all-right pass scores 100%');
  await shot(page, cfg, '07-quiz-results-100', true);
  await page.click('[data-act="retake"]');
  for (const q of D00.quiz) {
    await answerQuestion(page, q, false);
    if (q.type === 'mcq' && q.why && !(await page.$('.qbody .opt.wrong .why'))) fail('mcq wrong answer shows the option why');
    if (q.id === 'd00-q02') {
      await page.click('[data-act="askwhy"]');
      await page.waitForFunction(() => { const m = document.querySelector('.tutor-slot .tutor-msg.ai'); return m && /canned/.test(m.textContent); }, null, { timeout: 5000 });
      ok('Ask why opens the tutor seeded with the question');
      await shot(page, cfg, '08-quiz-wrong-askwhy', true);
    }
    if (q.type === 'order') await shot(page, cfg, '08b-quiz-order-wrong');
    await page.click('[data-act="submit"]');
  }
  await page.waitForSelector('.score-big');
  expect((await page.textContent('.score-big')).startsWith('0%'), 'all-wrong pass scores 0%');
  expect((await page.$$('.missed li')).length === D00.quiz.length, 'results list every missed question');
  await shot(page, cfg, '09-quiz-results-0', true); await overflow(page, cfg, 'quiz results');

  await go(page, '#d00-x1', '.drill .opt');
  const drill = D00.drills[0];
  for (let i = 0; i < drill.steps.length; i++) {
    const st = drill.steps[i];
    await page.click(`.drill .opt[data-oi="${(st.answer + 1) % st.options.length}"]`);
    if (!(await page.$('.dfb .fb.bad'))) fail('drill wrong choice shows feedback');
    await page.click(`.drill .opt[data-oi="${st.answer}"]`);
    await page.waitForSelector('.dfb .fb.ok');
    if (i === 1) await shot(page, cfg, '10-drill-step', true);
    await page.click('[data-next]');
  }
  await page.waitForSelector('.debrief');
  ok('drill runs to the debrief');
  await overflow(page, cfg, 'drill');

  await go(page, '#review', '.view-title');
  expect(!!(await page.$('.empty')), 'review says nothing is due right after answering');
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('rb_state_v1')); const t = new Date(); const iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); Object.values(s.review).forEach((c) => { c.due = iso; }); localStorage.setItem('rb_state_v1', JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector('#rv-start');
  await shot(page, cfg, '11-review-due');
  await page.click('#rv-start');
  await page.waitForSelector('.qbody');
  for (let i = 0; i < 12 && !(await page.$('.score-big')); i++) {
    const id = await page.evaluate(() => document.querySelector('.qmeta') && 1);
    if (!id) break;
    const q = await page.evaluate(() => { const t = document.querySelector('#qtext').textContent; return t; });
    const qq = D00.quiz.find((x) => x.q.replace(/\*\*|`/g, '') === q);
    await answerQuestion(page, qq, true);
    await page.click('[data-act="submit"]');
  }
  expect(!!(await page.$('.score-big')), 'review session completes');

  await go(page, '#tests', '.test-table');
  await shot(page, cfg, '12-tests', true); await overflow(page, cfg, 'tests');
  await go(page, '#test-placement', '.qbody');
  for (let i = 0; i < 40 && !(await page.$('.score-big')); i++) {
    await page.click('.qbody .opt[data-oi="0"]'); await page.click('[data-act="submit"]'); await page.click('[data-act="submit"]');
  }
  expect(!!(await page.$('.score-big')), 'placement test finishes with results by phase');
  await shot(page, cfg, '13-placement-results', true); await overflow(page, cfg, 'placement');
  await go(page, '#test-c1', '.qprog');
  ok('checkpoint 1 samples questions');
  await shot(page, cfg, '14-checkpoint', true); await overflow(page, cfg, 'checkpoint');
  await go(page, '#practice', '#pf');
  await page.check('input[name="dy"][value="d00"]');
  await page.click('#pf button[type="submit"]');
  await page.waitForSelector('#quiz-root .qbody');
  ok('custom practice starts');
  await overflow(page, cfg, 'practice');

  await go(page, '#guide', '#guide-q');
  await page.waitForFunction(() => document.querySelectorAll('#guide-list details').length > 0, null, { timeout: 10000 });
  await page.fill('#guide-q', 'retry');
  const n = await page.$$eval('#guide-list details', (e) => e.length);
  expect(n >= 1, `field guide search finds ${n} rows`);
  await page.click('#guide-list summary');
  await page.fill('#guide-q', '');
  await page.click('[data-ph="p5"]');
  await shot(page, cfg, '15-guide', true); await overflow(page, cfg, 'guide');
  await go(page, '#glossary', '#gloss-q');
  await page.fill('#gloss-q', 'jitter');
  expect((await page.$$('#gloss-list dt')).length >= 1, 'glossary search finds jitter');
  await page.fill('#gloss-q', '');
  await shot(page, cfg, '16-glossary'); await overflow(page, cfg, 'glossary');

  await go(page, '#today', '.today-hero');
  await shot(page, cfg, '17-today-progress', true); await overflow(page, cfg, 'today with progress');

  await go(page, '#prefs', '#reset-1');
  await shot(page, cfg, '18-prefs', true); await overflow(page, cfg, 'prefs');
  await page.click('#reset-1'); await page.click('#reset-cancel');
  await page.click('#reset-1'); await shot(page, cfg, '19-prefs-confirm'); await page.click('#reset-2');
  await page.waitForSelector('text=Progress erased');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('rb_state_v1')));
  expect(Object.keys(st.lessons).length === 0 && Object.keys(st.review).length === 0, 'reset erases progress');
  await go(page, '#today', '#setup-form');
  ok('setup card returns after reset');
  await ctx.close();
}

const VIEWS = [
  ['today', '.today-hero'], ['path', '.trace .tr'], ['d00', '.lesson-list'], ['d00-l1', '.article .blk'], ['d00-l2', '.article .code'],
  ['d00-quiz', '.qbody'], ['d00-x1', '.drill'], ['tests', '.test-table'], ['review', '.view-title'], ['guide', '#guide-q'],
  ['glossary', '#gloss-q'], ['prefs', '#reset-1'], ['practice', '#pf'], ['test-placement', '.qbody'], ['nowhere', '.empty']
];
async function tour(browser, cfg, realDays) {
  console.log(`\n== tour: ${cfg.name}`);
  const { ctx, page } = await newPage(browser, cfg);
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForSelector('.today-hero');
  const views = VIEWS.concat(realDays);
  for (const [h, sel] of views) {
    try { await go(page, '#' + h, sel); } catch (e) { fail(`${cfg.name} #${h}: ${sel} not found`); continue; }
    if (h === 'guide') await page.waitForFunction(() => document.querySelectorAll('#guide-list details').length > 0, null, { timeout: 10000 }).catch(() => {});
    if (h === 'd00-quiz') { const q = D00.quiz[0]; await answerQuestion(page, q, false); }
    await overflow(page, cfg, '#' + h);
    await shot(page, cfg, 'v-' + h, /^(d\d\d-l\d|d\d\d|path|today)$/.test(h));
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const list = fs.readdirSync(path.join(__dirname, '..', 'data')).filter((f) => /^d(0[1-9]|[12]\d|30)\.json$/.test(f)).map((f) => f.slice(0, 3)).sort();
  const missing = []; for (let i = 1; i <= 30; i++) { const id = 'd' + String(i).padStart(2, '0'); if (!list.includes(id)) missing.push(id); }
  const realDays = [];
  list.slice(0, 2).concat(list.slice(-1)).forEach((id) => { realDays.push([id, '.lesson-list'], [id + '-l1', '.article .blk'], [id + '-l2', '.article .blk'], [id + '-x1', '.drill']); });
  if (missing.length) realDays.push([missing[0], '.missing-day']);
  await fullFlow(browser, { name: 'desk-light', w: 1280, h: 800, scheme: 'light' });
  await fullFlow(browser, { name: 'phone-dark', w: 400, h: 850, scheme: 'dark' });
  await tour(browser, { name: 'desk-dark', w: 1280, h: 800, scheme: 'dark' }, realDays);
  await tour(browser, { name: 'phone-light', w: 400, h: 850, scheme: 'light' }, realDays);
  await browser.close();
  if (notes.length) console.log('\nnotes:\n  ' + Array.from(new Set(notes)).slice(0, 5).join('\n  '));
  console.log(`\n${problems.length ? 'FAILED: ' + problems.length + ' problem(s)' : 'PASSED: no problems'}`);
  process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
