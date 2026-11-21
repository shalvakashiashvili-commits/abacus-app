// გაკვეთილის ეკრანი: ბარათები (თითოზე ერთი იდეა), ანიმირებული ნაბიჯ-ნაბიჯ დემონსტრაციები,
// სორობანის გაცნობის ტური და „სცადე თავად“ ბარათები.

import { h, paragraphs, exprText, digitCount, put } from './ui.js';
import { SorobanView } from './soroban-view.js';
import { getLesson } from './lessons.js';
import { demoSteps, rodNamer } from './techniques.js';
import { mulProgram, divProgram, fmtScaled, rodLabel } from './muldiv.js';
import { levelLabel, getLevel } from './levels.js';
import { formatNumber } from './soroban.js';

export function renderLesson(root, { levelId, progress, onExit }) {
  const cards = getLesson(levelId);
  let idx = Math.min(progress.level(levelId).lessonStep || 0, Math.max(0, cards.length - 1));
  let widget = null;
  let tMark = Date.now();

  const counter = h('div', { class: 'topbar-meta' });
  const head = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': 'უკან', on: { click: () => onExit('back') } }, '←'),
    h('div', { class: 'topbar-title' }, `დონე ${levelLabel(getLevel(levelId))} · ახსნა`),
    counter);
  const barFill = h('div', { class: 'bar-fill' });
  const bar = h('div', { class: 'bar' }, barFill);
  const cardEl = h('div', { class: 'card lesson-card' });
  const prevBtn = h('button', { class: 'btn ghost', on: { click: () => idx > 0 && show(idx - 1) } }, '← წინა');
  const nextBtn = h('button', { class: 'btn primary', on: { click: next } });
  const nav = h('div', { class: 'lesson-nav' }, prevBtn, nextBtn);
  put(root, head, bar, cardEl, nav);

  function show(i) {
    widget?.destroy();
    widget = null;
    idx = i;
    progress.markLessonStep(levelId, i);
    const c = cards[i];
    cardEl.innerHTML = '';
    put(cardEl, h('h2', null, c.title), ...paragraphs(c.text));
    const area = h('div', { class: 'widget' });
    put(cardEl, area);
    widget = makeWidget(c, area);
    counter.textContent = `${i + 1} / ${cards.length}`;
    barFill.style.width = `${((i + 1) / cards.length) * 100}%`;
    prevBtn.disabled = i === 0;
    nextBtn.textContent = i === cards.length - 1 ? 'დასრულება ✓' : 'შემდეგი →';
    window.scrollTo(0, 0);
  }

  function next() {
    if (idx < cards.length - 1) show(idx + 1);
    else {
      progress.markLessonDone(levelId);
      progress.markLessonStep(levelId, 0);
      onExit('done');
    }
  }

  if (cards.length) show(idx);
  else put(cardEl, h('p', null, 'ამ დონის ახსნა ჯერ არ არის.'));

  return {
    destroy() {
      widget?.destroy();
      progress.addTime(Date.now() - tMark);
      tMark = Date.now();
    }
  };
}

function makeWidget(card, area) {
  if (card.tour) return tourWidget(area, card.tour);
  if (card.demo?.values) return valuesDemo(area, card.demo);
  if (card.demo?.calc) return calcDemo(area, card.demo);
  if (card.demo?.program) return programDemo(area, card.demo);
  if (card.try) return tryWidget(area, card.try);
  if (card.soroban) return staticSoroban(area, card.soroban);
  return null;
}

function staticSoroban(area, { value = 0, full = false }) {
  const sv = new SorobanView(area, {
    interactive: false, showValue: true, tools: ['value', 'zoom'], zoom: !full, minRods: digitCount(value)
  });
  sv.setValue(value);
  return { destroy: () => sv.destroy() };
}

function stepControls(onRestart, onNext) {
  const counter = h('span', { class: 'step-count' });
  const restart = h('button', { class: 'btn ghost', on: { click: onRestart } }, '⟲ თავიდან');
  const nextBtn = h('button', { class: 'btn primary', on: { click: onNext } }, 'შემდეგი ნაბიჯი →');
  const el = h('div', { class: 'demo-controls' }, restart, counter, nextBtn);
  return { el, counter, nextBtn };
}

