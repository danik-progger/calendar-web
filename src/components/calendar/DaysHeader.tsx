import { Plus } from "@animateicons/vanilla/lucide";
import { AnimatedIcon } from "../icons/AnimatedIcon";
import { For } from "solid-js";
import type { CalendarDay } from "../../shared/calendar/view";

export function DaysHeader(props: {
  days: readonly CalendarDay[];
  style: Record<string, string | number>;
  onAddEvent(): void;
}) {
  return (
    <div class="calendar-board__header calendar-board__days-grid" style={props.style}>
      <button
        class="calendar-board__add"
        type="button"
        aria-label="Add event"
        onClick={props.onAddEvent}
      >
        <AnimatedIcon icon={Plus} size={14} />
      </button>
      <For each={props.days}>
        {(day) => (
          <div
            data-testid="calendar-day-header"
            class="calendar-board__day-header"
            data-today={day.isToday ? "true" : "false"}
          >
            <span>{day.weekday}</span>
            <b>{day.dayNumber}</b>
          </div>
        )}
      </For>
    </div>
  );
}
