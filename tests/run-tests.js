// ტესტები:  node tests/run-tests.js
// 1) სორობანის მოდელი: მნიშვნელობა ყოველთვის ემთხვევა მძივების მდგომარეობას, ქვედა მძივების ჯგუფური ფიზიკა
// 2) ფორმულების ძრავა: დამოუკიდებელი შემმოწმებელი (მძივების ხელმისაწვდომობით) + ნაბიჯების ფიზიკური შესრულება
// 3) გენერატორი: თითო დონეზე (თითო სპეციფიკაციაზე) 500 მაგალითი — მხოლოდ ნასწავლი ფორმულები, სწორი პასუხი
// 4) გაკვეთილების დემოები, პროგრესი, sw.js ქეშის სია, manifest, ფარდობითი მისამართები
// 5) ეტაპი 2: 片落とし გამრავლება/გაყოფა დამოუკიდებელი სიმულაციით, 500 მაგალითი თითო ახალ ტიპზე, ათწილადები
// 6) ეტაპი 3: ანძანი, flash, ვიზუალიზაცია, 修正 (還元) დამოუკიდებელი სიმულაციით, „კენტეის მსგავსი“ გამოცდა ოფიციალური ცხრილით

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Soroban, toDigits, MAX_RODS } from '../js/soroban.js';
import { analyze, hintFor, demoSteps } from '../js/techniques.js';
import { generateProblem, buildSet, makeRng, problemKey, buildExam } from '../js/generator.js';
import { LEVELS, getLevel, testSize, TEST_SIZE, levelLabel, EXAM_GRADES } from '../js/levels.js';
import { mulProgram, divProgram, programFor, fmtScaled, parseScaled } from '../js/muldiv.js';
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

