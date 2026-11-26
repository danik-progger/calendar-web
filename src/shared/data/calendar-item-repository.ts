import type { CalendarItem } from "../calendar/calendar-item";
export class CalendarSessionExpiredError extends Error {
  constructor() {
    super("Your session expired. Sign in again.");
  }
}

export type RepositoryOperation = "load" | "save";
export type CalendarRepositoryError = Readonly<{
  operation: RepositoryOperation;
  message: string;
  cause?: unknown;
}>;
export type RepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: CalendarRepositoryError }>;
export type CalendarItemWrite =
  | Readonly<{ type: "save"; item: CalendarItem; previous: CalendarItem | null }>
  | Readonly<{ type: "delete"; id: CalendarItem["id"] }>;
export interface CalendarItemRepository {
  subscribe?(changed: () => void): () => void;
  loadAll(): Promise<RepositoryResult<readonly CalendarItem[]>>;
  write(change: CalendarItemWrite): Promise<RepositoryResult<void>>;
}
