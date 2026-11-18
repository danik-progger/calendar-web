import { moveItem, type CalendarItem, type ScheduledItem } from "../calendar/calendar-item";
import type { DragSession } from "./drag-types";
export function previewScheduledItem(
  item: CalendarItem | undefined,
  session: DragSession,
): ScheduledItem | null {
  if (!item || session.phase !== "dragging" || !session.target) return null;
  return moveItem(item, session.target);
}
