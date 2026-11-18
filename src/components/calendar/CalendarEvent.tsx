import { createSignal, Show } from "solid-js";
import type { CalendarCommandResult } from "../../shared/calendar/calendar-model";
import type { ItemId, ScheduledItem, TimedPlacement } from "../../shared/calendar/calendar-item";
import { calendarById } from "../../shared/calendar/calendars";
import { formatTimeRange, minuteToPixel } from "../../shared/calendar/date-time";
import { resolveTimedResizeEndMinute } from "../../shared/drag/drag-geometry";
import type { ItemPointerEvent } from "../../shared/drag/drag-types";

export function CalendarEvent(props: {
  item: ScheduledItem;
  allDay?: boolean;
  dragging?: boolean;
  preview?: boolean;
  exiting?: boolean;
  hourHeight: number;
  onOpen(): void;
  onResizeEnd?(itemId: ItemId, endMinute: number): Promise<CalendarCommandResult>;
  onPointerDown(itemId: ItemId, event: ItemPointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  onPointerUp(event: PointerEvent): void;
  onPointerCancel(): void;
}) {
  const item = () => props.item;
  const calendar = () => calendarById(item().calendarId);
  const animationSeed = [...item().id].reduce(
    (seed, character) => Math.imul(seed, 31) + character.charCodeAt(0),
    0,
  );
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
      data-dragging={props.dragging ? "true" : undefined}
      data-drop-preview={props.preview ? "true" : undefined}
      data-exiting={props.exiting ? "true" : undefined}
      aria-hidden={props.exiting || undefined}
      inert={props.exiting}
      data-compact={compactTimed() ? "true" : undefined}
      data-resizing={resizeEnd() !== null ? "true" : undefined}
      style={{
        "--event-color": calendar().color,
        "--event-enter-delay": `${40 + Math.abs(animationSeed % 240)}ms`,
        "--event-enter-duration": `${360 + Math.abs((animationSeed * 97) % 260)}ms`,
        top: timed() ? `${minuteToPixel(timed()!.startMinute, props.hourHeight)}px` : undefined,
        height: timed()
          ? `${Math.max(minuteToPixel(duration(), props.hourHeight), compactTimed() ? 24 : 38) - 3}px`
          : undefined,
      }}
      onPointerDown={(event) => props.onPointerDown(item().id, event as ItemPointerEvent)}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      onPointerCancel={props.onPointerCancel}
      onClick={(event) => {
        // The drag controller handles pointer clicks, including release after a move.
        if (event.detail === 0) props.onOpen();
      }}
    >
      <div class="event-card__title">{item().title}</div>
      <Show when={timed() && !compactTimed()}>
        <span class="event-card__time">
          {formatTimeRange(timed()!.startMinute, displayedEnd())}
        </span>
      </Show>
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
