import type { CalendarId } from "./calendars";
import { clampTimeRange } from "./date-time";

export type ItemId = string;
export type DateKey = `${number}-${number}-${number}`;
export type MinuteOfDay = number;
export type TimedPlacement = Readonly<{
  type: "timed";
  date: DateKey;
  startMinute: MinuteOfDay;
  endMinute: MinuteOfDay;
}>;
export type AllDayPlacement = Readonly<{ type: "all-day"; date: DateKey }>;
export type CalendarItem = Readonly<{
  id: ItemId;
  title: string;
  calendarId: CalendarId;
  notes: string;
  durationMinute?: number;
  type: "event";
  presentation: "standard" | "focus" | "call";
  placement: TimedPlacement | AllDayPlacement;
}>;
export type PlacementTarget =
  | { type: "timed"; date: DateKey; startMinute: MinuteOfDay }
  | { type: "all-day"; date: DateKey };
export const MINUTES_PER_DAY = 1440;
export const DEFAULT_START_MINUTE = 9 * 60;
export const DEFAULT_DURATION_MINUTES = 45;
export const MIN_DURATION_MINUTES = 5;
export const DRAG_SNAP_MINUTES = 5;

export function createTimedEvent(input: {
  id: ItemId;
  title: string;
  calendarId: CalendarId;
  date: DateKey;
  startMinute: number;
  durationMinute?: number;
  presentation?: CalendarItem["presentation"];
  notes?: string;
}): CalendarItem {
  const range = clampTimeRange(
    input.startMinute,
    input.startMinute + (input.durationMinute ?? DEFAULT_DURATION_MINUTES),
  );
  return {
    id: input.id,
    title: input.title.trim(),
    calendarId: input.calendarId,
    notes: input.notes ?? "",
    type: "event",
    presentation: input.presentation ?? "standard",
    placement: { type: "timed", date: input.date, ...range },
  };
}
export function moveItem(item: CalendarItem, target: PlacementTarget): CalendarItem {
  const durationMinute = durationOf(item);
  const placement: CalendarItem["placement"] =
    target.type === "all-day"
      ? { type: "all-day", date: target.date }
      : {
          type: "timed",
          date: target.date,
          ...clampTimeRange(target.startMinute, target.startMinute + durationMinute),
        };
  return { ...item, durationMinute, placement };
}
export function resizeTimedItem(item: CalendarItem, endMinute: number): CalendarItem {
  if (item.placement.type !== "timed") return item;
  return {
    ...item,
    placement: {
      ...item.placement,
      endMinute: Math.min(
        MINUTES_PER_DAY,
        Math.max(item.placement.startMinute + MIN_DURATION_MINUTES, Math.round(endMinute)),
      ),
    },
  };
}
export function setItemAllDay(
  item: CalendarItem,
  allDay: boolean,
  previous: TimedPlacement | null,
): CalendarItem {
  if (allDay === (item.placement.type === "all-day")) return item;
  const date = item.placement.date;
  if (allDay) return moveItem(item, { type: "all-day", date });
  if (previous) return { ...item, placement: { ...previous, date } };
  return moveItem(item, { type: "timed", date, startMinute: DEFAULT_START_MINUTE });
}

export function durationOf(item: CalendarItem): number {
  return item.placement.type === "timed"
    ? Math.max(MIN_DURATION_MINUTES, item.placement.endMinute - item.placement.startMinute)
    : (item.durationMinute ?? DEFAULT_DURATION_MINUTES);
}