function tourWidget(area, parts) {
  const sv = new SorobanView(area, { interactive: false, showValue: false, tools: [], zoom: false });
  const title = h('h3', { class: 'tour-title' });
  const text = h('p', { class: 'tour-text' });
  let i = 0;
  const prev = h('button', { class: 'btn ghost', on: { click: () => i > 0 && show(i - 1) } }, '← წინა ნაწილი');
  const counter = h('span', { class: 'step-count' });
  const nextBtn = h('button', { class: 'btn primary', on: { click: () => i < parts.length - 1 && show(i + 1) } }, 'შემდეგი ნაწილი →');
  put(area, h('div', { class: 'caption tour-caption' }, title, text), h('div', { class: 'demo-controls' }, prev, counter, nextBtn));
  function show(k) {
    i = k;
    const part = parts[k];
    sv.setHighlight(part.part);
    sv.setValue(part.part === 'beam' ? 7 : 0);
    title.textContent = part.title;
    text.textContent = part.text;
    counter.textContent = `${k + 1} / ${parts.length}`;
    prev.disabled = k === 0;
    nextBtn.disabled = k === parts.length - 1;
  }
  show(0);
  return { destroy: () => sv.destroy() };
}

function valuesDemo(area, demo) {
  const steps = demo.values;
  const maxV = Math.max(...steps.map((s) => s.v));
  const dec = demo.unit || 0;
  const sv = new SorobanView(area, {
    interactive: false, showValue: true, tools: ['value', 'zoom'], zoom: !demo.full, minRods: Math.max(digitCount(maxV), dec + 1),
    dec, unit: dec ? dec : null
  });
  const caption = h('div', { class: 'caption' });
  let i = 0;
  const ctl = stepControls(() => show(0), () => i < steps.length - 1 && show(i + 1));
  put(area, caption, ctl.el);
  function show(k) {
    i = k;
    sv.setValue(steps[k].v);
    caption.textContent = steps[k].t;
    ctl.counter.textContent = `${k + 1} / ${steps.length}`;
    ctl.nextBtn.disabled = k === steps.length - 1;
  }
  show(0);
  return { destroy: () => sv.destroy() };
}

function calcDemo(area, demo) {
  const seq = [];
  let maxV = 0;
  const dec = demo.unit || 0;
  const fmt = (x) => fmtScaled(x, dec);
  for (const ex of demo.calc) {
    const terms = [ex.start, ...ex.ops];
    const expr = dec ? terms.map((t, i) => (i === 0 ? fmt(t) : (t < 0 ? ' − ' : ' + ') + fmt(Math.abs(t)))).join('') : exprText(terms);
    const ds = demoSteps(ex.start, ex.ops, undefined, rodNamer(dec));
    let run = ex.start;
    maxV = Math.max(maxV, run);
    for (const t of ex.ops) { run += t; maxV = Math.max(maxV, run); }
    seq.push({ type: 'reset', expr, head: `მაგალითი: ${expr}`, text: 'ვიწყებთ სუფთა სორობანით. დააჭირე „შემდეგ ნაბიჯს“.' });
    for (const s of ds.steps) seq.push({ type: 'move', expr, moves: s.moves, head: s.head, text: s.text, place: s.place });
    seq.push({ type: 'end', expr, head: `${expr} = ${dec ? fmt(ds.result) : formatNumber(ds.result)}`, text: '✓ პასუხი სორობანზე წერია.' });
  }
  const sv = new SorobanView(area, {
    interactive: false, showValue: true, tools: ['value', 'zoom'], zoom: true, minRods: Math.max(2, digitCount(maxV), dec + 1),
    dec, unit: dec ? dec : null
  });
  const exprEl = h('div', { class: 'demo-expr' });
  const headEl = h('div', { class: 'caption-head' });
  const textEl = h('div', { class: 'caption-text' });
  const caption = h('div', { class: 'caption' }, headEl, textEl);
  let i = 0;
  const ctl = stepControls(() => start(), () => i < seq.length - 1 && apply(i + 1));
  area.prepend(exprEl);
  put(area, caption, ctl.el);

  function apply(k) {
    i = k;
    const s = seq[k];
    if (s.type === 'reset') { sv.clear(); sv.setFocus([]); }
    else if (s.type === 'move') { sv.setFocus([s.place]); sv.applyMoves(s.moves); }
    else sv.setFocus([]);
    exprEl.textContent = s.expr;
    headEl.textContent = s.head;
    textEl.textContent = s.text;
    ctl.counter.textContent = `${k + 1} / ${seq.length}`;
    ctl.nextBtn.disabled = k === seq.length - 1;
  }
  function start() {
    sv.clear();
    apply(0);
  }
  start();
  return { destroy: () => sv.destroy() };
}

