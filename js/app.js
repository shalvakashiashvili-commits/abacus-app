// აპლიკაციის ჩარჩო: მარშრუტიზაცია (#/...), ეკრანები, თემა, service worker-ის რეგისტრაცია.

import { h, toast, confirmDialog, fmtSec, fmtPct } from './ui.js';
import { Progress } from './progress.js';
import { LEVELS, getLevel, testSize, PASS_ACCURACY } from './levels.js';
import { getLesson } from './lessons.js';
import { buildSet, shuffle, problemKey } from './generator.js';
import { renderLesson } from './lesson-player.js';
import { runSession, problemLabel } from './exercise.js';
import { SorobanView } from './soroban-view.js';

const progress = new Progress();
const app = document.getElementById('app');
const nav = document.getElementById('nav');
let cleanup = null;

// ---------- თემა ----------
function applyTheme() {
  const t = progress.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171b1d' : '#f5f2ec');
}
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
applyTheme();

// ---------- მარშრუტიზაცია ----------
function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function setScreen(render, { showNav = true, navKey = null } = {}) {
  try { cleanup?.(); } catch (e) { /* წინა ეკრანის გასუფთავების შეცდომა არ უნდა აჩერებდეს ნავიგაციას */ }
  cleanup = null;
  app.innerHTML = '';
  nav.hidden = !showNav;
  document.body.classList.toggle('with-nav', showNav);
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.key === navKey));
  const r = render(app);
  if (r && typeof r.destroy === 'function') cleanup = () => r.destroy();
  window.scrollTo(0, 0);
}

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const id = Number(parts[1]);
  switch (parts[0]) {
    case 'level': return setScreen((r) => levelScreen(r, id), { navKey: 'home' });
    case 'lesson': return setScreen((r) => lessonScreen(r, id), { showNav: false });
    case 'practice': return setScreen((r) => practiceScreen(r, id, parts[2]), { showNav: false });
    case 'review': return setScreen((r) => reviewScreen(r), { showNav: false });
    case 'free': return setScreen((r) => freeScreen(r), { navKey: 'free' });
    case 'progress': return setScreen((r) => progressScreen(r), { navKey: 'progress' });
    case 'settings': return setScreen((r) => settingsScreen(r), { navKey: 'settings' });
    default: return setScreen((r) => homeScreen(r), { navKey: 'home' });
  }
}

window.addEventListener('hashchange', route);

// ---------- საერთო ელემენტები ----------
function topbar(title, backHash = '#/') {
  return h('div', { class: 'topbar' },
    h('a', { class: 'icon-btn', href: backHash, 'aria-label': 'უკან' }, '←'),
    h('div', { class: 'topbar-title' }, title));
}

function tile(label, value) {
  return h('div', { class: 'tile' }, h('div', { class: 'tile-value' }, value), h('div', { class: 'tile-label' }, label));
}

// ---------- დღის რეკომენდებული სესია ----------
function dailyPlan() {
  const cur = progress.currentLevelId();
  const plan = progress.day().plan;
  const due = progress.dueMistakes(100).length;
  const passed = progress.passedLevels();
  const blocks = [];

  const canReview = due > 0 || passed.length > 0;
  blocks.push({
    key: 'review', title: 'გამეორება', min: '~5 წთ',
    desc: due ? `${due} შეცდომა წინა სესიებიდან და გავლილი მასალა` : canReview ? 'გავლილი დონეების მაგალითები' : 'ჯერ გასამეორებელი არაფერია',
    href: '#/review', available: canReview, done: !!plan.review || !canReview
  });

  if (cur !== null) {
    const lv = progress.level(cur);
    let learn;
    if (!lv.lessonDone) learn = { desc: `დონე ${cur}: ახსნა${lv.lessonStep ? ' (გაგრძელება)' : ''}`, href: `#/lesson/${cur}` };
    else if (!lv.guidedDone) learn = { desc: `დონე ${cur}: მართული სავარჯიშო`, href: `#/practice/${cur}/guided` };
    else if (lv.tasksBest >= 0.8) learn = { desc: `დონე ${cur}: დონის ტესტი`, href: `#/practice/${cur}/test` };
    else learn = { desc: `დონე ${cur}: მართული სავარჯიშო (კიდევ ერთხელ)`, href: `#/practice/${cur}/guided` };
    blocks.push({ key: 'learn', title: 'ახალი მასალა', min: '~10 წთ', ...learn, available: true, done: !!plan.learn });
    blocks.push({
      key: 'tasks', title: 'დავალებები', min: '~10 წთ',
      desc: lv.lessonDone ? `დონე ${cur}: 10 ახალი მაგალითი` : 'გაიხსნება ახსნის დასრულების შემდეგ',
      href: `#/practice/${cur}/tasks`, available: lv.lessonDone, done: !!plan.tasks
    });
  } else {
    const last = passed[passed.length - 1];
    blocks.push({ key: 'learn', title: 'ახალი მასალა', min: '', desc: 'ეტაპი 1-ის ყველა დონე გავლილია — ახალი დონეები შემდეგ ეტაპზე დაემატება', available: false, done: true });
    blocks.push({ key: 'tasks', title: 'დავალებები', min: '~10 წთ', desc: `დონე ${last}: შენარჩუნებისთვის`, href: `#/practice/${last}/tasks`, available: true, done: !!plan.tasks });
  }
  return blocks;
}

