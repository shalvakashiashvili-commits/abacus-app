// ტესტები:  node tests/run-tests.js
// 1) სორობანის მოდელი: მნიშვნელობა ყოველთვის ემთხვევა მძივების მდგომარეობას, ქვედა მძივების ჯგუფური ფიზიკა
// 2) ფორმულების ძრავა: დამოუკიდებელი შემმოწმებელი (მძივების ხელმისაწვდომობით) + ნაბიჯების ფიზიკური შესრულება
// 3) გენერატორი: თითო დონეზე (თითო სპეციფიკაციაზე) 500 მაგალითი — მხოლოდ ნასწავლი ფორმულები, სწორი პასუხი
// 4) გაკვეთილების დემოები, პროგრესი, sw.js ქეშის სია, manifest, ფარდობითი მისამართები

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Soroban, toDigits, MAX_RODS } from '../js/soroban.js';
import { analyze, hintFor, demoSteps } from '../js/techniques.js';
import { generateProblem, buildSet, makeRng, problemKey } from '../js/generator.js';
import { LEVELS, getLevel, testSize, TEST_SIZE } from '../js/levels.js';
import { LESSONS } from '../js/lessons.js';
import { Progress, memoryStorage, PROGRESS_KEY } from '../js/progress.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
let currentNotes = [];

function test(name, fn) {
  currentNotes = [];
  const t0 = Date.now();
  try {
    fn();
    results.push({ name, ok: true, ms: Date.now() - t0, notes: currentNotes });
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: e.message, notes: currentNotes });
  }
}

function note(s) { currentNotes.push(s); }

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------------- დამოუკიდებელი შემმოწმებელი ----------------
// ერთი ციფრის მოქმედების კლასიფიკაცია მძივების ენაზე:
//   u — ზედა მძივი ზოლთანაა; l — ზოლთან მიწეული ქვედა მძივები; 4 − l — თავისუფალი ქვედა მძივები.
function refAddDigit(u, l, a) {
  const v = (u ? 5 : 0) + l;
  const needUp = a >= 5, needLow = a % 5;
  if ((!needUp || !u) && 4 - l >= needLow) return 'direct';
  if (v + a <= 9) {
    // „პატარა მეგობარი“: ზედა მძივი თავისუფალია და ზოლთან საკმარისი ქვედაა მეგობრის მოსაშორებლად
    if (a < 5 && !u && l >= 5 - a) return 'small';
    throw new Error(`refAdd: შეუძლებელი შემთხვევა ${v}+${a}`);
  }
  const k = 10 - a; // ამ ღეროდან მოსაშორებელი „დიდი მეგობარი“
  const kUp = k >= 5, kLow = k % 5;
  if ((!kUp || u) && l >= kLow) return 'big';
  if (k < 5 && u && 4 - l >= 5 - k) return 'mixed';
  throw new Error(`refAdd: შეუძლებელი შემთხვევა ${v}+${a}`);
}

function refSubDigit(u, l, a) {
  const v = (u ? 5 : 0) + l;
  const needUp = a >= 5, needLow = a % 5;
  if ((!needUp || u) && l >= needLow) return 'direct';
  if (v >= a) {
    if (a < 5 && u && 4 - l >= 5 - a) return 'small';
    throw new Error(`refSub: შეუძლებელი შემთხვევა ${v}-${a}`);
  }
  const k = 10 - a; // ამ ღეროზე მისამატებელი „დიდი მეგობარი“
  const kUp = k >= 5, kLow = k % 5;
  if ((!kUp || !u) && 4 - l >= kLow) return 'big';
  if (k < 5 && !u && l >= 5 - k) return 'mixed';
  throw new Error(`refSub: შეუძლებელი შემთხვევა ${v}-${a}`);
}

