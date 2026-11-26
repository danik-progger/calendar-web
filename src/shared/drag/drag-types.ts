import type { ItemId, PlacementTarget } from "../calendar/calendar-item";
export type PointerPoint = Readonly<{ clientX: number; clientY: number }>;
export type DragSession =
  | { phase: "idle" }
  | {
      phase: "pending";
      itemId: ItemId;
      pointerId: number;
      origin: PointerPoint;
      grabOffsetMinute: number;
    }
  | {
      phase: "dragging";
      itemId: ItemId;
      pointerId: number;
      target: PlacementTarget | null;
      grabOffsetMinute: number;
    };
export type ItemPointerEvent = PointerEvent & { currentTarget: HTMLElement };
