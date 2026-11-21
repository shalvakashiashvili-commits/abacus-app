// გამრავლება და გაყოფა იაპონური თანამედროვე მეთოდით (片落とし, kata-otoshi) + ათწილადების დამხმარეები.
//
// გამრავლება (片落とし): სორობანზე იწერება მხოლოდ პირველი თანამამრავლი (掛けられる数), მისი ერთეულები
//   წერტილიან ღეროზე (定位点). მეორე თანამამრავლი (掛ける数) სორობანზე არ იწერება.
//   ვიწყებთ პირველი თანამამრავლის ყველაზე მარჯვენა ციფრიდან: ვხსნით მას და მის ადგილას ვამატებთ
//   ორნიშნა ნამრავლებს (მაგ. 2×4 = 08): ათეულები — იმავე ღეროზე, ერთეულები — მარჯვნივ;
//   ყოველი შემდეგი ნამრავლი ერთი ღეროთი მარჯვნივ იწყება.
//   ერთეულის წესი: პასუხის ერთეულები = წერტილიდან მარჯვნივ იმდენი ღეროთი, რამდენი ციფრიცაა მეორე თანამამრავლში.
//
// გაყოფა (片落とし): სორობანზე იწერება მხოლოდ გასაყოფი, მისი ერთეულები წერტილიან ღეროზე.
//   განაყოფის ციფრი: თუ გამყოფი ≤ გასაყოფის იმდენივე პირველ ციფრზე („იყოფა“) — 2 ღეროთი მარცხნივ
//   (შუაში ერთი ცარიელი), თუ არა („არ იყოფა“) — მეზობელ ღეროზე მარცხნივ. ნამრავლს (ციფრი × გამყოფი)
//   ვაკლებთ განაყოფის ციფრის მარჯვენა ღეროდან დაწყებული.
//   ერთეულის წესი: განაყოფის ერთეულები = წერტილიდან მარცხნივ (გამყოფის ციფრების რაოდენობა + 1) ღეროთი.
//
// ყოველი ნაბიჯი = ერთი მიმატება/გამოკლება სორობანზე, რომლის მძივების მოძრაობებს analyze() იძლევა.

import { analyze } from './techniques.js';

const boardNamer = (p) => `მარჯვნიდან ${p + 1}-ე ღეროზე`;
import { MAX_RODS, PLACE_GEN, formatNumber } from './soroban.js';

export function nDigits(n) {
  return String(Math.abs(n)).length;
}

export function digitAt(n, i) {
  return Math.floor(n / 10 ** i) % 10;
}

function pad2(x) {
  return x < 10 ? `0${x}` : String(x);
}

// ღეროს აღწერა: 0 = ყველაზე მარჯვენა
export function rodLabel(p) {
  return `მარჯვნიდან ${p + 1}-ე ღერო`;
}

// ---------- ათწილადები ----------
// მასშტაბირებული მთელი რიცხვი (value × 10^dec) → „12,5“ (ქართულად ათწილადის გამყოფი მძიმეა)
export function fmtScaled(x, dec = 0) {
  if (!dec) return formatNumber(x);
  const neg = x < 0;
  const ax = Math.abs(x);
  const ip = Math.floor(ax / 10 ** dec);
  let fp = String(ax % 10 ** dec).padStart(dec, '0').replace(/0+$/, '');
  return (neg ? '−' : '') + formatNumber(ip) + (fp ? ',' + fp : '');
}

// „12,5“ ან „12.5“ → მასშტაბირებული მთელი (dec ნიშნამდე); null, თუ არასწორია
export function parseScaled(text, dec = 0) {
  const t = String(text).trim().replace(/\s| /g, '').replace('.', ',');
  if (!/^\d+(,\d*)?$/.test(t)) return null;
  const [ip, fp = ''] = t.split(',');
  if (fp.length > dec) {
    if (/[1-9]/.test(fp.slice(dec))) return null;
  }
  const frac = (fp + '0'.repeat(dec)).slice(0, dec);
  return Number(ip) * 10 ** dec + (dec ? Number(frac || 0) : 0);
}