// მთელი მოქმედების დამოუკიდებელი სიმულაცია (მარცხნიდან მარჯვნივ, გადატანითა და სესხებით)
function refTechniques(start, operand) {
  const d = toDigits(start, MAX_RODS);
  const tags = new Set();
  const od = toDigits(Math.abs(operand), MAX_RODS);
  function add(p, a, nested) {
    const v = d[p];
    const tech = refAddDigit(v >= 5, v % 5, a);
    if (!nested) tags.add(tech); else if (tech !== 'direct') tags.add('nested');
    if (v + a >= 10) { d[p] = v + a - 10; add(p + 1, 1, true); } else d[p] = v + a;
  }
  function sub(p, a, nested) {
    const v = d[p];
    const tech = refSubDigit(v >= 5, v % 5, a);
    if (!nested) tags.add(tech); else if (tech !== 'direct') tags.add('nested');
    if (v < a) { sub(p + 1, 1, true); d[p] = v + 10 - a; } else d[p] = v - a;
  }
  for (let p = MAX_RODS - 1; p >= 0; p--) {
    if (!od[p]) continue;
    if (operand > 0) add(p, od[p], false); else sub(p, od[p], false);
  }
  let value = 0;
  for (let p = MAX_RODS - 1; p >= 0; p--) value = value * 10 + d[p];
  return { tags, value };
}

// analyze()-ის ნაბიჯების შესრულება ნამდვილ მოდელზე მკაცრი applyMove-ით
function executeSteps(start, a) {
  const sb = new Soroban(MAX_RODS);
  sb.setValue(start);
  for (const s of a.steps) {
    assert(s.moves.length > 0, 'ცარიელი ნაბიჯი');
    assert(typeof s.text === 'string' && s.text.length > 0, 'ნაბიჯს წარწერა აკლია');
    for (const m of s.moves) sb.applyMove(m);
  }
  return sb.value;
}

function sameSet(a, b) {
  const A = new Set(a), B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
}

// ---------------- 1. სორობანის მოდელი ----------------
test('სორობანი: setValue/value — 3000 შემთხვევითი რიცხვი (13 ნიშნამდე)', () => {
  const rng = makeRng(1);
  const sb = new Soroban();
  for (let i = 0; i < 3000; i++) {
    const digits = 1 + Math.floor(rng() * 13);
    let n = 0;
    for (let k = 0; k < digits; k++) n = n * 10 + Math.floor(rng() * 10);
    sb.setValue(n);
    assert(sb.value === n, `setValue(${n}) → ${sb.value}`);
  }
  sb.setValue(9999999999999);
  assert(sb.value === 9999999999999, 'მაქსიმალური მნიშვნელობა');
  let threw = false;
  try { sb.setValue(10 ** 13); } catch (e) { threw = true; }
  assert(threw, '13 ღეროზე არ დატეული რიცხვი შეცდომას უნდა იწვევდეს');
});

test('სორობანი: 30 000 შემთხვევითი შეხების შემდეგ მნიშვნელობა = მძივების მდგომარეობა', () => {
  const rng = makeRng(2);
  const sb = new Soroban();
  for (let i = 0; i < 30000; i++) {
    const p = Math.floor(rng() * MAX_RODS);
    if (rng() < 0.3) sb.tapUpper(p);
    else sb.tapLower(p, 1 + Math.floor(rng() * 4));
    let expected = 0;
    for (let q = MAX_RODS - 1; q >= 0; q--) {
      assert(sb.lower[q] >= 0 && sb.lower[q] <= 4, 'ქვედა მძივების რაოდენობა 0–4 უნდა იყოს');
      assert(typeof sb.upper[q] === 'boolean', 'ზედა მძივი boolean უნდა იყოს');
      expected = expected * 10 + (sb.upper[q] ? 5 : 0) + sb.lower[q];
    }
    assert(sb.value === expected, `მნიშვნელობა ${sb.value} ≠ მძივებით ${expected}`);
    assert(sb.digits().every((d, q) => d === sb.getDigit(q) && d >= 0 && d <= 9), 'ციფრები');
  }
});

test('სორობანი: ქვედა მძივები ჯგუფურად მოძრაობს (ყველა 20 შემთხვევა)', () => {
  const sb = new Soroban();
  for (let c = 0; c <= 4; c++) {
    for (let b = 1; b <= 4; b++) {
      sb.clear();
      sb.lower[0] = c;
      const wasActive = b <= c;
      sb.tapLower(0, b);
      const now = sb.lower[0];
      const isActive = b <= now;
      assert(isActive !== wasActive, `მძივი ${b} (რაოდ. ${c}) მდგომარეობა არ შეიცვალა`);
      // აწევისას ზოლსა და მძივს შორის ყველა მძივი ზოლთანაა; ჩამოწევისას მის ქვემოთ ყველა ჩამოდის
      if (!wasActive) assert(now === b, `აწევა: მოსალოდნელი ${b}, მიღებული ${now}`);
      else assert(now === b - 1, `ჩამოწევა: მოსალოდნელი ${b - 1}, მიღებული ${now}`);
    }
  }
  sb.clear();
  sb.tapUpper(3);
  assert(sb.value === 5000, 'ზედა მძივი ათასეულებზე = 5000');
  sb.tapUpper(3);
  assert(sb.value === 0, 'ზედა მძივის უკან აწევა');
});

