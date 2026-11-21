// ფორმულების ძრავა: ერთი მოქმედების (start ± operand) დაშლა სორობანის ნაბიჯებად.
// იაპონური მეთოდი: ვთვლით მარცხნიდან მარჯვნივ (უმაღლესი თანრიგიდან), ფორმულას ვასრულებთ ისე, როგორც იკითხება:
//   +4 = +5 −1      (ვამატებ 5-ს, ვაკლებ 1-ს)            — „პატარა მეგობარი“
//   −4 = +1 −5      (ვამატებ 1-ს, ვაკლებ 5-ს)
//   +9 = −1 +10     (ვაკლებ 1-ს, ვამატებ 10-ს)           — „დიდი მეგობარი“
//   −9 = −10 +1     (ვაკლებ 10-ს, ვამატებ 1-ს)
//   +6 = +1 −5 +10  (−4 თავად „პატარა მეგობრით“ კეთდება)  — შერეული
//   −6 = −10 +5 −1  (+4 თავად „პატარა მეგობრით“ კეთდება)
// ტეგები: direct, small, big, mixed და nested (როცა 10-ის გადატანას/სესხებას მარცხენა ღეროზე თავად სჭირდება ფორმულა).

import { MAX_RODS, toDigits, PLACE_GEN } from './soroban.js';

export const TECHS = ['direct', 'small', 'big', 'mixed', 'nested'];

export const TECH_NAMES = {
  direct: 'პირდაპირი მოქმედება',
  small: '„პატარა მეგობარი“ (5-ის ფორმულა)',
  big: '„დიდი მეგობარი“ (10-ის ფორმულა)',
  mixed: 'შერეული ფორმულა (5 და 10 ერთად)',
  nested: 'გადატანა, რომელსაც თავად სჭირდება ფორმულა'
};

const TECH_SHORT = {
  small: '„პატარა მეგობარი“',
  big: '„დიდი მეგობარი“',
  mixed: 'შერეული ფორმულა'
};

const M = '−'; // მათემატიკური მინუსი

export function placeOn(p) {
  const g = PLACE_GEN[p];
  return g ? g.slice(0, -2) + 'ზე' : `${p + 1}-ე ღეროზე`;
}

// ღეროს სახელი წინადადებაში („ერთეულების ღეროზე“). ათწილადებისთვის ერთეულები unit ღეროზეა.
const DEC_GEN = ['მეათედების', 'მეასედების', 'მეათასედების', 'მეათიათასედების'];
export function rodNamer(unit = 0) {
  return (p) => {
    const k = p - unit;
    const g = k >= 0 ? PLACE_GEN[k] : DEC_GEN[-k - 1];
    return g ? `${g} ღეროზე` : `მარჯვნიდან ${p + 1}-ე ღეროზე`;
  };
}
const defaultNamer = rodNamer(0);

export function formulaOf(tech, sign, a) {
  const s = sign > 0 ? '+' : M;
  switch (tech) {
    case 'direct': return `${s}${a}`;
    case 'small': return sign > 0 ? `+${a} = +5 ${M}${5 - a}` : `${M}${a} = +${5 - a} ${M}5`;
    case 'big': return sign > 0 ? `+${a} = ${M}${10 - a} +10` : `${M}${a} = ${M}10 +${10 - a}`;
    case 'mixed': return sign > 0 ? `+${a} = +${a - 5} ${M}5 +10` : `${M}${a} = ${M}10 +5 ${M}${a - 5}`;
    default: return `${s}${a}`;
  }
}

export function wordsOf(tech, sign, a) {
  switch (tech) {
    case 'direct': return sign > 0 ? 'პირდაპირ ვამატებ' : 'პირდაპირ ვაკლებ';
    case 'small': return sign > 0 ? `5-ს ვამატებ, ${5 - a}-ს ვაკლებ` : `${5 - a}-ს ვამატებ, 5-ს ვაკლებ`;
    case 'big': return sign > 0 ? `${10 - a}-ს ვაკლებ, 10-ს ვამატებ` : `10-ს ვაკლებ, ${10 - a}-ს ვამატებ`;
    case 'mixed': return sign > 0
      ? `${a - 5}-ს ვამატებ, 5-ს ვაკლებ, 10-ს ვამატებ`
      : `10-ს ვაკლებ, 5-ს ვამატებ, ${a - 5}-ს ვაკლებ`;
    default: return '';
  }
}

function signedValue(v) {
  return (v < 0 ? M : '+') + Math.abs(v);
}

