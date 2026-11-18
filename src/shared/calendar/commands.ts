import type { CalendarId } from "./calendars";
import type { ItemId, MinuteOfDay, PlacementTarget } from "./calendar-item";
import type { EditorChange } from "./editor";
export type CalendarCommand =
  | { type: "item.move"; itemId: ItemId; target: PlacementTarget }
  | { type: "item.resize"; itemId: ItemId; endMinute: MinuteOfDay }
  | { type: "calendar.set-visible"; calendarId: CalendarId; visible: boolean }
  | {
      type: "editor.open-create";
      target: PlacementTarget;
    }
  | { type: "editor.open-item"; itemId: ItemId }
  | { type: "editor.change"; change: EditorChange }
  | { type: "editor.save" }
  | { type: "editor.cancel" }
  | { type: "editor.delete" }
  | { type: "deletion.undo" };
