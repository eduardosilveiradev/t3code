import { useEffect, useRef } from "react";

import { useClientSettings } from "~/hooks/useSettings";
import { observeResize } from "~/lib/observeResize";
import {
  renderWorkspaceBackdropCells,
  WORKSPACE_BACKDROP_CELL_PX,
  type WorkspaceBackdropArt,
} from "./WorkspaceBackdrop.logic";

const REDRAW_DEBOUNCE_MS = 120;

/**
 * Dithered artwork behind the main pane, chosen in Appearance. Drawn once per size at one
 * canvas pixel per dither cell and scaled up with `image-rendering: pixelated`, so it costs
 * one small canvas write per resize and nothing per frame.
 */
export function WorkspaceBackdrop() {
  const art = useClientSettings((settings) => settings.workspaceBackdrop);
  if (art === "none") return null;
  return <WorkspaceBackdropCanvas art={art} />;
}

function WorkspaceBackdropCanvas({ art }: { art: WorkspaceBackdropArt }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the canvas bitmap in step with its host's size; no React state involved
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const draw = () => {
      const { width, height } = host.getBoundingClientRect();
      const cols = Math.max(1, Math.ceil(width / WORKSPACE_BACKDROP_CELL_PX));
      const rows = Math.max(1, Math.ceil(height / WORKSPACE_BACKDROP_CELL_PX));
      if (canvas.width === cols && canvas.height === rows) return;
      canvas.width = cols;
      canvas.height = rows;
      canvas.style.width = `${cols * WORKSPACE_BACKDROP_CELL_PX}px`;
      canvas.style.height = `${rows * WORKSPACE_BACKDROP_CELL_PX}px`;
      canvas
        .getContext("2d")
        ?.putImageData(new ImageData(renderWorkspaceBackdropCells(cols, rows, art), cols), 0, 0);
    };

    // A new art choice must repaint even at the same size.
    canvas.width = 0;
    draw();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopObserving = observeResize(host, () => {
      clearTimeout(timer);
      timer = setTimeout(draw, REDRAW_DEBOUNCE_MS);
    });
    return () => {
      stopObserving();
      clearTimeout(timer);
    };
  }, [art]);

  return (
    <div aria-hidden className="workspace-backdrop">
      <canvas ref={canvasRef} className="workspace-backdrop-canvas" />
    </div>
  );
}
