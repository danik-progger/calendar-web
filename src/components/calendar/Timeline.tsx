import { For, Show } from "solid-js";
import type { CalendarCommandResult, DayItems } from "../../shared/calendar/calendar-model";
import type { CalendarDay } from "../../shared/calendar/calendar-view";
import type {
  DateKey,
  ItemId,
  MinuteOfDay,
  ScheduledItem,
} from "../../shared/calendar/calendar-item";
import { minuteToPixel, pixelToMinute, snapMinute } from "../../shared/calendar/date-time";
import type { DragSession, ItemPointerEvent } from "../../shared/drag/drag-types";
import { CalendarEvent } from "./CalendarEvent";
import { FadingEvents } from "./FadingEvents";
import { TimelineSidebar } from "./TimelineSidebar";

const hours = Array.from({ length: 24 }, (_, index) => index);

export function Timeline(props: {
  days: readonly CalendarDay[];
  bucketFor(date: DateKey): DayItems;
  style: Record<string, string | number>;
  hourHeight: number;
  todayKey: DateKey;
  currentMinute: MinuteOfDay;
  currentTimeLabel: string;
  previewFor(date: DateKey): ScheduledItem | null;
  dragSession: DragSession;
  onEmptySlotClick(date: DateKey, minute: MinuteOfDay): void;
  onResizeItem(itemId: ItemId, endMinute: MinuteOfDay): Promise<CalendarCommandResult>;
  onItemPointerDown(itemId: ItemId, event: ItemPointerEvent): void;
  onItemPointerMove(event: PointerEvent): void;
  onItemPointerUp(event: PointerEvent): void;
  onItemPointerCancel(): void;
  onOpenItem(itemId: ItemId): void;
}) {
  return (
    <div
      data-testid="calendar-timed"
      class="calendar-board__timed calendar-board__days-grid"
      style={props.style}
    >
      <TimelineSidebar hourHeight={props.hourHeight} />
      <For each={props.days}>
        {(day) => (
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
            <Show when={day.key === props.todayKey}>
              <div
                class="calendar-board__current-time"
                style={{ top: `${minuteToPixel(props.currentMinute, props.hourHeight)}px` }}
              >
                <span>{props.currentTimeLabel}</span>
              </div>
            </Show>
            <FadingEvents
              items={props.bucketFor(day.key).timed}
              hourHeight={props.hourHeight}
              dragSession={props.dragSession}
              onOpenItem={props.onOpenItem}
              onResizeEnd={props.onResizeItem}
              onPointerDown={props.onItemPointerDown}
              onPointerMove={props.onItemPointerMove}
              onPointerUp={props.onItemPointerUp}
              onPointerCancel={props.onItemPointerCancel}
            />
            <Show when={props.previewFor(day.key)} keyed>
              {(item) => (
                <CalendarEvent
                  item={item}
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
