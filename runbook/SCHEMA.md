# Thirty-Day Backend Runbook: content contract

This is the contract between the people who write day content (`data/dNN.json`) and the app shell that renders it. `plan.json` holds the curriculum. `data/d00.json` is a complete worked example of every block and question type. `tools/validate.mjs` enforces this file; a day is not done until it passes with zero errors.

```
node runbook/tools/validate.mjs runbook/data/d07.json
```

## Who this is for

One learner. He builds AI and agent projects, is comfortable reading Python, and spends most of his time **testing, evaluating, and debugging** rather than writing backend code from scratch. He wants to stop "banging his head" when something breaks. He has 30 days, about 45 to 60 minutes a day, alongside project work.

He does **not** need to learn to write the code. He needs, for every topic:

1. **The idea** in one or two plain sentences.
2. **The mechanism**: how it works underneath, with just enough detail that failures make sense.
3. **The tradeoffs**: what you gain, what you pay, when to choose which option.
4. **How it fails and what that looks like**: the exact symptom in a log, a status code, a metric, a trace, a loss curve.
5. **Where to look and what to fix**.

Points 3 to 5 matter most. A lesson that only defines terms has failed.

## The running example

Use one system across all 30 days so that knowledge accumulates. Refer to it by name.

**Relay** is an AI support agent for an online store. Customers write in; Relay answers, and can look up orders and issue refunds.

- A web app talks to a **FastAPI** service (Python, uvicorn workers) behind **nginx** and a cloud load balancer.
- **PostgreSQL** holds users, tickets, messages, orders. **Redis** holds cache entries, sessions, and rate-limit counters.
- A **worker** fleet consumes a job queue (ticket triage, sending email, nightly re-indexing).
- The agent calls an **LLM API** with tools (`lookup_order`, `issue_refund`, `search_help_center`). Help-center articles are chunked, embedded, and stored in **pgvector** for retrieval.
- An **eval harness** runs a few hundred recorded tickets against each new prompt or model version every night.
- It ships as Docker images through a CI pipeline to Kubernetes.

Use Relay for most scenarios, quiz contexts, and drills. Use a different example when Relay would be forced. Never contradict the architecture above.

## Voice

- Second person, plain, direct. Short sentences. Paragraphs of four sentences or fewer.
- Define each term the first time it appears, in the same sentence.
- Prefer a concrete case to an abstract statement. "The refund ran twice because the worker crashed after charging and before acknowledging" beats "at-least-once delivery can cause duplicates".
- No hype, no pep talk, no "let's dive in", no "in today's world". No rhetorical questions as section openers.
- Avoid em dashes, "not X but Y" constructions, and colon-then-reveal sentences. Use commas and full stops.
- American spelling.
- Do not teach syntax. Small artifacts to **read** are encouraged (an HTTP exchange, a log excerpt, an EXPLAIN plan, a traceback, a trace waterfall as text, a metrics table), because reading them is the debugging skill.
- Accuracy over color. State what is stable and conceptual. Avoid version-specific claims, prices, and precise benchmark numbers. When a number helps, give an order of magnitude and say it is rough. If you are not sure a claim is true, leave it out.

## Inline markup

Every prose string supports exactly three inline marks: `**bold**`, `*italic*`, and `` `code` ``. No HTML, no links, no headings, no newlines inside a string (only `code` fields may contain `\n`). Use bold for the term being defined, at most a few per lesson.

## File shape

One JSON object per day, file name `data/dNN.json`.

| Key | Type | Notes |
| --- | --- | --- |
| `id` | string | `d01` to `d30`. |
| `day` | integer | Matches the id. |
| `phase` | string | From `plan.json`. |
| `title` | string | **Must equal the title in `plan.json` exactly.** |
| `tagline` | string | One sentence, 150 characters or fewer. You may refine the plan's tagline. |
| `minutes` | integer | Honest total for lessons plus quiz, usually 40 to 60. |
| `why` | string | 2 to 4 sentences: why this day matters for someone who tests, evaluates, and debugs. |
| `objectives` | string[3..5] | Each starts with a verb: "Tell a 502 from a 504 and say which hop produced it." Observable skills, not "understand X". |
| `lessons` | Lesson[4] | Titles **must equal `plan.json` exactly**, in order. Day 30 has 3. |
| `fieldGuide` | Row[6..10] | Symptom to cause lookup. See below. |
| `glossary` | Term[8..14] | `{term, def}`. Definitions of 45 words or fewer. |
| `apply` | object | A 10 to 20 minute exercise on the learner's own project. See below. |
| `quiz` | Question[12] | See below. Day 30 has 15. |
| `drills` | Drill[2] | Incident simulations. Day 30 has 6. |

