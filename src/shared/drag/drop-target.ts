import {
  durationOf,
  type CalendarItem,
  type DateKey,
  type PlacementTarget,
} from "../calendar/calendar-item";
import type { PointerPoint } from "./drag-types";
import { resolveTimedDropMinute } from "./drag-geometry";
export type DropTargetResolver = (
  point: PointerPoint,
  context: Readonly<{ item: CalendarItem; grabOffsetMinute: number; hourHeight: number }>,
) => PlacementTarget | null;
export const resolveDomDropTarget: DropTargetResolver = (point, context) => {
  const element = document
    .elementFromPoint(point.clientX, point.clientY)
    ?.closest<HTMLElement>("[data-drop-zone]");
  if (!element) return null;
  const zone = element.dataset.dropZone;
  const date = element.dataset.date as DateKey | undefined;
  if (!date) return null;
  if (zone === "all-day") return { type: "all-day", date };
  if (zone === "timed") {
    const rect = element.getBoundingClientRect();
    return {
      type: "timed",
      date,
      startMinute: resolveTimedDropMinute(
        point.clientY,
        rect.top,
        context.hourHeight,
        context.grabOffsetMinute,
        durationOf(context.item),
      ),
    };
  }
  return null;
};
