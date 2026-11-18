import { createSignal, type Accessor } from "solid-js";
import { createDefaultCalendarVisibility, type CalendarVisibility } from "./calendars";
import {
  createTimedEvent,
  DEFAULT_START_MINUTE,
  moveItem,
  setItemAllDay,
  resizeTimedItem,
  type CalendarItem,
  type DateKey,
  type ItemId,
  type ScheduledItem,
} from "./calendar-item";
import { clampTimeRange } from "./date-time";
import type {
  CalendarItemRepository,
  CalendarRepositoryError,
} from "../data/calendar-item-repository";
import type { CalendarCommand } from "./commands";
import type { EditorChange, EditorError, EditorSession } from "./editor";

export type CalendarLoadState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready" }
  | { phase: "error"; error: CalendarRepositoryError };
export type CalendarMutationState =
  | { phase: "idle" }
  | { phase: "saving"; command: CalendarCommand["type"] }
  | { phase: "error"; command: CalendarCommand["type"]; error: CalendarRepositoryError };
export type CalendarCommandResult =
  | { ok: true }
  | {
      ok: false;
      error: CalendarRepositoryError | EditorError | "model-not-ready" | "item-not-found";
    };
export type CalendarModelDependencies = Readonly<{
  repository: CalendarItemRepository;
  createId(): ItemId;
}>;
export type DayItems = Readonly<{
  timed: readonly ScheduledItem[];
  allDay: readonly ScheduledItem[];
}>;
export type CalendarModel = Readonly<{
  loadState: Accessor<CalendarLoadState>;
  mutationState: Accessor<CalendarMutationState>;
  allItems: Accessor<readonly CalendarItem[]>;
  visibleItemsByDate: Accessor<ReadonlyMap<DateKey, DayItems>>;
  calendarVisibility: Accessor<CalendarVisibility>;
  editorSession: Accessor<EditorSession>;
  canUndoDeletion: Accessor<boolean>;
  initialize(): Promise<CalendarCommandResult>;
  retryLoad(): Promise<CalendarCommandResult>;
  dispatch(command: CalendarCommand): Promise<CalendarCommandResult>;
}>;

