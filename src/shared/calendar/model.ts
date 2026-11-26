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
} from "./calendar-item";
import { clampTimeRange } from "./date-time";
import {
  CalendarSessionExpiredError,
  type CalendarItemRepository,
  type CalendarItemWrite,
  type CalendarRepositoryError,
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
  timed: readonly CalendarItem[];
  allDay: readonly CalendarItem[];
}>;
export type CalendarModel = Readonly<{
  loadState: Accessor<CalendarLoadState>;
  mutationState: Accessor<CalendarMutationState>;
  allItems: Accessor<readonly CalendarItem[]>;
  visibleItemsByDate: Accessor<ReadonlyMap<DateKey, DayItems>>;
  calendarVisibility: Accessor<CalendarVisibility>;
  editorSession: Accessor<EditorSession>;
  canRestoreDraft: Accessor<boolean>;
  canUndoDeletion: Accessor<boolean>;
  restoreFailedDraft(): void;
  initialize(): Promise<CalendarCommandResult>;
  retryLoad(): Promise<CalendarCommandResult>;
  refresh(): Promise<CalendarCommandResult>;
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
  const [failedDrafts, setFailedDrafts] = createSignal<readonly NonNullable<EditorSession>[]>([]);
  const [deletedItems, setDeletedItems] = createSignal<
    readonly { item: CalendarItem; index: number }[]
  >([]);
  let writeQueue = Promise.resolve<CalendarCommandResult>({ ok: true });
  let initializing: Promise<CalendarCommandResult> | null = null;
  let refreshQueued: Promise<CalendarCommandResult> | null = null;
  let refreshPending = false;
  let confirmedItems: readonly CalendarItem[] = [];
  let editorRevision = 0;
  type PrepareChange = (
    current: readonly CalendarItem[],
  ) => { items: readonly CalendarItem[]; write: CalendarItemWrite; commit?(): void } | null;
  const pendingChanges: PrepareChange[] = [];
  const publishItems = () =>
    setItems(
      pendingChanges.reduce(
        (current, prepare) => prepare(current)?.items ?? current,
        confirmedItems,
      ),
    );
  const visibleItemsByDate = () => {
    const result = new Map<DateKey, { timed: CalendarItem[]; allDay: CalendarItem[] }>();
    for (const item of items()) {
      if (!visibility()[item.calendarId]) continue;
      const date = item.placement.date;
      const bucket = result.get(date) ?? { timed: [], allDay: [] };
      if (item.placement.type === "timed") bucket.timed.push(item);
      else bucket.allDay.push(item);
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
      confirmedItems = result.value;
      publishItems();
      setLoadState({ phase: "ready" });
      return { ok: true } as const;
    });
    return initializing;
  };
  const persist = (
    command: CalendarCommand,
    prepare: PrepareChange,
  ): Promise<CalendarCommandResult> => {
    pendingChanges.push(prepare);
    publishItems();
    setMutationState({ phase: "saving", command: command.type });
    const action = async (): Promise<CalendarCommandResult> => {
      setMutationState({ phase: "saving", command: command.type });
      try {
        const change = prepare(confirmedItems);
        if (!change) return { ok: false, error: "item-not-found" };
        const result = await dependencies.repository.write(change.write);
        if (!result.ok) {
          setMutationState({ phase: "error", command: command.type, error: result.error });
          return { ok: false, error: result.error };
        }
        confirmedItems = change.items;
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
        pendingChanges.splice(pendingChanges.indexOf(prepare), 1);
        publishItems();
        if (!pendingChanges.length && mutationState().phase === "saving")
          setMutationState({ phase: "idle" });
      }
    };
    const next = writeQueue.then(action, action);
    writeQueue = next;
    return next;
  };
  const refresh = (): Promise<CalendarCommandResult> => {
    refreshPending = true;
    if (refreshQueued) return refreshQueued;
    const action = async (): Promise<CalendarCommandResult> => {
      if (initializing) await initializing;
      let outcome: CalendarCommandResult = { ok: true };
      do {
        refreshPending = false;
        const result = await dependencies.repository.loadAll();
        if (result.ok) {
          confirmedItems = result.value;
          publishItems();
          setLoadState({ phase: "ready" });
          outcome = { ok: true };
        } else {
          if (
            loadState().phase !== "ready" ||
            result.error.cause instanceof CalendarSessionExpiredError
          )
            setLoadState({ phase: "error", error: result.error });
          outcome = { ok: false, error: result.error };
        }
      } while (refreshPending);
      return outcome;
    };
    const next = writeQueue.then(action, action);
    writeQueue = next;
    refreshQueued = next;
    void next.finally(() => {
      refreshQueued = null;
    });
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
          return {
            items: current.map((value) => (value.id === item.id ? updated : value)),
            write: { type: "save", item: updated, previous: item },
          };
        });
      case "editor.open-create": {
        editorRevision += 1;
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
        editorRevision += 1;
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
        editorRevision += 1;
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
    const revision = editorRevision;
    setEditorSession(null);
    return persist(command, (current) => {
      const previous = current.find((item) => item.id === draft.id) ?? null;
      if (session.mode === "edit" && !previous) return null;
      return {
        items: previous
          ? current.map((item) => (item.id === draft.id ? draft : item))
          : [...current, draft],
        write: { type: "save", item: draft, previous },
      };
    }).then((result) => {
      const otherDrafts = failedDrafts().filter((failed) => failed.draft.id !== draft.id);
      if (result.ok) {
        setFailedDrafts(otherDrafts);
      } else {
        const failed =
          result.error === "item-not-found" ? { ...session, error: result.error } : session;
        if (editorRevision === revision && editorSession() === null) {
          setFailedDrafts(otherDrafts);
          setEditorSession(failed);
        } else {
          setFailedDrafts([...otherDrafts, failed]);
        }
      }
      return result;
    });
  }
  function restoreFailedDraft() {
    if (editorSession()) return;
    const failed = failedDrafts().at(-1);
    if (!failed) return;
    editorRevision += 1;
    setFailedDrafts((drafts) => drafts.slice(0, -1));
    setEditorSession(failed);
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
        items: current.filter((item) => item.id !== deleted.id),
        write: { type: "delete", id: deleted.id },
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
        write: { type: "save", item: deleted.item, previous: null },
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
    canRestoreDraft: () => editorSession() === null && failedDrafts().length > 0,
    canUndoDeletion: () => deletedItems().length > 0,
    restoreFailedDraft,
    initialize,
    retryLoad: initialize,
    refresh,
    dispatch,
  };
}
