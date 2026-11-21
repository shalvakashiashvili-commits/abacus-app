// ყველა დონის კონფიგურაცია ერთ ადგილას. ახალი დონის დასამატებლად: built: true,
// allowed (ნასწავლი ფორმულები), focus (დონის მთავარი ფორმულა), guided / tasks / test და გაკვეთილი lessons.js-ში.
//
// სავარჯიშოს სპეციფიკაცია:
//   kind: 'read' | 'set' | 'calc' | 'column'
//   n: რამდენი მაგალითი
//   read/set: minDigits, maxDigits
//   calc/column: digits (ოპერანდის ნიშნები), firstDigits (პირველი რიცხვის ნიშნები), terms (რიცხვების რაოდენობა),
//                ops: 'add' | 'sub' | 'both', focus: false — თუ მაგალითს დონის ახალი ფორმულა არ სჭირდება
//                minDigits (ოპერანდის მინ. ნიშნები), subRate (გამოკლების წილი, დონეებზე, სადაც ყველა ფორმულა ნასწავლია)
//   table: rows (პირველი თანამამრავლები), from/to (მეორე თანამამრავლი)
//   mul: aDigits [min,max], bDigits, aDec/bDec (ციფრები მძიმის შემდეგ), place (定位点 — პირველი თანამამრავლის ერთეულები)
//   div: bDigits, qDigits [min,max], rem (ნაშთით), qDec (განაყოფის ათწილადი ნიშნები), place (定位点 — გასაყოფის ერთეულები)
//   read/set/calc/column + unit: ათწილადები (unit — ერთეულების ღერო; რიცხვები მასშტაბირებულია 10^unit-ზე), dec — მაქს. ციფრები მძიმის შემდეგ
//
// ქვედონეების id სტრიქონია ('5a'), label — ეკრანზე ჩვენება ('5ა'). გახსნის რიგი = მასივის რიგი.

