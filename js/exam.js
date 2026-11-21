// „კენტეის მსგავსი“ საგამოცდო რეჟიმი: სექციები, საერთო დრო, ქულები და გამსვლელი ზღვარი.
// ფორმატი აღებულია 日本珠算連盟-ის ოფიციალური ცხრილიდან (EXAM_GRADES, levels.js); ამოცანებს აპი ადგენს —
// ამიტომ ეს ვარჯიშია და არა ოფიციალური გამოცდა.

import { h, confirmDialog, fmtSec, put } from './ui.js';
import { EXAM_GRADES, EXAM_TIME_MODES, DEFAULT_EXAM_TIME_MODE, examMinutes, getLevel } from './levels.js';
import { buildExam } from './generator.js';
import { renderProblem, problemLabel } from './exercise.js';

export const EXAM_DISCLAIMER = 'კენტეის მსგავსი ვარჯიში: სექციები, ამოცანების რაოდენობა, ციფრები, დრო, ქულები და გამსვლელი ზღვარი აღებულია იაპონიის სორობანის ფედერაციის (日本珠算連盟) ოფიციალური ცხრილიდან, ამოცანებს კი აპი ადგენს. ეს ოფიციალური გამოცდა არ არის და ოფიციალურ კიუს არ ანიჭებს.';

const SECTION_TITLE = { mitori: 'სვეტები', kake: 'გამრავლება', wari: 'გაყოფა' };

export function examFormatTable(grade) {
  return h('table', { class: 'exam-table' },
    h('thead', null, h('tr', null, h('th', null, 'სექცია'), h('th', null, 'ამოცანა'), h('th', null, 'ქულა'))),
    h('tbody', null, grade.sections.map((s) => h('tr', null,
      h('td', null, s.title, h('div', { class: 'small muted' }, s.format)),
      h('td', null, String(s.n)),
      h('td', null, `${s.points} × ${s.n} = ${s.points * s.n}`)))));
}

export function renderExamList(root, { progress }) {
  put(root, h('section', { class: 'card' },
    h('h2', null, 'საგამოცდო რეჟიმი'),
    h('p', null, 'აირჩიე დონე. გამოცდა დროზეა: სორობანზე ამოხსნი სვეტებს, გამრავლებას და გაყოფას, ბოლოს კი ქულებს ნახავ.'),
    h('div', { class: 'disclaimer' }, EXAM_DISCLAIMER)));
  for (const g of EXAM_GRADES) {
    const best = progress.bestExam(g.id);
    put(root, h('a', { class: 'exam-grade', href: `#/exam/${g.id}` },
      h('b', null, `${g.grade}ს მსგავსი`),
      h('div', { class: 'small muted' }, `${g.sections.map((s) => `${SECTION_TITLE[s.key]} ${s.n}`).join(' · ')} · ${g.minutes} წთ (გაზრდილი: ${examMinutes(g, 'extended')} წთ) · გასვლა ≥ ${g.pass} / ${g.total}`),
      best ? h('div', { class: 'small' }, `საუკეთესო: ${best.score} / ${g.total}${best.passed ? ' ✓' : ''} (${(EXAM_TIME_MODES[best.timeMode] || EXAM_TIME_MODES.official).label})`) : null));
  }
}