test('სორობანი: ფიზიკურად შეუძლებელი გადაადგილება შეცდომას იწვევს', () => {
  const sb = new Soroban();
  const bad = [
    () => sb.applyMove({ place: 0, upper: -1 }),
    () => sb.applyMove({ place: 0, lower: -1 }),
    () => { sb.setValue(4); sb.applyMove({ place: 0, lower: 1 }); },
    () => { sb.setValue(5); sb.applyMove({ place: 0, upper: 1 }); }
  ];
  for (const f of bad) {
    let threw = false;
    try { f(); } catch (e) { threw = true; }
    assert(threw, 'შეცდომა არ მოხდა');
  }
});

// ---------------- 2. ფორმულების ძრავა ----------------
test('ფორმულები: მეთოდური ცხრილი და ნაბიჯების რიგი (იაპონური მეთოდი)', () => {
  const cases = [
    [1, 4, '+4 = +5 −1', [{ upper: 1 }, { lower: -1 }]],
    [4, 1, '+1 = +5 −4', [{ upper: 1 }, { lower: -4 }]],
    [5, -4, '−4 = +1 −5', [{ lower: 1 }, { upper: -1 }]],
    [6, -2, '−2 = +3 −5', [{ lower: 3 }, { upper: -1 }]],
    [2, 9, '+9 = −1 +10', [{ lower: -1, place: 0 }, { lower: 1, place: 1 }]],
    [7, 5, '+5 = −5 +10', [{ upper: -1, place: 0 }, { lower: 1, place: 1 }]],
    [12, -9, '−9 = −10 +1', [{ lower: -1, place: 1 }, { lower: 1, place: 0 }]],
    [13, -5, '−5 = −10 +5', [{ lower: -1, place: 1 }, { upper: 1, place: 0 }]],
    [5, 6, '+6 = +1 −5 +10', [{ lower: 1, place: 0 }, { upper: -1, place: 0 }, { lower: 1, place: 1 }]],
    [13, -6, '−6 = −10 +5 −1', [{ lower: -1, place: 1 }, { upper: 1, place: 0 }, { lower: -1, place: 0 }]]
  ];
  for (const [start, op, formula, moves] of cases) {
    const a = analyze(start, op);
    assert(a.ok, `${start}${op}: ვერ შესრულდა`);
    const top = a.ops.find((o) => !o.nested && o.tech !== 'direct');
    assert(top && top.formula === formula, `${start} ${op}: ფორმულა „${top?.formula}“, მოსალოდნელი „${formula}“`);
    const flat = a.steps.flatMap((s) => s.moves);
    assert(flat.length === moves.length, `${start} ${op}: ნაბიჯების რაოდენობა ${flat.length} ≠ ${moves.length}`);
    moves.forEach((m, i) => {
      for (const k of Object.keys(m)) assert(flat[i][k] === m[k], `${start} ${op}: ნაბიჯი ${i + 1}, ${k}=${flat[i][k]} (მოსალოდნელი ${m[k]})`);
    });
  }
  const h = hintFor(3, 2);
  assert(h.tech === 'small' && h.text.includes('+2 = +5 −3'), 'მინიშნება 3 + 2-სთვის');
  assert(hintFor(45, 5).text.includes('+1 = +5 −4'), 'მინიშნება 45 + 5 (გადატანა ფორმულით)');
});

test('ფორმულები: ამომწურავი შემოწმება — start 0..300 × operand −300..300', () => {
  let count = 0;
  for (let start = 0; start <= 300; start++) {
    for (let op = -300; op <= 300; op++) {
      if (op === 0) continue;
      const a = analyze(start, op);
      if (start + op < 0) { assert(!a.ok && a.error === 'negative', `${start}${op}: უარყოფითი უნდა უარყოს`); continue; }
      assert(a.ok, `${start} ${op}: ${a.error}`);
      const ref = refTechniques(start, op);
      assert(ref.value === start + op, `შემმოწმებელი: ${start}+${op}`);
      assert(sameSet(a.tags, ref.tags), `${start} ${op}: ტეგები [${a.tags}] ≠ შემმოწმებლის [${[...ref.tags]}]`);
      assert(executeSteps(start, a) === start + op, `${start} ${op}: ნაბიჯების შესრულების შემდეგ არასწორი მნიშვნელობა`);
      count++;
    }
  }
  note(`${count.toLocaleString('en-US')} მოქმედება`);
});