export function createCalendarModel(dependencies: CalendarModelDependencies): CalendarModel {
  const [loadState, setLoadState] = createSignal<CalendarLoadState>({ phase: "idle" });
  const [mutationState, setMutationState] = createSignal<CalendarMutationState>({ phase: "idle" });
  const [items, setItems] = createSignal<readonly CalendarItem[]>([]);
  const [visibility, setVisibility] = createSignal<CalendarVisibility>(
    createDefaultCalendarVisibility(),
  );
  const [editorSession, setEditorSession] = createSignal<EditorSession>(null);
  const [deletedItems, setDeletedItems] = createSignal<
    readonly { item: CalendarItem; index: number }[]
  >([]);
  let writeQueue = Promise.resolve<CalendarCommandResult>({ ok: true });
  let pendingWrites = 0;
  let initializing: Promise<CalendarCommandResult> | null = null;
  const visibleItemsByDate = () => {
    const result = new Map<DateKey, DayItems>();
    for (const item of items()) {
      if (!visibility()[item.calendarId]) continue;
      const date = item.placement.date;
      const existing = result.get(date);
      const bucket: { timed: ScheduledItem[]; allDay: ScheduledItem[] } = existing
        ? { timed: [...existing.timed], allDay: [...existing.allDay] }
        : { timed: [], allDay: [] };
      if (item.placement.type === "timed") bucket.timed = [...bucket.timed, item];
      else bucket.allDay = [...bucket.allDay, item];
      result.set(date, bucket);
    }
    return result;
  };
  const initialize = async (): Promise<CalendarCommandResult> => {
    if (loadState().phase === "ready" || loadState().phase === "loading") return { ok: true };
    if (initializing) return initializing;
    setLoadState({ phase: "loading" });
    initializing = dependencies.repository.loadAll().then((result) => {
      initializing = null;
      if (!result.ok) {
        setLoadState({ phase: "error", error: result.error });
        return { ok: false, error: result.error } as const;
      }
      setItems(result.value);
      setLoadState({ phase: "ready" });
      return { ok: true } as const;
    });
    return initializing;
  };
  const persist = (
    command: CalendarCommand,
    prepare: (
      current: readonly CalendarItem[],
    ) => { items: readonly CalendarItem[]; commit?(): void } | null,
  ): Promise<CalendarCommandResult> => {
    pendingWrites += 1;
    setMutationState({ phase: "saving", command: command.type });
    const action = async (): Promise<CalendarCommandResult> => {
      setMutationState({ phase: "saving", command: command.type });
      try {
        const change = prepare(items());
        if (!change) return { ok: false, error: "item-not-found" };
        const result = await dependencies.repository.saveAll(change.items);
        if (!result.ok) {
          setMutationState({ phase: "error", command: command.type, error: result.error });
          return { ok: false, error: result.error };
        }
        setItems(change.items);
        change.commit?.();
        return { ok: true };
      } catch (cause) {
        const error: CalendarRepositoryError = {
          operation: "save",
          message: cause instanceof Error ? cause.message : String(cause),
          cause,
        };
        setMutationState({ phase: "error", command: command.type, error });
        return { ok: false, error };
      } finally {
        pendingWrites -= 1;
        if (!pendingWrites && mutationState().phase === "saving")
          setMutationState({ phase: "idle" });
      }
    };
    const next = writeQueue.then(action, action);
    writeQueue = next;
    return next;
  };
  const dispatch = async (command: CalendarCommand): Promise<CalendarCommandResult> => {
    if (
      ["item.move", "item.resize", "editor.save", "editor.delete", "deletion.undo"].includes(
        command.type,
      ) &&
      loadState().phase !== "ready"
    )
      return { ok: false, error: "model-not-ready" };
    switch (command.type) {
      case "calendar.set-visible":
        setVisibility((current) => ({ ...current, [command.calendarId]: command.visible }));
        return { ok: true };
      case "item.move":
      case "item.resize":
        return persist(command, (current) => {
          const item = current.find((value) => value.id === command.itemId);
          if (!item || (command.type === "item.resize" && item.placement.type !== "timed"))
            return null;
          const updated =
            command.type === "item.move"
              ? moveItem(item, command.target)
              : resizeTimedItem(item, command.endMinute);
          return { items: current.map((value) => (value.id === item.id ? updated : value)) };
        });
      case "editor.open-create": {
        const timed = createTimedEvent({
          id: dependencies.createId(),
          title: "",
          calendarId: "work",
          date: command.target.date,
          startMinute:
            command.target.type === "timed" ? command.target.startMinute : DEFAULT_START_MINUTE,
        });
        setEditorSession({
          mode: "create",
          draft: command.target.type === "all-day" ? moveItem(timed, command.target) : timed,
          previousTimedPlacement: timed.placement.type === "timed" ? timed.placement : null,
          error: null,
        });
        return { ok: true };
      }
      case "editor.open-item": {
        const item = items().find((value) => value.id === command.itemId);
        if (!item) return { ok: false, error: "item-not-found" };
        setEditorSession({
          mode: "edit",
          originalId: item.id,
          draft: structuredClone(item),
          previousTimedPlacement: item.placement.type === "timed" ? item.placement : null,
          error: null,
        });
        return { ok: true };
      }
      case "editor.change":
        return changeEditor(command.change);
      case "editor.cancel":
        setEditorSession(null);
        return { ok: true };
      case "editor.delete":
        return deleteEditor(command);
      case "deletion.undo":
        return undoDeletion(command);
      case "editor.save":
        return saveEditor(command);
    }
  };
  function changeEditor(change: EditorChange): CalendarCommandResult {
    const session = editorSession();
    if (!session) return { ok: false, error: "item-not-found" };
    let draft = session.draft;
    if (change.type === "title") draft = { ...draft, title: change.value };
    if (change.type === "notes") draft = { ...draft, notes: change.value };
    if (change.type === "calendar") draft = { ...draft, calendarId: change.value };
    if (change.type === "date")
      draft = { ...draft, placement: { ...draft.placement, date: change.value } };
    if (change.type === "time-range" && draft.placement.type === "timed")
      draft = {
        ...draft,
        placement: { ...draft.placement, ...clampTimeRange(change.startMinute, change.endMinute) },
      };
    if (change.type === "all-day")
      draft = setItemAllDay(draft, change.value, session.previousTimedPlacement);
    setEditorSession({
      ...session,
      draft,
      error: null,
      previousTimedPlacement:
        draft.placement.type === "timed" ? draft.placement : session.previousTimedPlacement,
    });
    return { ok: true };
  }
  function saveEditor(command: CalendarCommand): Promise<CalendarCommandResult> {
    const session = editorSession();
    if (!session) return Promise.resolve({ ok: false, error: "item-not-found" });
    if (!session.draft.title.trim()) {
      setEditorSession({ ...session, error: "title-required" });
      return Promise.resolve({ ok: false, error: "title-required" });
    }
    if (
      session.draft.placement.type === "timed" &&
      session.draft.placement.endMinute - session.draft.placement.startMinute < 5
    ) {
      setEditorSession({ ...session, error: "invalid-time-range" });
      return Promise.resolve({ ok: false, error: "invalid-time-range" });
    }
    const draft = { ...session.draft, title: session.draft.title.trim() };
    return persist(command, (current) => ({
      items: current.some((item) => item.id === draft.id)
        ? current.map((item) => (item.id === draft.id ? draft : item))
        : [...current, draft],
      commit() {
        if (editorSession() === session) setEditorSession(null);
      },
    }));
  }
  function deleteEditor(command: CalendarCommand): Promise<CalendarCommandResult> {
    const session = editorSession();
    if (!session || session.mode !== "edit")
      return Promise.resolve({ ok: false, error: "item-not-found" });
    return persist(command, (current) => {
      const index = current.findIndex((item) => item.id === session.originalId);
      if (index < 0) return null;
      const deleted = current[index];
      return {
        items: current.filter((item) => item.id !== session.originalId),
        commit() {
          setDeletedItems((previous) => [...previous, { item: deleted, index }]);
          if (editorSession() === session) setEditorSession(null);
        },
      };
    });
  }
  function undoDeletion(command: CalendarCommand): Promise<CalendarCommandResult> {
    return persist(command, (current) => {
      const deleted = deletedItems().at(-1);
      if (!deleted || current.some((item) => item.id === deleted.item.id)) return null;
      const nextItems = [...current];
      nextItems.splice(Math.min(deleted.index, nextItems.length), 0, deleted.item);
      return {
        items: nextItems,
        commit() {
          setDeletedItems((previous) => previous.slice(0, -1));
        },
      };
    });
  }
  return {
    loadState,
    mutationState,
    allItems: items,
    visibleItemsByDate,
    calendarVisibility: visibility,
    editorSession,
    canUndoDeletion: () => deletedItems().length > 0,
    initialize,
    retryLoad: initialize,
    dispatch,
  };
}