function dailyCard() {
  const goal = Number(progress.settings.dailyGoalMin) || 20;
  const mins = Math.floor(progress.day().ms / 60000);
  const blocks = dailyPlan();
  return h('section', { class: 'card' },
    h('div', { class: 'row between' }, h('h2', null, 'დღის სესია'), h('span', { class: 'muted small' }, '20–30 წუთი')),
    h('div', { class: 'bar' }, h('div', { class: 'bar-fill', style: { width: `${Math.min(100, (mins / goal) * 100)}%` } })),
    h('div', { class: 'muted small' }, `დღეს: ${mins} / ${goal} წთ`),
    h('ol', { class: 'plan' }, blocks.map((b, i) =>
      h('li', { class: `plan-item${b.done ? ' done' : ''}` },
        h('span', { class: 'plan-mark' }, b.done ? '✓' : String(i + 1)),
        h('div', { class: 'plan-text' }, h('div', { class: 'plan-title' }, b.title, b.min ? h('span', { class: 'muted small' }, ` · ${b.min}`) : null), h('div', { class: 'muted small' }, b.desc)),
        b.available ? h('a', { class: `btn small ${b.done ? 'ghost' : 'primary'}`, href: b.href }, b.done ? 'კიდევ' : 'დაწყება') : null))));
}

// ---------- მთავარი ეკრანი ----------
function homeScreen(root) {
  const t = progress.totals();
  root.append(
    h('header', { class: 'home-head' },
      h('div', { class: 'brand' },
        h('img', { src: './icons/icon-192.png', alt: '', class: 'brand-icon', width: '44', height: '44' }),
        h('div', null, h('h1', null, 'აბაკუსი'), h('div', { class: 'muted small' }, 'სორობანი და ანძანი'))),
      h('div', { class: 'streak', title: 'დღეების სერია' }, `🔥 ${progress.streak()}`)),
    dailyCard(),
    h('section', { class: 'card' }, h('h2', null, 'დონეების რუკა'), levelMap()),
    h('section', { class: 'card' }, h('h2', null, 'სტატისტიკა'),
      h('div', { class: 'tiles' },
        tile('სიზუსტე', fmtPct(t.accuracy)),
        tile('საშუალო დრო', fmtSec(t.avgSec)),
        tile('ამოხსნილი', String(t.answered)),
        tile('დღეების სერია', `${progress.streak()} (მაქს. ${progress.bestStreak()})`)),
      h('a', { class: 'btn ghost wide', href: '#/progress' }, 'დეტალური პროგრესი →'))
  );
}

