import { expect, test } from "bun:test";
import { createCalendarModel } from "../src/shared/calendar/model.ts";
import { createTimedEvent } from "../src/shared/calendar/calendar-item.ts";
import { createApiCalendarItemRepository } from "../src/shared/data/api-calendar-item-repository.ts";

const event = (id) =>
  createTimedEvent({
    id,
    title: id,
    calendarId: "work",
    date: "2026-11-19",
    startMinute: 540,
  });

test("remote refresh waits for saves and preserves an open draft", async () => {
  let remote = [event("first")];
  let finishSave;
  let startedSave;
  const started = new Promise((resolve) => {
    startedSave = resolve;
  });
  const model = createCalendarModel({
    repository: {
      loadAll: async () => ({ ok: true, value: structuredClone(remote) }),
      write: async ({ item }) => {
        startedSave();
        await new Promise((resolve) => {
          finishSave = resolve;
        });
        remote = [item, event("from-another-device")];
        return { ok: true, value: undefined };
      },
    },
    createId: () => "new",
  });
  await model.initialize();
  await model.dispatch({ type: "editor.open-item", itemId: "first" });
  await model.dispatch({
    type: "editor.change",
    change: { type: "title", value: "Unsaved draft" },
  });
  const save = model.dispatch({ type: "item.resize", itemId: "first", endMinute: 630 });
  await started;
  const refresh = model.refresh();
  finishSave();
  await Promise.all([save, refresh]);
  expect(model.allItems().map((item) => item.id)).toEqual(["first", "from-another-device"]);
  expect(model.allItems()[0].placement.endMinute).toBe(630);
  expect(model.editorSession().draft.title).toBe("Unsaved draft");
});

test("saving an open draft does not recreate an event deleted remotely", async () => {
  let remote = [event("first")];
  const writes = [];
  const model = createCalendarModel({
    repository: {
      loadAll: async () => ({ ok: true, value: remote }),
      write: async (write) => {
        writes.push(write);
        return { ok: true, value: undefined };
      },
    },
    createId: () => "new",
  });
  await model.initialize();
  await model.dispatch({ type: "editor.open-item", itemId: "first" });
  await model.dispatch({
    type: "editor.change",
    change: { type: "title", value: "Unsaved draft" },
  });
  remote = [];
  await model.refresh();
  expect(await model.dispatch({ type: "editor.save" })).toEqual({
    ok: false,
    error: "item-not-found",
  });
  expect(writes).toEqual([]);
  expect(model.editorSession().draft.title).toBe("Unsaved draft");
});

test("a transient refresh failure keeps the loaded calendar and open draft usable", async () => {
  const first = event("first");
  let online = true;
  const model = createCalendarModel({
    repository: {
      loadAll: async () =>
        online
          ? { ok: true, value: [first] }
          : { ok: false, error: { operation: "load", message: "Offline" } },
      write: async () => ({ ok: true, value: undefined }),
    },
    createId: () => "new",
  });
  await model.initialize();
  await model.dispatch({ type: "editor.open-item", itemId: first.id });
  online = false;
  expect((await model.refresh()).ok).toBe(false);
  expect(model.loadState().phase).toBe("ready");
  expect(await model.dispatch({ type: "editor.save" })).toEqual({ ok: true });
});

test("a notification arriving during refresh triggers another snapshot", async () => {
  let loads = 0;
  let finishLoad;
  let startedLoad;
  const started = new Promise((resolve) => {
    startedLoad = resolve;
  });
  const model = createCalendarModel({
    repository: {
      loadAll: async () => {
        const count = ++loads;
        if (count === 2) {
          startedLoad();
          await new Promise((resolve) => {
            finishLoad = resolve;
          });
        }
        return { ok: true, value: [event(String(count))] };
      },
      write: async () => ({ ok: true, value: undefined }),
    },
    createId: () => "new",
  });
  await model.initialize();
  const first = model.refresh();
  await started;
  const second = model.refresh();
  finishLoad();
  await Promise.all([first, second]);
  expect(model.allItems()[0].id).toBe("3");
});

test("event writes pick the HTTP method, skip identical saves, and accept a missing delete", async () => {
  const requests = [];
  const repository = createApiCalendarItemRepository(async (path, { method }) => {
    requests.push(`${method} ${path}`);
    return new Response(null, { status: method === "DELETE" ? 404 : 204 });
  });
  const item = event("first");
  const edited = { ...item, title: "Edited" };
  for (const write of [
    { type: "save", item, previous: null },
    { type: "save", item, previous: item },
    { type: "save", item: edited, previous: item },
    { type: "delete", id: item.id },
  ])
    expect((await repository.write(write)).ok).toBe(true);
  expect(requests).toEqual([
    "POST /api/v1/events",
    "PUT /api/v1/events/first",
    "DELETE /api/v1/events/first",
  ]);
});

test("stream decodes split CRLF frames, ignores heartbeats, and cancels", async () => {
  let stream;
  let signal;
  const repository = createApiCalendarItemRepository(async (path, options) => {
    expect(path).toBe("/api/v1/events/stream");
    signal = options.signal;
    return new Response(
      new ReadableStream({
        start(controller) {
          stream = controller;
        },
      }),
      {
        headers: { "content-type": "text/event-stream" },
      },
    );
  });
  let changes = 0;
  const stop = repository.subscribe(() => {
    changes += 1;
  });
  const encoder = new TextEncoder();
  stream.enqueue(encoder.encode(": heartbeat\r\nevent: change\r\nda"));
  stream.enqueue(encoder.encode("ta: {}\r\n\r\n"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(changes).toBe(1);
  stop();
  expect(signal.aborted).toBe(true);
  stream.close();
});
