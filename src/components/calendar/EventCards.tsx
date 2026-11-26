import { createMemo, For, type ComponentProps } from "solid-js";
import type { ItemId, CalendarItem } from "../../shared/calendar/calendar-item";
import { CalendarEvent } from "./CalendarEvent";
import type { EventColumn } from "./timed-event-layout";

type Props = Omit<ComponentProps<typeof CalendarEvent>, "item" | "column" | "preview"> & {
  items: readonly CalendarItem[];
  columns?: ReadonlyMap<ItemId, EventColumn>;
};

export function EventCards(props: Props) {
  const byId = createMemo(() => new Map(props.items.map((item) => [item.id, item])));
  return (
    <For each={props.items.map((item) => item.id)}>
      {(id) => {
        // The keyed child can update before For removes it.
        let last = byId().get(id)!;
        const item = () => (last = byId().get(id) ?? last);
        return (
          <CalendarEvent
            item={item()}
            column={props.columns?.get(id)}
            allDay={props.allDay}
            hourHeight={props.hourHeight}
            drag={props.drag}
            onResizeEnd={props.onResizeEnd}
          />
        );
      }}
    </For>
  );
}
