import { For } from "solid-js";
import { formatHourLabel } from "../../shared/calendar/date-time";

const hours = Array.from({ length: 24 }, (_, index) => index);

export function TimelineSidebar(_props: { hourHeight: number }) {
  return (
    <div data-testid="calendar-time-rail" class="calendar-board__time-rail">
      <For each={hours}>
        {(hour) => <span data-testid="calendar-time-label">{formatHourLabel(hour * 60)}</span>}
      </For>
    </div>
  );
}