test('ფორმულები: 50 000 შემთხვევითი დიდი რიცხვი (6 ნიშნამდე)', () => {
  const rng = makeRng(3);
  for (let i = 0; i < 50000; i++) {
    const start = Math.floor(rng() * 1000000);
    let op = Math.floor(rng() * 1000000) * (rng() < 0.5 ? -1 : 1);
    if (op === 0) op = 1;
    if (start + op < 0) op = -start || 1;
    const a = analyze(start, op);
    assert(a.ok, `${start} ${op}: ${a.error}`);
    const ref = refTechniques(start, op);
    assert(sameSet(a.tags, ref.tags), `${start} ${op}: ტეგები`);
    assert(executeSteps(start, a) === start + op, `${start} ${op}: შესრულება`);
  }
});

// ---------------- 3. გენერატორი ----------------
const N_PER_SPEC = 500;

function checkCalcProblem(p, level, specLabel) {
  const allowed = new Set(level.allowed);
  assert(Array.isArray(p.terms) && p.terms.length >= 2, `${specLabel}: terms`);
  assert(Number.isInteger(p.terms[0]) && p.terms[0] > 0, `${specLabel}: პირველი რიცხვი`);
  let total = p.terms[0];
  const seen = new Set();
  // პირველი რიცხვის ჩაწერა სუფთა სორობანზე ყოველთვის პირდაპირია
  const w = refTechniques(0, total);
  assert(sameSet([...w.tags], ['direct']), `${specLabel}: პირველი რიცხვის ჩაწერა პირდაპირი არ არის`);
  for (let i = 1; i < p.terms.length; i++) {
    const t = p.terms[i];
    assert(Number.isInteger(t) && t !== 0, `${specLabel}: ნულოვანი ან არამთელი ოპერანდი`);
    const ref = refTechniques(total, t);
    for (const tag of ref.tags) {
      assert(allowed.has(tag), `${specLabel}: ${p.terms.join(' ')} — მოქმედება ${total} ${t} იყენებს ჯერ უსწავლელ ფორმულას „${tag}“`);
      seen.add(tag);
    }
    const a = analyze(total, t);
    assert(executeSteps(total, a) === total + t, `${specLabel}: ნაბიჯები`);
    total += t;
    assert(total > 0, `${specLabel}: შუალედური შედეგი ${total} ≤ 0`);
  }
  const sum = p.terms.reduce((s, x) => s + x, 0);
  assert(p.answer === sum && total === sum, `${specLabel}: პასუხი ${p.answer} ≠ ${sum}`);
  return seen;
}

