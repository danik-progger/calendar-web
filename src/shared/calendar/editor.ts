import type { CalendarItem, DateKey, ItemId, MinuteOfDay, TimedPlacement } from "./calendar-item";
import type { CalendarId } from "./calendars";
export type EditorError =
  | "title-required"
  | "invalid-date"
  | "invalid-time-range"
  | "item-not-found";
export type EditorChange =
  | { type: "title"; value: string }
  | { type: "notes"; value: string }
  | { type: "calendar"; value: CalendarId }
  | { type: "date"; value: DateKey }
  | { type: "time-range"; startMinute: MinuteOfDay; endMinute: MinuteOfDay }
  | { type: "all-day"; value: boolean };
export type EditorSession =
  | Readonly<{
      mode: "create";
      draft: CalendarItem;
      previousTimedPlacement: TimedPlacement | null;
      error: EditorError | null;
    }>
  | Readonly<{
      mode: "edit";
      originalId: ItemId;
      draft: CalendarItem;
      previousTimedPlacement: TimedPlacement | null;
      error: EditorError | null;
    }>
  | null;
