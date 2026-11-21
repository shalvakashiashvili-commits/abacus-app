// სავარჯიშოების სესია: მართული სავარჯიშო, დავალებები, დონის ტესტი, გამეორება.
// სავარჯიშოს ტიპები: read (წაიკითხე), set (ჩაწერე), calc (გამოთვალე), column (სვეტური ჯამი).

import { h, numpad, exprText, digitCount, fmtSec, fmtPct, sleep, confirmDialog } from './ui.js';
import { SorobanView } from './soroban-view.js';
import { hintFor, analyze } from './techniques.js';
import { formatNumber, formatSigned, toDigits, PLACE_GEN } from './soroban.js';
import { getLevel, PASS_ACCURACY } from './levels.js';

export const MODE_TITLES = {
  guided: 'მართული სავარჯიშო',
  tasks: 'დავალებები',
  test: 'დონის ტესტი',
  review: 'გამეორება'
};

const MODE_INTRO = {
  guided: [
    'მაგალითები მარტივიდან რთულისკენ მიდის.',
    'გამოთვლისას ყოველ რიცხვს სათითაოდ შეასრულებ სორობანზე და დააჭერ „მზადაა“. შეცდომისას მიიღებ მინიშნებას, თუ რომელი ფორმულაა საჭირო, და შეგიძლია ნახო, როგორ კეთდება.'
  ],
  tasks: [
    'ავტომატურად შექმნილი მაგალითები — მხოლოდ უკვე ნასწავლი ფორმულებით.',
    'მთელ მაგალითს სორობანზე შეასრულებ და ბოლოს შეამოწმებ.'
  ],
  test: [
    'გადასასვლელად საჭიროა სიზუსტე ≥ 90%.',
    'მინიშნებები არ არის. ჯერ სიზუსტეზე იზრუნე.'
  ],
  review: [
    'წინა სესიების შეცდომები და გავლილი მასალა.',
    'შეცდომა სიიდან ქრება, როცა მას ორჯერ სწორად ამოხსნი.'
  ]
};

export const KIND_TITLES = {
  read: 'წაიკითხე რიცხვი სორობანიდან',
  set: 'ჩაწერე რიცხვი სორობანზე',
  calc: 'გამოთვალე სორობანზე',
  column: 'სვეტური ჯამი'
};

export function problemLabel(p) {
  if (p.kind === 'read') return `წაკითხვა: ${formatNumber(p.value)}`;
  if (p.kind === 'set') return `ჩაწერა: ${formatNumber(p.value)}`;
  return `${p.kind === 'column' ? 'სვეტი: ' : ''}${exprText(p.terms)} = ${formatNumber(p.answer)}`;
}

function maxPartial(terms) {
  let run = 0, mx = 0;
  for (const t of terms) { run += t; mx = Math.max(mx, run); }
  return mx;
}

