import type { CalendarItem } from "../calendar/calendar-item";
import { isCalendarId } from "../calendar/calendars";
import { isDateKey } from "../calendar/date-time";
import type {
  CalendarItemRepository,
  RepositoryOperation,
  RepositoryResult,
} from "./calendar-item-repository";

const STORAGE_KEY = "calendar-only.events.v1";

export function createLocalStorageCalendarItemRepository(
  storage: Pick<Storage, "getItem" | "setItem" | "length" | "key">,
  initialItems: readonly CalendarItem[],
  userId?: string,
): CalendarItemRepository {
  const storageKey = userId ? `${STORAGE_KEY}.user.${userId}` : STORAGE_KEY;
  return {
    async loadAll() {
      try {
        const current = storage.getItem(storageKey);
        const legacyKeys =
          current === null && !userId
            ? Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
                (key): key is string => key?.endsWith(`-${STORAGE_KEY}`) ?? false,
              )
            : [];
        if (legacyKeys.length > 1) throw new Error("Multiple previous calendar stores found");
        const json = current ?? (legacyKeys.length ? storage.getItem(legacyKeys[0]) : null);
        if (json === null) {
          storage.setItem(storageKey, JSON.stringify(initialItems));
          return { ok: true, value: structuredClone(initialItems) };
        }
        const items: unknown = JSON.parse(json);
        if (
          !Array.isArray(items) ||
          !items.every(isCalendarItem) ||
          new Set(items.map((item) => item.id)).size !== items.length
        )
          throw new Error("Stored calendar data is invalid");
        if (current === null) storage.setItem(storageKey, json);
        return { ok: true, value: structuredClone(items) };
      } catch (cause) {
        return failure("load", cause);
      }
    },
    async saveAll(items) {
      try {
        storage.setItem(storageKey, JSON.stringify(items));
        return { ok: true, value: undefined };
      } catch (cause) {
        return failure("save", cause);
      }
    },
  };
}

function failure(operation: RepositoryOperation, cause: unknown): RepositoryResult<never> {
  return {
    ok: false,
    error: { operation, message: cause instanceof Error ? cause.message : String(cause), cause },
  };
}

export function isCalendarItem(value: unknown): value is CalendarItem {
  if (!isRecord(value) || !isRecord(value.placement)) return false;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
