import { useLayoutEffect, useRef, useState } from "react";

import horizonUrl from "~/assets/backdrop-horizon.jpg";
import sunsetLimbUrl from "~/assets/backdrop-sunset-limb.jpg";
import redSunUrl from "~/assets/backdrop-red-sun.jpg";
import sunriseBandsUrl from "~/assets/backdrop-sunrise-bands.jpg";
import brightLimbUrl from "~/assets/backdrop-bright-limb.jpg";
import crescentUrl from "~/assets/backdrop-crescent.jpg";
import { useClientSettings } from "~/hooks/useSettings";
import { observeResize } from "~/lib/observeResize";
import {
  coverSourceRect,
  isBackdropPhoto,
  renderWorkspaceBackdropCells,
  backdropCellPx,
  type WorkspaceBackdropArt,
  type WorkspaceBackdropPhoto,
} from "./WorkspaceBackdrop.logic";

const REDRAW_DEBOUNCE_MS = 120;

/** NASA photos from orbit, toned to Devin's panel; each is fetched only when first shown. */
const PHOTO_URLS: Record<WorkspaceBackdropPhoto, string> = {
  horizon: horizonUrl,
  "sunset-limb": sunsetLimbUrl,
  "red-sun": redSunUrl,
  "sunrise-bands": sunriseBandsUrl,
  "bright-limb": brightLimbUrl,
  crescent: crescentUrl,
};

/** Each photo decoded once and shared by the pane and the settings previews. */
const photoLoads = new Map<WorkspaceBackdropPhoto, Promise<HTMLImageElement>>();
/** Set once decoded, so a pane mounted later paints the photo in its first frame. */
const photoDecoded = new Map<WorkspaceBackdropPhoto, HTMLImageElement>();
function loadPhoto(art: WorkspaceBackdropPhoto): Promise<HTMLImageElement> {
  let load = photoLoads.get(art);
  if (!load) {
    load = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        photoDecoded.set(art, img);
        resolve(img);
      };
      img.onerror = () => {
        photoLoads.delete(art);
        reject(new Error(`${art} backdrop failed to load`));
      };
      img.src = PHOTO_URLS[art];
    });
    photoLoads.set(art, load);
  }
  return load;
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
 * Dithered artwork behind the main pane, chosen in Settings → Background. Drawn once per size,
 * one solid block of whole device pixels per dither cell, so it costs one canvas write per resize
 * and nothing per frame.
 */
export function WorkspaceBackdrop() {
  const art = useClientSettings((settings) => settings.workspaceBackdrop);
  const dither = useClientSettings((settings) => settings.workspaceBackdropDither);
  if (art === "none") return null;
  return <Backdrop art={art} dither={dither} />;
}

/** Whether the last pane's backdrop was blurred (a thread was open) when it went away. */
let lastBlurred = false;

/**
 * Each route has its own pane, so going from new chat to a thread mounts a fresh backdrop. It
 * starts in the state the old one left (`data-was-blurred`, read by `@starting-style` in CSS)
 * and transitions from there, instead of appearing already blurred.
 */
function Backdrop({ art, dither }: { art: WorkspaceBackdropArt; dither: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [wasBlurred] = useState(() => lastBlurred);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- records this pane's blur state as its DOM goes away, for the next route's pane; sets no state
  useLayoutEffect(() => {
    const el = ref.current;
    // Layout cleanup runs before React detaches the DOM, so the pane is still there to read.
    return () => {
      lastBlurred = !!el?.parentElement?.querySelector("[data-assistant-citation-viewport]");
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="workspace-backdrop"
      data-was-blurred={wasBlurred || undefined}
    >
      <BackdropCanvas art={art} dither={dither} />
      <div className="workspace-backdrop-blur" />
    </div>
  );
}

/**
 * The dithered art sized to its parent element; also used small for the settings previews,
 * which pass `guardText={false}` because no text sits over them.
 */
export function BackdropCanvas({
  art,
  dither,
  guardText = true,
}: {
  art: WorkspaceBackdropArt;
  /** The dither setting, in half pixels; 0 is no dither. */
  dither: number;
  guardText?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // A layout effect, so a pane that mounts on navigation paints the art in its first frame.
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the canvas bitmap in step with its host's size and the decoded photo; no React state involved
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let photo: HTMLImageElement | null = isBackdropPhoto(art)
      ? (photoDecoded.get(art) ?? null)
      : null;
    let alive = true;

    const draw = (force = false) => {
      // Whole device pixels per cell, so no cell comes out a pixel wider than its neighbour.
      const dpr = window.devicePixelRatio || 1;
      const cellDev = Math.max(1, Math.round(backdropCellPx(art, dither) * dpr));
      const { width, height } = host.getBoundingClientRect();
      const cols = Math.max(1, Math.ceil((width * dpr) / cellDev));
      const rows = Math.max(1, Math.ceil((height * dpr) / cellDev));
      if (!force && canvas.width === cols * cellDev && canvas.height === rows * cellDev) return;
      if (isBackdropPhoto(art) && !photo) return;
      const cells = renderWorkspaceBackdropCells(
        cols,
        rows,
        art,
        photo ? photoCells(photo, cols, rows) : undefined,
        { guardText, dither: dither > 0 },
      );
      const small = document.createElement("canvas");
      small.width = cols;
      small.height = rows;
      small.getContext("2d")?.putImageData(new ImageData(cells, cols), 0, 0);
      canvas.width = cols * cellDev;
      canvas.height = rows * cellDev;
      canvas.style.width = `${canvas.width / dpr}px`;
      canvas.style.height = `${canvas.height / dpr}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    };

    // A new art choice must repaint even at the same size.
    draw(true);
    if (isBackdropPhoto(art) && !photo) {
      loadPhoto(art)
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
  }, [art, dither, guardText]);

  return (
    <canvas
      ref={canvasRef}
      className="workspace-backdrop-canvas"
      data-art={art}
      data-photo={isBackdropPhoto(art) || undefined}
    />
  );
}