for (const level of LEVELS.filter((l) => l.built)) {
  test(`გენერატორი: დონე ${level.id} — ${N_PER_SPEC} მაგალითი თითო სპეციფიკაციაზე`, () => {
    const specs = [
      ...level.guided.map((s) => ['guided', s]),
      ...level.tasks.map((s) => ['tasks', s]),
      ...level.test.items.map((s) => ['test', s])
    ];
    let total = 0;
    const tagCounts = {};
    specs.forEach(([mode, spec], si) => {
      const rng = makeRng(1000 * level.id + si);
      const label = `დ${level.id} ${mode} ${JSON.stringify(spec)}`;
      for (let i = 0; i < N_PER_SPEC; i++) {
        const p = generateProblem(spec, level, rng);
        assert(p.kind === spec.kind && p.level === level.id, `${label}: kind/level`);
        if (p.kind === 'read' || p.kind === 'set') {
          const d = String(p.value).length;
          assert(d >= (spec.minDigits || 1) && d <= (spec.maxDigits || spec.minDigits || 1), `${label}: ნიშნების რაოდენობა ${p.value}`);
          assert(p.answer === p.value, `${label}: პასუხი`);
          if (p.kind === 'set') assert(p.value > 0, `${label}: ჩასაწერი რიცხვი 0`);
        } else {
          const seen = checkCalcProblem(p, level, label);
          assert(p.terms.length === (spec.terms || 2), `${label}: რიცხვების რაოდენობა`);
          if (level.focus.length && spec.focus !== false) {
            assert([...seen].some((t) => level.focus.includes(t)), `${label}: ${p.terms.join(' ')} — დონის ახალი ფორმულა არ გამოიყენება`);
          }
          for (const t of seen) tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
        total++;
      }
    });
    note(`${total} მაგალითი${Object.keys(tagCounts).length ? ' · ფორმულები: ' + Object.entries(tagCounts).map(([k, v]) => `${k}=${v}`).join(', ') : ''}`);
  });
}

test('შემმოწმებელი იჭერს დარღვევებს (უარყოფითი ტესტი)', () => {
  const bad = [
    [1, { kind: 'calc', terms: [3, 2], answer: 5 }, '3 + 2 დონე 1-ზე („პატარა მეგობარი“)'],
    [1, { kind: 'calc', terms: [6, -2], answer: 4 }, '6 − 2 დონე 1-ზე'],
    [2, { kind: 'calc', terms: [7, 5], answer: 12 }, '7 + 5 დონე 2-ზე („დიდი მეგობარი“)'],
    [3, { kind: 'calc', terms: [5, 6], answer: 11 }, '5 + 6 დონე 3-ზე (შერეული)'],
    [3, { kind: 'calc', terms: [45, 5], answer: 50 }, '45 + 5 დონე 3-ზე (გადატანა ფორმულით)'],
    [1, { kind: 'calc', terms: [2, 2], answer: 5 }, 'არასწორი პასუხი'],
    [1, { kind: 'calc', terms: [2, -3], answer: -1 }, 'უარყოფითი შედეგი']
  ];
  for (const [lv, p, label] of bad) {
    let threw = false;
    try { checkCalcProblem(p, getLevel(lv), 'neg'); } catch (e) { threw = true; }
    assert(threw, `შემმოწმებელმა ვერ დაიჭირა: ${label}`);
  }
  checkCalcProblem({ kind: 'calc', terms: [2, 2], answer: 4 }, getLevel(1), 'pos');
  note(`${bad.length} დარღვევა დაჭერილია`);
});

test('გენერატორი: ტესტი = 20 მაგალითი, სესიაში დუბლიკატები არ არის', () => {
  for (const level of LEVELS.filter((l) => l.built)) {
    assert(testSize(level) === TEST_SIZE, `დონე ${level.id}: ტესტში ${testSize(level)} მაგალითია`);
    for (let s = 0; s < 20; s++) {
      const set = buildSet(level.test.items, level, makeRng(s + 77));
      assert(set.length === TEST_SIZE, 'ტესტის ზომა');
      const keys = new Set(set.map(problemKey));
      assert(keys.size === set.length || level.id === 0, `დონე ${level.id}: დუბლიკატი ტესტში`);
    }
  }
});

test('დონეები: კონფიგურაცია (0–10 სრული გეგმა, 0–4 აწყობილი, დროის ლიმიტი 3–4)', () => {
  assert(LEVELS.length === 11, 'დონეების რაოდენობა 11 უნდა იყოს');
  LEVELS.forEach((l, i) => assert(l.id === i && l.title, `დონე ${i}`));
  for (let i = 0; i <= 4; i++) assert(getLevel(i).built, `დონე ${i} აწყობილი უნდა იყოს`);
  for (let i = 5; i <= 10; i++) assert(!getLevel(i).built, `დონე ${i} დაბლოკილი უნდა იყოს`);
  for (let i = 0; i <= 2; i++) assert(getLevel(i).test.maxAvgSec === null, `დონე ${i}: დროის ლიმიტი არ უნდა იყოს`);
  for (let i = 3; i <= 4; i++) assert(getLevel(i).test.maxAvgSec === 10, `დონე ${i}: ლიმიტი 10 წმ`);
  // ფორმულები თანმიმდევრულად ემატება: ყოველი დონე წინას ნასწავლს მოიცავს
  for (let i = 2; i <= 4; i++) {
    const prev = new Set(getLevel(i - 1).allowed);
    assert([...prev].every((t) => getLevel(i).allowed.includes(t)), `დონე ${i}: წინა დონის ფორმულები აკლია`);
  }
});

// ---------------- 4. გაკვეთილები ----------------
test('გაკვეთილები: ყველა დემო იყენებს მხოლოდ ამ დონემდე ნასწავლ ფორმულებს', () => {
  let demos = 0;
  for (const level of LEVELS.filter((l) => l.built)) {
    const cards = LESSONS[level.id];
    assert(Array.isArray(cards) && cards.length >= 3, `დონე ${level.id}: გაკვეთილი აკლია`);
    const allowed = new Set(level.id === 0 ? ['direct'] : level.allowed);
    for (const c of cards) {
      assert(c.title && Array.isArray(c.text), `დონე ${level.id}: ბარათს სათაური/ტექსტი აკლია`);
      if (c.demo?.calc) {
        for (const ex of c.demo.calc) {
          let total = ex.start;
          const ds = demoSteps(ex.start, ex.ops);
          for (const op of ex.ops) {
            const ref = refTechniques(total, op);
            for (const t of ref.tags) assert(allowed.has(t), `დონე ${level.id}, „${c.title}“: ${total} ${op} იყენებს „${t}“`);
            total += op;
          }
          assert(ds.result === total, `დემოს პასუხი ${c.title}`);
          const sb = new Soroban();
          for (const s of ds.steps) for (const m of s.moves) sb.applyMove(m);
          assert(sb.value === total, `დემოს ნაბიჯები ${c.title}`);
          demos++;
        }
      }
      if (c.demo?.values) for (const s of c.demo.values) assert(Number.isInteger(s.v) && s.v >= 0 && s.t, `values დემო ${c.title}`);
      if (c.try) assert(Number.isInteger(c.try.target) && c.try.target > 0, `try ${c.title}`);
      if (c.tour) assert(c.tour.every((p) => ['frame', 'rods', 'beam', 'upper', 'lower', 'dots', 'units'].includes(p.part)), 'ტურის ნაწილი');
    }
  }
  note(`${demos} გამოთვლის დემო`);
});

// ---------------- 5. პროგრესი ----------------
test('პროგრესი: შეცდომები, გამეორება, სერია, ექსპორტი/იმპორტი', () => {
  let now = new Date(2026, 10, 20, 10);
  const storage = memoryStorage();
  const pr = new Progress(storage, () => now);
  assert(pr.currentLevelId() === 0 && pr.isUnlocked(0) && !pr.isUnlocked(1), 'საწყისი მდგომარეობა');
  const prob = { kind: 'calc', terms: [3, 2], answer: 5, level: 2 };
  pr.recordAnswer({ level: 2, mode: 'tasks', problem: prob, correct: false, ms: 4000 });
  assert(pr.data.mistakes.length === 1, 'შეცდომა ჩაიწერა');
  assert(pr.dueMistakes().length === 0, 'იმავე დღეს შეცდომა არ მეორდება');
  now = new Date(2026, 10, 21, 10);
  const due = pr.dueMistakes();
  assert(due.length === 1, 'მეორე დღეს შეცდომა გამეორებაშია');
  pr.recordAnswer({ level: 2, mode: 'review', problem: prob, correct: true, ms: 3000, mistakeId: due[0].id });
  assert(pr.data.mistakes.length === 1, 'ერთი სწორი პასუხის შემდეგ ჯერ რჩება');
  now = new Date(2026, 10, 22, 10);
  pr.recordAnswer({ level: 2, mode: 'review', problem: prob, correct: true, ms: 3000, mistakeId: due[0].id });
  assert(pr.data.mistakes.length === 0, 'ორი სწორი პასუხის შემდეგ ქრება');
  assert(pr.streak() === 3, `სერია 3 უნდა იყოს, არის ${pr.streak()}`);
  now = new Date(2026, 10, 24, 10);
  assert(pr.streak() === 0, 'გამოტოვებული დღე სერიას წყვეტს');
  pr.recordSession({ level: 0, mode: 'test', accuracy: 0.95, avgSec: 5, passed: true });
  assert(pr.isPassed(0) && pr.isUnlocked(1) && pr.currentLevelId() === 1, 'ტესტის ჩაბარება ხსნის შემდეგ დონეს');
  const json = pr.exportJSON();
  const pr2 = new Progress(memoryStorage(), () => now);
  const res = pr2.importJSON(json);
  assert(res.ok && pr2.isPassed(0) && pr2.totals().answered === 3, 'იმპორტი');
  assert(!pr2.importJSON('{"bad":1}').ok && !pr2.importJSON('not json').ok, 'არასწორი ფაილი უარყოფილია');
  const pr3 = new Progress(storage, () => now);
  assert(pr3.isPassed(0), 'შენახული მონაცემები ხელახლა იტვირთება');
});

test('პროგრესი: მიუწვდომელი/გაფუჭებული localStorage აპლიკაციას არ აჩერებს', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('x'); } };
  const pr = new Progress(broken);
  pr.recordAnswer({ level: 0, mode: 'tasks', problem: { kind: 'read', value: 3, answer: 3, level: 0 }, correct: true, ms: 1000 });
  assert(pr.lastSaveOk === false, 'შენახვის შეცდომა უნდა დაფიქსირდეს');
  const garbage = memoryStorage();
  garbage.setItem(PROGRESS_KEY, '{oops');
  const pr2 = new Progress(garbage);
  assert(pr2.currentLevelId() === 0, 'გაფუჭებული JSON → სუფთა პროგრესი');
});

