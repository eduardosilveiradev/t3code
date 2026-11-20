import {
  AlarmClockIcon,
  CircleXIcon,
  ClipboardListIcon,
  MessageCircleQuestionIcon,
  UserRoundIcon,
} from "lucide-react";
import type { SVGProps } from "react";

import { cn } from "~/lib/utils";
import { observeVisibleAnimation } from "~/lib/visibleAnimation";

type GlyphProps = SVGProps<SVGSVGElement>;

const MATRIX_DOTS = [3.5, 8, 12.5].flatMap((cy) => [3.5, 8, 12.5].map((cx) => ({ cx, cy })));

/** 3×3 dot matrix; its dots twinkle while visible and freeze part-lit when paused. */
export function MatrixGlyph({ className, ...props }: GlyphProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      ref={observeVisibleAnimation}
      className={cn("status-matrix", className)}
      {...props}
    >
      {MATRIX_DOTS.map((dot) => (
        <circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r="1.4" />
      ))}
    </svg>
  );
}

/** Two low dots, like an ellipsis: waiting on background work. */
export function WaitingDotsGlyph(props: GlyphProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...props}>
      <circle cx="5.5" cy="10" r="1.5" />
      <circle cx="10.5" cy="10" r="1.5" />
    </svg>
  );
}

/** Solid dot for a finished run you haven't opened. */
function UnreadDotGlyph(props: GlyphProps) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" {...props}>
      <circle cx="8" cy="8" r="3.5" />
    </svg>
  );
}

/** A thread's status glyph, shared by the sidebar and the command palette. */
export const THREAD_STATUS_ICONS = {
  working: MatrixGlyph,
  waiting: WaitingDotsGlyph,
  input: MessageCircleQuestionIcon,
  request: UserRoundIcon,
  approval: ClipboardListIcon,
  failed: CircleXIcon,
  done: UnreadDotGlyph,
  woke: AlarmClockIcon,
} as const;