// ერთი ფაზის (ერთდროული მოძრაობების) ტექსტი
export function describeMoves(moves, relBase, multi, nameFn = defaultNamer) {
  const place = moves[0].place;
  const parts = [];
  let delta = 0;
  let thumbUp = false, upperDown = false;
  for (const m of moves) {
    if (m.upper === 1) { parts.push('ზედა მძივი ქვემოთ, ზოლისკენ'); delta += 5; upperDown = true; }
    if (m.upper === -1) { parts.push('ზედა მძივი ზემოთ, ზოლიდან'); delta -= 5; }
    if (m.lower > 0) { parts.push(`${m.lower} ქვედა მძივი ზემოთ, ზოლისკენ`); delta += m.lower; thumbUp = true; }
    if (m.lower < 0) { parts.push(`${-m.lower} ქვედა მძივი ქვემოთ, ზოლიდან`); delta += m.lower; }
  }
  const scaled = delta * 10 ** (place - relBase);
  let finger;
  if (thumbUp && upperDown) finger = 'საჩვენებელი და ცერა თითი ერთდროულად';
  else if (thumbUp) finger = 'ცერა თითი';
  else finger = 'საჩვენებელი თითი';
  const prefix = multi ? `${nameFn(place)}: ` : '';
  return `${prefix}${parts.join(' და ')} (${signedValue(scaled)}) · ${finger}`;
}

// მთავარი ფუნქცია: start ± |operand| → ნაბიჯები, ოპერაციები, ტეგები
export function analyze(start, operand, rods = MAX_RODS, nameFn = defaultNamer) {
  const res = {
    ok: true, error: null, start, operand,
    result: start + operand, ops: [], steps: [], tags: []
  };
  const max = 10 ** rods - 1;
  if (!Number.isInteger(start) || !Number.isInteger(operand) || start < 0 || start > max) {
    res.ok = false; res.error = 'bad-input'; return res;
  }
  if (res.result < 0) { res.ok = false; res.error = 'negative'; return res; }
  if (res.result > max || Math.abs(operand) > max) { res.ok = false; res.error = 'overflow'; return res; }

  const d = toDigits(start, rods);
  const multi = Math.max(start, Math.abs(operand), res.result) >= 10;
  const od = toDigits(Math.abs(operand), rods);
  const sign = operand < 0 ? -1 : 1;

  function makeOp(p, sgn, a, tech, parent) {
    const formula = formulaOf(tech, sgn, a);
    const words = wordsOf(tech, sgn, a);
    const where = multi ? `${nameFn(p)}: ` : '';
    const label = tech === 'direct' ? `${formula}: ${words}` : `${formula} · ${words} (${TECH_SHORT[tech]})`;
    const op = { place: p, sign: sgn, digit: a, tech, nested: !!parent, formula, words, head: where + label };
    op.topHead = parent ? parent.topHead : op.head;
    return op;
  }

  function stepper(op, parent) {
    // პირდაპირი გადატანა მშობელი ოპერაციის ნაწილია; ფორმულიანი გადატანა — ცალკე ქვე-ოპერაცია
    const owner = parent && op.tech === 'direct' ? parent : op;
    const prefix = parent && op.tech !== 'direct' ? `გადატანა: ${op.formula} · ` : '';
    return (moves) => {
      res.steps.push({
        place: moves[0].place,
        moves,
        head: op.topHead,
        text: prefix + describeMoves(moves, owner.place, multi, nameFn)
      });
    };
  }

  function addDigit(p, a, parent) {
    if (!res.ok) return;
    if (p >= rods) { res.ok = false; res.error = 'overflow'; return; }
    const v = d[p], u = v >= 5, l = v % 5, au = a >= 5, al = a % 5;
    let tech;
    if (v + a <= 9) tech = (!au || !u) && l + al <= 4 ? 'direct' : 'small';
    else {
      const k = 10 - a;
      tech = (k < 5 || u) && l >= k % 5 ? 'big' : 'mixed';
    }
    const op = makeOp(p, 1, a, tech, parent);
    res.ops.push(op);
    const st = stepper(op, parent);
    if (tech === 'direct') {
      st([au && { place: p, upper: 1 }, al && { place: p, lower: al }].filter(Boolean));
      d[p] = v + a;
    } else if (tech === 'small') {
      st([{ place: p, upper: 1 }]);
      st([{ place: p, lower: -(5 - a) }]);
      d[p] = v + a;
    } else {
      const k = 10 - a, ku = k >= 5, kl = k % 5;
      if (tech === 'big') st([ku && { place: p, upper: -1 }, kl && { place: p, lower: -kl }].filter(Boolean));
      else { st([{ place: p, lower: 5 - k }]); st([{ place: p, upper: -1 }]); }
      d[p] = v - k;
      addDigit(p + 1, 1, op);
    }
  }

  function subDigit(p, a, parent) {
    if (!res.ok) return;
    if (p >= rods) { res.ok = false; res.error = 'negative'; return; }
    const v = d[p], u = v >= 5, l = v % 5, au = a >= 5, al = a % 5;
    let tech;
    if (v >= a) tech = (!au || u) && l >= al ? 'direct' : 'small';
    else {
      const k = 10 - a;
      tech = (k < 5 || !u) && l + (k % 5) <= 4 ? 'big' : 'mixed';
    }
    const op = makeOp(p, -1, a, tech, parent);
    res.ops.push(op);
    const st = stepper(op, parent);
    if (tech === 'direct') {
      st([au && { place: p, upper: -1 }, al && { place: p, lower: -al }].filter(Boolean));
      d[p] = v - a;
    } else if (tech === 'small') {
      st([{ place: p, lower: 5 - a }]);
      st([{ place: p, upper: -1 }]);
      d[p] = v - a;
    } else {
      const k = 10 - a, ku = k >= 5, kl = k % 5;
      subDigit(p + 1, 1, op); // ჯერ ვაკლებ 10-ს (მარცხენა ღეროდან)
      if (tech === 'big') st([ku && { place: p, upper: 1 }, kl && { place: p, lower: kl }].filter(Boolean));
      else { st([{ place: p, upper: 1 }]); st([{ place: p, lower: -(5 - k) }]); }
      d[p] = v + k;
    }
  }

  for (let p = rods - 1; p >= 0; p--) {
    if (!od[p]) continue;
    if (sign > 0) addDigit(p, od[p], null);
    else subDigit(p, od[p], null);
    if (!res.ok) return res;
  }

  const tags = new Set();
  for (const op of res.ops) {
    if (!op.nested) tags.add(op.tech);
    else if (op.tech !== 'direct') tags.add('nested');
  }
  res.tags = [...tags];
  return res;
}

