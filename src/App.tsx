import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import { AppShell } from "./app/AppShell";
import { createLocalStorageCalendarItemRepository } from "./shared/data/local-storage-calendar-item-repository";
import { createApiCalendarItemRepository } from "./shared/data/api-calendar-item-repository";
import { createSeedItems } from "./shared/fixtures/create-seed-items";
import { CALENDARS } from "./shared/calendar/calendars";
import { createCalendarModel } from "./shared/calendar/calendar-model";
import { createCalendarView } from "./shared/calendar/calendar-view";
import { createDragController } from "./shared/drag/drag-controller";
import { resolveDomDropTarget } from "./shared/drag/drop-target";
import { CalendarHeader } from "./components/calendar/CalendarHeader";
import { CalendarBoard } from "./components/calendar/CalendarBoard";
import { EventModal } from "./components/modal/EventModal";
import { CalendarDataStatus } from "./components/feedback/CalendarDataStatus";

export function App(props: {
  userId?: string;
  token?: string;
  email?: string;
  onLogout?: () => Promise<void>;
}) {
  const repository = props.userId
    ? createApiCalendarItemRepository((path, options) => {
        if (!props.token) throw new Error("Sign in to access your calendar.");
        const headers = new Headers(options?.headers);
        headers.set("Authorization", `Bearer ${props.token}`);
        const origin = import.meta.env.VITE_CALENDAR_API_URL;
        if (!origin) throw new Error("Calendar API URL is not configured.");
        return fetch(new URL(String(path), origin), { ...options, headers, credentials: "omit" });
      })
    : createLocalStorageCalendarItemRepository(
        window.localStorage,
        props.userId ? [] : createSeedItems(new Date()),
        props.userId,
      );
  const model = createCalendarModel({ repository, createId: () => crypto.randomUUID() });
  const view = createCalendarView({
    now: () => new Date(),
    initialViewportWidth: window.innerWidth,
  });
  const [hourHeight, setHourHeight] = createSignal(88);
  const [deletionNotice, setDeletionNotice] = createSignal<"event" | "error" | null>(null);
  const [undoPending, setUndoPending] = createSignal(false);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  const showDeletionNotice = (type: "event" | "error") => {
    if (noticeTimer) clearTimeout(noticeTimer);
    setDeletionNotice(type);
    if (type !== "error") noticeTimer = setTimeout(() => setDeletionNotice(null), 5000);
  };
  const undoDeletion = async () => {
    if (undoPending() || !model.canUndoDeletion()) return;
    setUndoPending(true);
    const result = await model.dispatch({ type: "deletion.undo" });
    setUndoPending(false);
    if (result.ok) {
      if (noticeTimer) clearTimeout(noticeTimer);
      setDeletionNotice(null);
    } else showDeletionNotice("error");
  };
  const deleteEvent = async () => {
    const result = await model.dispatch({ type: "editor.delete" });
    if (result.ok) showDeletionNotice("event");
    return result;
  };
  const drag = createDragController({
    getItem: (id) => model.allItems().find((item) => item.id === id),
    moveItem: (itemId, target) => model.dispatch({ type: "item.move", itemId, target }),
    resolveDropTarget: resolveDomDropTarget,
    getHourHeight: () => hourHeight(),
    openItem: (itemId) => void model.dispatch({ type: "editor.open-item", itemId }),
  });
  const draggedItem = () => {
    const session = drag.session();
    return session.phase === "idle"
      ? undefined
      : model.allItems().find((item) => item.id === session.itemId);
  };
  onMount(() => {
    const resize = () => view.setViewportWidth(window.innerWidth);
    const onUndo = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "z"
      )
        return;
      const target = event.target;
      if (
        model.editorSession() ||
        (target instanceof Element &&
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
          ))
      )
        return;
      if (!model.canUndoDeletion() || undoPending()) return;
      event.preventDefault();
      void undoDeletion();
    };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", onUndo);
    void model.initialize();
    onCleanup(() => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onUndo);
      if (noticeTimer) clearTimeout(noticeTimer);
      view.dispose();
      drag.dispose();
    });
  });

  return (
    <AppShell
      toolbar={
        <CalendarHeader
          email={props.email}
          onLogout={props.onLogout}
          mode={view.mode()}
          isMobile={view.isMobile()}
          monthLabel={view.monthLabel()}
          onPrevious={() => view.shiftDays(view.mode() === "week" ? -7 : -1)}
          onToday={view.goToday}
          onNext={() => view.shiftDays(view.mode() === "week" ? 7 : 1)}
          onModeChange={view.setMode}
        />
      }
    >
      <Show
        when={model.loadState().phase === "ready"}
        fallback={
          <CalendarDataStatus state={model.loadState()} onRetry={() => void model.retryLoad()} />
        }
      >
        <CalendarBoard
          days={view.days()}
          itemsByDate={model.visibleItemsByDate()}
          hourHeight={hourHeight()}
          onHourHeightChange={setHourHeight}
          todayKey={view.todayKey()}
          currentMinute={view.currentMinute()}
          currentTimeLabel={view.currentTimeLabel()}
          dragSession={drag.session()}
          draggedItem={draggedItem()}
          onEmptySlotClick={(date, startMinute) =>
            void model.dispatch({
              type: "editor.open-create",
              target: { type: "timed", date, startMinute },
            })
          }
          onAllDaySlotClick={(date) =>
            void model.dispatch({ type: "editor.open-create", target: { type: "all-day", date } })
          }
          onHorizontalWheel={view.pushHorizontalWheel}
          onResizeItem={(itemId, endMinute) =>
            model.dispatch({ type: "item.resize", itemId, endMinute })
          }
          onItemPointerDown={drag.pointerDown}
          onItemPointerMove={drag.pointerMove}
          onItemPointerUp={drag.pointerUp}
          onItemPointerCancel={drag.pointerCancel}
          onOpenItem={(itemId) => void model.dispatch({ type: "editor.open-item", itemId })}
        />
      </Show>
      <Presence>
        <Show when={model.editorSession()}>
          {(session) => (
            <EventModal
              session={session()}
              calendars={CALENDARS}
              saving={model.mutationState().phase === "saving"}
              onChange={(change) => void model.dispatch({ type: "editor.change", change })}
              onSave={() => model.dispatch({ type: "editor.save" })}
              onCancel={() => void model.dispatch({ type: "editor.cancel" })}
              onDelete={deleteEvent}
            />
          )}
        </Show>
      </Presence>
      <Presence>
        <Show when={deletionNotice()}>
          {(notice) => (
            <Motion.div
              class="deletion-notice"
              role="status"
              aria-live="polite"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.18,
              }}
            >
              <span>{notice() === "error" ? "Couldn’t restore. Try again." : "Event deleted"}</span>
              <button type="button" disabled={undoPending()} onClick={() => void undoDeletion()}>
                Undo
              </button>
            </Motion.div>
          )}
        </Show>
      </Presence>
    </AppShell>
  );
}
