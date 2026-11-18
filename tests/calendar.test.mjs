import { describe, expect, test } from "bun:test";
import { createCalendarModel } from "../src/shared/calendar/model.ts";
import { createTimedEvent, moveItem } from "../src/shared/calendar/calendar-item.ts";
import { resolveDomDropTarget } from "../src/shared/drag/drop-target.ts";

const event = (id = "event") =>
  createTimedEvent({
    id,
    title: id,
    calendarId: "work",
    date: "2026-11-17",
    startMinute: 540,
    durationMinute: 60,
  });
async function setup(initial = [event()]) {
  let saved = initial;
  let save = async (items) => {
    saved = structuredClone(items);
    return { ok: true, value: undefined };
  };
  const model = createCalendarModel({
    repository: {
      loadAll: async () => ({ ok: true, value: initial }),
      saveAll: (items) => save(items),
    },
    createId: () => "new",
  });
  await model.initialize();
  return {
    model,
    saved: () => saved,
    setSave: (next) => {
      save = next;
    },
  };
}
const open = (model) => model.dispatch({ type: "editor.open-item", itemId: "event" });
const change = (model, change) => model.dispatch({ type: "editor.change", change });

describe("serialized calendar mutations", () => {
  test("queued resize preserves preceding move", async () => {
    const { model, saved } = await setup();
    const move = model.dispatch({
      type: "item.move",
      itemId: "event",
      target: { type: "timed", date: "2026-11-18", startMinute: 600 },
    });
    const resize = model.dispatch({ type: "item.resize", itemId: "event", endMinute: 690 });
    expect(await Promise.all([move, resize])).toEqual([{ ok: true }, { ok: true }]);
    expect(model.allItems()[0].placement).toEqual({
      type: "timed",
      date: "2026-11-18",
      startMinute: 600,
      endMinute: 690,
    });
    expect(saved()).toEqual(model.allItems());
    expect(model.mutationState()).toEqual({ phase: "idle" });
  });

  test("pending writes keep saving state until last write finishes", async () => {
    const { model, setSave } = await setup();
    let release;
    const started = Promise.withResolvers();
    let calls = 0;
    setSave(async () => {
      if (++calls === 2) {
        started.resolve();
        await new Promise((resolve) => {
          release = resolve;
        });
      }
      return { ok: true, value: undefined };
    });
    const first = model.dispatch({ type: "item.resize", itemId: "event", endMinute: 660 });
    const second = model.dispatch({ type: "item.resize", itemId: "event", endMinute: 720 });
    await first;
    await started.promise;
    expect(model.mutationState().phase).toBe("saving");
    release();
    await second;
    expect(model.mutationState().phase).toBe("idle");
  });

  test("failed save leaves items and editor intact and queue remains usable", async () => {
    const { model, setSave } = await setup();
    await open(model);
    await change(model, { type: "title", value: "Edited" });
    const error = { operation: "save", message: "Full" };
    setSave(async () => ({ ok: false, error }));
    expect(await model.dispatch({ type: "editor.save" })).toEqual({ ok: false, error });
    expect(model.allItems()[0].title).toBe("event");
    expect(model.editorSession().draft.title).toBe("Edited");
    expect(model.mutationState()).toEqual({ phase: "error", command: "editor.save", error });
    setSave(async () => ({ ok: true, value: undefined }));
    expect(await model.dispatch({ type: "editor.save" })).toEqual({ ok: true });
    expect(model.allItems()[0].title).toBe("Edited");
    expect(model.editorSession()).toBeNull();
  });

  test("delete and immediate undo serialize together; failed undo keeps history", async () => {
    const { model, setSave } = await setup([event("before"), event(), event("after")]);
    await open(model);
    const deleting = model.dispatch({ type: "editor.delete" });
    const restoring = model.dispatch({ type: "deletion.undo" });
    expect(await Promise.all([deleting, restoring])).toEqual([{ ok: true }, { ok: true }]);
    expect(model.allItems().map((item) => item.id)).toEqual(["before", "event", "after"]);
    await open(model);
    await model.dispatch({ type: "editor.delete" });
    setSave(async () => ({ ok: false, error: { operation: "save", message: "Full" } }));
    expect((await model.dispatch({ type: "deletion.undo" })).ok).toBe(false);
    expect(model.canUndoDeletion()).toBe(true);
    expect(model.allItems().map((item) => item.id)).toEqual(["before", "after"]);
    setSave(async () => ({ ok: true, value: undefined }));
    await model.dispatch({ type: "deletion.undo" });
    expect(model.allItems().map((item) => item.id)).toEqual(["before", "event", "after"]);
  });

  test("rejected delete preserves editor and history, and later writes recover", async () => {
    const { model, setSave } = await setup();
    await open(model);
    setSave(async () => {
      throw new Error("Storage unavailable");
    });
    const result = await model.dispatch({ type: "editor.delete" });
    expect(result.ok).toBe(false);
    expect(result.error.message).toBe("Storage unavailable");
    expect(model.allItems().map((item) => item.id)).toEqual(["event"]);
    expect(model.editorSession().draft.id).toBe("event");
    expect(model.canUndoDeletion()).toBe(false);
    setSave(async () => ({ ok: true, value: undefined }));
    expect(await model.dispatch({ type: "editor.delete" })).toEqual({ ok: true });
    expect(model.allItems()).toEqual([]);
    expect(model.canUndoDeletion()).toBe(true);
  });

  test("saving an old editor does not close newly opened editor", async () => {
    const { model, setSave } = await setup([event(), event("other")]);
    const started = Promise.withResolvers();
    const finish = Promise.withResolvers();
    setSave(async () => {
      started.resolve();
      await finish.promise;
      return { ok: true, value: undefined };
    });
    await open(model);
    const saving = model.dispatch({ type: "editor.save" });
    await started.promise;
    await model.dispatch({ type: "editor.open-item", itemId: "other" });
    finish.resolve();
    await saving;
    expect(model.editorSession().draft.id).toBe("other");
  });
});

