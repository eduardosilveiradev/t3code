import type { WorkspaceBackdrop } from "@t3tools/contracts";

export type WorkspaceBackdropArt = Exclude<WorkspaceBackdrop, "none">;
type Rgb = readonly [number, number, number];
/** Colours across the light band, from far above its centre line (-1) to far below (+1). */
type BandPalette = ReadonlyArray<readonly [position: number, color: Rgb]>;

/** CSS pixels per dither cell: a 2px dot plus a 1px gap (the gap is a CSS mask). */
export const WORKSPACE_BACKDROP_CELL_PX = 3;

const BAND_PALETTES: Record<WorkspaceBackdropArt, BandPalette> = {
  aurora: [
    [-1, [24, 70, 255]],
    [-0.45, [60, 170, 255]],
    [0, [255, 236, 210]],
    [0.4, [255, 128, 32]],
    [1, [220, 30, 18]],
  ],
  ember: [
    [-1, [120, 40, 255]],
    [-0.45, [236, 72, 186]],
    [0, [255, 222, 196]],
    [0.4, [255, 150, 40]],
    [1, [200, 48, 20]],
  ],
};

// Classic 8x8 Bayer matrix; thresholds are (value + 0.5) / 64.
const BAYER_8 = [
  0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52, 11, 59, 7, 55, 40, 24,
  36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61, 34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6,
  54, 9, 57, 5, 53, 42, 26, 38, 22, 41, 25, 37, 21,
];
const LEVELS = 3;
const BAND_WIDTH = 0.15;
const NOISE_DENSITY = 0.045;

function sample(palette: BandPalette, t: number): Rgb {
  for (let k = 1; k < palette.length; k++) {
    const [p1, c1] = palette[k]!;
    if (t <= p1) {
      const [p0, c0] = palette[k - 1]!;
      const f = (t - p0) / (p1 - p0);
      return [
        c0[0] + (c1[0] - c0[0]) * f,
        c0[1] + (c1[1] - c0[1]) * f,
        c0[2] + (c1[2] - c0[2]) * f,
      ];
    }
  }
  return palette[palette.length - 1]![1];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Deterministic per-cell hash in [0, 1), so a resize never reshuffles the noise. */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * One RGBA pixel per dither cell: a sweeping light band (bright, warm core; cool above, hot
 * below) quantised per channel through an ordered Bayer dither, over a sparse floor of
 * coloured noise. Transparent where a cell has no dot, so the pane's own background shows.
 * The centre column, where chat text sits, is dimmed to keep the text readable.
 */
export function renderWorkspaceBackdropCells(
  cols: number,
  rows: number,
  art: WorkspaceBackdropArt,
): Uint8ClampedArray<ArrayBuffer> {
  const palette = BAND_PALETTES[art];
  const out = new Uint8ClampedArray(new ArrayBuffer(cols * rows * 4));
  // Measure the band in the shorter axis so it keeps its thickness at any aspect ratio.
  const scale = Math.min(cols, rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = x / cols;
      const centre = (0.06 + 0.38 * u + 0.16 * u * u) * rows;
      const d = (y - centre) / (BAND_WIDTH * scale);
      const glow = Math.exp(-d * d) + 0.18 * Math.exp(-Math.abs(d) * 0.9);
      const textGuard = 0.2 + 0.8 * smoothstep(0.16, 0.42, Math.abs(u - 0.5));
      const strength = Math.min(1, glow * textGuard * (0.75 + 0.25 * u));
      const color = sample(palette, Math.max(-1, Math.min(1, d / 2.4)));
      const threshold = (BAYER_8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64;
      const i = (y * cols + x) * 4;
      let lit = false;
      for (let c = 0; c < 3; c++) {
        const v = (color[c]! / 255) * strength * LEVELS;
        const level = Math.min(LEVELS, Math.floor(v) + (v - Math.floor(v) > threshold ? 1 : 0));
        out[i + c] = (level / LEVELS) * 255;
        if (level > 0) lit = true;
      }
      if (!lit && hash(x, y) < NOISE_DENSITY) {
        const tint = sample(palette, hash(y, x) * 2 - 1);
        out[i] = tint[0] * 0.4;
        out[i + 1] = tint[1] * 0.4;
        out[i + 2] = tint[2] * 0.4;
        lit = true;
      }
      out[i + 3] = lit ? 255 : 0;
    }
  }
  return out;
}
