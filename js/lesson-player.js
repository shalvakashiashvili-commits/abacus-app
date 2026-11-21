// გაკვეთილის ეკრანი: ბარათები (თითოზე ერთი იდეა), ანიმირებული ნაბიჯ-ნაბიჯ დემონსტრაციები,
// სორობანის გაცნობის ტური და „სცადე თავად“ ბარათები.

import { h, paragraphs, exprText, digitCount } from './ui.js';
import { SorobanView } from './soroban-view.js';
import { getLesson } from './lessons.js';
import { demoSteps } from './techniques.js';
import { formatNumber } from './soroban.js';

export function renderLesson(root, { levelId, progress, onExit }) {
  const cards = getLesson(levelId);
  let idx = Math.min(progress.level(levelId).lessonStep || 0, Math.max(0, cards.length - 1));
  let widget = null;
  let tMark = Date.now();

  const counter = h('div', { class: 'topbar-meta' });
  const head = h('div', { class: 'topbar' },
    h('button', { class: 'icon-btn', 'aria-label': 'უკან', on: { click: () => onExit('back') } }, '←'),
    h('div', { class: 'topbar-title' }, `დონე ${levelId} · ახსნა`),
    counter);
  const barFill = h('div', { class: 'bar-fill' });
  const bar = h('div', { class: 'bar' }, barFill);
  const cardEl = h('div', { class: 'card lesson-card' });
  const prevBtn = h('button', { class: 'btn ghost', on: { click: () => idx > 0 && show(idx - 1) } }, '← წინა');
  const nextBtn = h('button', { class: 'btn primary', on: { click: next } });
  const nav = h('div', { class: 'lesson-nav' }, prevBtn, nextBtn);
  root.append(head, bar, cardEl, nav);

  function show(i) {
    widget?.destroy();
    widget = null;
    idx = i;
    progress.markLessonStep(levelId, i);
    const c = cards[i];
    cardEl.innerHTML = '';
    cardEl.append(h('h2', null, c.title), ...paragraphs(c.text));
    const area = h('div', { class: 'widget' });
    cardEl.append(area);
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
  else cardEl.append(h('p', null, 'ამ დონის ახსნა ჯერ არ არის.'));

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
  area.append(h('div', { class: 'caption tour-caption' }, title, text), h('div', { class: 'demo-controls' }, prev, counter, nextBtn));
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
  const sv = new SorobanView(area, {
    interactive: false, showValue: true, tools: ['value', 'zoom'], zoom: !demo.full, minRods: digitCount(maxV)
  });
  const caption = h('div', { class: 'caption' });
  let i = 0;
  const ctl = stepControls(() => show(0), () => i < steps.length - 1 && show(i + 1));
  area.append(caption, ctl.el);
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
  for (const ex of demo.calc) {
    const terms = [ex.start, ...ex.ops];
    const expr = exprText(terms);
    const ds = demoSteps(ex.start, ex.ops);
    let run = ex.start;
    maxV = Math.max(maxV, run);
    for (const t of ex.ops) { run += t; maxV = Math.max(maxV, run); }
    seq.push({ type: 'reset', expr, head: `მაგალითი: ${expr}`, text: 'ვიწყებთ სუფთა სორობანით. დააჭირე „შემდეგ ნაბიჯს“.' });
    for (const s of ds.steps) seq.push({ type: 'move', expr, moves: s.moves, head: s.head, text: s.text, place: s.place });
    seq.push({ type: 'end', expr, head: `${expr} = ${formatNumber(ds.result)}`, text: '✓ პასუხი სორობანზე წერია.' });
  }
  const sv = new SorobanView(area, {
    interactive: false, showValue: true, tools: ['value', 'zoom'], zoom: true, minRods: Math.max(2, digitCount(maxV))
  });
  const exprEl = h('div', { class: 'demo-expr' });
  const headEl = h('div', { class: 'caption-head' });
  const textEl = h('div', { class: 'caption-text' });
  const caption = h('div', { class: 'caption' }, headEl, textEl);
  let i = 0;
  const ctl = stepControls(() => start(), () => i < seq.length - 1 && apply(i + 1));
  area.prepend(exprEl);
  area.append(caption, ctl.el);

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

function tryWidget(area, { target }) {
  const status = h('div', { class: 'caption' }, `ჩაწერე: ${formatNumber(target)}`);
  const sv = new SorobanView(area, {
    interactive: true, showValue: false, tools: ['clear', 'value', 'zoom'], minRods: digitCount(target),
    onChange: (v) => {
      const ok = v === target;
      status.classList.toggle('good', ok);
      status.textContent = ok ? '✓ სწორია! შეგიძლია გადახვიდე შემდეგზე.' : `ჩაწერე: ${formatNumber(target)}`;
    }
  });
  area.append(status);
  return { destroy: () => sv.destroy() };
}