function levelMap() {
  const cur = progress.currentLevelId();
  return h('ol', { class: 'map' }, LEVELS.map((l) => {
    let state, label, mark;
    if (!l.built) { state = 'soon'; label = 'შემდეგ ეტაპზე'; mark = String(l.id); }
    else if (progress.isPassed(l.id)) { state = 'passed'; label = 'გავლილია'; mark = '✓'; }
    else if (l.id === cur) { state = 'current'; label = 'მიმდინარე'; mark = String(l.id); }
    else { state = 'locked'; label = 'დაბლოკილია'; mark = '🔒'; }
    const open = state === 'passed' || state === 'current';
    const onClick = (e) => {
      if (open) return;
      e.preventDefault();
      toast(state === 'soon' ? 'ეს დონე აპლიკაციის შემდეგ ეტაპზე დაემატება.' : `ჯერ დაასრულე დონე ${l.id - 1}.`);
    };
    return h('li', { class: `map-node ${state}` },
      h('a', { href: open ? `#/level/${l.id}` : '#/', on: { click: onClick } },
        h('span', { class: 'node-circle' }, mark),
        h('span', { class: 'node-text' },
          h('span', { class: 'node-title' }, `${l.id}. ${l.title}`),
          h('span', { class: 'node-sub' }, l.subtitle),
          h('span', { class: 'node-state' }, label))));
  }));
}

// ---------- დონის ეკრანი ----------
function levelScreen(root, id) {
  const lvl = getLevel(id);
  if (!lvl || !lvl.built || !progress.isUnlocked(id)) {
    toast('ეს დონე ჯერ დაბლოკილია.');
    location.hash = '#/';
    return null;
  }
  const st = progress.level(id);
  const nCards = getLesson(id).length;
  const lessonDesc = st.lessonDone ? `დასრულებულია · ${nCards} ბარათი` : st.lessonStep > 0 ? `გაგრძელება: ${st.lessonStep + 1} / ${nCards}` : `${nCards} ბარათი ანიმირებული დემონსტრაციებით`;
  const maxAvg = lvl.test.maxAvgSec;
  const steps = [
    { n: 1, title: 'ახსნა', desc: lessonDesc, href: `#/lesson/${id}`, done: st.lessonDone, enabled: true },
    { n: 2, title: 'მართული სავარჯიშო', desc: 'მინიშნებებით, მარტივიდან რთულისკენ', href: `#/practice/${id}/guided`, done: st.guidedDone, enabled: st.lessonDone },
    { n: 3, title: 'დავალებები', desc: `10 ავტომატური მაგალითი${st.tasksRuns ? ` · საუკეთესო: ${fmtPct(st.tasksBest)}` : ''}`, href: `#/practice/${id}/tasks`, done: st.tasksBest >= PASS_ACCURACY, enabled: st.lessonDone },
    {
      n: 4, title: 'დონის ტესტი',
      desc: `${testSize(lvl)} მაგალითი · ≥ ${Math.round(PASS_ACCURACY * 100)}% · ${maxAvg ? `საშუალოდ ≤ ${maxAvg} წმ` : 'დროის ლიმიტის გარეშე'}${st.testBest !== null ? ` · საუკეთესო: ${fmtPct(st.testBest)}` : ''}`,
      href: `#/practice/${id}/test`, done: st.passed, enabled: st.lessonDone
    }
  ];
  const acc = st.answered ? st.correct / st.answered : null;
  root.append(
    topbar(`დონე ${id}`),
    h('section', { class: 'card' },
      h('h1', { class: 'level-title' }, lvl.title),
      h('p', { class: 'muted' }, lvl.subtitle),
      st.passed ? h('div', { class: 'chip ok-chip' }, `✓ გავლილია ${st.passedAt || ''}`) : null),
    h('ol', { class: 'steps' }, steps.map((s) =>
      h('li', { class: `step${s.done ? ' done' : ''}${s.enabled ? '' : ' disabled'}` },
        h('a', {
          href: s.enabled ? s.href : `#/level/${id}`,
          on: { click: (e) => { if (!s.enabled) { e.preventDefault(); toast('ჯერ გაიარე ახსნა.'); } } }
        },
          h('span', { class: 'plan-mark' }, s.done ? '✓' : String(s.n)),
          h('span', { class: 'step-text' }, h('span', { class: 'plan-title' }, s.title), h('span', { class: 'muted small' }, s.desc)),
          h('span', { class: 'chev' }, s.enabled ? '›' : '🔒'))))),
    h('section', { class: 'card' }, h('h2', null, 'ამ დონის სტატისტიკა'),
      h('div', { class: 'tiles' },
        tile('ამოხსნილი', String(st.answered)),
        tile('სიზუსტე', fmtPct(acc)),
        tile('საშუალო დრო', fmtSec(st.answered ? st.ms / st.answered / 1000 : null))))
  );
  return null;
}

