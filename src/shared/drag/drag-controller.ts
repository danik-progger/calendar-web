import { createSignal, type Accessor } from "solid-js";
import type { CalendarCommandResult } from "../calendar/calendar-model";
import type { ItemId } from "../calendar/calendar-item";
import type { DropTargetResolver } from "./drop-target";
import type { DragSession, ItemPointerEvent } from "./drag-types";
import { grabOffsetMinute } from "./drag-geometry";
export type DragControllerDependencies = Readonly<{
  getItem(itemId: ItemId): import("../calendar/calendar-item").CalendarItem | undefined;
  moveItem(
    itemId: ItemId,
    target: import("../calendar/calendar-item").PlacementTarget,
  ): Promise<CalendarCommandResult>;
  resolveDropTarget: DropTargetResolver;
  getHourHeight(): number;
  openItem(itemId: ItemId): void;
}>;
export type DragController = Readonly<{
  session: Accessor<DragSession>;
  pointerDown(itemId: ItemId, event: ItemPointerEvent): void;
  pointerMove(event: PointerEvent): void;
  pointerUp(event: PointerEvent): void;
  pointerCancel(): void;
  lostPointerCapture(): void;
  escape(): void;
  dispose(): void;
}>;
export function createDragController(dependencies: DragControllerDependencies): DragController {
  const [session, setSession] = createSignal<DragSession>({ phase: "idle" });
  const finish = (_event: PointerEvent | null, commit: boolean) => {
    const current = session();
    if (current.phase === "pending") {
      if (commit) dependencies.openItem(current.itemId);
      setSession({ phase: "idle" });
      return;
    }
    if (current.phase !== "dragging") {
      setSession({ phase: "idle" });
      return;
    }
    const target = current.target;
    setSession({ phase: "idle" });
    if (commit && target) void dependencies.moveItem(current.itemId, target);
  };
  return {
    session,
    pointerDown(itemId, event) {
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
    pointerMove(event) {
      const current = session();
      if (current.phase === "idle" || current.pointerId !== event.pointerId) return;
      if (current.phase === "pending") {
        if (
          Math.hypot(
            event.clientX - current.origin.clientX,
            event.clientY - current.origin.clientY,
          ) < 5
        )
          return;
        const item = dependencies.getItem(current.itemId);
        if (!item) return;
        const target = dependencies.resolveDropTarget(
          { clientX: event.clientX, clientY: event.clientY },
          {
            item,
            grabOffsetMinute: current.grabOffsetMinute,
            hourHeight: dependencies.getHourHeight(),
          },
        );
        setSession({
          phase: "dragging",
          itemId: current.itemId,
          pointerId: current.pointerId,
          target,
          grabOffsetMinute: current.grabOffsetMinute,
        });
      } else {
        const item = dependencies.getItem(current.itemId);
        if (!item) return;
        const target = dependencies.resolveDropTarget(
          { clientX: event.clientX, clientY: event.clientY },
          {
            item,
            grabOffsetMinute: current.grabOffsetMinute,
            hourHeight: dependencies.getHourHeight(),
          },
        );
        setSession({ ...current, target });
      }
    },
    pointerUp(event) {
      finish(event, true);
    },
    pointerCancel() {
      finish(null, false);
    },
    lostPointerCapture() {
      finish(null, false);
    },
    escape() {
      finish(null, false);
    },
    dispose() {
      setSession({ phase: "idle" });
    },
  };
}
