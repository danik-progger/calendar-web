import { createSignal, onCleanup, onMount } from "solid-js";
import { type CalendarCommandResult, type DayItems } from "../../shared/calendar/calendar-model";
import type { CalendarDay } from "../../shared/calendar/calendar-view";
import type {
  CalendarItem,
  DateKey,
  ItemId,
  MinuteOfDay,
} from "../../shared/calendar/calendar-item";
import type { DragSession, ItemPointerEvent } from "../../shared/drag/drag-types";
import { previewScheduledItem } from "../../shared/drag/drag-preview";
import { DaysHeader } from "./DaysHeader";
import { AllDayEventsHeader } from "./AllDayEventsHeader";
import { Timeline } from "./Timeline";
import "./calendar-board.css";
import "./calendar-event.css";

export function CalendarBoard(props: {
  days: readonly CalendarDay[];
  itemsByDate: ReadonlyMap<DateKey, DayItems>;
  hourHeight: number;
  onHourHeightChange(height: number): void;
  todayKey: DateKey;
  currentMinute: MinuteOfDay;
  currentTimeLabel: string;
  dragSession: DragSession;
  draggedItem: CalendarItem | undefined;
  onEmptySlotClick(date: DateKey, startMinute: MinuteOfDay): void;
  onAllDaySlotClick(date: DateKey): void;
  onHorizontalWheel(delta: number): void;
  onResizeItem(itemId: ItemId, endMinute: MinuteOfDay): Promise<CalendarCommandResult>;
  onItemPointerDown(itemId: ItemId, event: ItemPointerEvent): void;
  onItemPointerMove(event: PointerEvent): void;
  onItemPointerUp(event: PointerEvent): void;
  onItemPointerCancel(): void;
  onOpenItem(itemId: ItemId): void;
}) {
  let board!: HTMLElement;
  const [entering, setEntering] = createSignal(true);
  onMount(() => {
    const container = board.parentElement!;
    const header = board.querySelector<HTMLElement>(".calendar-board__header")!;
    const allDay = board.querySelector<HTMLElement>(".calendar-board__all-day")!;
    const updateHeight = () =>
      props.onHourHeightChange(
        Math.max(1, (container.clientHeight - header.offsetHeight - allDay.offsetHeight) / 8),
      );
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    observer.observe(header);
    observer.observe(allDay);
    updateHeight();
    onCleanup(() => observer.disconnect());
    const timer = window.setTimeout(() => setEntering(false), 1000);
    requestAnimationFrame(() => {
      container.scrollTop = props.hourHeight * 9;
    });
    onCleanup(() => window.clearTimeout(timer));
  });
  const bucketFor = (date: DateKey) => props.itemsByDate.get(date) ?? { timed: [], allDay: [] };
  const gridStyle = () => ({ "--calendar-day-count": props.days.length });
  const timedGridStyle = () => ({
    ...gridStyle(),
    "--calendar-hour-height": `${props.hourHeight}px`,
  });
  const preview = () => previewScheduledItem(props.draggedItem, props.dragSession);
  const previewFor = (date: DateKey, type: "timed" | "all-day") => {
    const item = preview();
    return item?.placement.type === type && item.placement.date === date ? item : null;
  };
  return (
    <section
      class="calendar-board"
      data-testid="calendar-board"
      data-event-entry={entering() ? "true" : undefined}
      ref={board}
      onWheel={(event) => {
        const delta =
          Math.abs(event.deltaX) > Math.abs(event.deltaY)
            ? event.deltaX
            : event.shiftKey
              ? event.deltaY
              : 0;
        if (delta) {
          event.preventDefault();
          setEntering(false);
          props.onHorizontalWheel(delta);
        }
      }}
    >
      <DaysHeader
        days={props.days}
        style={gridStyle()}
        onAddEvent={() => {
          const day = props.days.find((day) => day.isToday) ?? props.days[0];
          if (day) props.onEmptySlotClick(day.key, 9 * 60);
        }}
      />
      <AllDayEventsHeader
        days={props.days}
        bucketFor={bucketFor}
        style={gridStyle()}
        previewFor={(date) => previewFor(date, "all-day")}
        dragSession={props.dragSession}
        hourHeight={props.hourHeight}
        onEmptyCellClick={props.onAllDaySlotClick}
        onItemPointerDown={props.onItemPointerDown}
        onItemPointerMove={props.onItemPointerMove}
        onItemPointerUp={props.onItemPointerUp}
        onItemPointerCancel={props.onItemPointerCancel}
        onOpenItem={props.onOpenItem}
      />
      <Timeline
        days={props.days}
        bucketFor={bucketFor}
        style={timedGridStyle()}
        hourHeight={props.hourHeight}
        todayKey={props.todayKey}
        currentMinute={props.currentMinute}
        currentTimeLabel={props.currentTimeLabel}
        previewFor={(date) => previewFor(date, "timed")}
        dragSession={props.dragSession}
        onEmptySlotClick={props.onEmptySlotClick}
        onResizeItem={props.onResizeItem}
        onItemPointerDown={props.onItemPointerDown}
        onItemPointerMove={props.onItemPointerMove}
        onItemPointerUp={props.onItemPointerUp}
        onItemPointerCancel={props.onItemPointerCancel}
        onOpenItem={props.onOpenItem}
      />
    </section>
  );
}
