#!/usr/bin/env node
// Renders terminal content from a .cast file at a given timestamp to PNG
// Uses xterm.js headless to replay the cast, then renders to canvas via @xterm/addon-canvas...
// Actually, since we can't use canvas in Node, we'll render text to PNG via resvg with a proper SVG.

import * as fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');

const castFile = process.argv[2];
const targetTime = parseFloat(process.argv[3] || '0');
const outFile = process.argv[4] || 'screenshot.png';

if (!castFile) {
  console.error('Usage: node render-screenshot.mjs <cast-file> <time-seconds> [output.png]');
  process.exit(1);
}

// Parse cast file
const lines = fs.readFileSync(castFile, 'utf8').trim().split('\n');
const header = JSON.parse(lines[0]);
const cols = header.width || 120;
const rows = header.height || 40;

// Replay events up to target time through xterm headless
const xtermHeadless = (await import('@xterm/headless')).default;
const { Terminal } = xtermHeadless;

const term = new Terminal({ cols, rows, scrollback: 0, allowProposedApi: true });

// Write all data and wait for xterm to fully parse each chunk
for (let i = 1; i < lines.length; i++) {
  const event = JSON.parse(lines[i]);
  const [time, type, data] = event;
  if (time > targetTime) break;
  if (type === 'o') {
    await new Promise(resolve => term.write(data, resolve));
  }
}

// Extra flush time
await new Promise(resolve => setTimeout(resolve, 500));

// Read terminal buffer
const buffer = term.buffer.active;
const cellData = [];
for (let y = 0; y < rows; y++) {
  const line = buffer.getLine(y);
  if (!line) continue;
  for (let x = 0; x < cols; x++) {
    const cell = line.getCell(x);
    if (!cell) continue;
    const char = cell.getChars() || ' ';
    const fg = cell.getFgColor();
    const bg = cell.getBgColor();
    const fgMode = cell.getFgColorMode();
    const bgMode = cell.getBgColorMode();
    const bold = cell.isBold();
    const italic = cell.isItalic();
    const dim = cell.isDim();
    const underline = cell.isUnderline();
    cellData.push({ x, y, char, fg, bg, fgMode, bgMode, bold, italic, dim, underline });
  }
}

// Color palette (xterm 256 basic 16)
const palette16 = [
  '#282c34', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#abb2bf',
  '#5c6370', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#ffffff',
];

function color256(n) {
  if (n < 16) return palette16[n];
  if (n < 232) {
    n -= 16;
    const r = Math.floor(n / 36) * 51;
    const g = Math.floor((n % 36) / 6) * 51;
    const b = (n % 6) * 51;
    return `rgb(${r},${g},${b})`;
  }
  const gray = (n - 232) * 10 + 8;
  return `rgb(${gray},${gray},${gray})`;
}

// xterm.js CellColorMode bitmask values from IBufferCell.getFgColorMode():
//   0          = CM_DEFAULT (no color set)
//   16777216   = CM_P16  (0x1000000) — 16-color palette (SGR 30-37, 90-97)
//   33554432   = CM_P256 (0x2000000) — 256-color palette (SGR 38;5;N)
//   50331648   = CM_RGB  (0x3000000) — 24-bit truecolor (SGR 38;2;R;G;B)
const CM_DEFAULT = 0;
const CM_P16 = 16777216;    // 0x1000000
const CM_P256 = 33554432;   // 0x2000000
const CM_RGB = 50331648;    // 0x3000000

function resolveColor(color, mode, isBackground) {
  if (mode === CM_DEFAULT || color < 0) {
    return isBackground ? '#282c34' : '#abb2bf';
  }
  if (mode === CM_P16) {
    return palette16[color] || (isBackground ? '#282c34' : '#abb2bf');
  }
  if (mode === CM_P256) {
    if (color < 16) return palette16[color];
    return color256(color);
  }
  if (mode === CM_RGB) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `rgb(${r},${g},${b})`;
  }
  return isBackground ? '#282c34' : '#abb2bf';
}

// Build SVG
const charW = 8.4;
const charH = 17;
const padX = 16;
const padY = 44; // space for window chrome
const padBottom = 12;
const width = cols * charW + padX * 2;
const height = rows * charH + padY + padBottom;
const cornerR = 10;

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <style>
    @font-face { font-family: 'MonoFont'; }
    text { font-family: 'JetBrains Mono'; font-size: 13px; }
  </style>
</defs>
<rect width="${width}" height="${height}" rx="${cornerR}" ry="${cornerR}" fill="#282c34"/>
<!-- Window chrome -->
<circle cx="20" cy="18" r="6" fill="#ff5f57"/>
<circle cx="40" cy="18" r="6" fill="#febc2e"/>
<circle cx="60" cy="18" r="6" fill="#28c840"/>
`;

// Render background cells that aren't default
for (const cell of cellData) {
  const bgColor = resolveColor(cell.bg, cell.bgMode, true);
  if (bgColor !== '#282c34') {
    const cx = padX + cell.x * charW;
    const cy = padY + cell.y * charH;
    svg += `<rect x="${cx}" y="${cy}" width="${charW}" height="${charH}" fill="${bgColor}"/>`;
  }
}

// Render text row by row, grouping consecutive chars with same color
for (let y = 0; y < rows; y++) {
  const rowCells = cellData.filter(c => c.y === y);
  let runStart = 0;
  let runColor = null;
  let runBold = false;
  let runText = '';

  function flushRun() {
    if (runText.length === 0 || runText.trim().length === 0) return;
    const cx = padX + runStart * charW;
    const cy = padY + y * charH + charH - 4;
    const escaped = runText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const weight = runBold ? ' font-weight="bold"' : '';
    svg += `<text x="${cx}" y="${cy}" fill="${runColor}"${weight}>${escaped}</text>\n`;
  }

  for (const cell of rowCells) {
    const fgColor = resolveColor(cell.fg, cell.fgMode, false);
    const bold = cell.bold;
    if (fgColor !== runColor || bold !== runBold || cell.x !== runStart + runText.length) {
      flushRun();
      runStart = cell.x;
      runColor = fgColor;
      runBold = bold;
      runText = cell.char;
    } else {
      runText += cell.char;
    }
  }
  flushRun();
}

svg += '</svg>';

// Write SVG
const svgPath = outFile.replace(/\.png$/, '.svg');
fs.writeFileSync(svgPath, svg);

// Convert to PNG
const os = await import('os');
const path = await import('path');
const fontDir = path.join(os.default.homedir(), '.local/share/fonts');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: Math.round(width * 2) },
  font: {
    loadSystemFonts: false,
    fontDirs: [fontDir],
    defaultFontFamily: 'JetBrains Mono',
  },
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
fs.writeFileSync(outFile, pngBuffer);
console.log(`Wrote ${outFile} (${pngBuffer.length} bytes, ${Math.round(width*2)}x${Math.round(height*2)})`);

term.dispose();