export function runExam(root, { grade, progress, onExit }) {
  const level = getLevel('10b');
  const problems = buildExam(grade, level);
  const results = new Array(problems.length).fill(null);
  let index = 0;
  let current = null;
  let tick = null;
  let endAt = 0;
  let timeMode = EXAM_TIME_MODES[progress.settings.examTimeMode] ? progress.settings.examTimeMode : DEFAULT_EXAM_TIME_MODE;
  let t0 = 0;
  let destroyed = false;
  let finished = false;

  const clockEl = h('div', { class: 'timer' });
  const counter = h('div', { class: 'topbar-meta' });
  const secEl = h('div', { class: 'small muted' });
  const body = h('div', { class: 'ex-body' });
  const barFill = h('div', { class: 'bar-fill' });
  put(root, 
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'დახურვა', on: { click: close } }, '✕'),
      h('div', { class: 'topbar-title' }, `${grade.grade}ს მსგავსი`),
      clockEl, counter),
    h('div', { class: 'bar' }, barFill), body);

  async function close() {
    if (t0 && !finished) {
      const ok = await confirmDialog('გამოცდის შეწყვეტა? შედეგი არ ჩაიწერება.', { ok: 'შეწყვეტა' });
      if (!ok) return;
    }
    onExit('back');
  }

  function intro() {
    put(body, h('div', { class: 'card' },
      h('h2', null, `${grade.grade}ს მსგავსი გამოცდა`),
      examFormatTable(grade),
      h('p', null, `ოფიციალური დრო: ${grade.minutes} წუთი ყველა სექციაზე ერთად. გასასვლელად: ≥ ${grade.pass} ქულა ${grade.total}-დან.`),
      h('div', { class: 'field' }, h('span', null, 'დროის რეჟიმი:'),
        h('div', { class: 'radios' }, Object.entries(EXAM_TIME_MODES).map(([key, m]) =>
          h('label', { class: 'radio' },
            h('input', { type: 'radio', name: 'examTime', value: key, checked: key === timeMode, on: { change: () => { timeMode = key; progress.setSetting('examTimeMode', key); } } }),
            `${m.label} — ${examMinutes(grade, key)} წთ`)))),
      h('p', { class: 'small muted' }, 'ამოცანას შეგიძლია გამოტოვო. დროის ამოწურვისას გამოცდა ავტომატურად სრულდება. პასუხის სისწორეს ბოლოს ნახავ.'),
      h('div', { class: 'disclaimer' }, EXAM_DISCLAIMER),
      h('button', { class: 'btn primary wide', on: { click: start } }, 'დაწყება →')));
  }

  function start() {
    t0 = Date.now();
    endAt = t0 + examMinutes(grade, timeMode) * 60 * 1000;
    tick = setInterval(() => {
      const left = Math.max(0, endAt - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      clockEl.textContent = `⏳ ${m}:${String(s).padStart(2, '0')}`;
      if (left <= 0) finish(true);
    }, 250);
    show();
  }

  function show() {
    current?.destroy();
    body.innerHTML = '';
    if (index >= problems.length) { finish(false); return; }
    const p = problems[index];
    const sec = grade.sections.find((s) => s.key === p.section);
    counter.textContent = `${index + 1} / ${problems.length}`;
    barFill.style.width = `${(index / problems.length) * 100}%`;
    let pt0 = performance.now();
    const ctx = {
      mode: 'exam', guided: false, progress, body,
      startTimer: () => { pt0 = performance.now(); },
      elapsed: () => performance.now() - pt0,
      isDestroyed: () => destroyed || finished,
      done: ({ correct, given }) => {
        const ms = performance.now() - pt0;
        results[index] = { correct, given, ms };
        progress.recordAnswer({ level: p.level, mode: 'exam', problem: p, correct, ms });
        index += 1;
        show();
      }
    };
    put(body, h('div', { class: 'row between' }, h('div', { class: 'small' }, h('b', null, sec.title)),
      h('button', { class: 'btn small ghost', on: { click: () => { results[index] = { correct: false, skipped: true, ms: 0 }; index += 1; show(); } } }, 'გამოტოვება →')));
    current = renderProblem(p, ctx);
    window.scrollTo(0, 0);
  }

  function finish(timeUp) {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    current?.destroy();
    current = null;
    body.innerHTML = '';
    barFill.style.width = '100%';
    const secs = Math.round((Date.now() - t0) / 1000);
    let score = 0;
    const rows = grade.sections.map((s) => {
      const idx = problems.map((p, i) => (p.section === s.key ? i : -1)).filter((i) => i >= 0);
      const ok = idx.filter((i) => results[i]?.correct).length;
      const pts = ok * s.points;
      score += pts;
      return { s, ok, pts, n: idx.length };
    });
    const passed = score >= grade.pass;
    progress.addExam({ grade: grade.id, score, total: grade.total, passed, secs, timeMode, minutes: examMinutes(grade, timeMode), sections: rows.map((r) => ({ key: r.s.key, ok: r.ok, n: r.n })) });
    const wrong = problems.map((p, i) => ({ p, r: results[i] })).filter((x) => !x.r?.correct);
    put(body, h('div', { class: 'card results' },
      h('div', { class: `result-badge ${passed ? 'good' : 'bad'}` }, String(score)),
      h('h2', null, passed ? 'გამსვლელი ქულა მიღწეულია!' : 'გამსვლელი ქულა ჯერ არ არის'),
      h('p', null, `${score} / ${grade.total} (გასვლა ≥ ${grade.pass}) · დრო: ${Math.floor(secs / 60)} წთ ${secs % 60} წმ${timeUp ? ' — დრო ამოიწურა' : ''}`),
      h('p', { class: 'small muted' }, `რეჟიმი: ${EXAM_TIME_MODES[timeMode].label}, ${examMinutes(grade, timeMode)} წთ`),
      h('table', { class: 'exam-table' }, h('tbody', null, rows.map((r) => h('tr', null,
        h('td', null, r.s.title), h('td', null, `${r.ok} / ${r.n}`), h('td', null, `${r.pts} ქულა`))))),
      h('div', { class: 'disclaimer' }, EXAM_DISCLAIMER),
      wrong.length ? [h('h3', null, `შეცდომები და გამოტოვებული (${wrong.length}):`),
        h('ul', { class: 'mistake-list' }, wrong.slice(0, 30).map((x) => h('li', null, `${problemLabel(x.p)}${x.r?.skipped ? ' — გამოტოვებული' : !x.r ? ' — დრო ამოიწურა' : ''}`)))] : null,
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn ghost', on: { click: () => onExit('again') } }, 'თავიდან'),
        h('button', { class: 'btn primary', on: { click: () => onExit('list') } }, 'გამოცდების სია'))));
  }

  intro();
  return {
    destroy() {
      destroyed = true;
      clearInterval(tick);
      current?.destroy();
    }
  };
}

export { fmtSec };
