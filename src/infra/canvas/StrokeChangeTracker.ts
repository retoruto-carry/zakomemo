import type { Drawing, Stroke } from "../../core/types";
import type { StrokeWithNewPoints } from "./types";

export type StrokeDiff =
  | {
      mode: "diff";
      newStrokes: Stroke[];
      strokesWithNewPoints: StrokeWithNewPoints[];
    }
  | {
      mode: "scratch";
      reason: "uninitialized" | "removed" | "reordered";
    };

/**
 * Tracks stroke order and point counts to detect safe incremental updates.
 */
export class StrokeChangeTracker {
  private strokeOrder: string[] | null = null;
  private strokePointCounts: Map<string, number> = new Map();

  /**
   * Compare current drawing against tracked state.
   * Returns diff info or a scratch reason if incremental update is unsafe.
   */
  diff({ drawing }: { drawing: Drawing }): StrokeDiff {
    if (!this.strokeOrder) {
      return { mode: "scratch", reason: "uninitialized" };
    }

    const currentIds = drawing.strokes.map((stroke) => stroke.id);
    if (currentIds.length < this.strokeOrder.length) {
      return { mode: "scratch", reason: "removed" };
    }

    for (let i = 0; i < this.strokeOrder.length; i++) {
      if (currentIds[i] !== this.strokeOrder[i]) {
        return { mode: "scratch", reason: "reordered" };
      }
    }

    const newStrokes = drawing.strokes.slice(this.strokeOrder.length);
    const strokesWithNewPoints: StrokeWithNewPoints[] = [];

    for (const stroke of drawing.strokes.slice(0, this.strokeOrder.length)) {
      const cachedCount = this.strokePointCounts.get(stroke.id) ?? 0;
      if (stroke.points.length > cachedCount) {
        strokesWithNewPoints.push({
          stroke,
          cachedPointCount: cachedCount,
        });
      }
    }

    return {
      mode: "diff",
      newStrokes,
      strokesWithNewPoints,
    };
  }

  /** Sync tracker state to the current drawing after a successful render. */
  sync({ drawing }: { drawing: Drawing }): void {
    this.strokeOrder = drawing.strokes.map((stroke) => stroke.id);
    this.strokePointCounts.clear();
    for (const stroke of drawing.strokes) {
      this.strokePointCounts.set(stroke.id, stroke.points.length);
    }
  }

  /** Clear tracked state. */
  reset(): void {
    this.strokeOrder = null;
    this.strokePointCounts.clear();
  }
}
