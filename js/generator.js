// მაგალითების გენერატორი. კრიტიკული წესი: მაგალითში მხოლოდ ის ფორმულები შეიძლება იყოს,
// რაც დონის კონფიგურაციაში (level.allowed) უკვე ნასწავლია. ყოველი მოქმედება მოწმდება analyze()-ით.

import { analyze, TECHS } from './techniques.js';
import { mulProgram, divProgram, nDigits } from './muldiv.js';

// განმეორებადი შემთხვევითი რიცხვები (ტესტებისთვის); ნაგულისხმევად Math.random
export function makeRng(seed) {
  if (seed === undefined || seed === null) return Math.random;
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function problemKey(p) {
  if (p.kind === 'mul' || p.kind === 'div' || p.kind === 'table') {
    return `${p.kind}:${p.a}/${p.aDec || 0}:${p.b}/${p.bDec || 0}:${p.qDec || 0}`;
  }
  return p.kind + ':' + (p.terms ? p.terms.join(',') : p.value) + (p.unit ? `@${p.unit}` : '');
}

export function sumTerms(terms) {
  return terms.reduce((s, t) => s + t, 0);
}

// ტერმინების მიმდევრობის შემოწმება დონის წესებით
export function checkTerms(terms, level) {
  const allowed = new Set(level.allowed);
  let total = terms[0];
  const tags = new Set();
  const analyses = [];
  if (!Number.isInteger(total) || total <= 0) return { ok: false, reason: 'პირველი რიცხვი უნდა იყოს დადებითი' };
  for (let i = 1; i < terms.length; i++) {
    const a = analyze(total, terms[i]);
    if (!a.ok) return { ok: false, reason: a.error };
    for (const t of a.tags) {
      if (!allowed.has(t)) return { ok: false, reason: `ფორმულა „${t}“ ამ დონეზე ჯერ ნასწავლი არ არის` };
      tags.add(t);
    }
    analyses.push(a);
    total = a.result;
  }
  return { ok: true, answer: total, tags: [...tags], analyses };
}

function genNumber(spec, level, rng) {
  const minD = spec.minDigits || 1;
  const maxD = spec.maxDigits || minD;
  const d = randInt(rng, minD, maxD);
  let value;
  if (d === 1) value = spec.kind === 'read' ? randInt(rng, 0, 9) : randInt(rng, 1, 9);
  else value = randInt(rng, 10 ** (d - 1), 10 ** d - 1);
  return { kind: spec.kind, value, answer: value, level: level.id };
}

// შემთხვევითი რიცხვი minD–maxD ნიშნით
function randDigits(rng, minD, maxD) {
  const d = randInt(rng, minD, maxD);
  return randInt(rng, d > 1 ? 10 ** (d - 1) : 1, 10 ** d - 1);
}

// სვეტები დონეებზე, სადაც ყველა ფორმულა ნასწავლია (დონე 5): ფორმულების შეზღუდვა აღარ არის,
// ამიტომ რიცხვებს პირდაპირ ვირჩევთ (გამოკლება ~25%, შედეგი ყოველთვის დადებითია).
function genTermsFree(spec, level, rng) {
  const minD = spec.minDigits || 1;
  const maxD = spec.digits || minD;
  const nTerms = spec.terms || 3;
  const subRate = spec.ops === 'add' ? 0 : spec.ops === 'sub' ? 1 : (spec.subRate ?? 0.25);
  const first = randDigits(rng, minD, maxD);
  const terms = [first];
  let total = first;
  for (let i = 1; i < nTerms; i++) {
    let m = randDigits(rng, minD, maxD);
    let sign = rng() < subRate ? -1 : 1;
    if (sign < 0 && total - m <= 0) {
      if (total > 10 ** (minD - 1)) m = randInt(rng, Math.min(10 ** (minD - 1), total - 1), total - 1);
      else sign = 1;
      if (m < 1) { sign = 1; m = randDigits(rng, minD, maxD); }
    }
    terms.push(sign * m);
    total += sign * m;
  }
  return { kind: spec.kind, terms, answer: total, level: level.id };
}

// ათწილადი: მთელი ნაწილი 0..(10^digits−1), 1..dec ციფრი მძიმის შემდეგ; შედეგი მასშტაბირებულია 10^unit-ზე
function randDecimal(rng, digits, dec, unit) {
  const d = randInt(rng, 1, dec);
  const ip = randInt(rng, 0, 10 ** digits - 1);
  let fp = randInt(rng, 0, 10 ** d - 1);
  if (fp % 10 === 0) fp += randInt(rng, 1, 9); // ბოლო ციფრი არანულოვანი, რომ მძიმის შემდეგ ციფრები ჩანდეს
  if (fp >= 10 ** d) fp = 10 ** d - 1;
  return ip * 10 ** unit + fp * 10 ** (unit - d);
}

function genDecimalNumber(spec, level, rng) {
  const unit = spec.unit;
  const digits = randInt(rng, spec.minDigits || 1, spec.maxDigits || spec.minDigits || 1);
  let value = randDecimal(rng, digits, spec.dec || 1, unit);
  if (value < 10 ** unit) value += randInt(rng, 1, 9) * 10 ** unit; // მთელი ნაწილიც ჩანდეს
  return { kind: spec.kind, value, answer: value, unit, level: level.id };
}

function genDecimalTerms(spec, level, rng) {
  const unit = spec.unit;
  const nTerms = spec.terms || 2;
  const subRate = spec.ops === 'add' ? 0 : spec.ops === 'sub' ? 1 : 0.35;
  for (let attempt = 0; attempt < 200; attempt++) {
    const terms = [randDecimal(rng, spec.digits || 1, spec.dec || 1, unit) + 10 ** unit];
    let total = terms[0];
    for (let i = 1; i < nTerms; i++) {
      let t = randDecimal(rng, spec.digits || 1, spec.dec || 1, unit);
      if (t === 0) t = 10 ** (unit - 1);
      const sign = rng() < subRate && total - t > 0 ? -1 : 1;
      terms.push(sign * t);
      total += sign * t;
    }
    if (total > 0) return { kind: spec.kind, terms, answer: total, unit, level: level.id };
  }
  throw new Error('ათწილადების მაგალითი ვერ შეიქმნა');
}

function genTable(spec, level, rng) {
  const a = pick(rng, spec.rows || [2, 3, 4, 5, 6, 7, 8, 9]);
  const b = randInt(rng, spec.from || 2, spec.to || 9);
  return { kind: 'table', a, b, answer: a * b, level: level.id };
}

function genMul(spec, level, rng) {
  const [minA, maxA] = spec.aDigits || [2, 2];
  const place = spec.place ?? 3;
  const aDec = spec.aDec || 0;
  const bDec = spec.bDec || 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    let a = randDigits(rng, minA, maxA);
    if (aDec && a % 10 === 0) continue; // ათწილადი ნულით არ მთავრდება
    if (a % 10 === 0 && rng() < 0.7) continue;
    const bD = spec.bDigits || 1;
    const b = bD === 1 ? randInt(rng, 2, 9) : randInt(rng, 11, 99);
    if (bD > 1 && b % 10 === 0) continue;
    try {
      const prog = mulProgram({ a, b, place, aDec, bDec });
      const ansDec = aDec + bDec;
      return { kind: 'mul', a, b, aDec, bDec, place, ansUnit: prog.unit, answer: a * b, ansDec, level: level.id };
    } catch (e) { /* არ ეტევა — ვცდით სხვას */ }
  }
  throw new Error(`გამრავლების მაგალითი ვერ შეიქმნა (${JSON.stringify(spec)})`);
}

