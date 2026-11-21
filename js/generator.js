// მაგალითების გენერატორი. კრიტიკული წესი: მაგალითში მხოლოდ ის ფორმულები შეიძლება იყოს,
// რაც დონის კონფიგურაციაში (level.allowed) უკვე ნასწავლია. ყოველი მოქმედება მოწმდება analyze()-ით.

import { analyze } from './techniques.js';

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
  return p.kind + ':' + (p.terms ? p.terms.join(',') : p.value);
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

function genTerms(spec, level, rng) {
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
  if (spec.kind === 'read' || spec.kind === 'set') return genNumber(spec, level, rng);
  if (spec.kind === 'calc' || spec.kind === 'column') return genTerms(spec, level, rng);
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
