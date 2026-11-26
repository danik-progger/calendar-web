import { createMemo, For, Show } from "solid-js";
import type { CalendarCommandResult, DayItems } from "../../shared/calendar/model";
import type { CalendarDay } from "../../shared/calendar/view";
import type {
  DateKey,
  ItemId,
  MinuteOfDay,
  CalendarItem,
} from "../../shared/calendar/calendar-item";
import {
  minuteToPixel,
  pixelToMinute,
  snapMinute,
  timeInputFromMinute,
} from "../../shared/calendar/date-time";
import type { DragController } from "../../shared/drag/drag-controller";
import { CalendarEvent } from "./CalendarEvent";
import { EventCards } from "./EventCards";
import { TimelineSidebar } from "./TimelineSidebar";
import { timedEventColumns } from "./timed-event-layout";

const hours = Array.from({ length: 24 }, (_, index) => index);

export function Timeline(props: {
  days: readonly CalendarDay[];
  bucketFor(date: DateKey): DayItems;
  style: Record<string, string | number>;
  hourHeight: number;
  currentMinute: MinuteOfDay;
  previewFor(date: DateKey): CalendarItem | null;
  drag: DragController;
  onEmptySlotClick(date: DateKey, minute: MinuteOfDay): void;
  onResizeItem(itemId: ItemId, endMinute: MinuteOfDay): Promise<CalendarCommandResult>;
}) {
  return (
    <div
      data-testid="calendar-timed"
      class="calendar-board__timed calendar-board__days-grid"
      style={props.style}
    >
      <TimelineSidebar hourHeight={props.hourHeight} />
      <For each={props.days}>
        {(day) => {
          const items = () => props.bucketFor(day.key).timed;
          const columns = createMemo(() => timedEventColumns(items(), props.hourHeight));
          const preview = () => props.previewFor(day.key);
          const previewColumns = createMemo(() => {
            const item = preview();
            return (
              item &&
              timedEventColumns(
                [...items().filter(({ id }) => id !== item.id), item],
                props.hourHeight,
              )
            );
          });
          return (
            <div
              data-testid="calendar-day-column"
              class="calendar-board__day-column"
              data-drop-zone="timed"
              data-date={day.key}
              style={{ height: `${props.hourHeight * 24}px` }}
              onDblClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                props.onEmptySlotClick(
                  day.key,
                  snapMinute(pixelToMinute(event.clientY - rect.top, props.hourHeight)),
                );
              }}
            >
              <For each={hours}>
                {(hour) => (
                  <div
                    class="calendar-board__hour-line"
                    onClick={() => props.onEmptySlotClick(day.key, hour * 60)}
                  />
                )}
              </For>
              <Show when={day.isToday}>
                <div
                  class="calendar-board__current-time"
                  style={{ top: `${minuteToPixel(props.currentMinute, props.hourHeight)}px` }}
                >
                  <span>{timeInputFromMinute(props.currentMinute)}</span>
                </div>
              </Show>
              <EventCards
                items={items()}
                columns={columns()}
                hourHeight={props.hourHeight}
                drag={props.drag}
                onResizeEnd={props.onResizeItem}
              />
              <Show when={preview()} keyed>
                {(item) => (
                  <CalendarEvent
                    item={item}
                    column={previewColumns()?.get(item.id)}
                    preview
                    hourHeight={props.hourHeight}
                  />
                )}
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}