export function runSession(root, { mode, levelId, problems, progress, onExit }) {
  const level = levelId !== null && levelId !== undefined ? getLevel(levelId) : null;
  const results = [];
  let index = 0;
  let current = null;
  let t0 = 0;
  let timing = false;
  let tick = null;
  let finished = false;
  let destroyed = false;

  const showTimer = mode === 'test' && level?.test?.maxAvgSec;
  const counter = h('div', { class: 'topbar-meta' });
  const timerEl = h('div', { class: 'timer', hidden: !showTimer });
  const head = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': 'დახურვა', on: { click: close } }, '✕'),
    h('div', { class: 'topbar-title' }, MODE_TITLES[mode] + (level ? ` · დონე ${level.id}` : '')),
    timerEl, counter);
  const barFill = h('div', { class: 'bar-fill' });
  const body = h('div', { class: 'ex-body' });
  root.append(head, h('div', { class: 'bar' }, barFill), body);

  async function close() {
    if (index > 0 && !finished) {
      const ok = await confirmDialog('სესიის დატოვება? უკვე გაცემული პასუხები შენახულია.', { ok: 'დატოვება' });
      if (!ok) return;
    }
    onExit('back');
  }

  function startTimer() {
    t0 = performance.now();
    timing = true;
  }

  function elapsed() {
    return timing ? performance.now() - t0 : 0;
  }

  if (showTimer) {
    tick = setInterval(() => {
      if (!timing) return;
      timerEl.textContent = `⏱ ${(elapsed() / 1000).toFixed(1)}`;
    }, 200);
  }

  function intro() {
    counter.textContent = `${problems.length} მაგალითი`;
    const lines = [...MODE_INTRO[mode]];
    if (mode === 'test' && level) {
      lines.unshift(`${problems.length} მაგალითი.`);
      lines.push(level.test.maxAvgSec
        ? `დროის პირობა: საშუალოდ ≤ ${level.test.maxAvgSec} წამი თითო მაგალითზე.`
        : 'დროის ლიმიტი არ არის.');
    }
    body.append(h('div', { class: 'card' },
      h('h2', null, MODE_TITLES[mode]),
      lines.map((l) => h('p', null, l)),
      h('button', { class: 'btn primary wide', on: { click: showProblem } }, 'დაწყება →')));
  }

  function showProblem() {
    current?.destroy();
    body.innerHTML = '';
    const p = problems[index];
    counter.textContent = `${index + 1} / ${problems.length}`;
    barFill.style.width = `${(index / problems.length) * 100}%`;
    timerEl.textContent = '';
    const ctx = {
      mode, guided: mode === 'guided', progress, body, startTimer,
      isDestroyed: () => destroyed,
      done: (r) => finishProblem(p, r)
    };
    const renderer = RENDERERS[p.kind];
    current = renderer(p, ctx);
    window.scrollTo(0, 0);
  }

  function finishProblem(p, { correct, given, fixed }) {
    const ms = elapsed();
    timing = false;
    results.push({ problem: p, correct, given, ms });
    progress.recordAnswer({ level: p.level, mode, problem: p, correct, ms, mistakeId: p.mistakeId });
    barFill.style.width = `${((index + 1) / problems.length) * 100}%`;
    current?.lock?.();

    const isLast = index === problems.length - 1;
    const nextBtn = h('button', { class: 'btn primary wide', on: { click: () => { index += 1; isLast ? showResults() : showProblem(); } } },
      isLast ? 'შედეგები →' : 'შემდეგი →');
    let msg;
    if (correct) msg = `✓ სწორია! · ${fmtSec(ms / 1000)}`;
    else if (fixed) msg = '✓ ახლა სწორია. პირველივე ცდით არ გამოვიდა, ამიტომ მაგალითი გამეორებაში დაბრუნდება.';
    else msg = `✗ არასწორია. ${given !== undefined && given !== null ? `შენი პასუხი: ${formatNumber(given)} · ` : ''}სწორი პასუხი: ${formatNumber(p.answer)}`;
    const fb = h('div', { class: `feedback ${correct ? 'good' : fixed ? 'warn' : 'bad'}` }, h('div', { class: 'fb-msg' }, msg));
    if (!correct && mode !== 'test' && (p.kind === 'calc' || p.kind === 'column')) fb.append(explainTerms(p.terms));
    fb.append(nextBtn);
    body.append(fb);
    nextBtn.focus({ preventScroll: true });
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showResults() {
    finished = true;
    current?.destroy();
    current = null;
    clearInterval(tick);
    body.innerHTML = '';
    counter.textContent = '';
    timerEl.hidden = true;
    barFill.style.width = '100%';
    const n = results.length;
    const correct = results.filter((r) => r.correct).length;
    const acc = n ? correct / n : 0;
    const avgSec = n ? results.reduce((s, r) => s + r.ms, 0) / n / 1000 : 0;
    let passed = null;
    const card = h('div', { class: 'card results' });

    if (mode === 'review') progress.markPlan('review');
    else if (level) {
      if (mode === 'test') {
        const okAcc = acc >= PASS_ACCURACY;
        const okTime = !level.test.maxAvgSec || avgSec <= level.test.maxAvgSec;
        passed = okAcc && okTime;
        const wasPassed = progress.isPassed(level.id);
        progress.recordSession({ level: level.id, mode, accuracy: acc, avgSec, passed });
        card.append(
          h('div', { class: `result-badge ${passed ? 'good' : 'bad'}` }, passed ? '🎉' : '↻'),
          h('h2', null, passed ? `დონე ${level.id} გავლილია!` : 'ჯერ არ გამოვიდა'),
          h('ul', { class: 'criteria' },
            h('li', { class: okAcc ? 'ok' : 'no' }, `სიზუსტე ≥ ${Math.round(PASS_ACCURACY * 100)}%: ${fmtPct(acc)} (${correct}/${n})`),
            level.test.maxAvgSec
              ? h('li', { class: okTime ? 'ok' : 'no' }, `საშუალო დრო ≤ ${level.test.maxAvgSec} წმ: ${fmtSec(avgSec)}`)
              : h('li', { class: 'ok' }, `საშუალო დრო: ${fmtSec(avgSec)} (ლიმიტის გარეშე)`)),
          passed && !wasPassed
            ? h('p', null, getLevel(level.id + 1)?.built ? `გაიხსნა დონე ${level.id + 1}: ${getLevel(level.id + 1).title}.` : 'ეტაპი 1-ის ყველა დონე გავლილია! შემდეგი დონეები მომდევნო ეტაპზე დაემატება.')
            : null,
          !passed ? h('p', null, 'გაიმეორე დავალებები და სცადე თავიდან — შეცდომები გამეორებაში დაგხვდება.') : null
        );
      } else {
        progress.recordSession({ level: level.id, mode, accuracy: acc, avgSec });
      }
    }
    if (mode !== 'test') {
      card.append(
        h('div', { class: `result-badge ${acc >= 0.9 ? 'good' : acc >= 0.7 ? 'warn' : 'bad'}` }, fmtPct(acc)),
        h('h2', null, acc >= 0.9 ? 'შესანიშნავია!' : acc >= 0.7 ? 'კარგია, გააგრძელე!' : 'ვარჯიში გააგრძელე'),
        h('p', null, `სწორი: ${correct} / ${n} · საშუალო დრო: ${fmtSec(avgSec)}`)
      );
      if (mode === 'tasks' && level && acc >= 0.8 && !progress.isPassed(level.id)) {
        card.append(h('p', null, 'მზად ხარ დონის ტესტისთვის!'));
      }
    }
    const wrong = results.filter((r) => !r.correct);
    if (wrong.length) {
      card.append(h('h3', null, 'შეცდომები (გამეორებაში დაბრუნდება):'),
        h('ul', { class: 'mistake-list' }, wrong.map((r) => h('li', null, problemLabel(r.problem)))));
    }
    card.append(h('div', { class: 'row wrap' },
      h('button', { class: 'btn ghost', on: { click: () => onExit('again') } }, 'თავიდან'),
      h('button', { class: 'btn primary', on: { click: () => onExit(level ? 'level' : 'home') } }, level ? 'დონეზე დაბრუნება' : 'მთავარ ეკრანზე')));
    body.append(card);
  }

  if (!problems.length) {
    body.append(h('div', { class: 'card' }, h('p', null, 'მაგალითები ვერ შეიქმნა.')));
  } else {
    intro();
  }

  return {
    destroy() {
      destroyed = true;
      clearInterval(tick);
      current?.destroy();
    }
  };
}

