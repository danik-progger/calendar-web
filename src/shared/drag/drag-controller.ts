import { createMemo, createSignal } from "solid-js";
import {
  moveItem,
  type CalendarItem,
  type ItemId,
  type PlacementTarget,
} from "../calendar/calendar-item";
import type { DropTargetResolver } from "./drop-target";
import type { DragSession, ItemPointerEvent } from "./drag-types";
import { grabOffsetMinute } from "./drag-geometry";
type DragControllerDependencies = Readonly<{
  getItem(itemId: ItemId): CalendarItem | undefined;
  moveItem(itemId: ItemId, target: PlacementTarget): void;
  resolveDropTarget: DropTargetResolver;
  getHourHeight(): number;
  openItem(itemId: ItemId): void;
}>;
export type DragController = ReturnType<typeof createDragController>;

export function createDragController(dependencies: DragControllerDependencies) {
  const [session, setSession] = createSignal<DragSession>({ phase: "idle" });
  const preview = createMemo(() => {
    const current = session();
    if (current.phase !== "dragging" || !current.target) return null;
    const item = dependencies.getItem(current.itemId);
    return item ? moveItem(item, current.target) : null;
  });
  const cancel = () => {
    setSession({ phase: "idle" });
  };
  return {
    session,
    preview,
    openItem: dependencies.openItem,
    pointerDown(itemId: ItemId, event: ItemPointerEvent) {
      if (
        event.button !== 0 ||
        (event.target instanceof Element && event.target.closest("input,button,textarea,select"))
      )
        return;
      const item = dependencies.getItem(itemId);
      if (!item) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const grabOffset =
        item.placement.type === "timed"
          ? grabOffsetMinute(
              event.clientY,
              event.currentTarget.getBoundingClientRect().top,
              dependencies.getHourHeight(),
            )
          : 0;
      setSession({
        phase: "pending",
        itemId,
        pointerId: event.pointerId,
        origin: { clientX: event.clientX, clientY: event.clientY },
        grabOffsetMinute: grabOffset,
      });
    },
    pointerMove(event: PointerEvent) {
      const current = session();
      if (current.phase === "idle" || current.pointerId !== event.pointerId) return;
      if (
        current.phase === "pending" &&
        Math.hypot(event.clientX - current.origin.clientX, event.clientY - current.origin.clientY) <
          5
      )
        return;

      const { itemId, pointerId, grabOffsetMinute } = current;
      const item = dependencies.getItem(itemId);
      if (!item) return;
      const target = dependencies.resolveDropTarget(event, {
        item,
        grabOffsetMinute,
        hourHeight: dependencies.getHourHeight(),
      });
      setSession({ phase: "dragging", itemId, pointerId, grabOffsetMinute, target });
    },
    pointerUp() {
      const current = session();
      if (current.phase === "pending") dependencies.openItem(current.itemId);
      cancel();
      if (current.phase === "dragging" && current.target)
        dependencies.moveItem(current.itemId, current.target);
    },
    cancel,
  };
}