for (const level of LEVELS.filter((l) => l.built && typeof l.id === 'number')) {
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

test('დონეები: კონფიგურაცია (სრული გეგმა 0–10 ქვედონეებით + არასავალდებულო 修正)', () => {
  const ids = LEVELS.map((l) => String(l.id));
  const expected = ['0', '1', '2', '3', '4', '5a', '5b', '6a', '6b', '6c', '7a', '7b', '7c', '8a', '8b', '9a', '9b', '9c', '10a', '10b', 'fix'];
  assert(JSON.stringify(ids) === JSON.stringify(expected), `დონეების რიგი: ${ids.join(',')}`);
  for (const id of expected) assert(getLevel(id).built, `დონე ${id} აწყობილი უნდა იყოს`);
  assert(getLevel('fix').optional && getLevel('fix').requires === '7b', '修正 — არასავალდებულო, იხსნება 7ბ-ის შემდეგ');
  assert(LEVELS.filter((l) => l.optional).length === 1, 'მხოლოდ ერთი არასავალდებულო დონე');
  for (let i = 0; i <= 2; i++) assert(getLevel(i).test.maxAvgSec === null, `დონე ${i}: დროის ლიმიტი არ უნდა იყოს`);
  for (let i = 3; i <= 4; i++) assert(getLevel(i).test.maxAvgSec === 10, `დონე ${i}: ლიმიტი 10 წმ`);
  assert(getLevel('5a').test.maxAvgSec > 0 && getLevel('5b').test.maxAvgSec > 0, 'დონე 5: ტესტში დროის ლიმიტი');
  // ფორმულები თანმიმდევრულად ემატება: ყოველი დონე წინას ნასწავლს მოიცავს
  for (let i = 1; i < 20; i++) {
    const prev = new Set(getLevel(expected[i - 1]).allowed);
    assert([...prev].every((t) => getLevel(expected[i]).allowed.includes(t)), `დონე ${expected[i]}: წინა დონის ფორმულები აკლია`);
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

// =====================================================================
// ეტაპი 2: სვეტები, ტაბულა, გამრავლება, გაყოფა, ათწილადები
// =====================================================================

// ---- დამოუკიდებელი 片落とし სიმულაცია (ღეროების მასივით, ძრავის კოდისგან ცალკე დაწერილი) ----
// board: ციფრების მასივი, ინდექსი = ღერო (0 = ყველაზე მარჯვენა)
function rodsOf(v) { return toDigits(v, MAX_RODS); }
function valueOf(r) { let v = 0; for (let p = MAX_RODS - 1; p >= 0; p--) v = v * 10 + r[p]; return v; }
function digitsLowHigh(n) { return String(n).split('').reverse().map(Number); }

// გამრავლება: წესები სიტყვასიტყვით —
//  (1) პირველი თანამამრავლის ერთეულები ▼ ღეროზე (ათწილადისას ბოლო ციფრი ▼-დან aDec ღეროთი მარჯვნივ);
//  (2) მარჯვენა ციფრიდან: ციფრს ვხსნით, ნამრავლი მეორე თანამამრავლის ყოველ ციფრზე (მარცხნიდან) — ორნიშნად,
//      პირველის ათეულები ციფრის ღეროზე, ყოველი შემდეგი ერთი ღეროთი მარჯვნივ;
//  (3) პასუხის ერთეულები = ▼ − (მეორე თანამამრავლის მთელი ციფრები).
function refMul(a, b, place, aDec = 0, bDec = 0) {
  const seq = [];
  let board = 0;
  const aLow = place - aDec;
  board += a * 10 ** aLow; seq.push(board);
  const ad = digitsLowHigh(a), bd = digitsLowHigh(b).reverse(); // bd: მარცხნიდან მარჯვნივ
  ad.forEach((d, i) => {
    const rod = aLow + i;
    if (d === 0) return;
    board -= d * 10 ** rod; seq.push(board);
    bd.forEach((bj, k) => {
      const prod = d * bj;
      const tensRod = rod - k;            // k-ე ნამრავლი k ღეროთი მარჯვნივ იწყება
      if (prod) { board += prod * 10 ** (tensRod - 1); seq.push(board); }
    });
  });
  const unit = place - (bd.length - bDec);
  return { seq, board, unit };
}

// გაყოფა: წესები —
//  (1) გასაყოფის ერთეულები ▼ ღეროზე; განაყოფის ერთეულები ▲ = ▼ + (გამყოფის ციფრები + 1);
//  (2) გასაყოფის (დარჩენილის) პირველი ციფრებიდან: თუ გამყოფი ≤ იმავე რაოდენობის პირველ ციფრებზე — ციფრი 2 ღეროთი
//      მარცხნივ, თუ არა — ერთით მეტი ციფრი და ციფრი მეზობელ ღეროზე;
//  (3) ნამრავლი (ციფრი × გამყოფი) აკლდება განაყოფის ციფრის მარჯვენა ღეროდან; ვჩერდებით, როცა ციფრი stopRod-ზე დაბლა ხვდება.
function refDiv(a, b, place, aDec = 0, decimals = 0) {
  const n = String(b).length;
  const unit = place + n + 1;
  const stop = unit - decimals;
  const qRods = new Array(MAX_RODS).fill(0);
  let rem = rodsOf(a * 10 ** (place - aDec));
  const seq = [valueOf(rem)];
  const placements = [];
  for (let g = 0; g < 50; g++) {
    let head = -1;
    for (let p = MAX_RODS - 1; p >= 0; p--) if (rem[p]) { head = p; break; }
    if (head < 0) break;
    const lead = (len) => { let v = 0; for (let k = 0; k < len; k++) { const p = head - k; v = v * 10 + (p >= 0 ? rem[p] : 0); } return v; };
    let qRod, chunk;
    if (lead(n) >= b) { qRod = head + 2; chunk = lead(n); } else { qRod = head + 1; chunk = lead(n + 1); }
    if (qRod < stop || qRod - n - 1 < 0) break;
    const q = Math.floor(chunk / b);
    assert(q >= 1 && q <= 9, `refDiv: ციფრი ${q}`);
    assert(qRods[qRod] === 0, 'refDiv: განაყოფის ღერო დაკავებულია');
    qRods[qRod] = q;
    placements.push({ q, qRod, head });
    seq.push(valueOf(qRods) + valueOf(rem));
    // ნამრავლი გამყოფის ყოველ ციფრზე, მარცხნიდან; პირველის ათეულები qRod−1-ზე
    const bd = String(b).split('').map(Number);
    let remVal = valueOf(rem);
    bd.forEach((bj, k) => {
      const prod = q * bj;
      if (prod) { remVal -= prod * 10 ** (qRod - 2 - k); seq.push(valueOf(qRods) + remVal); }
    });
    assert(remVal >= 0, 'refDiv: ნაშთი უარყოფითი');
    rem = rodsOf(remVal);
  }
  return { seq, unit, qBoard: valueOf(qRods), remBoard: valueOf(rem), placements };
}

function executeProgram(prog) {
  const sb = new Soroban(MAX_RODS);
  for (const st of prog.steps) {
    assert(sb.value === st.before, `ნაბიჯი იწყება ${st.before}-დან, სორობანზე კი ${sb.value}`);
    for (const m of st.micro) for (const mv of m.moves) sb.applyMove(mv);
    assert(sb.value === st.after, `ნაბიჯის შემდეგ ${sb.value} ≠ ${st.after}`);
    assert(st.instr && st.hint, 'ნაბიჯს წარწერა/მინიშნება აკლია');
  }
  return sb.value;
}

function checkMul(p, label) {
  const prog = programFor(p);
  const ref = refMul(p.a, p.b, p.place, p.aDec || 0, p.bDec || 0);
  const engSeq = [prog.steps[0].after, ...prog.steps.slice(1).map((s) => s.after)];
  assert(JSON.stringify(engSeq) === JSON.stringify(ref.seq), `${label}: ნაბიჯები არ ემთხვევა შემმოწმებელს`);
  assert(prog.unit === ref.unit && p.ansUnit === ref.unit, `${label}: ერთეულის ღერო ${prog.unit} ≠ ${ref.unit}`);
  assert(executeProgram(prog) === ref.board, `${label}: ფიზიკური შესრულება`);
  // პასუხის წაკითხვა ▲ ღეროდან: board = answer × 10^(unit − ansDec)
  const ansDec = (p.aDec || 0) + (p.bDec || 0);
  assert(p.answer === p.a * p.b && p.ansDec === ansDec, `${label}: პასუხი`);
  assert(ref.board === p.answer * 10 ** (ref.unit - ansDec), `${label}: პასუხი ▲ ღეროდან არ იკითხება`);
  return prog;
}

function checkDiv(p, label) {
  const prog = programFor(p);
  const ref = refDiv(p.a, p.b, p.place, p.aDec || 0, p.qDec || 0);
  const engSeq = prog.steps.map((s) => s.after);
  assert(JSON.stringify(engSeq) === JSON.stringify(ref.seq), `${label}: ნაბიჯები არ ემთხვევა შემმოწმებელს`);
  assert(prog.unit === ref.unit && p.ansUnit === ref.unit, `${label}: ერთეულის ღერო`);
  assert(executeProgram(prog) === ref.qBoard + ref.remBoard, `${label}: ფიზიკური შესრულება`);
  // არითმეტიკა: a / 10^aDec = b·q/10^qDec + r/10^aDec  →  a = b·q + r (qDec = aDec)
  assert(p.a === p.b * p.q + p.r && p.r >= 0 && p.r < p.b, `${label}: ${p.a} ≠ ${p.b}·${p.q} + ${p.r}`);
  assert(ref.qBoard === p.q * 10 ** (ref.unit - (p.qDec || 0)), `${label}: განაყოფი ▲ ღეროდან არ იკითხება`);
  assert(ref.remBoard === p.r * 10 ** (p.place - (p.aDec || 0)), `${label}: ნაშთი არასწორ ადგილასაა`);
  for (const pl of ref.placements) assert(pl.qRod === pl.head + 1 || pl.qRod === pl.head + 2, `${label}: ციფრის ადგილი`);
  return prog;
}

test('片落とし: წყაროების მაგალითები (12×34, 4116:42, 862:15, 18:2, 0,84:4)', () => {
  const m = mulProgram({ a: 12, b: 34, place: 3 });
  assert(m.answerBoard === 4080 && m.unit === 1, `12×34: ${m.answerBoard}, ▲=${m.unit}`);
  const d1 = divProgram({ a: 4116, b: 42, place: 0 });
  assert(d1.unit === 3 && d1.qBoard === 98000 && d1.remBoard === 0, '4116:42 = 98');
  assert(d1.qDigits[0].qRod === 4 && !d1.qDigits[0].divides, '4116:42 — 9 მეზობელ ღეროზე (41 < 42)');
  const d2 = divProgram({ a: 862, b: 15, place: 0 });
  assert(d2.qBoard === 57000 && d2.remBoard === 7, '862:15 = 57, ნაშთი 7');
  const d3 = divProgram({ a: 18, b: 2, place: 0 });
  assert(d3.unit === 2 && d3.qBoard === 900, '18:2 — 9 მარცხნივ მეორე ღეროზე');
  const d4 = divProgram({ a: 84, b: 4, place: 3, aDec: 2, decimals: 2 });
  assert(d4.qBoard === 21000 && d4.unit === 5, '0,84:4 = 0,21');
  const d5 = divProgram({ a: 84, b: 4, place: 0 });
  assert(d5.qDigits.every((q) => q.divides), '84:4 — ორივე ციფრი „იყოფა“ (2 ღეროთი მარცხნივ)');
});

test('片落とし: ამომწურავი შემოწმება — 10–999 × 2–99 და გაყოფა 2–99-ზე', () => {
  let nm = 0, nd = 0;
  for (let a = 10; a <= 999; a += 7) for (let b = 2; b <= 99; b++) {
    checkMul({ kind: 'mul', a, b, place: 3, aDec: 0, bDec: 0, ansUnit: 3 - String(b).length, answer: a * b, ansDec: 0 }, `${a}×${b}`);
    nm++;
  }
  for (let b = 2; b <= 99; b++) for (let a = b; a <= 9999; a += 13) {
    const q = Math.floor(a / b), r = a % b;
    checkDiv({ kind: 'div', a, b, place: 0, aDec: 0, qDec: 0, ansUnit: String(b).length + 1, q, r }, `${a}:${b}`);
    nd++;
  }
  note(`${nm.toLocaleString('en-US')} გამრავლება, ${nd.toLocaleString('en-US')} გაყოფა`);
});

const STAGE2 = ['5a', '5b', '6a', '6b', '6c', '7a', '7b', '7c', '8a', '8b'];

function checkStage2Problem(p, spec, level, label) {
  assert(p.kind === spec.kind && String(p.level) === String(level.id), `${label}: kind/level`);
  const lid = String(level.id);
  if (p.kind === 'calc' || p.kind === 'column') {
    assert(p.terms.length === (spec.terms || 2), `${label}: რიცხვების რაოდენობა`);
    let total = p.terms[0];
    assert(total > 0, `${label}: პირველი რიცხვი`);
    for (let i = 1; i < p.terms.length; i++) {
      const a = analyze(total, p.terms[i]);
      assert(a.ok && executeSteps(total, a) === total + p.terms[i], `${label}: ნაბიჯები`);
      total += p.terms[i];
      assert(total > 0, `${label}: შუალედური შედეგი ≤ 0`);
    }
    assert(p.answer === total, `${label}: პასუხი`);
    if (spec.unit) {
      assert(p.unit === spec.unit, `${label}: ერთეულის ღერო`);
      for (const t of p.terms) assert(Math.abs(t) % 10 ** (spec.unit - spec.dec) === 0, `${label}: მძიმის შემდეგ მეტი ციფრია, ვიდრე ${spec.dec}`);
    } else {
      assert(!p.unit, `${label}: ათწილადი ჯერ არ არის ნასწავლი`);
      for (const t of p.terms) {
        const d = String(Math.abs(t)).length;
        assert(d <= spec.digits && (t === p.terms[0] ? d >= (spec.minDigits || 1) : true), `${label}: ნიშნები ${t}`);
      }
    }
  } else if (p.kind === 'read' || p.kind === 'set') {
    assert(p.unit === spec.unit && p.answer === p.value && p.value > 0, `${label}: ათწილადი`);
    assert(p.value % 10 ** (spec.unit - spec.dec) === 0, `${label}: მძიმის შემდეგ ციფრები`);
    assert(parseScaled(fmtScaled(p.value, p.unit), p.unit) === p.value, `${label}: ჩვენება/წაკითხვა`);
  } else if (p.kind === 'table') {
    assert(spec.rows.includes(p.a) && p.b >= spec.from && p.b <= spec.to && p.answer === p.a * p.b, `${label}: ტაბულა`);
  } else if (p.kind === 'mul') {
    const [mn, mx] = spec.aDigits;
    const ad = String(p.a).length;
    assert(ad >= mn && ad <= mx, `${label}: პირველი თანამამრავლის ნიშნები`);
    assert(String(p.b).length === spec.bDigits, `${label}: მეორე თანამამრავლი — ${spec.bDigits}-ნიშნა უნდა იყოს (${p.b})`);
    assert((p.aDec || 0) === (spec.aDec || 0) && (p.bDec || 0) === (spec.bDec || 0), `${label}: ათწილადი`);
    checkMul(p, label);
  } else if (p.kind === 'div') {
    assert(String(p.b).length === spec.bDigits, `${label}: გამყოფი — ${spec.bDigits}-ნიშნა უნდა იყოს`);
    const qd = String(p.q).length;
    assert(qd >= spec.qDigits[0] && qd <= spec.qDigits[1], `${label}: განაყოფის ნიშნები ${p.q}`);
    if (spec.rem) assert(p.r > 0, `${label}: ნაშთი უნდა იყოს`);
    else assert(p.r === 0, `${label}: ნაშთი ჯერ არ არის ნასწავლი (${p.a}:${p.b})`);
    assert((p.qDec || 0) === (spec.qDec || 0), `${label}: ათწილადი განაყოფი`);
    checkDiv(p, label);
  } else {
    throw new Error(`${label}: უცნობი ტიპი ${p.kind}`);
  }
  // „მხოლოდ ნასწავლი ხერხები“ ქვედონეების მიხედვით
  const order = STAGE2.indexOf(lid);
  if (order < STAGE2.indexOf('6a')) assert(!['table', 'mul', 'div'].includes(p.kind), `${label}: გამრავლება/გაყოფა ჯერ არ არის ნასწავლი`);
  if (order < STAGE2.indexOf('6c') && p.kind === 'mul') assert(String(p.b).length === 1, `${label}: ორნიშნა მამრავლი ჯერ არ არის ნასწავლი`);
  if (order < STAGE2.indexOf('7a')) assert(p.kind !== 'div', `${label}: გაყოფა ჯერ არ არის ნასწავლი`);
  if (order < STAGE2.indexOf('7b') && p.kind === 'div') assert(String(p.b).length === 1, `${label}: ორნიშნა გამყოფი ჯერ არ არის ნასწავლი`);
  if (order < STAGE2.indexOf('7c') && p.kind === 'div') assert(p.r === 0, `${label}: ნაშთი ჯერ არ არის ნასწავლი`);
  if (order < STAGE2.indexOf('8a')) assert(!p.unit && !p.aDec && !p.bDec && !p.qDec, `${label}: ათწილადები ჯერ არ არის ნასწავლი`);
}

for (const lid of STAGE2) {
  test(`გენერატორი: დონე ${levelLabel(getLevel(lid))} — ${N_PER_SPEC} მაგალითი თითო სპეციფიკაციაზე`, () => {
    const level = getLevel(lid);
    const specs = [
      ...level.guided.map((s) => ['guided', s]),
      ...level.tasks.map((s) => ['tasks', s]),
      ...level.test.items.map((s) => ['test', s])
    ];
    let total = 0;
    const kinds = {};
    specs.forEach(([mode, spec], si) => {
      const rng = makeRng(7000 + STAGE2.indexOf(lid) * 100 + si);
      const label = `დ${lid} ${mode} ${JSON.stringify(spec)}`;
      for (let i = 0; i < N_PER_SPEC; i++) {
        const p = generateProblem(spec, level, rng);
        checkStage2Problem(p, spec, level, label);
        kinds[p.kind] = (kinds[p.kind] || 0) + 1;
        total++;
      }
    });
    note(`${total} მაგალითი · ${Object.entries(kinds).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  });
}

test('ეტაპი 2: შემმოწმებელი იჭერს დარღვევებს (უარყოფითი ტესტი)', () => {
  const L = (id) => getLevel(id);
  const mulSpec1 = { kind: 'mul', aDigits: [2, 2], bDigits: 1, place: 3 };
  const divSpec1 = { kind: 'div', bDigits: 1, qDigits: [2, 2], place: 0 };
  const bad = [
    ['6b', mulSpec1, { kind: 'mul', a: 23, b: 45, aDec: 0, bDec: 0, place: 3, ansUnit: 1, answer: 1035, ansDec: 0, level: '6b' }, 'ორნიშნა მამრავლი 6ბ-ზე'],
    ['6b', mulSpec1, { kind: 'mul', a: 23, b: 4, aDec: 0, bDec: 0, place: 3, ansUnit: 3, answer: 92, ansDec: 0, level: '6b' }, 'არასწორი ერთეულის ღერო (▲)'],
    ['6b', mulSpec1, { kind: 'mul', a: 23, b: 4, aDec: 0, bDec: 0, place: 3, ansUnit: 2, answer: 93, ansDec: 0, level: '6b' }, 'არასწორი პასუხი'],
    ['6b', mulSpec1, { kind: 'mul', a: 23, b: 4, aDec: 1, bDec: 0, place: 3, ansUnit: 2, answer: 92, ansDec: 1, level: '6b' }, 'ათწილადი 6ბ-ზე'],
    ['7a', divSpec1, { kind: 'div', a: 87, b: 4, aDec: 0, qDec: 0, place: 0, ansUnit: 2, q: 21, r: 3, answer: 21, level: '7a' }, 'ნაშთი 7ა-ზე'],
    ['7a', divSpec1, { kind: 'div', a: 84, b: 4, aDec: 0, qDec: 0, place: 0, ansUnit: 3, q: 21, r: 0, answer: 21, level: '7a' }, 'განაყოფის არასწორი ▲'],
    ['7a', divSpec1, { kind: 'div', a: 84, b: 4, aDec: 0, qDec: 0, place: 0, ansUnit: 2, q: 22, r: 0, answer: 22, level: '7a' }, 'არასწორი განაყოფი'],
    ['5a', { kind: 'calc', minDigits: 2, digits: 2, terms: 3, ops: 'both' }, { kind: 'calc', terms: [40, -50, 30], answer: 20, level: '5a' }, 'უარყოფითი შუალედური შედეგი']
  ];
  for (const [id, spec, prob, label] of bad) {
    let threw = false;
    try { checkStage2Problem(prob, spec, L(id), 'neg'); } catch (e) { threw = true; }
    assert(threw, `შემმოწმებელმა ვერ დაიჭირა: ${label}`);
  }
  // თავად შემმოწმებელიც არ უნდა ემთხვეოდეს „სხვა“ წესს: ნამრავლი ციფრის მარჯვნივ (ათეულები r−1-ზე) — სხვა სისტემაა
  const wrongRule = mulProgram({ a: 23, b: 4, place: 4 }).answerBoard; // ერთი ღეროთი გადაწეული
  assert(wrongRule !== refMul(23, 4, 3).board, 'გადაწეული განლაგება უნდა განსხვავდებოდეს');
  note(`${bad.length} დარღვევა დაჭერილია`);
});

test('ეტაპი 2: გაკვეთილების ყველა დემო ფიზიკურად სრულდება და სწორ პასუხს იძლევა', () => {
  let n = 0;
  for (const lid of STAGE2) {
    const cards = LESSONS[lid];
    assert(Array.isArray(cards) && cards.length >= 4, `დონე ${lid}: გაკვეთილი აკლია`);
    for (const c of cards) {
      assert(c.title && Array.isArray(c.text) && c.text.length, `დონე ${lid}: ბარათი`);
      for (const ex of c.demo?.program || []) {
        const spec = ex.mul || ex.div;
        const prog = ex.mul ? mulProgram(ex.mul) : divProgram(ex.div);
        const final = executeProgram(prog);
        let expected;
        if (ex.mul) {
          const ref = refMul(spec.a, spec.b, spec.place, spec.aDec || 0, spec.bDec || 0);
          assert(final === ref.board && prog.unit === ref.unit, `„${c.title}“: გამრავლების დემო`);
          expected = fmtScaled(spec.a * spec.b, (spec.aDec || 0) + (spec.bDec || 0));
        } else {
          const ref = refDiv(spec.a, spec.b, spec.place, spec.aDec || 0, spec.decimals || 0);
          assert(final === ref.qBoard + ref.remBoard && prog.unit === ref.unit, `„${c.title}“: გაყოფის დემო`);
          const qv = Math.floor(spec.a / spec.b), r = spec.a % spec.b;
          expected = fmtScaled(qv, spec.decimals || 0) + (r ? `, ნაშთი ${r}` : '');
          assert(ref.qBoard === qv * 10 ** (ref.unit - (spec.decimals || 0)), `„${c.title}“: განაყოფი`);
        }
        assert(ex.answer.replace(/\s| /g, '') === expected.replace(/\s| /g, ''), `„${c.title}“: დემოს პასუხი „${ex.answer}“ ≠ ${expected}`);
        n++;
      }
      if (c.demo?.calc) {
        for (const ex of c.demo.calc) {
          const ds = demoSteps(ex.start, ex.ops);
          const sb = new Soroban();
          for (const s of ds.steps) for (const m of s.moves) sb.applyMove(m);
          assert(sb.value === ex.ops.reduce((x, y) => x + y, ex.start), `„${c.title}“: გამოთვლის დემო`);
          n++;
        }
      }
      if (c.try) assert(Number.isInteger(c.try.target) && c.try.target > 0, `try ${c.title}`);
    }
  }
  note(`${n} დემო`);
});

test('ათწილადები: ჩვენება და წაკითხვა მძიმით', () => {
  const cases = [[12500, 3, '12,5'], [3070, 3, '3,07'], [4250, 3, '4,25'], [7, 3, '0,007'], [5000, 3, '5'], [123456, 3, '123,456']];
  for (const [v, d, s] of cases) {
    assert(fmtScaled(v, d) === s, `fmtScaled(${v}) = ${fmtScaled(v, d)}, მოსალოდნელი ${s}`);
    assert(parseScaled(s, d) === v, `parseScaled(${s})`);
  }
  assert(parseScaled('12.5', 3) === 12500 && parseScaled('2,', 3) === 2000, 'წერტილი/ცარიელი წილადი');
  assert(parseScaled('1,2345', 3) === null && parseScaled('abc', 3) === null, 'არასწორი შეყვანა');
});

test('პროგრესი: ქვედონეები რიგრიგობით იხსნება (ეტაპი 2 → ეტაპი 3)', () => {
  const pr = new Progress(memoryStorage(), () => new Date(2026, 10, 25, 10));
  for (let i = 0; i <= 4; i++) pr.recordSession({ level: i, mode: 'test', accuracy: 1, avgSec: 3, passed: true });
  assert(pr.currentLevelId() === '5a' && pr.isUnlocked('5a') && !pr.isUnlocked('5b'), 'დონე 4-ის შემდეგ იხსნება 5ა');
  for (const id of STAGE2) {
    assert(pr.isUnlocked(id), `${id} უნდა იყოს გახსნილი`);
    pr.recordSession({ level: id, mode: 'test', accuracy: 1, avgSec: 3, passed: true });
  }
  assert(pr.currentLevelId() === '9a' && pr.isUnlocked('9a') && !pr.isUnlocked('9b'), '8ბ-ის შემდეგ იხსნება 9ა');
  // ეტაპი 1-ის შენახული პროგრესი (რიცხვითი გასაღებები) ისევ იკითხება
  const st = memoryStorage();
  st.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, levels: { '0': { passed: true }, '4': { passed: true }, '3': { passed: true }, '2': { passed: true }, '1': { passed: true } }, days: {}, mistakes: [] }));
  const old = new Progress(st);
  assert(old.isPassed(4) && old.currentLevelId() === '5a', 'ძველი პროგრესი შენარჩუნებულია');
});

// =====================================================================
// ეტაპი 3: ვიზუალიზაცია, ანძანი, flash anzan, „კენტეის მსგავსი“ გამოცდა, 修正
// =====================================================================

// 修正 (還元): დამოუკიდებელი სიმულაცია. საცდელი ციფრი = min(9, ⌊(ნაწილის პირველი ციფრები) / (გამყოფის პირველი ციფრი)⌋);
// როცა ნამრავლი აღარ აკლდება: ციფრი −1 და უკვე გამოკლებული 1 × (გამყოფის ციფრები) ბრუნდება იმავე ღეროებზე.
function refDivTrial(a, b, place) {
  const bd = String(b).split('').map(Number);
  const n = bd.length;
  const unit = place + n + 1;
  const qRods = new Array(MAX_RODS).fill(0);
  let remVal = a * 10 ** place;
  const seq = [remVal];
  let corrections = 0;
  for (let g = 0; g < 50; g++) {
    const rem = rodsOf(remVal);
    let head = -1;
    for (let p = MAX_RODS - 1; p >= 0; p--) if (rem[p]) { head = p; break; }
    if (head < 0) break;
    const lead = (len) => { let v = 0; for (let k = 0; k < len; k++) { const p = head - k; v = v * 10 + (p >= 0 ? rem[p] : 0); } return v; };
    let qRod, chunk;
    if (lead(n) >= b) { qRod = head + 2; chunk = lead(n); } else { qRod = head + 1; chunk = lead(n + 1); }
    if (qRod < unit || qRod - n - 1 < 0) break;
    let cur = Math.min(9, Math.floor(Math.floor(chunk / 10 ** (n - 1)) / bd[0]));
    qRods[qRod] = cur;
    seq.push(valueOf(qRods) + remVal);
    const subtracted = [];
    for (let k = 0; k < n; k++) {
      for (;;) {
        const prod = cur * bd[k];
        const pos = qRod - 2 - k;
        if (prod * 10 ** pos <= remVal) {
          remVal -= prod * 10 ** pos;
          if (prod) seq.push(valueOf(qRods) + remVal);
          subtracted.push(k);
          break;
        }
        corrections += 1;
        cur -= 1;
        assert(cur >= 1, 'refDivTrial: ციფრი 0-მდე ჩამოვიდა');
        qRods[qRod] = cur;
        seq.push(valueOf(qRods) + remVal);
        for (const k2 of subtracted) {
          if (!bd[k2]) continue;
          remVal += bd[k2] * 10 ** (qRod - 2 - k2);
          seq.push(valueOf(qRods) + remVal);
        }
      }
    }
  }
  return { seq, unit, qBoard: valueOf(qRods), remBoard: remVal, corrections };
}

function checkFixDiv(p, label) {
  const prog = programFor(p);
  const ref = refDivTrial(p.a, p.b, p.place);
  const engSeq = prog.steps.map((s) => s.after);
  assert(JSON.stringify(engSeq) === JSON.stringify(ref.seq), `${label}: 修正-ის ნაბიჯები არ ემთხვევა შემმოწმებელს`);
  assert(ref.corrections >= 1, `${label}: შესწორება საჭირო არ გახდა`);
  assert(executeProgram(prog) === ref.qBoard + ref.remBoard, `${label}: ფიზიკური შესრულება`);
  const exact = divProgram({ a: p.a, b: p.b, place: p.place });
  assert(exact.answerBoard === prog.answerBoard, `${label}: 修正-ის შედეგი ზუსტი მეთოდის შედეგს არ ემთხვევა`);
  assert(p.a === p.b * p.q + p.r && ref.qBoard === p.q * 10 ** ref.unit, `${label}: განაყოფი`);
  assert(prog.steps.some((s) => s.type === 'correct') && prog.steps.some((s) => s.type === 'giveback' || s.type === 'correct'), `${label}: შესწორების ნაბიჯი`);
}

function checkTermsBasic(p, spec, label, { addOnly = false } = {}) {
  assert(Array.isArray(p.terms) && p.terms.length === spec.terms, `${label}: რიცხვების რაოდენობა`);
  let total = 0;
  p.terms.forEach((t, i) => {
    assert(Number.isInteger(t) && t !== 0, `${label}: რიცხვი ${t}`);
    if (addOnly) assert(t > 0, `${label}: flash anzan-ში მხოლოდ მიმატებაა (${t})`);
    const d = String(Math.abs(t)).length;
    if (i === 0 || t > 0) assert(d >= (spec.minDigits || 1) && d <= spec.digits, `${label}: ნიშნები ${t}`);
    else assert(d <= spec.digits, `${label}: ნიშნები ${t}`);
    if (i > 0) {
      const a = analyze(total, t);
      assert(a.ok && executeSteps(total, a) === total + t, `${label}: ნაბიჯები`);
    }
    total += t;
    assert(total > 0, `${label}: შუალედური ჯამი ≤ 0`);
  });
  assert(p.answer === total, `${label}: პასუხი ${p.answer} ≠ ${total}`);
}

const STAGE3_KINDS = {
  '9a': ['flashread', 'calc'], '9b': ['mental'], '9c': ['mentalmul', 'mentaldiv'],
  '10a': ['flash'], '10b': ['calc', 'mul', 'div'], fix: ['div']
};

function checkStage3Problem(p, spec, level, label) {
  const lid = String(level.id);
  assert(p.kind === spec.kind && String(p.level) === lid, `${label}: kind/level`);
  assert(STAGE3_KINDS[lid].includes(p.kind), `${label}: ტიპი ${p.kind} ამ დონეზე არ ისწავლება`);
  assert(!p.unit && !p.aDec && !p.bDec && !p.qDec, `${label}: ათწილადი ამ დონეზე არ არის`);
  if (p.kind === 'flashread') {
    const d = String(p.value).length;
    assert(d >= spec.minDigits && d <= spec.maxDigits && p.answer === p.value && p.ms === spec.ms && p.value > 0, `${label}: ვიზუალიზაცია`);
  } else if (p.kind === 'calc') {
    if (lid === '9a') assert(p.ghost === true, `${label}: მოჩვენებითი სორობანი`);
    checkTermsBasic(p, spec, label, { addOnly: spec.ops === 'add' });
  } else if (p.kind === 'mental') {
    checkTermsBasic(p, spec, label);
  } else if (p.kind === 'flash') {
    checkTermsBasic(p, spec, label, { addOnly: true });
  } else if (p.kind === 'mentalmul') {
    const ad = String(p.a).length, bd = String(p.b).length;
    assert(ad >= spec.aDigits[0] && ad <= spec.aDigits[1] && bd === spec.bDigits, `${label}: ნიშნები`);
    let prod = 0; // დამოუკიდებელი გამრავლება თანრიგებით
    String(p.a).split('').reverse().forEach((d, i) => { prod += Number(d) * 10 ** i * p.b; });
    assert(p.answer === prod, `${label}: ${p.a} × ${p.b} ≠ ${p.answer}`);
  } else if (p.kind === 'mentaldiv') {
    const qd = String(p.q).length;
    assert(String(p.b).length === spec.bDigits && qd >= spec.qDigits[0] && qd <= spec.qDigits[1], `${label}: ნიშნები`);
    assert(p.a === p.b * p.q && p.answer === p.q, `${label}: ${p.a} : ${p.b} ≠ ${p.q}`);
  } else if (p.kind === 'mul') {
    assert(String(p.b).length === spec.bDigits, `${label}: მეორე თანამამრავლი`);
    checkMul(p, label);
  } else if (p.kind === 'div') {
    assert(String(p.b).length === spec.bDigits && p.r === 0, `${label}: გამყოფი/ნაშთი`);
    if (lid === 'fix') { assert(p.fix === true, `${label}: 修正`); checkFixDiv(p, label); }
    else { assert(!p.fix, `${label}: 修正 ამ დონეზე არ ისწავლება`); checkDiv(p, label); }
  }
}

for (const lid of Object.keys(STAGE3_KINDS)) {
  test(`გენერატორი: დონე ${levelLabel(getLevel(lid))} — ${N_PER_SPEC} მაგალითი თითო სპეციფიკაციაზე`, () => {
    const level = getLevel(lid);
    const specs = [
      ...level.guided.map((s) => ['guided', s]),
      ...level.tasks.map((s) => ['tasks', s]),
      ...level.test.items.map((s) => ['test', s])
    ];
    let total = 0;
    const kinds = {};
    specs.forEach(([mode, spec], si) => {
      const rng = makeRng(9000 + Object.keys(STAGE3_KINDS).indexOf(lid) * 100 + si);
      const label = `დ${lid} ${mode} ${JSON.stringify(spec)}`;
      for (let i = 0; i < N_PER_SPEC; i++) {
        const p = generateProblem(spec, level, rng);
        checkStage3Problem(p, spec, level, label);
        kinds[p.kind] = (kinds[p.kind] || 0) + 1;
        total++;
      }
    });
    note(`${total} მაგალითი · ${Object.entries(kinds).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  });
}

test('修正: წყაროს მაგალითი 168 : 28 (საცდელი 8 → 7 → 6) და ამომწურავი შემოწმება', () => {
  const prog = divProgram({ a: 168, b: 28, place: 0, estimate: 'trial' });
  const ref = refDivTrial(168, 28, 0);
  assert(ref.corrections === 2 && prog.qDigits[0].trial === 8 && prog.qDigits[0].q === 6, '168:28 — საცდელი 8, ორი შესწორება, პასუხი 6');
  assert(prog.answerBoard === 6000, '168:28 = 6 (▲ = მე-4 ღერო)');
  let n = 0, withFix = 0;
  for (let b = 11; b <= 99; b++) {
    if (b % 10 === 0) continue;
    for (let q = 1; q <= 99; q += 2) {
      const a = q * b;
      if (String(a).length > 5) continue;
      const pr = divProgram({ a, b, place: 0, estimate: 'trial' });
      const rf = refDivTrial(a, b, 0);
      assert(JSON.stringify(pr.steps.map((s) => s.after)) === JSON.stringify(rf.seq), `${a}:${b}: ნაბიჯები`);
      assert(pr.answerBoard === q * 10 ** 3 && executeProgram(pr) === pr.answerBoard, `${a}:${b}: შედეგი`);
      for (const d of pr.qDigits) assert(d.trial >= d.q, `${a}:${b}: საცდელი ციფრი სწორზე ნაკლებია`);
      if (rf.corrections) withFix++;
      n++;
    }
  }
  note(`${n.toLocaleString('en-US')} გაყოფა, ${withFix.toLocaleString('en-US')}-ში საჭირო გახდა შესწორება`);
});

// ოფიციალური ცხრილი (日本珠算連盟, https://www.shuzan.jp/kentei/shuzan/) — აქ დამოუკიდებლად ჩაწერილი
const OFFICIAL = {
  g9: { minutes: 20, pass: 120, total: 200, mitori: { n: 10, kuchi: 5, ji: 10 }, kake: { n: 20, digits: 3 } },
  g8: { minutes: 20, pass: 120, total: 200, mitori: { n: 10, kuchi: 8, ji: 16 }, kake: { n: 10, digits: 4 }, wari: { n: 10, digits: 3 } },
  g7: { minutes: 20, pass: 120, total: 200, mitori: { n: 10, kuchi: 10, ji: 20 }, kake: { n: 10, digits: 4 }, wari: { n: 10, digits: 4 } },
  g6: { minutes: 30, pass: 210, total: 300, mitori: { n: 10, kuchi: 10, ji: 30 }, kake: { n: 20, digits: 5 }, wari: { n: 20, digits: 4 } }
};

test('„კენტეის მსგავსი“ გამოცდა: ფორმატი ოფიციალურ ცხრილს ემთხვევა, 500 ამოცანა თითო სექციაზე', () => {
  const level = getLevel('10b');
  let count = 0;
  for (const g of EXAM_GRADES) {
    const off = OFFICIAL[g.id];
    assert(off, `${g.id}: ოფიციალური მონაცემი არ არის`);
    assert(g.minutes === off.minutes && g.pass === off.pass && g.total === off.total, `${g.id}: დრო/ქულა`);
    const pts = g.sections.reduce((s, x) => s + x.points * x.n, 0);
    assert(pts === off.total, `${g.id}: ქულების ჯამი ${pts} ≠ ${off.total}`);
    for (const sec of g.sections) {
      const o = off[sec.key];
      assert(o && o.n === sec.n, `${g.id}/${sec.key}: ამოცანების რაოდენობა`);
      assert(sec.points === (sec.key === 'mitori' ? 10 : 5), `${g.id}/${sec.key}: ქულა ამოცანაზე`);
    }
    for (const k of Object.keys(off)) if (typeof off[k] === 'object') assert(g.sections.some((s) => s.key === k), `${g.id}: სექცია ${k} აკლია`);
    const rng = makeRng(4242 + count);
    const per = {};
    for (let rep = 0; per.min === undefined || Object.values(per).some((v) => v < 500); rep++) {
      const exam = buildExam(g, level, rng);
      assert(exam.length === g.sections.reduce((s, x) => s + x.n, 0), `${g.id}: ამოცანების რაოდენობა გამოცდაში`);
      for (const p of exam) {
        const sec = g.sections.find((s) => s.key === p.section);
        const o = off[p.section];
        const label = `${g.id}/${p.section}`;
        if (p.section === 'mitori') {
          assert(p.kind === 'calc' && p.terms.length === o.kuchi, `${label}: 口数`);
          const ji = p.terms.reduce((s, t) => s + String(Math.abs(t)).length, 0);
          assert(ji === o.ji, `${label}: 字数 ${ji} ≠ ${o.ji}`);
          checkTermsBasic(p, sec.specs[0], label, { addOnly: sec.specs[0].ops === 'add' });
        } else if (p.section === 'kake') {
          assert(p.kind === 'mul' && String(p.a).length + String(p.b).length === o.digits, `${label}: 実法 ${o.digits} けた`);
          checkMul(p, label);
        } else {
          assert(p.kind === 'div' && String(p.b).length + String(p.q).length === o.digits && p.r === 0, `${label}: 法商 ${o.digits} けた`);
          checkDiv(p, label);
        }
        per[p.section] = (per[p.section] || 0) + 1;
        count++;
      }
      per.min = 0;
      if (rep > 200) break;
    }
    delete per.min;
    for (const [k, v] of Object.entries(per)) assert(v >= 500, `${g.id}/${k}: მხოლოდ ${v} ამოცანა`);
  }
  note(`${count.toLocaleString('en-US')} ამოცანა 4 დონის გამოცდებში`);
});

test('ეტაპი 3: გაკვეთილების დემოები ფიზიკურად სრულდება და სწორ პასუხს იძლევა', () => {
  let n = 0;
  for (const lid of Object.keys(STAGE3_KINDS)) {
    const cards = LESSONS[lid];
    assert(Array.isArray(cards) && cards.length >= 4, `დონე ${lid}: გაკვეთილი აკლია`);
    for (const c of cards) {
      assert(c.title && Array.isArray(c.text) && c.text.length, `დონე ${lid}: ბარათი`);
      for (const ex of c.demo?.program || []) {
        const spec = ex.mul || ex.div;
        const prog = ex.mul ? mulProgram(ex.mul) : divProgram(ex.div);
        const final = executeProgram(prog);
        if (ex.mul) assert(final === refMul(spec.a, spec.b, spec.place).board, `„${c.title}“: დემო`);
        else if (ex.div.estimate === 'trial') {
          const rf = refDivTrial(spec.a, spec.b, spec.place);
          assert(final === rf.qBoard + rf.remBoard && rf.corrections > 0, `„${c.title}“: 修正-ის დემო`);
        } else assert(final === refDiv(spec.a, spec.b, spec.place).qBoard, `„${c.title}“: დემო`);
        const expected = ex.mul ? spec.a * spec.b : Math.floor(spec.a / spec.b);
        assert(Number(ex.answer.replace(/\D/g, '')) === expected, `„${c.title}“: პასუხი ${ex.answer} ≠ ${expected}`);
        n++;
      }
      for (const ex of c.demo?.calc || []) {
        const ds = demoSteps(ex.start, ex.ops);
        const sb = new Soroban();
        for (const s of ds.steps) for (const m of s.moves) sb.applyMove(m);
        assert(sb.value === ex.ops.reduce((x, y) => x + y, ex.start), `„${c.title}“: გამოთვლის დემო`);
        n++;
      }
    }
  }
  note(`${n} დემო`);
});

test('ეტაპი 3: შემმოწმებელი იჭერს დარღვევებს (უარყოფითი ტესტი)', () => {
  const L = (id) => getLevel(id);
  const bad = [
    ['10a', { kind: 'flash', minDigits: 1, digits: 1, terms: 3, ops: 'add' }, { kind: 'flash', terms: [5, -2, 4], answer: 7, level: '10a' }, 'გამოკლება flash anzan-ში'],
    ['9c', { kind: 'mentalmul', aDigits: [2, 2], bDigits: 1 }, { kind: 'mentalmul', a: 23, b: 4, answer: 93, level: '9c' }, 'არასწორი ნამრავლი'],
    ['9c', { kind: 'mentaldiv', bDigits: 1, qDigits: [2, 2] }, { kind: 'mentaldiv', a: 85, b: 4, q: 21, answer: 21, level: '9c' }, 'ნაშთიანი გაყოფა'],
    ['fix', { kind: 'div', bDigits: 2, qDigits: [1, 1], fix: true, place: 0 }, { kind: 'div', a: 84, b: 42, aDec: 0, qDec: 0, place: 0, ansUnit: 3, q: 2, r: 0, answer: 2, level: 'fix', fix: true }, '修正 შესწორების გარეშე'],
    ['9b', { kind: 'mental', minDigits: 1, digits: 1, terms: 3, ops: 'both' }, { kind: 'flash', terms: [3, 4, 5], answer: 12, level: '9b' }, 'სხვა ტიპი სხვა დონეზე'],
    ['10b', { kind: 'div', bDigits: 1, qDigits: [2, 2], place: 0 }, { kind: 'div', a: 84, b: 4, aDec: 1, qDec: 1, place: 0, ansUnit: 2, q: 21, r: 0, answer: 21, level: '10b' }, 'ათწილადი გამოცდის დონეზე']
  ];
  for (const [id, spec, prob, label] of bad) {
    let threw = false;
    try { checkStage3Problem(prob, spec, L(id), 'neg'); } catch (e) { threw = true; }
    assert(threw, `შემმოწმებელმა ვერ დაიჭირა: ${label}`);
  }
  note(`${bad.length} დარღვევა დაჭერილია`);
});

test('პროგრესი: ეტაპი 3 + არასავალდებულო 修正 (არ ბლოკავს რიგს), ტიპების სტატისტიკა, გამოცდები', () => {
  const pr = new Progress(memoryStorage(), () => new Date(2026, 10, 26, 10));
  const chain = LEVELS.filter((l) => !l.optional).map((l) => l.id);
  for (const id of chain) {
    if (String(id) === '7b') assert(!pr.isUnlocked('fix'), '修正 7ბ-მდე დაბლოკილია');
    assert(pr.isUnlocked(id) && String(pr.currentLevelId()) === String(id), `${id} — მიმდინარე`);
    pr.recordSession({ level: id, mode: 'test', accuracy: 1, avgSec: 3, passed: true });
    if (String(id) === '7b') assert(pr.isUnlocked('fix'), '修正 იხსნება 7ბ-ის შემდეგ');
  }
  assert(pr.currentLevelId() === null && !pr.isPassed('fix'), 'ყველა სავალდებულო გავლილია; 修正 არასავალდებულოა');
  pr.recordAnswer({ level: '6b', mode: 'tasks', problem: { kind: 'mul', a: 23, b: 4 }, correct: true, ms: 12000 });
  pr.recordAnswer({ level: '6b', mode: 'tasks', problem: { kind: 'mul', a: 23, b: 5 }, correct: false, ms: 8000 });
  const k = pr.data.kinds.mul;
  assert(k.answered === 2 && k.correct === 1 && k.ms === 20000, 'ტიპის სტატისტიკა (დრო იწერება)');
  pr.addExam({ grade: 'g7', score: 150, total: 200, passed: true, secs: 900 });
  pr.addExam({ grade: 'g7', score: 170, total: 200, passed: true, secs: 800 });
  assert(pr.bestExam('g7').score === 170 && pr.data.exams.length === 2, 'გამოცდების ისტორია');
  const pr2 = new Progress(memoryStorage());
  assert(pr2.importJSON(pr.exportJSON()).ok && pr2.data.kinds.mul.answered === 2 && pr2.data.exams.length === 2, 'ექსპორტი/იმპორტი');
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
