export const CALENDARS = [
  { id: "birthdays", label: "Birthdays", color: "var(--calendar-birthdays)" },
  { id: "personal", label: "Personal", color: "var(--calendar-personal)" },
  { id: "work", label: "Work", color: "var(--calendar-work)" },
  { id: "health", label: "Health", color: "var(--calendar-health)" },
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