### Lesson

```
{ "id": "d07-l2", "title": "...", "minutes": 8, "blocks": [ ... ] }
```

- 450 to 750 words of prose across the blocks (validator minimum 380).
- At least 7 blocks. Open with a `p` block that states the idea.
- Each lesson must contain: at least one `compare` or `tradeoff`; at least one `check` or `reveal`; at least one `callout` of kind `debug` or `pitfall`.
- Across the day: at least one `flow` or `layers`, at least two `code` blocks, at least one `tradeoff`, at least one `debug` callout.
- Do not write a wall of `p` blocks. A good lesson alternates explanation with a structure the eye can use.
- Cover the lesson's `scope` from `plan.json`. Across the day, cover every `mustCover` tradeoff and every `failureSignatures` item, either in lessons, the field guide, or the quiz.

### Blocks

| `t` | Fields | Use it for |
| --- | --- | --- |
| `p` | `text` | A paragraph. 90 words or fewer. |
| `h` | `text` | A subheading inside a lesson. Use sparingly, 2 or 3 per lesson. |
| `list` | `items[2..8]`, optional `style`: `bullet` or `number` | Parallel points or ordered steps. |
| `callout` | `kind`, `title`, `text` | `insight` (the key idea), `pitfall` (a common mistake), `debug` (what to check when this breaks), `rule` (a rule of thumb), `ai` (how this shows up in LLM and agent systems; use it on days 1 to 21 to tie backend ideas to his AI work). |
| `compare` | `columns[3..4]`, `rows[3..8]`, optional `caption`, `verdict` | A comparison table. First column is the row label (its header may be `""`). Cells stay under about 20 words. `verdict` says when to pick which. |
| `tradeoff` | `title`, `options[2..4]` of `{name, gain[1..4], cost[1..4], choose}` | A decision between options. `gain` and `cost` are short phrases. `choose` is one sentence: "Choose this when ...". |
| `flow` | `title`, `steps[3..9]` of `{actor, label, detail, fail?}` | A sequence through time or through components. `actor` is who acts (Browser, nginx, API, Postgres, Worker, Model). `fail` says what breaking at this step looks like from outside. The app renders it as a step-through diagram. |
| `layers` | `title`, `layers[3..7]` of `{name, role, breaks?}` | A stack, top to bottom. `breaks` says how this layer fails. |
| `code` | `lang`, `code`, optional `title`, `notes[1..6]` | An artifact to read. `lang` is one of `http`, `sql`, `log`, `json`, `python`, `shell`, `text`, `yaml`, `trace`, `plan`, `diff`. 28 lines and 1800 characters at most, lines under about 96 characters. `notes` explain what to notice. |
| `analogy` | `text` | One analogy, then say where it stops being accurate. |
| `check` | `q`, `options[3..4]`, `answer` (index), `explain` | A quick question inside the lesson. Tests the point just made. |
| `reveal` | `prompt`, `answer` | "Think first" retrieval practice. The learner predicts, then reveals. |

### Field guide row

The field guide is the part the learner will open at 2 a.m. Each row is a lookup from what he sees to what to do.

```
{
  "symptom": "p99 latency climbs while p50 stays flat",
  "causes": ["A minority of requests hit a slow path", "Lock contention or GC pauses"],
  "look": "Where to look first, concretely",
  "confirm": "The observation that confirms the cause",
  "fix": "The usual fix, and the tradeoff it carries"
}
```

Write `symptom` in the words that appear on screen or in a bug report. 140 characters or fewer.

### Apply

```
{ "title": "Find the slowest hop in one of your own requests", "minutes": 15, "steps": ["...", "..."] }
```

2 to 5 concrete steps the learner can do today on his own project, with no special setup. Each step produces something he can observe. Assume a Python project that calls an LLM API; do not assume Kubernetes or a specific cloud.

## Quiz

Exactly 12 questions per day (15 on day 30), ids `dNN-q01` to `dNN-q12`.

Required mix: at least 6 `mcq`, at least 1 each of `multi`, `order`, `match`, `open`, and at most 2 `open`. At least 4 questions at level 3, at most 4 at level 1. At least 4 questions carry a `context` or an `artifact`, and at least 2 carry an `artifact`. Exactly one `mcq` has `"diagnostic": true`.

