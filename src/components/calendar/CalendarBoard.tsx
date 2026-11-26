import { createRenderEffect, createSignal, onCleanup, onMount } from "solid-js";
import { type CalendarCommandResult, type DayItems } from "../../shared/calendar/model";
import type { CalendarDay } from "../../shared/calendar/view";
import type { DateKey, ItemId, MinuteOfDay } from "../../shared/calendar/calendar-item";
import type { DragController } from "../../shared/drag/drag-controller";
import { DaysHeader } from "./DaysHeader";
import { AllDayEventsHeader } from "./AllDayEventsHeader";
import { Timeline } from "./Timeline";
import { animateInitialEvents, captureEventMotion } from "./event-motion";
import "./calendar-board.css";
import "./calendar-event.css";

export function CalendarBoard(props: {
  days: readonly CalendarDay[];
  itemsByDate: ReadonlyMap<DateKey, DayItems>;
  hourHeight: number;
  onHourHeightChange(height: number): void;
  currentMinute: MinuteOfDay;
  drag: DragController;
  dropRevision: number;
  onEmptySlotClick(date: DateKey, startMinute: MinuteOfDay): void;
  onAllDaySlotClick(date: DateKey): void;
  onHorizontalWheel(delta: number): void;
  onResizeItem(itemId: ItemId, endMinute: MinuteOfDay): Promise<CalendarCommandResult>;
}) {
  let board!: HTMLElement;
  let updateHeight: (() => void) | undefined;
  let pendingMotion: (() => void) | undefined;
  let lastDrop = props.dropRevision;
  const [itemsByDate, setItemsByDate] = createSignal(props.itemsByDate);
  createRenderEffect(() => {
    const items = props.itemsByDate;
    const drop = props.dropRevision;
    // Capture before updating the keyed cards, then animate their committed layout.
    if (drop !== lastDrop) {
      lastDrop = drop;
      pendingMotion = undefined;
    } else if (board?.isConnected && !pendingMotion) {
      pendingMotion = captureEventMotion(board);
      if (pendingMotion) {
        queueMicrotask(() => {
          if (board.isConnected) updateHeight?.();
          pendingMotion?.();
          pendingMotion = undefined;
        });
      }
    }
    setItemsByDate(items);
  });
  onMount(() => {
    const container = board.parentElement!;
    const header = board.querySelector<HTMLElement>(".calendar-board__header")!;
    const allDay = board.querySelector<HTMLElement>(".calendar-board__all-day")!;
    updateHeight = () =>
      props.onHourHeightChange(
        Math.max(1, (container.clientHeight - header.offsetHeight - allDay.offsetHeight) / 8),
      );
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    observer.observe(header);
    observer.observe(allDay);
    updateHeight();
    animateInitialEvents(board);
    onCleanup(() => observer.disconnect());
    requestAnimationFrame(() => {
      container.scrollTop = props.hourHeight * 9;
    });
  });
  const bucketFor = (date: DateKey) => itemsByDate().get(date) ?? { timed: [], allDay: [] };
  const gridStyle = () => ({ "--calendar-day-count": props.days.length });
  const timedGridStyle = () => ({
    ...gridStyle(),
    "--calendar-hour-height": `${props.hourHeight}px`,
  });
  const previewFor = (date: DateKey, type: "timed" | "all-day") => {
    const item = props.drag.preview();
    return item?.placement.type === type && item.placement.date === date ? item : null;
  };
  return (
    <section
      class="calendar-board"
      data-testid="calendar-board"
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
        drag={props.drag}
        hourHeight={props.hourHeight}
        onEmptyCellClick={props.onAllDaySlotClick}
      />
      <Timeline
        days={props.days}
        bucketFor={bucketFor}
        style={timedGridStyle()}
        hourHeight={props.hourHeight}
        currentMinute={props.currentMinute}
        previewFor={(date) => previewFor(date, "timed")}
        drag={props.drag}
        onEmptySlotClick={props.onEmptySlotClick}
        onResizeItem={props.onResizeItem}
      />
    </section>
  );
}
