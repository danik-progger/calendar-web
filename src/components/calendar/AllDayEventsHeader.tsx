import { For, Show } from "solid-js";
import type { DayItems } from "../../shared/calendar/model";
import type { CalendarDay } from "../../shared/calendar/view";
import type { DateKey, CalendarItem } from "../../shared/calendar/calendar-item";
import type { DragController } from "../../shared/drag/drag-controller";
import { CalendarEvent } from "./CalendarEvent";
import { EventCards } from "./EventCards";

export function AllDayEventsHeader(props: {
  days: readonly CalendarDay[];
  bucketFor(date: DateKey): DayItems;
  style: Record<string, string | number>;
  previewFor(date: DateKey): CalendarItem | null;
  drag: DragController;
  hourHeight: number;
  onEmptyCellClick(date: DateKey): void;
}) {
  return (
    <div class="calendar-board__all-day calendar-board__days-grid" style={props.style}>
      <div />
      <For each={props.days}>
        {(day) => (
          <div
            data-testid="calendar-all-day-cell"
            class="calendar-board__all-day-cell"
            data-drop-zone="all-day"
            data-date={day.key}
          >
            <button
              type="button"
              class="calendar-board__all-day-create"
              data-testid="calendar-all-day-create"
              aria-label={`Create all-day event on ${day.key}`}
              onClick={() => props.onEmptyCellClick(day.key)}
            />
            <EventCards
              items={props.bucketFor(day.key).allDay}
              hourHeight={props.hourHeight}
              drag={props.drag}
              allDay
            />
            <Show when={props.previewFor(day.key)} keyed>
              {(item) => <CalendarEvent item={item} allDay preview hourHeight={props.hourHeight} />}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