Common fields:

| Key | Notes |
| --- | --- |
| `id` | `dNN-qNN` in order. |
| `type` | `mcq`, `multi`, `order`, `match`, `open`. |
| `level` | `1` recall, `2` apply or choose, `3` diagnose from evidence. |
| `tags` | 1 to 4 lowercase-kebab topic tags (`replica-lag`, `idempotency`). Reuse tags within a day. |
| `q` | The question. |
| `context` | Optional. A scenario paragraph shown above the question. |
| `artifact` | Optional `{lang, code, title?}`. A log, plan, exchange, trace, or metrics excerpt the learner must read to answer. |
| `diagnostic` | Optional, `true` on exactly one `mcq` per day. That question is used in the placement test, so it must be level 2, self-contained, and answerable by someone who already knows the topic without having read the lesson. |

Type-specific fields:

- `mcq`: `options` (exactly 4), `answer` (index), `explain`, optional `why` (4 strings, one per option, saying why each wrong option is wrong; use `""` at the correct index). At least half of the mcq questions need `why`.
- `multi`: `options` (4 to 6), `answers` (2 or more indices, never all), `explain`. Phrase the question as "Which of these ... ? Select all that apply."
- `order`: `items` (4 to 6) **listed in the correct order**, `explain`. The app shuffles.
- `match`: `pairs` (4 or 5) of `[left, right]`, `explain`. The app shuffles the right side. Lefts are short (a symptom, a term); rights are their match (a cause, a definition).
- `open`: `rubric` (3 to 5 points a good answer contains), `model` (a model answer, 35 words or more). The learner writes an answer and compares; when available, Claude grades against the rubric.

### What makes a good question

- It tests **understanding or diagnosis**, never trivia. Not "what does ACID stand for" but "two requests both read stock = 1 and both decrement; which guarantee was missing and what prevents it".
- Level 3 questions give evidence (a status code, a log line, a plan, a metric pattern) and ask for the most likely cause, the next thing to check, or the fix.
- Exactly one defensible best answer for `mcq`. Before you finish, reread each one and ask: could a knowledgeable engineer argue for another option? If yes, fix the options or the wording.
- Distractors are things a reasonable person would believe: the common misconception, the right answer to a neighboring question, the fix for a similar-looking fault.
- All four options are about the same length and grammatical form. The correct option must not be the longest or the only detailed one.
- The app shuffles options, so never write "all of the above", "none of the above", "both A and B", or refer to an option by position.
- `explain` says why the answer is right **and** names the misconception behind the most tempting wrong answer. It is where the learning happens. 18 words minimum; 30 to 60 is typical.
- Vary the `answer` index across the day.

## Drills

A drill is a short incident simulation: a symptom, then a chain of decisions where each good decision reveals new evidence.

```
{
  "id": "d07-x1",
  "title": "Checkout is slow for some customers",
  "brief": "The situation as it would reach you: who reported what, since when, what changed recently.",
  "artifact": { "lang": "log", "code": "..." },
  "steps": [
    { "q": "What do you check first?", "options": ["...", "...", "...", "..."], "answer": 1,
      "explain": "Why that is the best next move, and why the tempting alternative wastes time.",
      "reveal": "What you find when you do it. New evidence for the next step.",
      "artifact": { "lang": "trace", "code": "..." } }
  ],
  "debrief": "Root cause, the fix, how it could have been caught earlier, and the general lesson."
}
```

- 3 to 5 steps, each with 3 or 4 options. `reveal` and a step-level `artifact` are optional but most steps should have a `reveal`.
- The best first move is usually to **gather cheap evidence that halves the search space**, not to apply a fix. Write distractors that jump to a fix, restart things, or investigate the layer that the evidence already cleared.
- At least one drill per day should have a plausible but wrong obvious cause.
- Drills use Relay.

## Before you report a day as done

1. `node runbook/tools/validate.mjs runbook/data/dNN.json` prints `ok` with zero errors. Read the warnings and fix the ones that are fair.
2. Reread every quiz answer key and every drill step. Wrong answer keys are the worst defect this project can have.
3. Check that every `mustCover` and `failureSignatures` item from `plan.json` appears somewhere in the day.
4. Check facts you are less than sure of, and cut any you cannot stand behind.
