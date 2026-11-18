export const CALENDARS = [
  { id: "birthdays", label: "Birthdays", color: "#f2ad3d" },
  { id: "personal", label: "Personal", color: "#e86bb5" },
  { id: "work", label: "Work", color: "#7283db" },
  { id: "health", label: "Health", color: "#42beb9" },
] as const;
export type CalendarId = (typeof CALENDARS)[number]["id"];
export type CalendarDefinition = Readonly<{ id: CalendarId; label: string; color: string }>;
export type CalendarVisibility = Readonly<Record<CalendarId, boolean>>;
export function calendarById(id: CalendarId): CalendarDefinition {
  return CALENDARS.find((calendar) => calendar.id === id) ?? CALENDARS[0];
}
export function isCalendarId(value: string): value is CalendarId {
  return CALENDARS.some((calendar) => calendar.id === value);
}
export function createDefaultCalendarVisibility(): CalendarVisibility {
  return { birthdays: true, personal: true, work: true, health: true };
}
