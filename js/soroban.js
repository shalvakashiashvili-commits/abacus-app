// სორობანის მოდელი: სუფთა ლოგიკა, DOM-ის გარეშე (Node-ის ტესტებშიც გამოიყენება).
// ღეროების ინდექსი: 0 = ერთეულები (ყველაზე მარჯვენა ღერო), 1 = ათეულები, ...
// თითო ღერო: upper (ზედა მძივი ზოლთანაა თუ არა) + lower (ზოლთან მიწეული ქვედა მძივების რაოდენობა 0–4).

export const MAX_RODS = 13;

export const PLACE_GEN = [
  'ერთეულების', 'ათეულების', 'ასეულების', 'ათასეულების', 'ათიათასეულების',
  'ასიათასეულების', 'მილიონების', 'ათიმილიონების', 'ასიმილიონების',
  'მილიარდების', 'ათიმილიარდების', 'ასიმილიარდების', 'ტრილიონების'
];

export const PLACE_SHORT = [
  'ერთეულები', 'ათეულები', 'ასეულები', 'ათასეულები', 'ათიათასეულები',
  'ასიათასეულები', 'მილიონები', 'ათიმილიონები', 'ასიმილიონები',
  'მილიარდები', 'ათიმილიარდები', 'ასიმილიარდები', 'ტრილიონები'
];

export function placeRodName(p) {
  return `${PLACE_GEN[p] || (p + 1) + '-ე'} ღერო`;
}

// ერთეულის წერტილები: ყოველ მესამე ღეროზე, ერთეულების ღეროდან დაწყებული (0, 3, 6, 9, 12).
export function hasUnitDot(place) {
  return place % 3 === 0;
}

export function toDigits(n, len) {
  const out = [];
  let x = n;
  for (let i = 0; i < len; i++) {
    out.push(x % 10);
    x = Math.floor(x / 10);
  }
  return out;
}

export function formatNumber(n) {
  const s = String(Math.abs(n));
  if (s.length < 4) return (n < 0 ? '−' : '') + s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ' ';
    out += s[i];
  }
  return (n < 0 ? '−' : '') + out;
}

export function formatSigned(n) {
  return (n < 0 ? '− ' : '+ ') + formatNumber(Math.abs(n));
}

export class Soroban {
  constructor(rods = MAX_RODS) {
    if (!Number.isInteger(rods) || rods < 1 || rods > 15) throw new Error('ღეროების რაოდენობა არასწორია');
    this.rods = rods;
    this.upper = new Array(rods).fill(false);
    this.lower = new Array(rods).fill(0);
  }

  clear() {
    this.upper.fill(false);
    this.lower.fill(0);
  }

  getDigit(p) {
    return (this.upper[p] ? 5 : 0) + this.lower[p];
  }

  setDigit(p, d) {
    if (!Number.isInteger(d) || d < 0 || d > 9) throw new Error('ციფრი უნდა იყოს 0–9');
    this.upper[p] = d >= 5;
    this.lower[p] = d % 5;
  }

  get maxValue() {
    return 10 ** this.rods - 1;
  }

  get value() {
    let v = 0;
    for (let p = this.rods - 1; p >= 0; p--) v = v * 10 + this.getDigit(p);
    return v;
  }

  setValue(n) {
    if (!Number.isInteger(n) || n < 0 || n > this.maxValue) throw new Error('რიცხვი სორობანზე არ ეტევა');
    const ds = toDigits(n, this.rods);
    for (let p = 0; p < this.rods; p++) this.setDigit(p, ds[p]);
  }

  digits() {
    const out = [];
    for (let p = 0; p < this.rods; p++) out.push(this.getDigit(p));
    return out;
  }

  // ყველაზე მაღალი არანულოვანი ღეროს ინდექსი (-1, თუ სორობანი სუფთაა)
  highestUsedPlace() {
    for (let p = this.rods - 1; p >= 0; p--) if (this.getDigit(p) !== 0) return p;
    return -1;
  }

  // შეხება ზედა მძივზე: ზოლისკენ ჩამოწევა ან უკან აწევა
  tapUpper(p) {
    this.upper[p] = !this.upper[p];
  }

  // შეხება ქვედა მძივზე. bead: 1 = ზოლთან ყველაზე ახლოს მყოფი, 4 = ყველაზე შორს.
  // ნამდვილი სორობანის ფიზიკა: ზოლთან მიწეულ მძივს რომ ჩამოწევ, მის ქვემოთ მყოფებიც ჩამოყვება;
  // დაშორებულ მძივს რომ აწევ, მის ზემოთ (ზოლისკენ) მყოფებიც აჰყვება.
  tapLower(p, bead) {
    if (!Number.isInteger(bead) || bead < 1 || bead > 4) throw new Error('მძივის ნომერი უნდა იყოს 1–4');
    if (bead <= this.lower[p]) this.lower[p] = bead - 1;
    else this.lower[p] = bead;
  }

  // მკაცრი გადაადგილება (დემონსტრაციებისა და ტესტებისთვის): შეცდომა, თუ ფიზიკურად შეუძლებელია.
  // move: { place, upper: +1|-1 } ან { place, lower: ±k }
  applyMove(move) {
    const p = move.place;
    if (!Number.isInteger(p) || p < 0 || p >= this.rods) throw new Error(`ღერო ${p} არ არსებობს`);
    if (move.upper) {
      if (move.upper === 1 && this.upper[p]) throw new Error(`ზედა მძივი უკვე ზოლთანაა (ღერო ${p})`);
      if (move.upper === -1 && !this.upper[p]) throw new Error(`ზედა მძივი ზოლთან არ არის (ღერო ${p})`);
      this.upper[p] = move.upper === 1;
    }
    if (move.lower) {
      const next = this.lower[p] + move.lower;
      if (next < 0 || next > 4) throw new Error(`ქვედა მძივები არ ყოფნის (ღერო ${p}, ${this.lower[p]} ${move.lower > 0 ? '+' : ''}${move.lower})`);
      this.lower[p] = next;
    }
  }

  snapshot() {
    return { upper: this.upper.slice(), lower: this.lower.slice() };
  }

  restore(s) {
    this.upper = s.upper.slice();
    this.lower = s.lower.slice();
  }
}
