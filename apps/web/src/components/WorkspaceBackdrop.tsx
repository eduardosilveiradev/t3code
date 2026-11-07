import { useEffect, useRef } from "react";

import horizonUrl from "~/assets/backdrop-horizon.jpg";
import { useClientSettings } from "~/hooks/useSettings";
import { observeResize } from "~/lib/observeResize";
import {
  coverSourceRect,
  renderWorkspaceBackdropCells,
  WORKSPACE_BACKDROP_CELL_PX,
  type WorkspaceBackdropArt,
} from "./WorkspaceBackdrop.logic";

const REDRAW_DEBOUNCE_MS = 120;

/** The horizon photo, decoded once and shared by the pane and the settings previews. */
let horizonImage: Promise<HTMLImageElement> | null = null;
function loadHorizon(): Promise<HTMLImageElement> {
  horizonImage ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => {
      horizonImage = null;
      reject(new Error("horizon backdrop failed to load"));
    };
    img.src = horizonUrl;
  });
  return horizonImage;
}

/** The photo scaled to one RGBA pixel per dither cell, covering the grid. */
function photoCells(img: HTMLImageElement, cols: number, rows: number): Uint8ClampedArray {
  const scratch = document.createElement("canvas");
  scratch.width = cols;
  scratch.height = rows;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Uint8ClampedArray(cols * rows * 4);
  const { sx, sy, sw, sh } = coverSourceRect(img.naturalWidth, img.naturalHeight, cols, rows);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
  return ctx.getImageData(0, 0, cols, rows).data;
}

/**
 * Dithered artwork behind the main pane, chosen in Settings → Background. Drawn once per size at
 * one canvas pixel per dither cell and scaled up with `image-rendering: pixelated`, so it costs
 * one small canvas write per resize and nothing per frame.
 */
export function WorkspaceBackdrop() {
  const art = useClientSettings((settings) => settings.workspaceBackdrop);
  if (art === "none") return null;
  return (
    <div aria-hidden className="workspace-backdrop">
      <BackdropCanvas art={art} />
    </div>
  );
}

/**
 * The dithered art sized to its parent element; also used small for the settings previews,
 * which pass `guardText={false}` because no text sits over them.
 */
export function BackdropCanvas({
  art,
  guardText = true,
}: {
  art: WorkspaceBackdropArt;
  guardText?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the canvas bitmap in step with its host's size and the decoded photo; no React state involved
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let photo: HTMLImageElement | null = null;
    let alive = true;

    const draw = (force = false) => {
      const { width, height } = host.getBoundingClientRect();
      const cols = Math.max(1, Math.ceil(width / WORKSPACE_BACKDROP_CELL_PX));
      const rows = Math.max(1, Math.ceil(height / WORKSPACE_BACKDROP_CELL_PX));
      if (!force && canvas.width === cols && canvas.height === rows) return;
      if (art === "horizon" && !photo) return;
      canvas.width = cols;
      canvas.height = rows;
      canvas.style.width = `${cols * WORKSPACE_BACKDROP_CELL_PX}px`;
      canvas.style.height = `${rows * WORKSPACE_BACKDROP_CELL_PX}px`;
      const cells = renderWorkspaceBackdropCells(
        cols,
        rows,
        art,
        photo ? photoCells(photo, cols, rows) : undefined,
        { guardText },
      );
      canvas.getContext("2d")?.putImageData(new ImageData(cells, cols), 0, 0);
    };

    // A new art choice must repaint even at the same size.
    draw(true);
    if (art === "horizon") {
      loadHorizon()
        .then((img) => {
          if (!alive) return;
          photo = img;
          draw(true);
        })
        .catch(() => {});
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopObserving = observeResize(host, () => {
      clearTimeout(timer);
      timer = setTimeout(draw, REDRAW_DEBOUNCE_MS);
    });
    return () => {
      alive = false;
      stopObserving();
      clearTimeout(timer);
    };
  }, [art, guardText]);

  return <canvas ref={canvasRef} className="workspace-backdrop-canvas" />;
}
