/**
 * Renders the terminal buffer to a PNG image via SVG.
 * Uses @xterm/headless buffer cell API for color extraction
 * and @resvg/resvg-js for SVG-to-PNG conversion.
 */

import { createRequire } from "module";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import type { Terminal } from "@xterm/headless";

const require = createRequire(import.meta.url);

function defaultFontDirs(): string[] {
  const dirs: string[] = [];
  const home = os.homedir();

  // Common font directories
  const candidates = [
    path.join(home, '.local/share/fonts'),
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    '/System/Library/Fonts',
    path.join(home, 'Library/Fonts'),
  ];

  for (const d of candidates) {
    try {
      if (fs.statSync(d).isDirectory()) dirs.push(d);
    } catch { /* skip */ }
  }

  return dirs;
}

// xterm.js CellColorMode bitmask values from IBufferCell.getFgColorMode():
const CM_DEFAULT = 0;
const CM_P16 = 16777216;    // 0x1000000 — 16-color palette (SGR 30-37, 90-97)
const CM_P256 = 33554432;   // 0x2000000 — 256-color palette (SGR 38;5;N)
const CM_RGB = 50331648;    // 0x3000000 — 24-bit truecolor (SGR 38;2;R;G;B)

// One Dark color palette for the basic 16 ANSI colors
const palette16 = [
  '#282c34', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#abb2bf',
  '#5c6370', '#e06c75', '#98c379', '#e5c07b', '#61afef', '#c678dd', '#56b6c2', '#ffffff',
];

const BG_COLOR = '#282c34';
const FG_COLOR = '#abb2bf';

function color256(n: number): string {
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

function resolveColor(color: number, mode: number, isBackground: boolean): string {
  if (mode === CM_DEFAULT || color < 0) {
    return isBackground ? BG_COLOR : FG_COLOR;
  }
  if (mode === CM_P16) {
    return palette16[color] || (isBackground ? BG_COLOR : FG_COLOR);
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
  return isBackground ? BG_COLOR : FG_COLOR;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface RenderOptions {
  /** Font family name (must be available to resvg). Default: 'JetBrains Mono' */
  fontFamily?: string;
  /** Directories to search for font files */
  fontDirs?: string[];
  /** Show macOS-style window chrome (traffic lights). Default: true */
  windowChrome?: boolean;
  /** Output scale multiplier. Default: 2 (retina) */
  scale?: number;
}

/**
 * Render an xterm.js Terminal buffer to a PNG image buffer.
 */
export function renderTerminalToPng(terminal: Terminal, options: RenderOptions = {}): Buffer {
  const {
    fontFamily = 'JetBrains Mono',
    fontDirs: userFontDirs = [],
    windowChrome = true,
    scale = 2,
  } = options;

  // Default font search paths if none provided
  const fontDirs = userFontDirs.length > 0
    ? userFontDirs
    : defaultFontDirs();

  const cols = terminal.cols;
  const rows = terminal.rows;
  const buffer = terminal.buffer.active;

  // Character metrics (approximate for 13px monospace)
  const charW = 8.4;
  const charH = 17;
  const padX = 16;
  const padY = windowChrome ? 44 : 16;
  const padBottom = 12;
  const width = cols * charW + padX * 2;
  const height = rows * charH + padY + padBottom;
  const cornerR = 10;

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
  <style>
    text { font-family: '${fontFamily}'; font-size: 13px; }
  </style>
</defs>
<rect width="${width}" height="${height}" rx="${cornerR}" ry="${cornerR}" fill="${BG_COLOR}"/>`;

  if (windowChrome) {
    svg += `
<circle cx="20" cy="18" r="6" fill="#ff5f57"/>
<circle cx="40" cy="18" r="6" fill="#febc2e"/>
<circle cx="60" cy="18" r="6" fill="#28c840"/>`;
  }
  svg += '\n';

  // Render each character individually at its exact grid position
  // (grouping into text runs causes drift with Unicode box/block characters)
  for (let y = 0; y < rows; y++) {
    const line = buffer.getLine(y);
    if (!line) continue;

    for (let x = 0; x < cols; x++) {
      const cell = line.getCell(x);
      if (!cell) continue;

      const char = cell.getChars();
      if (!char || char === ' ') continue;

      const bgColor = resolveColor(cell.getBgColor(), cell.getBgColorMode(), true);
      const fgColor = resolveColor(cell.getFgColor(), cell.getFgColorMode(), false);
      const bold = cell.isBold() === 1;

      const cx = padX + x * charW;
      const cy = padY + y * charH;

      // Render non-default backgrounds
      if (bgColor !== BG_COLOR) {
        svg += `<rect x="${cx}" y="${cy}" width="${charW}" height="${charH}" fill="${bgColor}"/>`;
      }

      const weight = bold ? ' font-weight="bold"' : '';
      svg += `<text x="${cx}" y="${cy + charH - 4}" fill="${fgColor}"${weight}>${escapeXml(char)}</text>\n`;
    }
  }

  svg += '</svg>';

  // Convert SVG to PNG
  // Dynamic import to avoid hard failure if resvg is not installed
  let Resvg: any;
  try {
    Resvg = require('@resvg/resvg-js').Resvg;
  } catch {
    throw new Error(
      'PNG screenshot requires @resvg/resvg-js. Install it with: npm install @resvg/resvg-js'
    );
  }

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: Math.round(width * scale) },
    font: {
      loadSystemFonts: fontDirs.length === 0,
      fontDirs,
      defaultFontFamily: fontFamily,
    },
  });

  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
