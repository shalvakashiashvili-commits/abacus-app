// ყველა დონის კონფიგურაცია ერთ ადგილას. ახალი დონის დასამატებლად: built: true,
// allowed (ნასწავლი ფორმულები), focus (დონის მთავარი ფორმულა), guided / tasks / test და გაკვეთილი lessons.js-ში.
//
// სავარჯიშოს სპეციფიკაცია:
//   kind: 'read' | 'set' | 'calc' | 'column'
//   n: რამდენი მაგალითი
//   read/set: minDigits, maxDigits
//   calc/column: digits (ოპერანდის ნიშნები), firstDigits (პირველი რიცხვის ნიშნები), terms (რიცხვების რაოდენობა),
//                ops: 'add' | 'sub' | 'both', focus: false — თუ მაგალითს დონის ახალი ფორმულა არ სჭირდება

export const STAGE = 1;
export const TEST_SIZE = 20;
export const PASS_ACCURACY = 0.9;

export const LEVELS = [
  {
    id: 0,
    built: true,
    title: 'რა არის სორობანი',
    subtitle: 'აგებულება, თითების ტექნიკა, რიცხვების ჩაწერა და წაკითხვა',
    allowed: [],
    focus: [],
    guided: [
      { kind: 'read', minDigits: 1, maxDigits: 1, n: 3 },
      { kind: 'set', minDigits: 1, maxDigits: 1, n: 3 },
      { kind: 'read', minDigits: 2, maxDigits: 2, n: 2 },
      { kind: 'set', minDigits: 2, maxDigits: 2, n: 2 },
      { kind: 'read', minDigits: 3, maxDigits: 4, n: 2 },
      { kind: 'set', minDigits: 3, maxDigits: 4, n: 2 }
    ],
    tasks: [
      { kind: 'read', minDigits: 1, maxDigits: 2, n: 3 },
      { kind: 'set', minDigits: 1, maxDigits: 2, n: 3 },
      { kind: 'read', minDigits: 2, maxDigits: 4, n: 2 },
      { kind: 'set', minDigits: 2, maxDigits: 4, n: 2 }
    ],
    test: {
      items: [
        { kind: 'read', minDigits: 1, maxDigits: 1, n: 4 },
        { kind: 'set', minDigits: 1, maxDigits: 1, n: 4 },
        { kind: 'read', minDigits: 2, maxDigits: 4, n: 6 },
        { kind: 'set', minDigits: 2, maxDigits: 4, n: 6 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: 1,
    built: true,
    title: 'პირდაპირი მიმატება და გამოკლება',
    subtitle: 'მძივების პირდაპირი მიწევა და მოშორება, ფორმულების გარეშე',
    allowed: ['direct'],
    focus: [],
    guided: [
      { kind: 'calc', digits: 1, terms: 2, ops: 'add', n: 3 },
      { kind: 'calc', digits: 1, terms: 2, ops: 'sub', n: 3 },
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 2 }
    ],
    tasks: [
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 3 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 3 },
      { kind: 'column', digits: 1, terms: 4, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 3, ops: 'both', n: 1 },
      { kind: 'column', digits: 2, terms: 3, ops: 'both', n: 1 }
    ],
    test: {
      items: [
        { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 8 },
        { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 6 },
        { kind: 'column', digits: 1, terms: 4, ops: 'both', n: 4 },
        { kind: 'column', digits: 2, terms: 3, ops: 'both', n: 2 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: 2,
    built: true,
    title: '„პატარა მეგობრები“',
    subtitle: 'ფორმულები 5-ით: მიმატება და გამოკლება',
    allowed: ['direct', 'small'],
    focus: ['small'],
    guided: [
      { kind: 'calc', digits: 1, terms: 2, ops: 'add', n: 3 },
      { kind: 'calc', digits: 1, terms: 2, ops: 'sub', n: 3 },
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 2 }
    ],
    tasks: [
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 3 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 3 },
      { kind: 'column', digits: 1, terms: 4, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 3, ops: 'both', n: 1 },
      { kind: 'column', digits: 2, terms: 3, ops: 'both', n: 1 }
    ],
    test: {
      items: [
        { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 8 },
        { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 6 },
        { kind: 'column', digits: 1, terms: 4, ops: 'both', n: 4 },
        { kind: 'column', digits: 2, terms: 3, ops: 'both', n: 2 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: 3,
    built: true,
    title: '„დიდი მეგობრები“',
    subtitle: 'ფორმულები 10-ით: მიმატება და გამოკლება',
    allowed: ['direct', 'small', 'big'],
    focus: ['big'],
    extraDigit: true,
    guided: [
      { kind: 'calc', digits: 1, terms: 2, ops: 'add', n: 3 },
      { kind: 'calc', digits: 1, firstDigits: 2, terms: 2, ops: 'sub', n: 3 },
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 2 }
    ],
    tasks: [
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 3 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 3 },
      { kind: 'column', digits: 1, terms: 4, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 3, ops: 'both', n: 1 },
      { kind: 'column', digits: 2, terms: 3, ops: 'both', n: 1 }
    ],
    test: {
      items: [
        { kind: 'calc', digits: 1, terms: 2, ops: 'add', n: 5 },
        { kind: 'calc', digits: 1, firstDigits: 2, terms: 2, ops: 'sub', n: 5 },
        { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 5 },
        { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 5 }
      ],
      maxAvgSec: 10
    }
  },
  {
    id: 4,
    built: true,
    title: 'შერეული ფორმულები',
    subtitle: '5-ის და 10-ის ფორმულები ერთად',
    allowed: ['direct', 'small', 'big', 'mixed', 'nested'],
    focus: ['mixed', 'nested'],
    extraDigit: true,
    guided: [
      { kind: 'calc', digits: 1, terms: 2, ops: 'add', n: 3 },
      { kind: 'calc', digits: 1, firstDigits: 2, terms: 2, ops: 'sub', n: 3 },
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 2 }
    ],
    tasks: [
      { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 3 },
      { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 3 },
      { kind: 'column', digits: 1, terms: 4, ops: 'both', n: 2 },
      { kind: 'calc', digits: 2, terms: 3, ops: 'both', n: 1 },
      { kind: 'column', digits: 2, terms: 3, ops: 'both', n: 1 }
    ],
    test: {
      items: [
        { kind: 'calc', digits: 1, terms: 2, ops: 'add', n: 5 },
        { kind: 'calc', digits: 1, firstDigits: 2, terms: 2, ops: 'sub', n: 5 },
        { kind: 'calc', digits: 1, terms: 3, ops: 'both', n: 5 },
        { kind: 'calc', digits: 2, terms: 2, ops: 'both', n: 5 }
      ],
      maxAvgSec: 10
    }
  },
  { id: 5, built: false, title: 'მრავალნიშნა რიცხვების სვეტები', subtitle: '3–10 რიცხვის ჯამი ზედიზედ' },
  { id: 6, built: false, title: 'გამრავლება', subtitle: 'გამრავლების ტაბულა და მრავალნიშნა გამრავლება სორობანზე' },
  { id: 7, built: false, title: 'გაყოფა', subtitle: 'გაყოფა სორობანზე' },
  { id: 8, built: false, title: 'ათწილადები', subtitle: 'ერთეულის წერტილი და ათწილადები' },
  { id: 9, built: false, title: 'წარმოსახვითი ანგარიში (anzan)', subtitle: 'ანძანი: ანგარიში გონებაში, ფიზიკური სორობანის გარეშე' },
  { id: 10, built: false, title: 'სწრაფი ანძანი (flash anzan)', subtitle: 'სიჩქარე და საგამოცდო რეჟიმი' }
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === Number(id)) || null;
}

export function builtLevels() {
  return LEVELS.filter((l) => l.built);
}

export function testSize(level) {
  return (level.test?.items || []).reduce((s, it) => s + (it.n || 1), 0);
}