// ---------- გაკვეთილი ----------
function lessonScreen(root, id) {
  if (!progress.isUnlocked(id)) { location.hash = '#/'; return null; }
  return renderLesson(root, {
    levelId: id, progress,
    onExit: (kind) => {
      if (kind === 'done') toast('ახსნა დასრულებულია! გადადი მართულ სავარჯიშოზე.');
      go(`#/level/${id}`);
    }
  });
}

// ---------- სავარჯიშოები ----------
function practiceScreen(root, id, mode) {
  const lvl = getLevel(id);
  if (!lvl || !progress.isUnlocked(id) || !['guided', 'tasks', 'test'].includes(mode)) { location.hash = '#/'; return null; }
  if (!progress.level(id).lessonDone) { toast('ჯერ გაიარე ახსნა.'); location.hash = `#/level/${id}`; return null; }
  let problems;
  try {
    if (mode === 'guided') problems = buildSet(lvl.guided, lvl);
    else if (mode === 'tasks') problems = buildSet(lvl.tasks, lvl);
    else problems = shuffle(buildSet(lvl.test.items, lvl));
  } catch (e) {
    problems = [];
  }
  return runSession(root, {
    mode, levelId: id, problems, progress,
    onExit: (kind) => {
      if (kind === 'again') route();
      else go(`#/level/${id}`);
    }
  });
}

function buildReview() {
  const due = progress.dueMistakes(6).map((m) => ({ ...m.problem, level: m.level ?? m.problem.level, mistakeId: m.id }));
  const keys = new Set(due.map((p) => problemKey(p)));
  let pool = progress.passedLevels();
  if (!pool.length) {
    const cur = progress.currentLevelId();
    if (cur !== null && progress.level(cur).lessonDone) pool = [cur];
  }
  const extra = [];
  const need = Math.max(0, 10 - due.length);
  if (pool.length && need) {
    for (let i = 0; i < need; i++) {
      const lvl = getLevel(pool[Math.floor(Math.random() * pool.length)]);
      const spec = lvl.tasks[Math.floor(Math.random() * lvl.tasks.length)];
      const [p] = buildSet([{ ...spec, n: 1 }], lvl, Math.random, keys);
      keys.add(problemKey(p));
      extra.push(p);
    }
  }
  return [...due, ...extra];
}

function reviewScreen(root) {
  const problems = buildReview();
  if (!problems.length) {
    root.append(topbar('გამეორება'), h('section', { class: 'card' },
      h('p', null, 'ჯერ გასამეორებელი არაფერია. შეცდომები და გავლილი დონეების მაგალითები აქ გამოჩნდება.'),
      h('a', { class: 'btn primary wide', href: '#/' }, 'მთავარ ეკრანზე')));
    return null;
  }
  return runSession(root, {
    mode: 'review', levelId: null, problems, progress,
    onExit: (kind) => { if (kind === 'again') route(); else go('#/'); }
  });
}

// ---------- თავისუფალი სორობანი ----------
function freeScreen(root) {
  root.append(topbar('თავისუფალი სორობანი'));
  const host = h('section', { class: 'card' });
  root.append(host);
  const sv = new SorobanView(host, { interactive: true, showValue: !!progress.settings.showValue, tools: ['clear', 'value', 'zoom'] });
  host.append(h('p', { class: 'muted small' }, 'შეეხე მძივებს: ზედა მძივი = 5, ქვედა = 1. მძივი ითვლება, როცა გამყოფ ზოლს ეხება. ერთეულები — ყველაზე მარჯვენა ღეროზე.'));
  const t0 = Date.now();
  return { destroy: () => { sv.destroy(); progress.addTime(Math.min(Date.now() - t0, 5 * 60 * 1000)); } };
}

