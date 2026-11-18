import type { CalendarItem } from "../calendar/calendar-item";
export type RepositoryOperation = "load" | "save";
export type CalendarRepositoryError = Readonly<{
  operation: RepositoryOperation;
  message: string;
  cause?: unknown;
}>;
export type RepositoryResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: CalendarRepositoryError }>;
export interface CalendarItemRepository {
  loadAll(): Promise<RepositoryResult<readonly CalendarItem[]>>;
  saveAll(items: readonly CalendarItem[]): Promise<RepositoryResult<void>>;
}
