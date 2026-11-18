import type { CalendarItem, ItemId, PlacementTarget } from "../calendar/calendar-item";
export type PointerPoint = Readonly<{ clientX: number; clientY: number }>;
export type DropTarget = PlacementTarget;
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
      target: DropTarget | null;
      grabOffsetMinute: number;
    };
export type ItemPointerEvent = PointerEvent & { currentTarget: HTMLElement };
export type DragItemGetter = (itemId: ItemId) => CalendarItem | undefined;
