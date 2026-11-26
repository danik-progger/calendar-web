import type { CalendarItem } from "../calendar/calendar-item";
import { isCalendarId } from "../calendar/calendars";
import { dateKeyFromDate, isDateKey } from "../calendar/date-time";
import {
  CalendarSessionExpiredError,
  type CalendarItemRepository,
  type RepositoryOperation,
  type RepositoryResult,
} from "./calendar-item-repository";

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  const date = value.allDay ? value.startAt.slice(0, 10) : dateKeyFromDate(start);
  if (
    value.allDay &&
    (end.getTime() - start.getTime() !== 86_400_000 ||
      start.getUTCHours() !== 0 ||
      start.getUTCMinutes() !== 0)
  ) {
    throw new Error("All-day events must use a single UTC date.");
  }
  const midnight = end.getHours() === 0 && end.getMinutes() === 0;
  const endDate = dateKeyFromDate(end);
  const followingDay = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  if (
    !value.allDay &&
    endDate !== date &&
    !(midnight && endDate === dateKeyFromDate(followingDay))
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
  async function call(path: string, method = "GET", body?: string) {
    const response = await request(`/api/v1/events${path}`, {
      method,
      credentials: "same-origin",
      headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok || (method === "DELETE" && response.status === 404)) return response;
    if (method === "DELETE") throw new Error("Couldn’t delete the event. Try again.");
    if (response.status === 401) throw new CalendarSessionExpiredError();
    throw new Error("Couldn’t save or load your calendar. Try again.");
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
    subscribe(changed) {
      const controller = new AbortController();
      const { signal } = controller;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const run = async () => {
        let retry = 1000;
        while (!signal.aborted) {
          try {
            const response = await request("/api/v1/events/stream", {
              headers: { Accept: "text/event-stream" },
              credentials: "same-origin",
              signal,
            });
            if (response.status === 401) {
              changed();
              return;
            }
            if (
              !response.ok ||
              !response.headers.get("content-type")?.startsWith("text/event-stream") ||
              !response.body
            )
              throw new Error("Calendar stream unavailable.");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            try {
              while (!signal.aborted) {
                const chunk = await reader.read();
                if (chunk.done) break;
                buffer += decoder.decode(chunk.value, { stream: true });
                let end: number;
                while ((end = buffer.indexOf("\n")) >= 0) {
                  const line = buffer.slice(0, end).replace(/\r$/, "");
                  buffer = buffer.slice(end + 1);
                  if (line === "data: {}") {
                    retry = 1000;
                    changed();
                  }
                }
                if (buffer.length > 65536) throw new Error("Calendar stream invalid.");
              }
            } finally {
              await reader.cancel().catch(() => {});
              reader.releaseLock();
            }
          } catch {
            if (signal.aborted) return;
          }
          await new Promise<void>((resolve) => {
            const finish = () => {
              clearTimeout(timer);
              signal.removeEventListener("abort", finish);
              resolve();
            };
            signal.addEventListener("abort", finish, { once: true });
            timer = setTimeout(finish, retry);
            if (signal.aborted) finish();
          });
          retry = Math.min(retry * 2, 30000);
        }
      };
      void run();
      return () => controller.abort();
    },
    async loadAll() {
      try {
        const items: CalendarItem[] = [];
        for (let offset = 0; ; offset += 1000) {
          const response: unknown = await (await call(`?limit=1000&offset=${offset}`)).json();
          if (!Array.isArray(response)) throw new Error("Calendar response is invalid.");
          items.push(...response.map(fromEvent));
          if (response.length < 1000) break;
        }
        return { ok: true, value: items };
      } catch (cause) {
        return failure("load", cause);
      }
    },
    async write(change) {
      try {
        if (change.type === "delete") {
          await call(`/${encodeURIComponent(change.id)}`, "DELETE");
        } else {
          const { item, previous } = change;
          const encoded = JSON.stringify(toEvent(item));
          if (!previous || JSON.stringify(toEvent(previous)) !== encoded) {
            await call(
              previous ? `/${encodeURIComponent(item.id)}` : "",
              previous ? "PUT" : "POST",
              encoded,
            );
          }
        }
        return { ok: true, value: undefined };
      } catch (cause) {
        return failure("save", cause);
      }
    },
  };
}

function isCalendarItem(value: unknown): value is CalendarItem {
  if (!record(value) || !record(value.placement)) return false;
  if (
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    typeof value.calendarId !== "string" ||
    !isCalendarId(value.calendarId) ||
    typeof value.notes !== "string" ||
    (value.durationMinute !== undefined && !isPositiveNumber(value.durationMinute))
  )
    return false;

  const placement = value.placement;
  const validPlacement =
    (placement.type === "all-day" &&
      typeof placement.date === "string" &&
      isDateKey(placement.date)) ||
    (placement.type === "timed" &&
      typeof placement.date === "string" &&
      isDateKey(placement.date) &&
      typeof placement.startMinute === "number" &&
      typeof placement.endMinute === "number" &&
      placement.startMinute >= 0 &&
      placement.startMinute < placement.endMinute &&
      placement.endMinute <= 1440);
  if (!validPlacement) return false;

  return (
    value.type === "event" &&
    (value.presentation === "standard" ||
      value.presentation === "focus" ||
      value.presentation === "call")
  );
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
