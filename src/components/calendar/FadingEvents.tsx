import { createEffect, createSignal, For, onCleanup, untrack, type ComponentProps } from "solid-js";
import type { ItemId, ScheduledItem } from "../../shared/calendar/calendar-item";
import type { DragSession } from "../../shared/drag/drag-types";
import { CalendarEvent } from "./CalendarEvent";

type Props = Omit<ComponentProps<typeof CalendarEvent>, "item" | "dragging" | "onOpen"> & {
  items: readonly ScheduledItem[];
  dragSession: DragSession;
  onOpenItem(id: ItemId): void;
};

export function FadingEvents(props: Props) {
  const [ids, setIds] = createSignal<ItemId[]>([]);
  const [exiting, setExiting] = createSignal<Set<ItemId>>(new Set());
  const previous = new Map<ItemId, ScheduledItem>();
  const timers = new Map<ItemId, ReturnType<typeof setTimeout>>();
  createEffect(() => {
    const items = props.items;
    const nextIds = items.map((item) => item.id);
    for (const item of items) previous.set(item.id, item);
    const oldIds = untrack(ids);
    const nextSet = new Set(nextIds);
    const removed = oldIds.filter((id) => !nextSet.has(id) && !timers.has(id));
    for (const id of nextIds) {
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
    }
    setExiting(new Set([...timers.keys(), ...removed]));
    setIds([...nextIds, ...oldIds.filter((id) => !nextSet.has(id))]);
    for (const id of removed) {
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180;
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          previous.delete(id);
          setIds((current) => current.filter((value) => value !== id));
          setExiting(new Set(timers.keys()));
        }, duration),
      );
    }
  });
  onCleanup(() => timers.forEach((timer) => clearTimeout(timer)));
  return (
    <For each={ids()}>
      {(id) => (
        <CalendarEvent
          item={props.items.find((item) => item.id === id) ?? previous.get(id)!}
          allDay={props.allDay}
          hourHeight={props.hourHeight}
          dragging={props.dragSession.phase === "dragging" && props.dragSession.itemId === id}
          exiting={exiting().has(id)}
          onOpen={() => props.onOpenItem(id)}
          onResizeEnd={props.onResizeEnd}
          onPointerDown={props.onPointerDown}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
          onPointerCancel={props.onPointerCancel}
        />
      )}
    </For>
  );
}