// „როგორ ითვლება?“ — ყოველი რიცხვის ფორმულები
function explainTerms(terms) {
  const items = [];
  let total = terms[0];
  for (let i = 1; i < terms.length; i++) {
    const hint = hintFor(total, terms[i]);
    items.push(h('li', null,
      h('strong', null, `${formatNumber(total)} ${terms[i] < 0 ? '−' : '+'} ${formatNumber(Math.abs(terms[i]))}`),
      h('div', { class: 'small' }, hint.lines.join(' · '))));
    total += terms[i];
  }
  return h('details', { class: 'explain' }, h('summary', null, 'როგორ ითვლება?'), h('ol', null, items));
}

function promptBlock(kind, main) {
  return h('div', { class: 'prompt' }, h('div', { class: 'prompt-kind' }, KIND_TITLES[kind]), main);
}

// --- წაიკითხე რიცხვი სორობანიდან ---
function renderRead(p, ctx) {
  let attempts = 0;
  const hint = h('div', { class: 'hint', hidden: true });
  const host = h('div');
  ctx.body.append(promptBlock('read', h('div', { class: 'prompt-main' }, 'რა რიცხვია სორობანზე?')), host, hint);
  const sv = new SorobanView(host, { interactive: false, showValue: false, tools: [], compact: true, minRods: Math.max(2, digitCount(p.value)) });
  sv.setValue(p.value);
  const np = numpad({
    maxLen: 7,
    onSubmit: (v) => {
      if (v === p.value) { ctx.done({ correct: attempts === 0, given: v, fixed: attempts > 0 }); return; }
      if (!ctx.guided) { ctx.done({ correct: false, given: v }); return; }
      attempts += 1;
      np.reset();
      hint.hidden = false;
      if (attempts === 1) {
        hint.textContent = `${formatNumber(v)} — ჯერ არა. წაიკითხე თითო ღერო მარცხნიდან: ზოლთან მიწეული ზედა მძივი = 5, ყოველი ზოლთან მიწეული ქვედა მძივი = 1. ცარიელი ღერო = 0.`;
      } else {
        sv.setShowValue(true);
        hint.textContent = `ციფრები ღეროების ქვეშ გამოჩნდა. სწორი პასუხია ${formatNumber(p.value)}.`;
        ctx.done({ correct: false, given: v });
      }
    }
  });
  ctx.body.append(np.el);
  ctx.startTimer();
  return {
    lock: () => np.setDisabled(true),
    destroy: () => sv.destroy()
  };
}

