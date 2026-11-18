import type { CalendarItem } from "../calendar/calendar-item";
import type {
  CalendarItemRepository,
  RepositoryOperation,
  RepositoryResult,
} from "./calendar-item-repository";
import { isCalendarItem } from "./local-storage-calendar-item-repository";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromEvent(value: unknown): CalendarItem {
  if (
    !record(value) ||
    typeof value.startAt !== "string" ||
    typeof value.endAt !== "string" ||
    !record(value.metadata)
  ) {
    throw new Error("Calendar response is invalid.");
  }
  const start = new Date(value.startAt);
  const end = new Date(value.endAt);
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start ||
    typeof value.allDay !== "boolean"
  ) {
    throw new Error("Calendar dates are invalid.");
  }
  const date = value.allDay ? value.startAt.slice(0, 10) : dateKey(start);
  if (
    value.allDay &&
    (end.getTime() - start.getTime() !== 86_400_000 ||
      start.getUTCHours() !== 0 ||
      start.getUTCMinutes() !== 0)
  ) {
    throw new Error("All-day events must use a single UTC date.");
  }
  const midnight = end.getHours() === 0 && end.getMinutes() === 0;
  const followingDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  if (
    !value.allDay &&
    dateKey(end) !== date &&
    !(midnight && dateKey(end) === dateKey(followingDay))
  ) {
    throw new Error("This event spans multiple days and cannot be displayed yet.");
  }
  const item = {
    id: value.id,
    title: value.title,
    notes: value.description ?? "",
    type: "event",
    calendarId: value.metadata.calendarId,
    presentation: value.metadata.presentation,
    ...(value.metadata.durationMinute == null
      ? {}
      : { durationMinute: value.metadata.durationMinute }),
    placement: value.allDay
      ? { type: "all-day", date }
      : {
          type: "timed",
          date,
          startMinute: start.getHours() * 60 + start.getMinutes(),
          endMinute: midnight ? 1440 : end.getHours() * 60 + end.getMinutes(),
        },
  };
  if (!isCalendarItem(item)) throw new Error("Calendar response is invalid.");
  return item;
}

function toEvent(item: CalendarItem) {
  const placement = item.placement;
  const [year, month, day] = placement.date.split("-").map(Number);
  const allDay = placement.type === "all-day";
  const start = allDay
    ? new Date(Date.UTC(year, month - 1, day))
    : new Date(year, month - 1, day, 0, placement.startMinute);
  const end = allDay
    ? new Date(Date.UTC(year, month - 1, day + 1))
    : new Date(year, month - 1, day, 0, placement.endMinute);
  return {
    id: item.id,
    title: item.title,
    description: item.notes,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    allDay,
    metadata: {
      calendarId: item.calendarId,
      presentation: item.presentation,
      durationMinute: item.durationMinute ?? null,
    },
  };
}

export function createApiCalendarItemRepository(
  request: typeof fetch = fetch,
): CalendarItemRepository {
  const confirmed = new Map<string, string>();
  async function call(path: string, method = "GET", body?: unknown) {
    const response = await request(`/api/v1/events${path}`, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Your session expired. Sign in again."
          : "Couldn’t save or load your calendar. Try again.",
      );
    return response;
  }
  function failure(operation: RepositoryOperation, cause: unknown): RepositoryResult<never> {
    return {
      ok: false,
      error: {
        operation,
        message: cause instanceof Error ? cause.message : "Calendar request failed.",
        cause,
      },
    };
  }
  return {
    async loadAll() {
      try {
        const items: CalendarItem[] = [];
        for (let offset = 0; ; offset += 1000) {
          const response: unknown = await (await call(`?limit=1000&offset=${offset}`)).json();
          if (!Array.isArray(response)) throw new Error("Calendar response is invalid.");
          items.push(...response.map(fromEvent));
          if (response.length < 1000) break;
        }
        confirmed.clear();
        for (const item of items) confirmed.set(item.id, JSON.stringify(toEvent(item)));
        return { ok: true, value: items };
      } catch (cause) {
        return failure("load", cause);
      }
    },
    async saveAll(items) {
      try {
        for (const item of items) {
          const event = toEvent(item);
          const encoded = JSON.stringify(event);
          if (confirmed.get(item.id) === encoded) continue;
          const existing = confirmed.has(item.id);
          await call(
            existing ? `/${encodeURIComponent(item.id)}` : "",
            existing ? "PUT" : "POST",
            event,
          );
          confirmed.set(item.id, encoded);
        }
        const keep = new Set(items.map((item) => item.id));
        for (const id of confirmed.keys()) {
          if (keep.has(id)) continue;
          const response = await request(`/api/v1/events/${encodeURIComponent(id)}`, {
            method: "DELETE",
            credentials: "same-origin",
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok && response.status !== 404)
            throw new Error("Couldn’t delete the event. Try again.");
          confirmed.delete(id);
        }
        return { ok: true, value: undefined };
      } catch (cause) {
        return failure("save", cause);
      }
    },
  };
}
