// Generates simple indigo rounded-square PNG icons using only Node.js built-ins
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { deflateSync } = require('zlib');

if (!existsSync('icons')) mkdirSync('icons');

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function createIcon(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA

  // Indigo: #6366f1 with rounded corners
  const cornerR = Math.max(2, Math.floor(size * 0.22));
  const rowLen = 1 + size * 4; // filter byte + RGBA pixels
  const raw = Buffer.alloc(rowLen * size);

  // Lighter accent for the "D" letter shape
  const bgR = 99, bgG = 102, bgB = 241;       // #6366f1
  const fgR = 224, fgG = 225, fgB = 255;       // light accent for letter

  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const off = y * rowLen + 1 + x * 4;

      // Rounded rect check
      let inside = true;
      if (x < cornerR && y < cornerR) inside = dist(x, y, cornerR, cornerR) <= cornerR;
      else if (x >= size - cornerR && y < cornerR) inside = dist(x, y, size - cornerR - 1, cornerR) <= cornerR;
      else if (x < cornerR && y >= size - cornerR) inside = dist(x, y, cornerR, size - cornerR - 1) <= cornerR;
      else if (x >= size - cornerR && y >= size - cornerR) inside = dist(x, y, size - cornerR - 1, size - cornerR - 1) <= cornerR;

      if (!inside) {
        raw[off] = 0; raw[off + 1] = 0; raw[off + 2] = 0; raw[off + 3] = 0;
        continue;
      }

      // Draw a simple "D" letterform for sizes >= 32
      let isLetter = false;
      if (size >= 32) {
        const nx = x / size, ny = y / size;
        // Vertical bar of D
        if (nx >= 0.25 && nx <= 0.38 && ny >= 0.22 && ny <= 0.78) isLetter = true;
        // Curved part of D (approximate with circle)
        const cx = 0.42, cy = 0.5, r = 0.28;
        const d = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);
        if (d >= r - 0.08 && d <= r && nx >= 0.35) isLetter = true;
      } else if (size >= 16) {
        // Simpler shape for small icons: just a bright center dot
        const cx = size / 2, cy = size / 2, r = size * 0.22;
        if (dist(x, y, cx, cy) <= r) isLetter = true;
      }

      if (isLetter) {
        raw[off] = fgR; raw[off + 1] = fgG; raw[off + 2] = fgB; raw[off + 3] = 255;
      } else {
        raw[off] = bgR; raw[off + 1] = bgG; raw[off + 2] = bgB; raw[off + 3] = 255;
      }
    }
  }

  const compressed = deflateSync(raw);
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

[16, 32, 48, 128].forEach(size => {
  writeFileSync(`icons/icon-${size}.png`, createIcon(size));
  console.log(`Created icon-${size}.png (${size}x${size})`);
});

console.log('Icons generated!');
