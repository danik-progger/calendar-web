import { batch, createSignal, onCleanup, onMount, Show } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import { AppShell } from "./app/AppShell";
import { createApiCalendarItemRepository } from "./shared/data/api-calendar-item-repository";
import { CalendarSessionExpiredError } from "./shared/data/calendar-item-repository";
import { CALENDARS } from "./shared/calendar/calendars";
import { createCalendarModel } from "./shared/calendar/model";
import { createCalendarView } from "./shared/calendar/view";
import { createDragController } from "./shared/drag/drag-controller";
import { resolveDomDropTarget } from "./shared/drag/drop-target";
import { CalendarHeader } from "./components/calendar/CalendarHeader";
import { CalendarBoard } from "./components/calendar/CalendarBoard";
import { EventModal } from "./components/modal/EventModal";
import { CalendarDataStatus } from "./components/feedback/CalendarDataStatus";

export function App(props: { token: string; email: string; onLogout: () => Promise<void> }) {
  const repository = createApiCalendarItemRepository((path, options) => {
    if (!props.token) throw new Error("Sign in to access your calendar.");
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${props.token}`);
    const origin = import.meta.env.VITE_CALENDAR_API_URL;
    if (!origin) throw new Error("Calendar API URL is not configured.");
    return fetch(new URL(String(path), origin), { ...options, headers, credentials: "omit" });
  });
  const model = createCalendarModel({ repository, createId: () => crypto.randomUUID() });
  const view = createCalendarView({
    now: () => new Date(),
    initialViewportWidth: window.innerWidth,
  });
  const [hourHeight, setHourHeight] = createSignal(88);
  const [dropRevision, setDropRevision] = createSignal(0);
  const [deletionNotice, setDeletionNotice] = createSignal<"deleted" | "undo-error" | null>(null);
  const [undoPending, setUndoPending] = createSignal(false);
  const bottomNotice = (): {
    kind: "deleted" | "undo-error" | "mutation-error" | "failed-draft";
    message: string;
  } | null => {
    if (model.canRestoreDraft())
      return { kind: "failed-draft", message: "A draft couldn’t be saved." };
    const mutation = model.mutationState();
    if (
      mutation.phase === "error" &&
      (mutation.command !== "deletion.undo" ||
        mutation.error.cause instanceof CalendarSessionExpiredError)
    ) {
      return { kind: "mutation-error", message: mutation.error.message };
    }
    const kind = deletionNotice();
    return (
      kind && {
        kind,
        message: kind === "undo-error" ? "Couldn’t restore. Try again." : "Event deleted",
      }
    );
  };
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  const showDeletionNotice = (type: "deleted" | "undo-error") => {
    if (noticeTimer) clearTimeout(noticeTimer);
    setDeletionNotice(type);
    if (type === "deleted") noticeTimer = setTimeout(() => setDeletionNotice(null), 5000);
  };
  const undoDeletion = async () => {
    if (undoPending() || !model.canUndoDeletion()) return;
    setUndoPending(true);
    const result = await model.dispatch({ type: "deletion.undo" });
    setUndoPending(false);
    if (result.ok) {
      if (noticeTimer) clearTimeout(noticeTimer);
      setDeletionNotice(null);
    } else showDeletionNotice("undo-error");
  };
  const deleteEvent = async () => {
    const result = await model.dispatch({ type: "editor.delete" });
    if (result.ok) showDeletionNotice("deleted");
    return result;
  };
  const drag = createDragController({
    getItem: (id) => model.allItems().find((item) => item.id === id),
    moveItem: (itemId, target) =>
      batch(() => {
        setDropRevision((revision) => revision + 1);
        return model.dispatch({ type: "item.move", itemId, target });
      }),
    resolveDropTarget: resolveDomDropTarget,
    getHourHeight: hourHeight,
    openItem: (itemId) => void model.dispatch({ type: "editor.open-item", itemId }),
  });
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
    let unsubscribe: (() => void) | undefined;
    const synchronize = () => {
      unsubscribe?.();
      unsubscribe = document.hidden
        ? undefined
        : repository.subscribe?.(() => void model.refresh());
    };
    document.addEventListener("visibilitychange", synchronize);
    synchronize();
    onCleanup(() => {
      unsubscribe?.();
      document.removeEventListener("visibilitychange", synchronize);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onUndo);
      if (noticeTimer) clearTimeout(noticeTimer);
      view.dispose();
      drag.cancel();
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
          currentMinute={view.currentMinute()}
          drag={drag}
          dropRevision={dropRevision()}
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
        />
      </Show>
      <Presence>
        <Show when={model.editorSession()}>
          {(session) => (
            <EventModal
              session={session()}
              calendars={CALENDARS}
              onChange={(change) => void model.dispatch({ type: "editor.change", change })}
              onSave={() => model.dispatch({ type: "editor.save" })}
              onCancel={() => void model.dispatch({ type: "editor.cancel" })}
              onDelete={deleteEvent}
            />
          )}
        </Show>
      </Presence>
      <Presence exitBeforeEnter>
        <Show when={bottomNotice()}>
          {(notice) => (
            <Motion.div
              class="deletion-notice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.18,
              }}
            >
              <span
                role={notice().kind === "mutation-error" ? "alert" : "status"}
                classList={{ "error-message": notice().kind !== "deleted" }}
              >
                {notice().message}
              </span>
              <Show when={notice().kind === "deleted" || notice().kind === "undo-error"}>
                <button
                  type="button"
                  class="action-button"
                  disabled={undoPending()}
                  onClick={() => void undoDeletion()}
                >
                  Undo
                </button>
              </Show>
              <Show when={notice().kind === "failed-draft"}>
                <button type="button" class="action-button" onClick={model.restoreFailedDraft}>
                  Restore draft
                </button>
              </Show>
            </Motion.div>
          )}
        </Show>
      </Presence>
    </AppShell>
  );
}