// გამრავლება/გაყოფის დემო (片落とし): ▼ — სად იწერება პირველი რიცხვის ერთეულები, ▲ — პასუხის ერთეულები
function programDemo(area, demo) {
  const seq = [];
  let top = 2;
  let anchor = 0;
  for (const ex of demo.program) {
    const prog = ex.mul ? mulProgram(ex.mul) : divProgram(ex.div);
    const spec = ex.mul || ex.div;
    const aShow = fmtScaled(spec.a, spec.aDec || 0);
    const expr = ex.mul ? `${aShow} × ${fmtScaled(spec.b, spec.bDec || 0)}` : `${aShow} : ${spec.b}`;
    anchor = spec.place;
    top = Math.max(top, String(prog.answerBoard).length, String(prog.steps[0].after).length, prog.unit + 1, spec.place + 1);
    seq.push({ type: 'reset', expr, anchor: spec.place, unit: prog.unit, head: `მაგალითი: ${expr}`,
      text: `▼ — ${ex.mul ? 'პირველი თანამამრავლის' : 'გასაყოფის'} ერთეულები (${rodLabel(spec.place)}). ▲ — პასუხის ერთეულები (${rodLabel(prog.unit)}).` });
    for (const st of prog.steps) {
      seq.push({ type: 'intro', expr, head: st.instr, text: st.hint, rods: st.rods });
      for (const m of st.micro) seq.push({ type: 'move', expr, head: st.instr, text: m.text, moves: m.moves, place: m.place });
    }
    seq.push({ type: 'end', expr, head: `${expr} = ${ex.answer}`, text: ex.read || '✓ პასუხი ▲ ღეროდან იკითხება.' });
  }
  const sv = new SorobanView(area, {
    interactive: false, showValue: false, tools: ['zoom'], zoom: true, minRods: top, anchor
  });
  const exprEl = h('div', { class: 'demo-expr' });
  const headEl = h('div', { class: 'caption-head' });
  const textEl = h('div', { class: 'caption-text' });
  let i = 0;
  const ctl = stepControls(() => start(), () => i < seq.length - 1 && apply(i + 1));
  area.prepend(exprEl);
  put(area, h('div', { class: 'caption' }, headEl, textEl), ctl.el);
  function apply(k) {
    i = k;
    const s = seq[k];
    if (s.type === 'reset') { sv.clear(); sv.setFocus([]); sv.setMarkers({ anchor: s.anchor, unit: s.unit }); }
    else if (s.type === 'intro') sv.setFocus(s.rods || []);
    else if (s.type === 'move') { sv.setFocus([s.place]); sv.applyMoves(s.moves); }
    else sv.setFocus([]);
    exprEl.textContent = s.expr;
    headEl.textContent = s.head;
    textEl.textContent = s.text;
    ctl.counter.textContent = `${k + 1} / ${seq.length}`;
    ctl.nextBtn.disabled = k === seq.length - 1;
  }
  function start() { sv.clear(); apply(0); }
  start();
  return { destroy: () => sv.destroy() };
}

function tryWidget(area, { target, unit = 0 }) {
  const show = unit ? fmtScaled(target, unit) : formatNumber(target);
  const status = h('div', { class: 'caption' }, `ჩაწერე: ${show}`);
  const sv = new SorobanView(area, {
    interactive: true, showValue: false, tools: ['clear', 'value', 'zoom'], minRods: Math.max(digitCount(target), unit + 1),
    dec: unit, unit: unit ? unit : null,
    onChange: (v) => {
      const ok = v === target;
      status.classList.toggle('good', ok);
      status.textContent = ok ? '✓ სწორია! შეგიძლია გადახვიდე შემდეგზე.' : `ჩაწერე: ${show}`;
    }
  });
  put(area, status);
  return { destroy: () => sv.destroy() };
}
