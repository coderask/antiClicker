#!/usr/bin/env node
// scripts/gen-icon.mjs
//
// Generates build/icon.png — a 512x512 solid-color PNG using only Node.js
// built-ins (no npm canvas dependency). The PNG format is implemented from
// spec: PNG signature + IHDR + IDAT (zlib-compressed scanlines) + IEND.
//
// Output: build/icon.png — background #2d5a8e (AntiClicker blue)
// This file is committed to git; run this script if you want to regenerate it.

import { createWriteStream, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'build', 'icon.png');

const WIDTH = 512;
const HEIGHT = 512;

// AntiClicker blue: R=0x2d G=0x5a B=0x8e
const R = 0x2d, G = 0x5a, B = 0x8e;

// ---------------------------------------------------------------------------
// PNG helper utilities
// ---------------------------------------------------------------------------

function crc32(buf) {
  let crc = 0xffffffff;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeBytes, data]);
  return Buffer.concat([
    uint32be(data.length),
    typeBytes,
    data,
    uint32be(crc32(crcBuf)),
  ]);
}

// ---------------------------------------------------------------------------
// Build raw scanlines (filter byte 0 = None + RGB pixels)
// ---------------------------------------------------------------------------

// Each scanline: 1 filter byte + WIDTH * 3 bytes (RGB)
const scanline = Buffer.alloc(1 + WIDTH * 3);
scanline[0] = 0; // filter type: None
for (let x = 0; x < WIDTH; x++) {
  scanline[1 + x * 3] = R;
  scanline[2 + x * 3] = G;
  scanline[3 + x * 3] = B;
}

// Stack all scanlines into a single buffer
const raw = Buffer.alloc(HEIGHT * scanline.length);
for (let y = 0; y < HEIGHT; y++) {
  scanline.copy(raw, y * scanline.length);
}

// Zlib-compress the raw scanlines (PNG IDAT data)
const compressed = deflateSync(raw, { level: 9 });

// ---------------------------------------------------------------------------
// Assemble PNG
// ---------------------------------------------------------------------------

// IHDR: width, height, bit depth (8), color type (2=RGB), compression (0),
//       filter (0), interlace (0)
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(WIDTH, 0);
ihdrData.writeUInt32BE(HEIGHT, 4);
ihdrData[8] = 8;  // bit depth
ihdrData[9] = 2;  // color type: RGB
ihdrData[10] = 0; // compression
ihdrData[11] = 0; // filter
ihdrData[12] = 0; // interlace

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
  chunk('IHDR', ihdrData),
  chunk('IDAT', compressed),
  chunk('IEND', Buffer.alloc(0)),
]);

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

mkdirSync(join(__dirname, '..', 'build'), { recursive: true });
const ws = createWriteStream(outPath);
ws.write(png);
ws.end();
ws.on('finish', () => console.log(`Wrote ${outPath} (${png.length} bytes, ${WIDTH}x${HEIGHT} RGB PNG)`));
ws.on('error', (err) => { console.error('Error writing icon:', err); process.exit(1); });
