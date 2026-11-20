import { describe, expect, it } from "vite-plus/test";

import {
  isBackdropPhoto,
  coverSourceRect,
  renderWorkspaceBackdropCells,
} from "./WorkspaceBackdrop.logic";

const litShare = (
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
  x0: number,
  x1: number,
) => {
  let lit = 0;
  let total = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = x0; x < x1; x++) {
      total++;
      if (pixels[(y * cols + x) * 4 + 3] === 255) lit++;
    }
  }
  return lit / total;
};

describe("renderWorkspaceBackdropCells", () => {
  it("returns one opaque-or-clear RGBA pixel per cell", () => {
    const pixels = renderWorkspaceBackdropCells(40, 30, "aurora");
    expect(pixels.length).toBe(40 * 30 * 4);
    for (let i = 3; i < pixels.length; i += 4) expect([0, 255]).toContain(pixels[i]);
  });

  it("is deterministic, so a redraw at the same size is identical", () => {
    expect(renderWorkspaceBackdropCells(64, 48, "ember")).toEqual(
      renderWorkspaceBackdropCells(64, 48, "ember"),
    );
  });

  it("leaves most of the pane clear and keeps the centre column sparser than the edges", () => {
    const cols = 400;
    const rows = 260;
    const pixels = renderWorkspaceBackdropCells(cols, rows, "aurora");
    expect(litShare(pixels, cols, rows, 0, cols)).toBeLessThan(0.5);
    const centre = litShare(pixels, cols, rows, cols * 0.4, cols * 0.6);
    const right = litShare(pixels, cols, rows, cols * 0.8, cols);
    expect(centre).toBeLessThan(right);
  });

  it("draws nothing for the horizon photo until its pixels arrive", () => {
    const pixels = renderWorkspaceBackdropCells(20, 10, "horizon");
    expect(pixels.every((v) => v === 0)).toBe(true);
  });

  it("dithers the horizon photo from its own colours", () => {
    const cols = 60;
    const rows = 40;
    // A photo that is bright orange on the left edge and near-black elsewhere, like space.
    const photo = new Uint8ClampedArray(cols * rows * 4);
    for (let i = 0; i < photo.length; i += 4) photo.set([22, 20, 26, 255], i);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < 6; x++) photo.set([255, 140, 40, 255], (y * cols + x) * 4);
    const pixels = renderWorkspaceBackdropCells(cols, rows, "horizon", photo);
    let red = 0;
    let blue = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < 6; x++) {
        red += pixels[(y * cols + x) * 4]!;
        blue += pixels[(y * cols + x) * 4 + 2]!;
      }
    expect(red).toBeGreaterThan(blue * 2);
    // The dark part of the photo is solid black, with no dither dots.
    for (let y = 0; y < rows; y++)
      for (let x = 10; x < cols; x++)
        for (let c = 0; c < 3; c++) expect(pixels[(y * cols + x) * 4 + c]).toBe(0);
    // Solid cells: every one is opaque, even the black ones.
    for (let i = 3; i < pixels.length; i += 4) expect(pixels[i]).toBe(255);
  });
});

describe("photo backdrops", () => {
  it("treats every NASA photo as a photo, and the generated bands as bands", () => {
    for (const art of [
      "horizon",
      "sunset-limb",
      "red-sun",
      "sunrise-bands",
      "bright-limb",
      "crescent",
    ] as const)
      expect(isBackdropPhoto(art)).toBe(true);
    expect(isBackdropPhoto("aurora")).toBe(false);
    // A photo with no pixels yet draws nothing, like Horizon.
    expect(renderWorkspaceBackdropCells(4, 2, "crescent").every((v) => v === 0)).toBe(true);
  });
});

describe("photo without dither", () => {
  it("passes the photo through smoothly above the black point, black below it", () => {
    const photo = new Uint8ClampedArray([200, 120, 60, 255, 20, 20, 24, 255]);
    const pixels = renderWorkspaceBackdropCells(2, 1, "horizon", photo, { dither: false });
    // Not snapped to the 0/85/170/255 levels, and the hue is kept.
    expect([85, 170, 255]).not.toContain(pixels[0]);
    expect(pixels[0]!).toBeGreaterThan(pixels[1]!);
    expect(pixels[1]!).toBeGreaterThan(pixels[2]!);
    expect([pixels[4], pixels[5], pixels[6]]).toEqual([0, 0, 0]);
  });
});

describe("coverSourceRect", () => {
  it("covers a wide grid from a tall photo, sliced on the horizon band", () => {
    const r = coverSourceRect(346, 449, 400, 250);
    expect(r.sw).toBeCloseTo(346);
    expect(r.sh).toBeCloseTo(346 * (250 / 400));
    expect(r.sy).toBeGreaterThan(0);
    expect(r.sy + r.sh).toBeLessThanOrEqual(449);
    expect(r.sx).toBeCloseTo(0);
  });

  it("crops the sides of a photo wider than the grid, centred", () => {
    const r = coverSourceRect(400, 100, 100, 100);
    expect(r.sw).toBeCloseTo(100);
    expect(r.sx).toBeCloseTo(150);
  });
});
