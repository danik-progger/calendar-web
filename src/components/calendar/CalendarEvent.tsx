import { createSignal, Show } from "solid-js";
import type { CalendarCommandResult } from "../../shared/calendar/model";
import type { ItemId, CalendarItem, TimedPlacement } from "../../shared/calendar/calendar-item";
import { calendarById } from "../../shared/calendar/calendars";
import { formatTimeRange, minuteToPixel } from "../../shared/calendar/date-time";
import { resolveTimedResizeEndMinute } from "../../shared/drag/drag-geometry";
import type { DragController } from "../../shared/drag/drag-controller";
import { timedCardHeight, type EventColumn } from "./timed-event-layout";

export function CalendarEvent(props: {
  item: CalendarItem;
  allDay?: boolean;
  drag?: DragController;
  preview?: boolean;
  column?: EventColumn;
  hourHeight: number;
  onResizeEnd?(itemId: ItemId, endMinute: number): Promise<CalendarCommandResult>;
}) {
  const item = () => props.item;
  const calendar = () => calendarById(item().calendarId);
  const dragging = () => {
    const session = props.drag?.session();
    return session?.phase === "dragging" && session.itemId === item().id;
  };
  const timed = () =>
    item().placement.type === "timed" ? (item().placement as TimedPlacement) : null;
  const [resizeEnd, setResizeEnd] = createSignal<number | null>(null);
  let resizePointerId: number | null = null;
  let resizeOriginY = 0;
  const displayedEnd = () => resizeEnd() ?? timed()?.endMinute ?? 30;
  const duration = () => (timed() ? displayedEnd() - timed()!.startMinute : 30);
  const compactTimed = () => Boolean(timed() && duration() < 30);
  const finishResize = (commit: boolean) => {
    const endMinute = resizeEnd();
    resizePointerId = null;
    setResizeEnd(null);
    if (commit && timed() && endMinute !== null && endMinute !== timed()!.endMinute)
      void props.onResizeEnd?.(item().id, endMinute);
  };
  return (
    <article
      class="event-card"
      data-testid="calendar-event"
      data-event-id={item().id}
      data-dragging={dragging() ? "true" : undefined}
      data-drop-preview={props.preview ? "true" : undefined}
      data-all-day={props.allDay ? "true" : undefined}
      aria-hidden={props.preview || undefined}
      inert={props.preview}
      data-compact={compactTimed() ? "true" : undefined}
      data-resizing={resizeEnd() !== null ? "true" : undefined}
      style={{
        "--event-color": calendar().color,
        "--event-column-offset": props.column
          ? `${(props.column.index / props.column.count) * 100}%`
          : undefined,
        "--event-column-width": props.column ? `${100 / props.column.count}%` : undefined,
        top: timed() ? `${minuteToPixel(timed()!.startMinute, props.hourHeight)}px` : undefined,
        height: timed() ? `${timedCardHeight(duration(), props.hourHeight)}px` : undefined,
      }}
      onPointerDown={(event) => props.drag?.pointerDown(item().id, event)}
      onPointerMove={props.drag?.pointerMove}
      onPointerUp={props.drag?.pointerUp}
      onPointerCancel={props.drag?.cancel}
      onClick={(event) => {
        // The drag controller handles pointer clicks, including release after a move.
        if (event.detail === 0) props.drag?.openItem(item().id);
      }}
    >
      <div class="event-card__copy">
        <div class="event-card__title">{item().title}</div>
        <Show when={timed() && !compactTimed()}>
          <span class="event-card__time">
            {formatTimeRange(timed()!.startMinute, displayedEnd())}
          </span>
        </Show>
      </div>
      <Show when={timed() && !props.preview}>
        <button
          type="button"
          class="event-card__resize-handle"
          data-testid="calendar-event-resize"
          aria-label={`Resize ${item().title}`}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            event.stopPropagation();
            const delta = event.key === "ArrowDown" ? 5 : -5;
            void props.onResizeEnd?.(
              item().id,
              Math.min(1440, Math.max(timed()!.startMinute + 5, timed()!.endMinute + delta)),
            );
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            resizePointerId = event.pointerId;
            resizeOriginY = event.clientY;
            setResizeEnd(timed()!.endMinute);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (resizePointerId !== event.pointerId) return;
            event.stopPropagation();
            setResizeEnd(
              resolveTimedResizeEndMinute(
                timed()!.endMinute,
                event.clientY - resizeOriginY,
                props.hourHeight,
                timed()!.startMinute,
              ),
            );
          }}
          onPointerUp={(event) => {
            if (resizePointerId !== event.pointerId) return;
            event.stopPropagation();
            finishResize(true);
          }}
          onPointerCancel={(event) => {
            event.stopPropagation();
            finishResize(false);
          }}
        />
      </Show>
    </article>
  );
}
