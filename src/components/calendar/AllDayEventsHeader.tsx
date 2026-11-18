import { For, Show } from "solid-js";
import type { DayItems } from "../../shared/calendar/calendar-model";
import type { CalendarDay } from "../../shared/calendar/calendar-view";
import type { DateKey, ItemId, ScheduledItem } from "../../shared/calendar/calendar-item";
import type { DragSession, ItemPointerEvent } from "../../shared/drag/drag-types";
import { CalendarEvent } from "./CalendarEvent";
import { FadingEvents } from "./FadingEvents";

export function AllDayEventsHeader(props: {
  days: readonly CalendarDay[];
  bucketFor(date: DateKey): DayItems;
  style: Record<string, string | number>;
  previewFor(date: DateKey): ScheduledItem | null;
  dragSession: DragSession;
  hourHeight: number;
  onEmptyCellClick(date: DateKey): void;
  onItemPointerDown(itemId: ItemId, event: ItemPointerEvent): void;
  onItemPointerMove(event: PointerEvent): void;
  onItemPointerUp(event: PointerEvent): void;
  onItemPointerCancel(): void;
  onOpenItem(itemId: ItemId): void;
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
            <FadingEvents
              items={props.bucketFor(day.key).allDay}
              hourHeight={props.hourHeight}
              dragSession={props.dragSession}
              onOpenItem={props.onOpenItem}
              allDay
              onPointerDown={props.onItemPointerDown}
              onPointerMove={props.onItemPointerMove}
              onPointerUp={props.onItemPointerUp}
              onPointerCancel={props.onItemPointerCancel}
            />
            <Show when={props.previewFor(day.key)} keyed>
              {(item) => (
                <CalendarEvent
                  item={item}
                  allDay
                  preview
                  hourHeight={props.hourHeight}
                  onOpen={() => undefined}
                  onPointerDown={props.onItemPointerDown}
                  onPointerMove={props.onItemPointerMove}
                  onPointerUp={props.onItemPointerUp}
                  onPointerCancel={props.onItemPointerCancel}
                />
              )}
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}