// ---------------- 6. PWA ფაილები ----------------
function walk(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((f) => {
    const rel = `${dir}/${f}`;
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

test('sw.js: ქეშის სიის ყველა ფაილი არსებობს და ყველა საჭირო ფაილი სიაშია', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const ver = sw.match(/CACHE_VERSION\s*=\s*'([^']+)'/);
  assert(ver && /^abacus-v\d+$/.test(ver[1]), 'CACHE_VERSION ფორმატი abacus-vN');
  const list = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert(list, 'ASSETS სია ვერ მოიძებნა');
  const assets = [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const a of assets) {
    assert(a.startsWith('./'), `${a}: მისამართი ./-ით უნდა იწყებოდეს`);
    const file = a === './' ? 'index.html' : a.slice(2);
    assert(existsSync(join(ROOT, file)), `ქეშის სიაში არარსებული ფაილია: ${a}`);
  }
  const required = ['index.html', 'manifest.json', ...walk('css'), ...walk('js'), ...walk('icons')];
  for (const f of required) assert(assets.includes('./' + f), `ფაილი ქეშის სიაში არ არის: ${f}`);
  note(`${assets.length} ფაილი, ვერსია ${ver[1]}`);
});

test('manifest.json და index.html: ფარდობითი მისამართები, ხატულები, ქართული სახელი', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  assert(m.name === 'აბაკუსი' && m.short_name === 'აბაკუსი', 'სახელი');
  assert(m.display === 'standalone' && m.orientation === 'portrait', 'display/orientation');
  assert(m.start_url.startsWith('./') && m.scope.startsWith('./'), 'start_url/scope ფარდობითი');
  for (const size of ['192x192', '512x512']) {
    assert(m.icons.some((i) => i.sizes === size && i.purpose === 'any'), `ხატულა ${size}`);
    assert(m.icons.some((i) => i.sizes === size && i.purpose === 'maskable'), `maskable ${size}`);
  }
  for (const i of m.icons) {
    assert(i.src.startsWith('./') && existsSync(join(ROOT, i.src)), `ხატულა ${i.src}`);
    const buf = readFileSync(join(ROOT, i.src));
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    assert(`${w}x${h}` === i.sizes, `${i.src}: ზომა ${w}x${h}`);
  }
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map((x) => x[1]);
  for (const r of refs) {
    assert(!r.startsWith('/') && !/^https?:/.test(r), `index.html: აბსოლუტური/გარე მისამართი ${r}`);
    assert(existsSync(join(ROOT, normalize(r))), `index.html: ${r} არ არსებობს`);
  }
});

test('JS მოდულები: იმპორტები არსებობს, გარე ბიბლიოთეკები და CDN არ არის', () => {
  for (const f of walk('js')) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
      assert(m[1].startsWith('./'), `${f}: გარე იმპორტი ${m[1]}`);
      assert(existsSync(join(ROOT, 'js', m[1])), `${f}: ${m[1]} არ არსებობს`);
    }
    assert(!/https?:\/\//.test(src), `${f}: გარე URL`);
  }
  const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
  assert(!/@import|url\(\s*['"]?https?:/.test(css), 'CSS: გარე რესურსი');
});

// ---------------- შედეგი ----------------
let failed = 0;
console.log('\nაბაკუსი — ტესტების შედეგი\n');
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.ms} ms)`);
  for (const n of r.notes) console.log(`        ${n}`);
  if (!r.ok) console.log(`        ✗ ${r.error}`);
}
console.log(`\n${results.length - failed} / ${results.length} ტესტი გავიდა${failed ? ` — ${failed} ჩავარდა` : ''}\n`);
process.exitCode = failed ? 1 : 0;