describe("placement retention", () => {
  test("all-day toggle keeps edited hours and current date through repeated toggles", async () => {
    const { model } = await setup();
    await open(model);
    await change(model, { type: "time-range", startMinute: 660, endMinute: 750 });
    await change(model, { type: "all-day", value: true });
    expect(model.editorSession().draft.durationMinute).toBe(90);
    await change(model, { type: "date", value: "2026-11-18" });
    await change(model, { type: "all-day", value: false });
    expect(model.editorSession().draft.placement).toEqual({
      type: "timed",
      date: "2026-11-18",
      startMinute: 660,
      endMinute: 750,
    });
    await change(model, { type: "time-range", startMinute: 720, endMinute: 840 });
    await change(model, { type: "all-day", value: true });
    await change(model, { type: "all-day", value: false });
    expect(model.editorSession().draft.placement.startMinute).toBe(720);
    expect(model.editorSession().draft.placement.endMinute).toBe(840);
  });

  test("reopened all-day item retains duration at default start time", async () => {
    const { model } = await setup([moveItem(event(), { type: "all-day", date: "2026-11-17" })]);
    await open(model);
    await change(model, { type: "all-day", value: false });
    expect(model.editorSession().draft.placement).toEqual({
      type: "timed",
      date: "2026-11-17",
      startMinute: 540,
      endMinute: 600,
    });
  });

  test("DOM drop adapter and placement share all-day duration", () => {
    const originalDocument = globalThis.document;
    globalThis.document = {
      elementFromPoint: () => ({
        closest: () => ({
          dataset: { dropZone: "timed", date: "2026-11-18" },
          getBoundingClientRect: () => ({ top: 0 }),
        }),
      }),
    };
    try {
      const item = moveItem(event(), { type: "all-day", date: "2026-11-17" });
      const target = resolveDomDropTarget(
        { clientX: 0, clientY: 1380 },
        { item, grabOffsetMinute: 0, hourHeight: 60 },
      );
      expect(target.startMinute).toBe(1380);
      expect(moveItem(item, target).placement.endMinute).toBe(1440);
    } finally {
      globalThis.document = originalDocument;
    }
  });
});
