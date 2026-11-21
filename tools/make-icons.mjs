// ხატულების გენერატორი: მარტივი სორობანის გამოსახულება PNG-ად, გარე ბიბლიოთეკების გარეშე.
// გაშვება:  node tools/make-icons.mjs
// ქმნის: icons/icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'icons');
mkdirSync(outDir, { recursive: true });

const COLORS = {
  bg: [46, 110, 98],
  wood: [109, 69, 39],
  inner: [239, 228, 208],
  rod: [155, 123, 91],
  bead: [138, 90, 51],
  beadOn: [208, 133, 54]
};

// ---------- PNG ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = rgba[y * w * 4 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---------- რასტერიზაცია (4×4 ქვეპიქსელი ანტიალიასინგისთვის) ----------
function makeCanvas(size) {
  return { size, px: new Float32Array(size * size * 4) };
}

function fillShape(cv, bbox, inside, color) {
  const S = cv.size;
  const x0 = Math.max(0, Math.floor(bbox[0] * S)), x1 = Math.min(S - 1, Math.ceil(bbox[2] * S));
  const y0 = Math.max(0, Math.floor(bbox[1] * S)), y1 = Math.min(S - 1, Math.ceil(bbox[3] * S));
  const N = 4;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let hit = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          if (inside((x + (sx + 0.5) / N) / S, (y + (sy + 0.5) / N) / S)) hit++;
        }
      }
      if (!hit) continue;
      const a = hit / (N * N);
      const i = (y * S + x) * 4;
      const da = cv.px[i + 3];
      const oa = a + da * (1 - a);
      for (let c = 0; c < 3; c++) {
        cv.px[i + c] = oa ? (color[c] * a + cv.px[i + c] * da * (1 - a)) / oa : 0;
      }
      cv.px[i + 3] = oa;
    }
  }
}

function roundRect(cv, x, y, w, h, r, color) {
  fillShape(cv, [x, y, x + w, y + h], (px, py) => {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    const cx = Math.min(Math.max(px, x + r), x + w - r);
    const cy = Math.min(Math.max(py, y + r), y + h - r);
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
  }, color);
}

function polygon(cv, pts, color) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  fillShape(cv, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], (px, py) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }, color);
}

function bead(cv, cx, cy, w, h, color) {
  polygon(cv, [
    [cx - w / 2, cy], [cx - w * 0.26, cy - h / 2], [cx + w * 0.26, cy - h / 2],
    [cx + w / 2, cy], [cx + w * 0.26, cy + h / 2], [cx - w * 0.26, cy + h / 2]
  ], color);
}

function drawIcon(size, maskable) {
  const cv = makeCanvas(size);
  const s = maskable ? 0.8 : 1; // maskable: შინაარსი უსაფრთხო ზონაში (ცენტრალური წრე)
  const T = (v) => 0.5 + (v - 0.5) * s;
  const L = (v) => v * s;
  if (maskable) roundRect(cv, 0, 0, 1, 1, 0, COLORS.bg);
  else roundRect(cv, 0, 0, 1, 1, 0.22, COLORS.bg);

  // ჩარჩო და შიდა ნაწილი
  roundRect(cv, T(0.14), T(0.22), L(0.72), L(0.56), L(0.05), COLORS.wood);
  roundRect(cv, T(0.175), T(0.255), L(0.65), L(0.49), L(0.015), COLORS.inner);

  const innerTop = 0.255, beamTop = 0.40, beamBot = 0.43, innerBot = 0.745;
  const rodsX = [0.32, 0.5, 0.68];
  for (const x of rodsX) roundRect(cv, T(x - 0.009), T(innerTop), L(0.018), L(innerBot - innerTop), L(0.004), COLORS.rod);
  roundRect(cv, T(0.175), T(beamTop), L(0.65), L(beamBot - beamTop), 0, COLORS.wood);

  // მძივები: ციფრები 2, 5, 9
  const digits = [2, 5, 9];
  const bw = 0.15, bh = 0.058;
  const upSlot = (beamTop - innerTop) / 2;
  const loSlot = (innerBot - beamBot) / 5;
  rodsX.forEach((x, i) => {
    const d = digits[i];
    const on = d >= 5;
    const ucy = on ? beamTop - upSlot / 2 : innerTop + upSlot / 2;
    bead(cv, T(x), T(ucy), L(bw), L(bh), on ? COLORS.beadOn : COLORS.bead);
    const count = d % 5;
    for (let b = 1; b <= 4; b++) {
      const slot = b <= count ? b - 1 : b;
      const cy = beamBot + (slot + 0.5) * loSlot;
      bead(cv, T(x), T(cy), L(bw), L(bh), b <= count ? COLORS.beadOn : COLORS.bead);
    }
  });

  const out = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(Math.min(255, Math.max(0, cv.px[i * 4 + c])));
    out[i * 4 + 3] = Math.round(cv.px[i * 4 + 3] * 255);
  }
  return encodePNG(size, size, out);
}

for (const size of [192, 512]) {
  writeFileSync(join(outDir, `icon-${size}.png`), drawIcon(size, false));
  writeFileSync(join(outDir, `icon-maskable-${size}.png`), drawIcon(size, true));
  console.log(`icons/icon-${size}.png, icons/icon-maskable-${size}.png`);
}