// --- ჩაწერე რიცხვი სორობანზე ---
function renderSet(p, ctx) {
  let errors = 0;
  const host = h('div');
  const hint = h('div', { class: 'hint', hidden: true });
  const checkBtn = h('button', { class: 'btn primary wide', on: { click: check } }, 'შემოწმება');
  const showBtn = h('button', { class: 'btn ghost wide', hidden: true, on: { click: reveal } }, 'აჩვენე სწორი პასუხი');
  ctx.body.append(
    promptBlock('set', h('div', { class: 'prompt-main' }, 'ჩაწერე: ', h('span', { class: 'big-num' }, formatNumber(p.value)))),
    host, hint, h('div', { class: 'actions' }, checkBtn, showBtn));
  const sv = new SorobanView(host, { interactive: true, showValue: false, tools: ['clear', 'zoom'], minRods: Math.max(2, digitCount(p.value)) });
  ctx.startTimer();

  function check() {
    const v = sv.value;
    if (v === p.value) { ctx.done({ correct: errors === 0, given: v, fixed: errors > 0 }); return; }
    if (!ctx.guided) { ctx.done({ correct: false, given: v }); return; }
    errors += 1;
    const exp = toDigits(p.value, 13), act = sv.model.digits();
    const marks = {}, lines = [];
    for (let q = 12; q >= 0; q--) {
      if (exp[q] !== act[q]) {
        marks[q] = 'bad';
        lines.push(`${PLACE_GEN[q]} ღეროზე უნდა იყოს ${exp[q]} (ახლა ${act[q]})`);
      }
    }
    sv.setMarks(marks);
    hint.hidden = false;
    hint.textContent = `ჯერ არა: ${lines.join('; ')}.`;
    if (errors >= 2) showBtn.hidden = false;
  }

  function reveal() {
    sv.setValue(p.value);
    sv.setShowValue(true);
    sv.setInteractive(false);
    hint.textContent = 'ასე იწერება ეს რიცხვი. დააკვირდი თითო ღეროს.';
    ctx.done({ correct: false, given: null });
  }

  return {
    lock: () => { checkBtn.disabled = true; showBtn.disabled = true; sv.setInteractive(false); },
    destroy: () => sv.destroy()
  };
}

// --- გამოთვალე სორობანზე ---
function renderCalc(p, ctx) {
  return ctx.guided ? renderCalcGuided(p, ctx) : renderCalcFree(p, ctx);
}

function termsSheet(terms, currentIdx = -1, doneUpTo = -1) {
  return h('div', { class: 'sheet' }, terms.map((t, i) =>
    h('div', { class: `sheet-row${i === currentIdx ? ' current' : ''}${i <= doneUpTo ? ' done' : ''}` },
      h('span', { class: 'sheet-mark' }, i <= doneUpTo ? '✓' : i === currentIdx ? '▶' : ''),
      h('span', { class: 'sheet-num' }, i === 0 ? formatNumber(t) : formatSigned(t)))),
  h('div', { class: 'sheet-row total' }, h('span', { class: 'sheet-mark' }), h('span', { class: 'sheet-num' }, '= ?')));
}

