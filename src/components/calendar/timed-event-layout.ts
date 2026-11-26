import type { ItemId, CalendarItem } from "../../shared/calendar/calendar-item";
import { minuteToPixel } from "../../shared/calendar/date-time";

export type EventColumn = { index: number; count: number };

export function timedCardHeight(duration: number, hourHeight: number): number {
  return Math.max(minuteToPixel(duration, hourHeight), duration < 30 ? 24 : 38) - 3;
}

export function timedEventColumns(items: readonly CalendarItem[], hourHeight: number) {
  const timed = items.flatMap(({ id, placement }) =>
    placement.type === "timed" ? [{ id, ...placement }] : [],
  );
  timed.sort(
    (a, b) =>
      a.startMinute - b.startMinute ||
      b.endMinute - a.endMinute ||
      (a.id < b.id ? -1 : Number(a.id !== b.id)),
  );

  const columns = new Map<ItemId, EventColumn>();
  let group: EventColumn[] = [];
  let columnEnds: number[] = [];
  let groupEnd = 0;
  for (const { id, startMinute, endMinute } of timed) {
    const top = minuteToPixel(startMinute, hourHeight);
    if (top >= groupEnd) {
      for (const column of group) column.count = columnEnds.length;
      group = [];
      columnEnds = [];
    }
    const free = columnEnds.findIndex((end) => end <= top);
    const column = { index: free >= 0 ? free : columnEnds.length, count: 1 };
    const bottom = Math.max(
      minuteToPixel(endMinute, hourHeight),
      top + timedCardHeight(endMinute - startMinute, hourHeight),
    );
    columnEnds[column.index] = bottom;
    groupEnd = Math.max(groupEnd, bottom);
    group.push(column);
    columns.set(id, column);
  }
  for (const column of group) column.count = columnEnds.length;
  return columns;
}