function genDiv(spec, level, rng) {
  const [minQ, maxQ] = spec.qDigits || [1, 2];
  const place = spec.place ?? 0;
  const qDec = spec.qDec || 0;
  for (let attempt = 0; attempt < 300; attempt++) {
    const bD = spec.bDigits || 1;
    const b = bD === 1 ? randInt(rng, 2, 9) : randInt(rng, 11, 99);
    if (bD > 1 && b % 10 === 0) continue;
    const q = randDigits(rng, minQ, maxQ);
    if (qDec && q % 10 === 0) continue;
    if (qDec && q < 10 ** qDec && rng() < 0.5) continue;
    const r = spec.rem ? randInt(rng, 1, b - 1) : 0;
    const a = q * b + r;
    const aDec = qDec; // ათწილადი გასაყოფი: განაყოფს იმდენივე ციფრი აქვს მძიმის შემდეგ
    if (nDigits(a) > 5) continue;
    try {
      const prog = divProgram({ a, b, place, aDec, decimals: qDec });
      if (prog.remBoard !== r * 10 ** (place - aDec)) continue;
      return { kind: 'div', a, b, aDec, qDec, place, ansUnit: prog.unit, q, r, answer: q, level: level.id };
    } catch (e) { /* არ ეტევა */ }
  }
  throw new Error(`გაყოფის მაგალითი ვერ შეიქმნა (${JSON.stringify(spec)})`);
}