// ---------- პროგრამა: ნაბიჯების სია ----------
function makeProgram() {
  return { steps: [], board: 0 };
}

function push(prog, delta, step) {
  const before = prog.board;
  const a = analyze(before, delta, MAX_RODS, boardNamer);
  if (!a.ok) throw new Error(`ნაბიჯი ვერ სრულდება: ${before} ${delta >= 0 ? '+' : ''}${delta} (${a.error})`);
  prog.steps.push({ ...step, delta, before, after: a.result, micro: a.steps });
  prog.board = a.result;
}

// ---------- გამრავლება ----------
// a, b — მთელი რიცხვები (ათწილადისთვის მასშტაბირებული: aDec / bDec ნიშანი მძიმის შემდეგ).
// place — ღერო (定位点), რომელზეც პირველი თანამამრავლის ერთეულები იწერება.
export function mulProgram({ a, b, place = 3, aDec = 0, bDec = 0 }) {
  if (!(a > 0 && b > 0)) throw new Error('თანამამრავლები დადებითი უნდა იყოს');
  const n = nDigits(b);
  const aLow = place - aDec;              // პირველი თანამამრავლის ბოლო ციფრის ღერო
  const unit = place - (n - bDec);        // პასუხის ერთეულების ღერო
  const lowest = aLow - n;                // პასუხის ბოლო ციფრის ღერო
  const top = aLow + nDigits(a) - 1;
  if (lowest < 0 || top >= MAX_RODS) throw new Error('რიცხვები სორობანზე არ ეტევა');
  const prog = makeProgram();
  const aShow = fmtScaled(a, aDec);
  const bShow = fmtScaled(b, bDec);
  push(prog, a * 10 ** aLow, {
    type: 'place',
    instr: `ჩაწერე ${aShow} ისე, რომ ერთეულები ▼ ღეროზე იყოს`,
    hint: `${aShow}: ერთეულების ციფრი ▼ ღეროზე (${rodLabel(place)}), დანარჩენი ციფრები — მარცხნივ.`,
    rods: [place]
  });
  const la = nDigits(a);
  for (let i = 0; i < la; i++) {
    const r = aLow + i;
    const d = digitAt(a, i);
    if (d === 0) continue;
    push(prog, -d * 10 ** r, {
      type: 'clear',
      instr: `მოხსენი ${d} (${rodLabel(r)}) — დაიმახსოვრე`,
      hint: `${d}-ს ვამრავლებთ ${bShow}-ზე. ჯერ ${d}-ს ვხსნით სორობანიდან და ვიმახსოვრებთ: მის ადგილას ნამრავლი ჩაიწერება.`,
      rods: [r]
    });
    for (let j = n - 1; j >= 0; j--) {
      const bj = digitAt(b, j);
      const prod = d * bj;
      const unitsRod = r - n + j;
      if (prod === 0) continue;
      push(prog, prod * 10 ** unitsRod, {
        type: 'product',
        instr: `დაუმატე ${d} × ${bj} = ${pad2(prod)}`,
        hint: `${d} × ${bj} = ${pad2(prod)}: ათეულები (${Math.floor(prod / 10)}) — ${rodLabel(unitsRod + 1)}, ერთეულები (${prod % 10}) — ${rodLabel(unitsRod)}.`,
        rods: [unitsRod + 1, unitsRod]
      });
    }
  }
  return { ...prog, kind: 'mul', place, unit, lowest, n, answerBoard: prog.board };
}

