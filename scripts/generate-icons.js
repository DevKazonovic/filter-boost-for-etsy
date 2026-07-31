const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { stripAlpha } = require('./png');

const OUT = path.resolve(__dirname, '..', 'src', 'icons');
const TOP = [99, 102, 241];
const BOTTOM = [67, 56, 202];
const GLYPH = [255, 255, 255];
const SS = 4;

function insideRoundedSquare(x, y, r) {
  const cx = Math.min(x, 1 - x);
  const cy = Math.min(y, 1 - y);
  if (cx >= r || cy >= r) return true;
  const dx = r - cx;
  const dy = r - cy;
  return dx * dx + dy * dy <= r * r;
}

function makeFunnel(bold) {
  const topY = 0.29;
  const neckY = 0.55;
  const stemY = 0.775;
  const topHalf = bold ? 0.345 : 0.325;
  const neckHalf = bold ? 0.08 : 0.06;
  return (x, y) => {
    if (y < topY || y > stemY) return false;
    const d = Math.abs(x - 0.5);
    if (y <= neckY) {
      const t = (y - topY) / (neckY - topY);
      return d <= topHalf + t * (neckHalf - topHalf);
    }
    return d <= neckHalf;
  };
}

function crc32(buf) {
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Int32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icon(size, { square = false } = {}) {
  const funnel = makeFunnel(size <= 32);
  const radius = square ? 0 : size <= 16 ? 0.18 : 0.22;
  return encodePng(size, (x, y) => {
    let inside = 0;
    let glyph = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const ux = (x + (sx + 0.5) / SS) / size;
        const uy = (y + (sy + 0.5) / SS) / size;
        if (!insideRoundedSquare(ux, uy, radius)) continue;
        inside++;
        if (funnel(ux, uy)) glyph++;
      }
    }
    const total = SS * SS;
    if (!inside) return [0, 0, 0, 0];
    const shade = (y + 0.5) / size;
    const base = [0, 1, 2].map((i) => TOP[i] + (BOTTOM[i] - TOP[i]) * shade);
    const mix = glyph / inside;
    const color = [0, 1, 2].map((i) => Math.round(base[i] + (GLYPH[i] - base[i]) * mix));
    return [color[0], color[1], color[2], Math.round((inside / total) * 255)];
  });
}

const STORE_OUT = path.resolve(__dirname, '..', 'store', 'assets');

fs.mkdirSync(OUT, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const file = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, icon(size));
  console.log(`${path.relative(process.cwd(), file)}  ${fs.statSync(file).size} bytes`);
}

fs.mkdirSync(STORE_OUT, { recursive: true });
const storeIcon = path.join(STORE_OUT, 'store-icon-128.png');
fs.writeFileSync(storeIcon, stripAlpha(icon(128, { square: true })));
console.log(`${path.relative(process.cwd(), storeIcon)}  ${fs.statSync(storeIcon).size} bytes  24-bit, full bleed`);