// ---------- პროგრესი ----------
function progressScreen(root) {
  const t = progress.totals();
  const days = progress.lastDays(14);
  const maxMs = Math.max(1, ...days.map((d) => d.ms));
  const mistakes = progress.data.mistakes.slice().reverse();
  root.append(
    topbar('პროგრესი'),
    h('section', { class: 'card' }, h('h2', null, 'საერთო'),
      h('div', { class: 'tiles' },
        tile('სიზუსტე', fmtPct(t.accuracy)),
        tile('საშუალო დრო', fmtSec(t.avgSec)),
        tile('ამოხსნილი', String(t.answered)),
        tile('სერია / მაქს.', `${progress.streak()} / ${progress.bestStreak()}`))),
    h('section', { class: 'card' }, h('h2', null, 'ბოლო 14 დღე (წუთები)'),
      h('div', { class: 'chart', role: 'img', 'aria-label': 'ვარჯიშის წუთები დღეების მიხედვით' }, days.map((d) => {
        const mins = Math.round(d.ms / 60000);
        return h('div', { class: 'chart-col', title: `${d.key}: ${mins} წთ, ${d.answered} მაგალითი` },
          h('div', { class: 'chart-val small' }, mins ? String(mins) : ''),
          h('div', { class: 'chart-bar', style: { height: `${Math.max(d.ms ? 6 : 2, (d.ms / maxMs) * 100)}%` } }),
          h('div', { class: 'chart-day small muted' }, d.key.slice(8)));
      }))),
    h('section', { class: 'card' }, h('h2', null, 'დონეები'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, 'დონე'), h('th', null, 'სიზუსტე'), h('th', null, 'დრო'), h('th', null, 'ტესტი'))),
        h('tbody', null, LEVELS.filter((l) => l.built).map((l) => {
          const s = progress.level(l.id);
          return h('tr', null,
            h('td', null, `${s.passed ? '✓ ' : ''}${l.id}. ${l.title}`),
            h('td', null, fmtPct(s.answered ? s.correct / s.answered : null)),
            h('td', null, fmtSec(s.answered ? s.ms / s.answered / 1000 : null)),
            h('td', null, s.testBest === null ? '—' : fmtPct(s.testBest)));
        }))))),
    h('section', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, `შეცდომები (${mistakes.length})`),
        mistakes.length ? h('a', { class: 'btn small primary', href: '#/review' }, 'გამეორება') : null),
      mistakes.length
        ? h('ul', { class: 'mistake-list' }, mistakes.slice(0, 50).map((m) =>
          h('li', null, h('span', null, `დ${m.level} · ${problemLabel(m.problem)}`),
            h('span', { class: 'muted small' }, ` ✗${m.wrong}${m.right ? ` ✓${m.right}` : ''}`))))
        : h('p', { class: 'muted' }, 'შეცდომები არ არის. შეცდომით ამოხსნილი მაგალითები აქ ჩაიწერება და შემდეგ სესიებში ხელახლა გამოჩნდება.'))
  );
  return null;
}