// ---------- გაყოფა ----------
// a — გასაყოფი (aDec ნიშანი მძიმის შემდეგ), b — მთელი გამყოფი; place — გასაყოფის ერთეულების ღერო (定位点).
// decimals — რამდენი ციფრი გავაგრძელოთ მძიმის შემდეგ (0 = მთელი განაყოფი + ნაშთი).
// estimate: 'exact' — ყოველთვის სწორი ციფრი (დონეები 7ა–8ბ);
//           'trial' — 修正 (還元/割り戻し): საცდელი ციფრი მხოლოდ გამყოფის პირველი ციფრით (შეიძლება დიდი იყოს);
//           როცა ნამრავლის გამოკლება ვერ ხერხდება, ციფრს ერთით ვამცირებთ და ზედმეტად გამოკლებულს ვაბრუნებთ.
export function divProgram({ a, b, place = 0, aDec = 0, decimals = 0, estimate = 'exact' }) {
  if (!(a > 0 && b > 0) || !Number.isInteger(b)) throw new Error('გასაყოფი და გამყოფი დადებითი უნდა იყოს');
  const n = nDigits(b);
  const aLow = place - aDec;
  const unit = place + n + 1;
  const stopRod = unit - decimals;
  if (aLow < 0) throw new Error('გასაყოფი სორობანზე არ ეტევა');
  const prog = makeProgram();
  const aShow = fmtScaled(a, aDec);
  push(prog, a * 10 ** aLow, {
    type: 'place',
    instr: `ჩაწერე ${aShow} ისე, რომ ერთეულები ▼ ღეროზე იყოს`,
    hint: `${aShow}: ერთეულების ციფრი ▼ ღეროზე (${rodLabel(place)}), დანარჩენი ციფრები — მარცხნივ. გამყოფს (${b}) სორობანზე არ ვწერთ.`,
    rods: [place]
  });
  let qPart = 0;
  const qDigits = [];
  for (let guard = 0; guard < 40; guard++) {
    const rem = prog.board - qPart;
    if (rem === 0) break;
    const h = nDigits(rem) - 1;
    const chunkAt = (len) => {
      const low = h - len + 1;
      return low >= 0 ? Math.floor(rem / 10 ** low) : rem * 10 ** -low;
    };
    const chunkN = chunkAt(n);
    let qRod, q, divides;
    if (chunkN >= b) { divides = true; qRod = h + 2; q = Math.floor(chunkN / b); }
    else { divides = false; qRod = h + 1; q = Math.floor(chunkAt(n + 1) / b); }
    if (qRod < stopRod || qRod - n - 1 < 0) break;
    if (qRod >= MAX_RODS) throw new Error('განაყოფი სორობანზე არ ეტევა');
    const cmp = divides
      ? `${chunkN} ≥ ${b} — იყოფა, ამიტომ ციფრს 2 ღეროთი მარცხნივ ვწერთ (შუაში ერთი ცარიელი ღეროა)`
      : `${chunkN} < ${b} — არ იყოფა, ამიტომ ვიღებთ ერთ ციფრს მეტს (${chunkAt(n + 1)}) და ციფრს მეზობელ ღეროზე ვწერთ`;
    const chunkUsed = divides ? chunkN : chunkAt(n + 1);
    const b1 = digitAt(b, n - 1);
    const chunkTop = Math.floor(chunkUsed / 10 ** (n - 1));
    const trial = estimate === 'trial' && n >= 2 ? Math.min(9, Math.floor(chunkTop / b1)) : q;
    if (trial < q) throw new Error('საცდელი ციფრი სწორზე ნაკლები ვერ იქნება');
    push(prog, trial * 10 ** qRod, {
      type: 'quotient',
      instr: trial === q && estimate !== 'trial' ? `ჩაწერე განაყოფის ციფრი ${q}` : `ჩაწერე საცდელი ციფრი ${trial}`,
      hint: estimate === 'trial' && n >= 2
        ? `${cmp}. შეფასება მხოლოდ გამყოფის პირველი ციფრით: ${chunkTop} : ${b1} → ${trial}${Math.floor(chunkTop / b1) > 9 ? ' (მაქსიმუმ 9)' : ''}. ${rodLabel(qRod)}.`
        : `${cmp}. ${q} — ყველაზე დიდი ციფრი, რომლის ნამრავლი ${b}-ზე არ აღემატება ${chunkUsed}-ს. ${rodLabel(qRod)}.`,
      rods: [qRod], divides, q: trial, qRod
    });
    let cur = trial;
    let corrections = 0;
    const done = [];
    for (let j = n - 1; j >= 0; j--) {
      const bj = digitAt(b, j);
      const unitsRod = qRod - n - 1 + j;
      for (;;) {
        const prod = cur * bj;
        const remNow = prog.board - qPart - cur * 10 ** qRod;
        if (prod * 10 ** unitsRod <= remNow) {
          if (prod) {
            push(prog, -prod * 10 ** unitsRod, {
              type: 'subtract',
              instr: `გამოაკელი ${cur} × ${bj} = ${pad2(prod)}`,
              hint: `${cur} × ${bj} = ${pad2(prod)}: ათეულები — ${rodLabel(unitsRod + 1)}, ერთეულები — ${rodLabel(unitsRod)}. (ნამრავლს განაყოფის ციფრის მარჯვენა ღეროდან ვაკლებთ.)`,
              rods: [unitsRod + 1, unitsRod]
            });
          }
          done.push({ bj, unitsRod });
          break;
        }
        // 還元: ციფრი დიდია — ვამცირებთ და ვაბრუნებთ ზედმეტად გამოკლებულს
        corrections += 1;
        push(prog, -1 * 10 ** qRod, {
          type: 'correct',
          instr: `${cur} × ${bj} აღარ აკლდება → შეამცირე ციფრი: ${cur} → ${cur - 1}`,
          hint: `${pad2(prod)}-ის გამოკლება ვერ ხერხდება — საცდელი ციფრი დიდია. განაყოფის ღეროზე (${rodLabel(qRod)}) 1-ს ვაკლებთ.`,
          rods: [qRod], q: cur - 1, qRod
        });
        for (const d of done) {
          if (!d.bj) continue;
          push(prog, d.bj * 10 ** d.unitsRod, {
            type: 'giveback',
            instr: `დააბრუნე ზედმეტად გამოკლებული 1 × ${d.bj} = ${pad2(d.bj)}`,
            hint: `ციფრი 1-ით შევამცირეთ, ამიტომ ადრე 1 × ${d.bj} ზედმეტად გამოვაკელით. ვაბრუნებთ: ${rodLabel(d.unitsRod + 1)} / ${rodLabel(d.unitsRod)}.`,
            rods: [d.unitsRod + 1, d.unitsRod]
          });
        }
        cur -= 1;
      }
    }
    if (cur !== q) throw new Error(`修正-ის შემდეგ ციფრი ${cur} ≠ ${q}`);
    qDigits.push({ q, qRod, divides, trial, corrections });
    qPart += q * 10 ** qRod;
  }
  const remBoard = prog.board - qPart;
  return {
    ...prog, kind: 'div', place, unit, n, stopRod,
    qBoard: qPart, remBoard, qDigits, answerBoard: prog.board
  };
}

// პროგრამის შედეგი ადამიანისთვის
export function describeResult(p) {
  if (p.kind === 'mul') return fmtScaled(p.answer, p.ansDec || 0);
  if (p.kind === 'div') {
    const q = fmtScaled(p.q, p.qDec || 0);
    return p.r ? `${q}, ნაშთი ${formatNumber(p.r)}` : q;
  }
  return '';
}

// ამოცანიდან (generator.js-ის ფორმატი) პროგრამის აგება
export function programFor(p) {
  if (p.kind === 'mul') return mulProgram({ a: p.a, b: p.b, place: p.place, aDec: p.aDec || 0, bDec: p.bDec || 0 });
  if (p.kind === 'div') return divProgram({ a: p.a, b: p.b, place: p.place, aDec: p.aDec || 0, decimals: p.qDec || 0, estimate: p.fix ? 'trial' : 'exact' });
  throw new Error('პროგრამა მხოლოდ გამრავლება/გაყოფისთვისაა');
}

export { PLACE_GEN };
