import { expect, test } from "bun:test";
import { createCalendarModel } from "../src/shared/calendar/model.ts";
import { createTimedEvent } from "../src/shared/calendar/calendar-item.ts";

const event = createTimedEvent({
  id: "event",
  title: "Test",
  calendarId: "work",
  date: "2026-11-19",
  startMinute: 600,
});
const move = (date) => ({
  type: "item.move",
  itemId: event.id,
  target: { type: "timed", date, startMinute: 660 },
});
const success = { ok: true, value: undefined };
const failure = { ok: false, error: { operation: "save", message: "Offline" } };

async function setup() {
  const writes = [];
  const loads = [];
  const model = createCalendarModel({
    repository: {
      loadAll: () => {
        const load = Promise.withResolvers();
        loads.push(load);
        return load.promise;
      },
      write: (change) => {
        const write = Promise.withResolvers();
        writes.push({ ...write, change });
        return write.promise;
      },
    },
    createId: () => "new",
  });
  const loading = model.initialize();
  loads[0].resolve({ ok: true, value: [event] });
  await loading;
  return { model, writes, loads };
}

test("drop and resize stay visible before either request finishes", async () => {
  const { model, writes } = await setup();
  const moving = model.dispatch(move("2026-11-20"));
  expect(model.allItems()[0].placement.date).toBe("2026-11-20");
  const resizing = model.dispatch({ type: "item.resize", itemId: event.id, endMinute: 750 });
  expect(model.allItems()[0].placement.endMinute).toBe(750);
  await Promise.resolve();
  expect(writes).toHaveLength(1);
  writes[0].resolve(success);
  await moving;
  expect(model.allItems()[0].placement.endMinute).toBe(750);
  expect(writes).toHaveLength(2);
  writes[1].resolve(success);
  await resizing;
  expect(writes[1].change).toMatchObject({ type: "save", item: model.allItems()[0] });
});

test("failed earlier drop cannot roll back a newer drop", async () => {
  const { model, writes } = await setup();
  const first = model.dispatch(move("2026-11-20"));
  const second = model.dispatch(move("2026-11-21"));
  expect(model.allItems()[0].placement.date).toBe("2026-11-21");
  await Promise.resolve();
  writes[0].resolve(failure);
  await first;
  expect(model.allItems()[0].placement.date).toBe("2026-11-21");
  writes[1].resolve(success);
  await second;
  expect(model.allItems()[0].placement.date).toBe("2026-11-21");
});

test("a rejected request rolls back the optimistic drop", async () => {
  const { model, writes } = await setup();
  const moving = model.dispatch(move("2026-11-20"));
  expect(model.allItems()[0].placement.date).toBe("2026-11-20");
  await Promise.resolve();
  writes[0].reject(new Error("Offline"));
  expect((await moving).ok).toBe(false);
  expect(model.allItems()).toEqual([event]);
  expect(model.mutationState().phase).toBe("error");
});

test("a refresh already in flight cannot hide a newer drop", async () => {
  const { model, loads, writes } = await setup();
  const refreshing = model.refresh();
  await Promise.resolve();
  const moving = model.dispatch(move("2026-11-20"));
  loads[1].resolve({ ok: true, value: [event] });
  await refreshing;
  expect(model.allItems()[0].placement.date).toBe("2026-11-20");
  writes[0].resolve(success);
  await moving;
});

test("editor saves close immediately and restore failed drafts", async () => {
  const { model, writes } = await setup();
  await model.dispatch({ type: "editor.open-item", itemId: event.id });
  await model.dispatch({ type: "editor.change", change: { type: "title", value: "Edited" } });
  const saving = model.dispatch({ type: "editor.save" });
  expect(model.editorSession()).toBeNull();
  expect(model.allItems()[0].title).toBe("Edited");
  await Promise.resolve();
  writes[0].resolve(failure);
  await saving;
  expect(model.allItems()[0].title).toBe("Test");
  expect(model.editorSession().draft.title).toBe("Edited");
});

test("a failed save can be recovered after using a different editor", async () => {
  const { model, writes } = await setup();
  await model.dispatch({ type: "editor.open-item", itemId: event.id });
  await model.dispatch({ type: "editor.change", change: { type: "title", value: "Edited" } });
  const saving = model.dispatch({ type: "editor.save" });
  await model.dispatch({
    type: "editor.open-create",
    target: { type: "all-day", date: "2026-11-19" },
  });
  writes[0].resolve(failure);
  await saving;
  expect(model.editorSession().mode).toBe("create");
  await model.dispatch({ type: "editor.cancel" });
  expect(model.canRestoreDraft?.()).toBe(true);
  model.restoreFailedDraft();
  expect(model.editorSession().draft.title).toBe("Edited");
});