// მინიშნება მართული სავარჯიშოსთვის: რა ფორმულა სჭირდება ამ მოქმედებას
export function hintFor(start, operand, rods = MAX_RODS, nameFn = defaultNamer) {
  const a = analyze(start, operand, rods, nameFn);
  if (!a.ok) return { tech: null, text: 'ეს მოქმედება სორობანზე ვერ შესრულდება.', lines: [] };
  const top = a.ops.filter((o) => !o.nested);
  const special = top.find((o) => o.tech !== 'direct');
  const nested = a.ops.find((o) => o.nested && o.tech !== 'direct');
  const lines = top.map((o) => o.head);
  let text;
  if (!special && !nested) {
    text = 'ეს მოქმედება პირდაპირ კეთდება — საჭირო მძივები თავისუფალია.';
  } else if (special) {
    const k = special.tech === 'small' ? 5 - special.digit : 10 - special.digit;
    let why = '';
    if (special.tech === 'small') {
      why = special.sign > 0
        ? `ქვედა მძივები არ გყოფნის, ზედა კი თავისუფალია. ${special.digit}-ის „პატარა მეგობარი“ ${k}-ია.`
        : `ქვედა მძივები ზოლთან საკმარისი არ არის, ზედა მძივი კი ზოლთანაა. ${special.digit}-ის „პატარა მეგობარი“ ${k}-ია.`;
    } else if (special.tech === 'big') {
      why = special.sign > 0
        ? `ამ ღეროზე ადგილი არ ყოფნის (ჯამი 9-ზე მეტია). ${special.digit}-ის „დიდი მეგობარი“ ${k}-ია.`
        : `ამ ღეროზე ცოტა მძივია — 10-ს ვსესხულობთ მარცხენა ღეროდან. ${special.digit}-ის „დიდი მეგობარი“ ${k}-ია.`;
    } else {
      why = special.sign > 0
        ? `„დიდი მეგობარი“ ${k}-ის გამოკლებას ითხოვს, ეს კი თავად „პატარა მეგობრით“ კეთდება: ${M}${k} = +${5 - k} ${M}5.`
        : `„დიდი მეგობარი“ ${k}-ის მიმატებას ითხოვს, ეს კი თავად „პატარა მეგობრით“ კეთდება: +${k} = +5 ${M}${5 - k}.`;
    }
    text = `${special.head}. ${why}`;
  } else {
    text = '';
  }
  if (nested) {
    const nestedText = `10-ის ${nested.sign > 0 ? 'გადატანისას' : 'სესხებისას'} ${nameFn(nested.place)} ფორმულა გჭირდება: ${nested.formula} (${TECH_SHORT[nested.tech] || ''}).`;
    text = text ? `${text} ${nestedText}` : nestedText;
  }
  return { tech: special ? special.tech : nested ? 'nested' : 'direct', text, lines, analysis: a };
}

// დემონსტრაციის სრული ნაბიჯები: სუფთა სორობანზე start-ის ჩაწერა, შემდეგ ყოველი ოპერანდი
export function demoSteps(start, operands, rods = MAX_RODS, nameFn = defaultNamer) {
  const steps = [];
  const first = analyze(0, start, rods, nameFn);
  if (!first.ok) throw new Error('დემოს საწყისი რიცხვი არასწორია');
  for (const s of first.steps) steps.push({ ...s, head: `ვწერთ ${start}-ს` });
  let total = start;
  const analyses = [];
  for (const op of operands) {
    const a = analyze(total, op, rods, nameFn);
    if (!a.ok) throw new Error(`დემოს მოქმედება ვერ სრულდება: ${total} ${op}`);
    analyses.push(a);
    for (const s of a.steps) steps.push({ ...s, term: op, before: total });
    total = a.result;
  }
  return { steps, result: total, analyses };
}
