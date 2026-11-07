import { describe, expect, it } from "vite-plus/test";

import { renderWorkspaceBackdropCells } from "./WorkspaceBackdrop.logic";

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
});