function genTerms(spec, level, rng) {
  if (spec.unit) return genDecimalTerms(spec, level, rng);
  if (!(level.focus || []).length && TECHS.every((t) => (level.allowed || []).includes(t))) {
    return genTermsFree(spec, level, rng);
  }
  const allowed = new Set(level.allowed);
  const focus = level.focus || [];
  const needFocus = spec.focus !== false && focus.length > 0;
  const digits = spec.digits || 1;
  const firstDigits = spec.firstDigits || digits;
  const nTerms = spec.terms || 2;
  const width = spec.maxDigits || Math.max(firstDigits, digits) + (level.extraDigit ? 1 : 0);
  const maxTotal = 10 ** width - 1;
  const signs = spec.ops === 'add' ? [1] : spec.ops === 'sub' ? [-1] : [1, -1];
  const maxMag = 10 ** digits - 1;
  const fullMin = digits > 1 ? 10 ** (digits - 1) : 1;

  for (let attempt = 0; attempt < 400; attempt++) {
    const firstLo = firstDigits > 1 ? 10 ** (firstDigits - 1) : 1;
    const first = randInt(rng, firstLo, 10 ** firstDigits - 1);
    const terms = [first];
    let total = first;
    let hasFocus = false;
    let failed = false;

    for (let i = 1; i < nTerms; i++) {
      const cands = [];
      for (const s of signs) {
        for (let m = 1; m <= maxMag; m++) {
          const r = total + s * m;
          if (r <= 0 || r > maxTotal) continue;
          const a = analyze(total, s * m);
          if (!a.ok) continue;
          if (!a.tags.every((t) => allowed.has(t))) continue;
          cands.push({ v: s * m, isFocus: a.tags.some((t) => focus.includes(t)), full: m >= fullMin });
        }
      }
      if (!cands.length) { failed = true; break; }

      let pool = cands;
      const narrow = (fn) => {
        const f = pool.filter(fn);
        if (f.length) pool = f;
        return f.length > 0;
      };
      const isLast = i === nTerms - 1;
      if (needFocus) {
        const want = !hasFocus ? (isLast || rng() < 0.65) : rng() < 0.4;
        if (want) narrow((c) => c.isFocus);
      }
      if (signs.length === 2) {
        const wantSign = rng() < 0.5 ? 1 : -1;
        narrow((c) => Math.sign(c.v) === wantSign);
      }
      if (digits > 1 && rng() < 0.75) narrow((c) => c.full);
      if (pool.length > 1) narrow((c) => c.v !== terms[terms.length - 1]);

      const c = pick(rng, pool);
      terms.push(c.v);
      total += c.v;
      if (c.isFocus) hasFocus = true;
    }
    if (failed) continue;
    if (needFocus && !hasFocus) continue;
    return { kind: spec.kind, terms, answer: total, level: level.id };
  }
  throw new Error(`გენერატორმა ვერ შექმნა მაგალითი (დონე ${level.id}, ${JSON.stringify(spec)})`);
}

export function generateProblem(spec, level, rng = Math.random) {
  if (spec.kind === 'read' || spec.kind === 'set') return spec.unit ? genDecimalNumber(spec, level, rng) : genNumber(spec, level, rng);
  if (spec.kind === 'calc' || spec.kind === 'column') return genTerms(spec, level, rng);
  if (spec.kind === 'table') return genTable(spec, level, rng);
  if (spec.kind === 'mul') return genMul(spec, level, rng);
  if (spec.kind === 'div') return genDiv(spec, level, rng);
  throw new Error('უცნობი სავარჯიშოს ტიპი: ' + spec.kind);
}

// სპეციფიკაციების სია → მაგალითების სია (რიგი ნარჩუნდება: მარტივიდან რთულისკენ, დუბლიკატების გარეშე)
export function buildSet(specs, level, rng = Math.random, avoidKeys = new Set()) {
  const out = [];
  const seen = new Set(avoidKeys);
  for (const spec of specs) {
    for (let i = 0; i < (spec.n || 1); i++) {
      let p = null;
      for (let t = 0; t < 25; t++) {
        p = generateProblem(spec, level, rng);
        if (!seen.has(problemKey(p))) break;
      }
      seen.add(problemKey(p));
      out.push(p);
    }
  }
  return out;
}

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
