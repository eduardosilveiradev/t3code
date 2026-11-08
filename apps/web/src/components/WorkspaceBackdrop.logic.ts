import type { WorkspaceBackdrop } from "@t3tools/contracts";

export type WorkspaceBackdropArt = Exclude<WorkspaceBackdrop, "none">;
type Rgb = readonly [number, number, number];
/** Colours across the light band, from far above its centre line (-1) to far below (+1). */
type BandPalette = ReadonlyArray<readonly [position: number, color: Rgb]>;

/** CSS pixels per dither cell: a 2px dot plus a 1px gap (the gap is a CSS mask). */
const WORKSPACE_BACKDROP_CELL_PX = 3;

/**
 * CSS pixels per cell for an art. The photo's comes from the dither setting, in half pixels
 * (5 = 2.5px, Devin's panel); 0 means no dither, one cell per device pixel.
 */
export const backdropCellPx = (art: WorkspaceBackdropArt, dither: number) =>
  art !== "horizon"
    ? WORKSPACE_BACKDROP_CELL_PX
    : dither > 0
      ? dither / 2
      : 1 / (globalThis.devicePixelRatio || 1);

const BAND_PALETTES: Record<Exclude<WorkspaceBackdropArt, "horizon">, BandPalette> = {
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

/** Dims the centre column, where chat text sits, so text keeps its contrast over the dots. */
const textGuard = (u: number, floor = 0.2) =>
  floor + (1 - floor) * smoothstep(0.16, 0.42, Math.abs(u - 0.5));

/** Where a crop of the photo sits when the pane is taller than it, 0 = top, 1 = bottom. */
const PHOTO_ANCHOR_Y = 0.5;

/**
 * The photo art, dithered as Devin's panel is: each channel to 4 levels (0/85/170/255) through a
 * 2x2 ordered matrix, which reads as a fine checker between neighbouring colours. Every cell is
 * solid. Not dimmed: the asset is already toned to the panel's darkness.
 */
const BAYER_2 = [0, 2, 3, 1];
const PHOTO_STEPS = 3;
/** Brightest channel below this is solid black: space and the night side get no dither at all. */
const PHOTO_BLACK_POINT = 0.12;

function renderPhotoCells(cols: number, rows: number, photo: Uint8ClampedArray, dither: boolean) {
  const out = new Uint8ClampedArray(new ArrayBuffer(cols * rows * 4));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      out[i + 3] = 255;
      const peak = Math.max(photo[i]!, photo[i + 1]!, photo[i + 2]!) / 255;
      if (peak <= PHOTO_BLACK_POINT) continue;
      // Rescale from the black point up, keeping the hue, so the band fades in without a hard edge.
      const gain = (peak - PHOTO_BLACK_POINT) / (1 - PHOTO_BLACK_POINT) / peak;
      if (!dither) {
        for (let c = 0; c < 3; c++) out[i + c] = photo[i + c]! * gain;
        continue;
      }
      const threshold = (BAYER_2[(y & 1) * 2 + (x & 1)]! + 0.5) / 4;
      for (let c = 0; c < 3; c++) {
        const v = (photo[i + c]! / 255) * gain * PHOTO_STEPS;
        const level = Math.min(
          PHOTO_STEPS,
          Math.floor(v) + (v - Math.floor(v) > threshold ? 1 : 0),
        );
        out[i + c] = level * 85;
      }
    }
  }
  return out;
}

/**
 * Where to read a `srcW`×`srcH` image so it covers a `cols`×`rows` grid without stretching
 * (CSS `object-fit: cover`), centred.
 */
export function coverSourceRect(srcW: number, srcH: number, cols: number, rows: number) {
  const scale = Math.max(cols / srcW, rows / srcH);
  const sw = cols / scale;
  const sh = rows / scale;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) * PHOTO_ANCHOR_Y, sw, sh };
}

/**
 * One RGBA pixel per dither cell, quantised per channel through an ordered Bayer dither over a
 * sparse floor of coloured noise. Transparent where a cell has no dot, so the pane's own
 * background shows. The art is either a generated light band (aurora, ember) or a photo
 * (horizon), passed in already scaled to one RGBA pixel per cell; without it nothing is drawn.
 */
export function renderWorkspaceBackdropCells(
  cols: number,
  rows: number,
  art: WorkspaceBackdropArt,
  photo?: Uint8ClampedArray,
  { guardText = true, dither = true }: { guardText?: boolean; dither?: boolean } = {},
): Uint8ClampedArray<ArrayBuffer> {
  if (art === "horizon") {
    if (!photo || photo.length < cols * rows * 4)
      return new Uint8ClampedArray(new ArrayBuffer(cols * rows * 4));
    return renderPhotoCells(cols, rows, photo, dither);
  }
  const out = new Uint8ClampedArray(new ArrayBuffer(cols * rows * 4));
  const palette = BAND_PALETTES[art];
  // Measure the band in the shorter axis so it keeps its thickness at any aspect ratio.
  const scale = Math.min(cols, rows);
  const color: [number, number, number] = [0, 0, 0];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = x / cols;
      const i = (y * cols + x) * 4;
      const centre = (0.06 + 0.38 * u + 0.16 * u * u) * rows;
      const d = (y - centre) / (BAND_WIDTH * scale);
      const glow = Math.exp(-d * d) + 0.18 * Math.exp(-Math.abs(d) * 0.9);
      const strength = Math.min(1, glow * (guardText ? textGuard(u) : 1) * (0.75 + 0.25 * u));
      const c = sample(palette, Math.max(-1, Math.min(1, d / 2.4)));
      color[0] = c[0];
      color[1] = c[1];
      color[2] = c[2];
      const threshold = (BAYER_8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64;
      let lit = false;
      for (let c = 0; c < 3; c++) {
        const v = Math.min(1, (color[c]! / 255) * strength) * LEVELS;
        const level = Math.min(LEVELS, Math.floor(v) + (v - Math.floor(v) > threshold ? 1 : 0));
        out[i + c] = (level / LEVELS) * 255;
        if (level > 0) lit = true;
      }
      if (!lit && hash(x, y) < NOISE_DENSITY) {
        const tint = sample(palette, hash(y, x) * 2 - 1);
        out[i] = Math.min(255, tint[0]) * 0.4;
        out[i + 1] = Math.min(255, tint[1]) * 0.4;
        out[i + 2] = Math.min(255, tint[2]) * 0.4;
        lit = true;
      }
      out[i + 3] = lit ? 255 : 0;
    }
  }
  return out;
}