export const STAGE = 2;
export const ALL_TECHS = ['direct', 'small', 'big', 'mixed', 'nested'];
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
  {
    id: '5a', label: '5ა',
    built: true,
    title: 'სვეტები: 3–5 რიცხვი',
    subtitle: 'ორნიშნა და სამნიშნა რიცხვების სვეტები, თვლის რიტმი',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'calc', minDigits: 2, digits: 2, terms: 3, ops: 'both', n: 3 },
      { kind: 'calc', minDigits: 2, digits: 3, terms: 4, ops: 'both', n: 3 },
      { kind: 'calc', minDigits: 3, digits: 3, terms: 5, ops: 'both', n: 2 },
      { kind: 'column', minDigits: 2, digits: 2, terms: 3, ops: 'both', n: 2 }
    ],
    tasks: [
      { kind: 'calc', minDigits: 2, digits: 2, terms: 4, ops: 'both', n: 3 },
      { kind: 'calc', minDigits: 3, digits: 3, terms: 4, ops: 'both', n: 3 },
      { kind: 'column', minDigits: 2, digits: 2, terms: 4, ops: 'both', n: 2 },
      { kind: 'calc', minDigits: 3, digits: 3, terms: 5, ops: 'both', n: 2 }
    ],
    test: {
      items: [
        { kind: 'calc', minDigits: 2, digits: 2, terms: 4, ops: 'both', n: 6 },
        { kind: 'calc', minDigits: 3, digits: 3, terms: 4, ops: 'both', n: 7 },
        { kind: 'calc', minDigits: 2, digits: 3, terms: 5, ops: 'both', n: 7 }
      ],
      maxAvgSec: 30
    }
  },
  {
    id: '5b', label: '5ბ',
    built: true,
    title: 'გრძელი სვეტები: 6–10 რიცხვი',
    subtitle: '2–4-ნიშნა რიცხვები, სიჩქარე',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'calc', minDigits: 2, digits: 2, terms: 6, ops: 'both', n: 2 },
      { kind: 'calc', minDigits: 2, digits: 3, terms: 6, ops: 'both', n: 2 },
      { kind: 'calc', minDigits: 3, digits: 3, terms: 8, ops: 'both', n: 2 },
      { kind: 'column', minDigits: 2, digits: 2, terms: 6, ops: 'both', n: 2 }
    ],
    tasks: [
      { kind: 'calc', minDigits: 3, digits: 3, terms: 6, ops: 'both', n: 3 },
      { kind: 'calc', minDigits: 3, digits: 4, terms: 8, ops: 'both', n: 3 },
      { kind: 'column', minDigits: 2, digits: 3, terms: 6, ops: 'both', n: 2 },
      { kind: 'calc', minDigits: 3, digits: 4, terms: 10, ops: 'both', n: 2 }
    ],
    test: {
      items: [
        { kind: 'calc', minDigits: 2, digits: 3, terms: 6, ops: 'both', n: 10 },
        { kind: 'calc', minDigits: 3, digits: 3, terms: 8, ops: 'both', n: 7 },
        { kind: 'calc', minDigits: 3, digits: 4, terms: 10, ops: 'both', n: 3 }
      ],
      maxAvgSec: 60
    }
  },
  {
    id: '6a', label: '6ა',
    built: true,
    title: 'გამრავლების ტაბულა',
    subtitle: 'ტაბულის შემოწმება: 2×2-დან 9×9-მდე',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'table', rows: [2, 3, 4, 5], from: 2, to: 9, n: 8 },
      { kind: 'table', rows: [6, 7, 8, 9], from: 2, to: 9, n: 8 }
    ],
    tasks: [
      { kind: 'table', rows: [2, 3, 4, 5, 6, 7, 8, 9], from: 2, to: 9, n: 20 }
    ],
    test: {
      items: [{ kind: 'table', rows: [2, 3, 4, 5, 6, 7, 8, 9], from: 2, to: 9, n: 20 }],
      maxAvgSec: 5
    }
  },
  {
    id: '6b', label: '6ბ',
    built: true,
    title: 'გამრავლება ერთნიშნაზე',
    subtitle: 'განლაგება, ერთეულის წესი (teii), 2–3-ნიშნა × 1-ნიშნა',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'mul', aDigits: [2, 2], bDigits: 1, place: 3, n: 3 },
      { kind: 'mul', aDigits: [3, 3], bDigits: 1, place: 3, n: 3 }
    ],
    tasks: [
      { kind: 'mul', aDigits: [2, 2], bDigits: 1, place: 3, n: 5 },
      { kind: 'mul', aDigits: [3, 3], bDigits: 1, place: 3, n: 5 }
    ],
    test: {
      items: [
        { kind: 'mul', aDigits: [2, 2], bDigits: 1, place: 3, n: 10 },
        { kind: 'mul', aDigits: [3, 3], bDigits: 1, place: 3, n: 10 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: '6c', label: '6გ',
    built: true,
    title: 'გამრავლება ორნიშნაზე',
    subtitle: '2–3-ნიშნა × 2-ნიშნა',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'mul', aDigits: [2, 2], bDigits: 2, place: 3, n: 3 },
      { kind: 'mul', aDigits: [3, 3], bDigits: 2, place: 3, n: 2 }
    ],
    tasks: [
      { kind: 'mul', aDigits: [2, 2], bDigits: 2, place: 3, n: 5 },
      { kind: 'mul', aDigits: [3, 3], bDigits: 2, place: 3, n: 5 }
    ],
    test: {
      items: [
        { kind: 'mul', aDigits: [2, 2], bDigits: 2, place: 3, n: 12 },
        { kind: 'mul', aDigits: [3, 3], bDigits: 2, place: 3, n: 8 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: '7a', label: '7ა',
    built: true,
    title: 'გაყოფა ერთნიშნაზე',
    subtitle: 'განლაგება, ერთეულის წესი, ნაშთის გარეშე',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'div', bDigits: 1, qDigits: [1, 1], place: 0, n: 2 },
      { kind: 'div', bDigits: 1, qDigits: [2, 2], place: 0, n: 3 },
      { kind: 'div', bDigits: 1, qDigits: [3, 3], place: 0, n: 2 }
    ],
    tasks: [
      { kind: 'div', bDigits: 1, qDigits: [2, 2], place: 0, n: 5 },
      { kind: 'div', bDigits: 1, qDigits: [3, 3], place: 0, n: 5 }
    ],
    test: {
      items: [
        { kind: 'div', bDigits: 1, qDigits: [2, 2], place: 0, n: 10 },
        { kind: 'div', bDigits: 1, qDigits: [3, 3], place: 0, n: 10 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: '7b', label: '7ბ',
    built: true,
    title: 'გაყოფა ორნიშნაზე',
    subtitle: 'ორნიშნა გამყოფი, განაყოფის ციფრის შერჩევა',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'div', bDigits: 2, qDigits: [1, 1], place: 0, n: 3 },
      { kind: 'div', bDigits: 2, qDigits: [2, 2], place: 0, n: 3 }
    ],
    tasks: [
      { kind: 'div', bDigits: 2, qDigits: [1, 1], place: 0, n: 4 },
      { kind: 'div', bDigits: 2, qDigits: [2, 2], place: 0, n: 6 }
    ],
    test: {
      items: [
        { kind: 'div', bDigits: 2, qDigits: [1, 1], place: 0, n: 8 },
        { kind: 'div', bDigits: 2, qDigits: [2, 2], place: 0, n: 12 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: '7c', label: '7გ',
    built: true,
    title: 'გაყოფა ნაშთით',
    subtitle: 'სად იკითხება განაყოფი და ნაშთი',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'div', bDigits: 1, qDigits: [1, 2], rem: true, place: 0, n: 3 },
      { kind: 'div', bDigits: 2, qDigits: [1, 1], rem: true, place: 0, n: 3 }
    ],
    tasks: [
      { kind: 'div', bDigits: 1, qDigits: [2, 3], rem: true, place: 0, n: 5 },
      { kind: 'div', bDigits: 2, qDigits: [1, 2], rem: true, place: 0, n: 5 }
    ],
    test: {
      items: [
        { kind: 'div', bDigits: 1, qDigits: [2, 3], rem: true, place: 0, n: 10 },
        { kind: 'div', bDigits: 2, qDigits: [1, 2], rem: true, place: 0, n: 10 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: '8a', label: '8ა',
    built: true,
    title: 'ათწილადები: ჩაწერა, მიმატება, გამოკლება',
    subtitle: 'ერთეულის ღეროს არჩევა, მძიმე სორობანზე',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'read', unit: 3, minDigits: 1, maxDigits: 2, dec: 2, n: 2 },
      { kind: 'set', unit: 3, minDigits: 1, maxDigits: 2, dec: 2, n: 2 },
      { kind: 'calc', unit: 3, digits: 1, dec: 1, terms: 2, ops: 'both', n: 3 },
      { kind: 'calc', unit: 3, digits: 2, dec: 2, terms: 3, ops: 'both', n: 3 }
    ],
    tasks: [
      { kind: 'read', unit: 3, minDigits: 1, maxDigits: 2, dec: 3, n: 2 },
      { kind: 'set', unit: 3, minDigits: 1, maxDigits: 2, dec: 3, n: 2 },
      { kind: 'calc', unit: 3, digits: 2, dec: 2, terms: 3, ops: 'both', n: 4 },
      { kind: 'column', unit: 3, digits: 2, dec: 2, terms: 3, ops: 'both', n: 2 }
    ],
    test: {
      items: [
        { kind: 'read', unit: 3, minDigits: 1, maxDigits: 2, dec: 3, n: 4 },
        { kind: 'set', unit: 3, minDigits: 1, maxDigits: 2, dec: 3, n: 4 },
        { kind: 'calc', unit: 3, digits: 2, dec: 2, terms: 3, ops: 'both', n: 12 }
      ],
      maxAvgSec: null
    }
  },
  {
    id: '8b', label: '8ბ',
    built: true,
    title: 'ათწილადები: გამრავლება და გაყოფა',
    subtitle: 'მძიმის ადგილი გამრავლებისა და გაყოფისას',
    allowed: ALL_TECHS,
    focus: [],
    guided: [
      { kind: 'mul', aDigits: [2, 2], aDec: 1, bDigits: 1, place: 3, n: 3 },
      { kind: 'mul', aDigits: [2, 2], bDigits: 1, bDec: 1, place: 3, n: 2 },
      { kind: 'div', bDigits: 1, qDigits: [2, 2], qDec: 1, place: 3, n: 3 }
    ],
    tasks: [
      { kind: 'mul', aDigits: [2, 3], aDec: 1, bDigits: 1, place: 3, n: 3 },
      { kind: 'mul', aDigits: [2, 3], aDec: 2, bDigits: 1, place: 3, n: 2 },
      { kind: 'mul', aDigits: [2, 2], bDigits: 1, bDec: 1, place: 3, n: 2 },
      { kind: 'div', bDigits: 1, qDigits: [2, 3], qDec: 2, place: 3, n: 3 }
    ],
    test: {
      items: [
        { kind: 'mul', aDigits: [2, 3], aDec: 1, bDigits: 1, place: 3, n: 6 },
        { kind: 'mul', aDigits: [2, 3], aDec: 2, bDigits: 1, place: 3, n: 4 },
        { kind: 'mul', aDigits: [2, 2], bDigits: 1, bDec: 1, place: 3, n: 3 },
        { kind: 'div', bDigits: 1, qDigits: [2, 3], qDec: 1, place: 3, n: 3 },
        { kind: 'div', bDigits: 1, qDigits: [2, 3], qDec: 2, place: 3, n: 4 }
      ],
      maxAvgSec: null
    }
  },
  { id: 9, built: false, title: 'წარმოსახვითი ანგარიში (anzan)', subtitle: 'ანძანი: ანგარიში გონებაში, ფიზიკური სორობანის გარეშე' },
  { id: 10, built: false, title: 'სწრაფი ანძანი (flash anzan)', subtitle: 'სიჩქარე და საგამოცდო რეჟიმი' }
];

export function getLevel(id) {
  if (id === null || id === undefined) return null;
  return LEVELS.find((l) => String(l.id) === String(id)) || null;
}

export function levelLabel(lvl) {
  return lvl ? String(lvl.label ?? lvl.id) : '';
}

export function levelIndex(id) {
  return LEVELS.findIndex((l) => String(l.id) === String(id));
}

// წინა აწყობილი დონე (null — პირველი დონისთვის)
export function prevBuilt(id) {
  for (let i = levelIndex(id) - 1; i >= 0; i--) if (LEVELS[i].built) return LEVELS[i];
  return null;
}

export function nextLevel(id) {
  const i = levelIndex(id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null;
}

export function builtLevels() {
  return LEVELS.filter((l) => l.built);
}

export function testSize(level) {
  return (level.test?.items || []).reduce((s, it) => s + (it.n || 1), 0);
}