function renderCalcFree(p, ctx) {
  const host = h('div');
  const checkBtn = h('button', { class: 'btn primary wide', on: { click: () => ctx.done({ correct: sv.value === p.answer, given: sv.value }) } }, 'შემოწმება');
  ctx.body.append(promptBlock('calc', termsSheet(p.terms)), host, h('div', { class: 'actions' }, checkBtn));
  const sv = new SorobanView(host, { interactive: true, showValue: false, tools: ['clear', 'zoom'], minRods: Math.max(2, digitCount(maxPartial(p.terms))) });
  ctx.startTimer();
  return {
    lock: () => { checkBtn.disabled = true; sv.setInteractive(false); },
    destroy: () => sv.destroy()
  };
}

function renderCalcGuided(p, ctx) {
  const terms = p.terms;
  let t = 0;
  let errors = 0;
  let busy = false;
  const partial = (k) => terms.slice(0, k + 1).reduce((s, x) => s + x, 0);
  const sheetHost = h('div');
  const instr = h('div', { class: 'instr' });
  const host = h('div');
  const hintText = h('div', { class: 'hint-text' });
  const showBtn = h('button', { class: 'btn small ghost', on: { click: showMe } }, '▶ აჩვენე როგორ');
  const resetBtn = h('button', { class: 'btn small ghost', on: { click: resetStep } }, '⟲ ნაბიჯი თავიდან');
  const hintBox = h('div', { class: 'hint', hidden: true }, hintText, h('div', { class: 'row wrap' }, showBtn, resetBtn));
  const hintBtn = h('button', { class: 'btn ghost', on: { click: () => showHint(false) } }, '💡 მინიშნება');
  const checkBtn = h('button', { class: 'btn primary', on: { click: check } }, 'მზადაა ✓');
  ctx.body.append(h('div', { class: 'prompt' }, h('div', { class: 'prompt-kind' }, KIND_TITLES.calc), sheetHost, instr),
    host, hintBox, h('div', { class: 'actions row' }, hintBtn, checkBtn));
  const sv = new SorobanView(host, { interactive: true, showValue: false, tools: ['clear', 'zoom'], minRods: Math.max(2, digitCount(maxPartial(terms))) });

  function render() {
    sheetHost.innerHTML = '';
    sheetHost.append(termsSheet(terms, t, t - 1));
    const term = terms[t];
    instr.textContent = t === 0 ? `ჩაწერე ${formatNumber(term)}` : `${term > 0 ? 'მიუმატე' : 'გამოაკელი'} ${formatNumber(Math.abs(term))}`;
  }

  function stepStart() {
    return t === 0 ? 0 : partial(t - 1);
  }

  function stepOperand() {
    return t === 0 ? terms[0] : terms[t];
  }

  function showHint(afterError) {
    hintBox.hidden = false;
    let text;
    if (t === 0) {
      const ds = toDigits(terms[0], 13);
      const parts = [];
      for (let q = digitCount(terms[0]) - 1; q >= 0; q--) parts.push(`${PLACE_GEN[q]} ღეროზე ${ds[q]}`);
      text = `${formatNumber(terms[0])}: ${parts.join(', ')}. ჯერ სორობანი გაასუფთავე.`;
    } else {
      text = hintFor(stepStart(), stepOperand()).text;
    }
    hintText.textContent = (afterError ? 'ჯერ არა. ' : '') + text;
  }

  function check() {
    if (busy) return;
    if (sv.value === partial(t)) {
      t += 1;
      hintBox.hidden = true;
      if (t === terms.length) {
        ctx.done({ correct: errors === 0, given: sv.value, fixed: errors > 0 });
        return;
      }
      render();
      return;
    }
    errors += 1;
    showHint(true);
  }

  function resetStep() {
    if (busy) return;
    sv.setValue(stepStart());
    sv.clearMarks();
  }

  async function showMe() {
    if (busy) return;
    busy = true;
    [showBtn, resetBtn, hintBtn, checkBtn].forEach((b) => { b.disabled = true; });
    sv.setInteractive(false);
    const start = stepStart();
    const a = analyze(start, stepOperand());
    sv.setValue(start);
    await sleep(500);
    for (const s of a.steps) {
      if (ctx.isDestroyed()) return;
      hintText.textContent = `${s.head} — ${s.text}`;
      sv.setFocus([s.place]);
      sv.applyMoves(s.moves);
      await sleep(1600);
    }
    if (ctx.isDestroyed()) return;
    sv.setFocus([]);
    hintText.textContent = `ასე გამოდის ${formatNumber(a.result)}. ახლა შენ სცადე — სორობანი ნაბიჯის დასაწყისს დაუბრუნდა.`;
    await sleep(1400);
    if (ctx.isDestroyed()) return;
    sv.setValue(start);
    sv.setInteractive(true);
    [showBtn, resetBtn, hintBtn, checkBtn].forEach((b) => { b.disabled = false; });
    busy = false;
  }

  render();
  ctx.startTimer();
  return {
    lock: () => { [showBtn, resetBtn, hintBtn, checkBtn].forEach((b) => { b.disabled = true; }); sv.setInteractive(false); },
    destroy: () => sv.destroy()
  };
}