// ---------- პარამეტრები ----------
function settingsScreen(root) {
  const s = progress.settings;
  const radio = (name, value, label, current, onChange) =>
    h('label', { class: 'radio' }, h('input', { type: 'radio', name, value, checked: current === value, on: { change: () => onChange(value) } }), label);

  const speedLabel = h('span');
  const updSpeed = (v) => { speedLabel.textContent = `${Number(v).toFixed(1)} წმ`; };
  updSpeed(s.columnSpeed);

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, on: { change: onImport } });
  const cacheInfo = h('span', { class: 'muted' }, '…');
  if (window.caches) {
    caches.keys().then((keys) => { cacheInfo.textContent = keys.filter((k) => k.startsWith('abacus-')).join(', ') || 'ჯერ არ არის (offline რეჟიმი პირველი ჩატვირთვის შემდეგ ჩაირთვება)'; })
      .catch(() => { cacheInfo.textContent = 'მიუწვდომელია'; });
  }

  root.append(
    topbar('პარამეტრები'),
    h('section', { class: 'card' }, h('h2', null, 'თემა'),
      h('div', { class: 'radios' },
        radio('theme', 'auto', 'ავტომატური', s.theme, setTheme),
        radio('theme', 'light', 'ღია', s.theme, setTheme),
        radio('theme', 'dark', 'მუქი', s.theme, setTheme))),
    h('section', { class: 'card' }, h('h2', null, 'ვარჯიში'),
      h('label', { class: 'field' }, h('span', null, 'სვეტური ჯამის სიჩქარე: ', speedLabel),
        h('input', {
          type: 'range', min: '0.8', max: '6', step: '0.2', value: String(s.columnSpeed),
          on: { input: (e) => updSpeed(e.target.value), change: (e) => progress.setSetting('columnSpeed', Number(e.target.value)) }
        }),
        h('span', { class: 'row between small muted' }, h('span', null, 'სწრაფი'), h('span', null, 'ნელი'))),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: !!s.showValue, on: { change: (e) => progress.setSetting('showValue', e.target.checked) } }),
        'თავისუფალ სორობანზე მნიშვნელობის ჩვენება'),
      h('div', { class: 'field' }, h('span', null, 'დღის მიზანი'),
        h('div', { class: 'radios' },
          [15, 20, 30].map((m) => radio('goal', String(m), `${m} წთ`, String(s.dailyGoalMin), (v) => progress.setSetting('dailyGoalMin', Number(v))))))),
    h('section', { class: 'card' }, h('h2', null, 'პროგრესის გადატანა'),
      h('p', { class: 'muted small' }, 'ტელეფონის შეცვლამდე შეინახე პროგრესი JSON ფაილად, ახალ ტელეფონზე კი შემოიტანე.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn primary', on: { click: onExport } }, '⬇ ექსპორტი (JSON)'),
        h('button', { class: 'btn ghost', on: { click: () => fileInput.click() } }, '⬆ იმპორტი'),
        fileInput)),
    h('section', { class: 'card' }, h('h2', null, 'აპლიკაცია'),
      h('p', { class: 'small' }, 'ქეშის ვერსია: ', cacheInfo),
      h('p', { class: 'muted small' }, progress.lastSaveOk ? 'პროგრესი ინახება ამ მოწყობილობაზე (localStorage).' : '⚠ პროგრესის შენახვა ვერ ხერხდება — შეამოწმე ბრაუზერის პარამეტრები.'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn ghost', on: { click: checkUpdate } }, 'განახლების შემოწმება'),
        h('button', { class: 'btn danger', on: { click: onReset } }, 'პროგრესის წაშლა')))
  );

  function setTheme(v) {
    progress.setSetting('theme', v);
    applyTheme();
  }

  function onExport() {
    const text = progress.exportJSON();
    const name = `abacus-progress-${progress.today()}.json`;
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast(`ფაილი ${name} შეინახა (ჩამოტვირთვებში).`);
    } catch (e) {
      toast('ექსპორტი ვერ მოხერხდა.');
    }
  }

  function onImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await confirmDialog('იმპორტი ჩაანაცვლებს ამ მოწყობილობაზე არსებულ პროგრესს. გავაგრძელო?', { ok: 'იმპორტი' });
      if (!ok) return;
      const res = progress.importJSON(String(reader.result));
      if (res.ok) { applyTheme(); toast('პროგრესი წარმატებით შემოვიდა.'); go('#/'); }
      else toast(`იმპორტი ვერ მოხერხდა: ${res.error}`);
    };
    reader.onerror = () => toast('ფაილის წაკითხვა ვერ მოხერხდა.');
    reader.readAsText(file);
    e.target.value = '';
  }

  async function onReset() {
    const ok = await confirmDialog('წავშალო მთელი პროგრესი? ამის დაბრუნება შეუძლებელია (თუ ექსპორტი არ გაქვს).', { ok: 'წაშლა', danger: true });
    if (!ok) return;
    progress.reset();
    toast('პროგრესი წაიშალა.');
    go('#/');
  }

  async function checkUpdate() {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) { toast('Service worker ჯერ არ არის დარეგისტრირებული.'); return; }
      await reg.update();
      toast(reg.installing || reg.waiting ? 'ახალი ვერსია იტვირთება…' : 'გაქვს უახლესი ვერსია.');
    } catch (e) {
      toast('შემოწმება ვერ მოხერხდა (შესაძლოა offline ხარ).');
    }
  }

  return null;
}

// ---------- Service worker (offline) ----------
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('აპლიკაცია განახლდა.', { action: 'გადატვირთვა', onAction: () => location.reload(), sticky: true });
    hadController = true;
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline რეჟიმი მიუწვდომელია (მაგ. file://) */ });
  });
}

// ვთხოვთ ბრაუზერს, მონაცემები არ წაშალოს მეხსიერების ნაკლებობისას
try { navigator.storage?.persist?.(); } catch (e) { /* მხარდაჭერა არ არის */ }

route();
