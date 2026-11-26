import { CalendarPicker } from "./CalendarPicker";
import type { CalendarDefinition } from "../../shared/calendar/calendars";
import type { CalendarItem } from "../../shared/calendar/calendar-item";
import type { EditorChange } from "../../shared/calendar/editor";

export function EventModalMetadata(props: {
  draft: CalendarItem;
  calendars: readonly CalendarDefinition[];
  onChange(change: EditorChange): void;
}) {
  return (
    <>
      <div class="event-editor__metadata">
        <div class="event-editor__field-row event-editor__calendar-row">
          <CalendarPicker
            value={props.draft.calendarId}
            calendars={props.calendars}
            onChange={(value) => props.onChange({ type: "calendar", value })}
          />
        </div>
      </div>
      <div class="event-editor__description">
        <textarea
          class="event-editor__notes"
          value={props.draft.notes}
          placeholder="Add description..."
          aria-label="Description"
          data-testid="event-description"
          onInput={(event) => props.onChange({ type: "notes", value: event.currentTarget.value })}
        />
      </div>
    </>
  );
}