// --- სვეტური ჯამი: რიცხვები ჩნდება სათითაოდ ---
function renderColumn(p, ctx) {
  const progress = ctx.progress;
  let speed = Number(progress.settings.columnSpeed) || 3;
  const speedLabel = h('span', { class: 'speed-label' });
  const range = h('input', {
    type: 'range', min: '0.8', max: '6', step: '0.2', value: String(speed), 'aria-label': 'სიჩქარე',
    on: { input: (e) => { speed = Number(e.target.value); updateSpeed(); }, change: () => progress.setSetting('columnSpeed', speed) }
  });
  const speedBox = h('div', { class: 'speed' }, h('label', null, 'სიჩქარე: ', speedLabel), range,
    h('div', { class: 'row between small muted' }, h('span', null, 'სწრაფი'), h('span', null, 'ნელი')));
  function updateSpeed() { speedLabel.textContent = `${speed.toFixed(1)} წმ თითო რიცხვზე`; }
  updateSpeed();
  const flash = h('div', { class: 'flash' }, 'მზად ხარ?');
  const flashCount = h('div', { class: 'flash-count small muted' }, `${p.terms.length} რიცხვი`);
  const host = h('div');
  const startBtn = h('button', { class: 'btn primary wide', on: { click: start } }, '▶ დაწყება');
  const checkBtn = h('button', { class: 'btn primary wide', hidden: true, on: { click: () => ctx.done({ correct: sv.value === p.answer, given: sv.value }) } }, 'შემოწმება');
  ctx.body.append(
    promptBlock('column', h('div', { class: 'small muted' }, 'რიცხვები სათითაოდ გამოჩნდება — ყოველი მაშინვე სორობანზე შეასრულე.')),
    speedBox, h('div', { class: 'flash-box' }, flash, flashCount), host, h('div', { class: 'actions' }, startBtn, checkBtn));
  const sv = new SorobanView(host, { interactive: true, showValue: false, tools: ['clear', 'zoom'], minRods: Math.max(2, digitCount(maxPartial(p.terms))) });

  async function start() {
    startBtn.hidden = true;
    speedBox.hidden = true;
    sv.clear();
    ctx.startTimer();
    for (let i = 0; i < p.terms.length; i++) {
      if (ctx.isDestroyed()) return;
      const t = p.terms[i];
      flash.textContent = i === 0 ? formatNumber(t) : formatSigned(t);
      flash.classList.add('pop');
      flashCount.textContent = `${i + 1} / ${p.terms.length}`;
      await sleep(speed * 1000);
      flash.classList.remove('pop');
      flash.textContent = '';
      await sleep(220);
    }
    if (ctx.isDestroyed()) return;
    flash.textContent = '= ?';
    flashCount.textContent = 'ახლა შეამოწმე სორობანზე მიღებული პასუხი';
    checkBtn.hidden = false;
  }

  return {
    lock: () => {
      checkBtn.disabled = true;
      sv.setInteractive(false);
      flash.textContent = `${exprText(p.terms)} = ${formatNumber(p.answer)}`;
      flash.classList.add('small-flash');
    },
    destroy: () => sv.destroy()
  };
}

const RENDERERS = { read: renderRead, set: renderSet, calc: renderCalc, column: renderColumn };
