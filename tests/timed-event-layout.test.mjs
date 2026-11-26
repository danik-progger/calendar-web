import { expect, test } from "bun:test";
import { timedEventColumns } from "../src/components/calendar/timed-event-layout.ts";
import { createTimedEvent, moveItem } from "../src/shared/calendar/calendar-item.ts";

const date = "2026-11-22";
const event = (id, startMinute, endMinute) =>
  createTimedEvent({
    id,
    title: id,
    calendarId: "work",
    date,
    startMinute,
    durationMinute: endMinute - startMinute,
  });

test("overlapping events share a day's width and a back-to-back event uses the full width", () => {
  const columns = timedEventColumns(
    [event("call", 600, 660), event("next", 660, 720), event("focus", 570, 660)],
    80,
  );
  expect(columns.get("focus")).toEqual({ index: 0, count: 2 });
  expect(columns.get("call")).toEqual({ index: 1, count: 2 });
  expect(columns.get("next")).toEqual({ index: 0, count: 1 });
});

test("a connected group keeps its width and reuses columns as events finish", () => {
  const columns = timedEventColumns(
    [
      event("third", 570, 630),
      event("long", 540, 720),
      event("first", 540, 600),
      event("later", 630, 690),
    ],
    80,
  );
  expect([...columns.values()]).toEqual([
    { index: 0, count: 3 },
    { index: 1, count: 3 },
    { index: 2, count: 3 },
    { index: 1, count: 3 },
  ]);
});

test("minimum-height cards stay visible and all-day items take no time column", () => {
  const first = event("first", 540, 545);
  const second = event("second", 545, 550);
  const allDay = moveItem(event("all-day", 540, 600), { type: "all-day", date });
  const columns = timedEventColumns([second, allDay, first], 80);
  expect(columns.get("first")).toEqual({ index: 0, count: 2 });
  expect(columns.get("second")).toEqual({ index: 1, count: 2 });
  expect(columns.has("all-day")).toBe(false);
});
