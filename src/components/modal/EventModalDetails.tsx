import { Check, Square } from "@animateicons/vanilla/lucide";
import allDayOutline from "../icons/all-day-outline.json";
import { AnimatedIcon } from "../icons/AnimatedIcon";
import { DatePicker } from "./DatePicker";
import { TimePicker } from "./TimePicker";
import { Show } from "solid-js";
import type { CalendarItem, TimedPlacement } from "../../shared/calendar/calendar-item";
import type { EditorChange } from "../../shared/calendar/editor";
import { minuteFromTimeInput, timeInputFromMinute } from "../../shared/calendar/date-time";

const roundedSquare = {
  ...Square,
  children: Square.children?.map((child) => ({ ...child, attrs: allDayOutline })),
};

export function EventModalDetails(props: {
  draft: CalendarItem;
  onChange(change: EditorChange): void;
}) {
  const placement = () => props.draft.placement;
  const timed = (): TimedPlacement | null => {
    const value = placement();
    return value.type === "timed" ? value : null;
  };
  const setTime = (which: "start" | "end", value: string) => {
    const current = timed();
    if (!current) return;
    const next = minuteFromTimeInput(value);
    props.onChange({
      type: "time-range",
      startMinute: which === "start" ? next : current.startMinute,
      endMinute: which === "end" ? next : current.endMinute,
    });
  };
  return (
    <>
      <div class="event-editor__title-row">
        <input
          class="event-editor__title"
          data-testid="event-title"
          autofocus
          value={props.draft.title}
          aria-label="Event title"
          placeholder="Event title"
          onInput={(event) => props.onChange({ type: "title", value: event.currentTarget.value })}
        />
      </div>
      <div class="event-editor__details">
        <div class="event-editor__field-row">
          <DatePicker
            value={placement().date}
            onChange={(value) => props.onChange({ type: "date", value })}
          />
          <Show when={timed()}>
            {(current) => (
              <div class="event-editor__time-row">
                <TimePicker
                  value={timeInputFromMinute(current().startMinute)}
                  label="Start time"
                  testId="event-start-time"
                  onChange={(value) => setTime("start", value)}
                />
                <span class="event-editor__time-separator" aria-hidden="true">
                  –
                </span>
                <TimePicker
                  value={timeInputFromMinute(current().endMinute)}
                  label="End time"
                  testId="event-end-time"
                  onChange={(value) => setTime("end", value)}
                />
              </div>
            )}
          </Show>
        </div>
        <label class="event-editor__field-row event-editor__all-day">
          <input
            type="checkbox"
            data-testid="event-all-day"
            checked={placement().type === "all-day"}
            onChange={(event) =>
              props.onChange({ type: "all-day", value: event.currentTarget.checked })
            }
          />
          <span class="event-editor__check" aria-hidden="true">
            <Show
              when={placement().type === "all-day"}
              fallback={<AnimatedIcon icon={roundedSquare} size={16} />}
            >
              <AnimatedIcon icon={Check} size={12} />
            </Show>
          </span>
          <span>All day</span>
        </label>
      </div>
    </>
  );
}
