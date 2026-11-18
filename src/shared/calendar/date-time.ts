import type { DateKey, MinuteOfDay } from "./calendar-item";
const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
export function dateKeyFromDate(date: Date): DateKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` as DateKey;
}
export function dateFromKey(key: DateKey): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}
export function isDateKey(value: string): value is DateKey {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dateFromKey(value as DateKey).getTime())
  );
}
export function addDays(key: DateKey, amount: number): DateKey {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return dateKeyFromDate(date);
}
export function clampMinute(value: number): MinuteOfDay {
  return Math.max(0, Math.min(1440, Math.round(value)));
}
export function clampTimeRange(startMinute: number, endMinute: number) {
  let start = Math.max(0, Math.min(1439, Math.round(startMinute)));
  let end = Math.max(1, Math.min(1440, Math.round(endMinute)));
  if (end - start < 5) end = Math.min(1440, start + 5);
  if (end - start < 5) start = Math.max(0, end - 5);
  return { startMinute: start as MinuteOfDay, endMinute: end as MinuteOfDay };
}
export function snapMinute(value: number, interval = 30): MinuteOfDay {
  return clampMinute(Math.round(value / interval) * interval) as MinuteOfDay;
}
export function minuteFromTimeInput(value: string): MinuteOfDay {
  const [hours, minutes] = value.split(":").map(Number);
  return clampMinute(hours * 60 + minutes) as MinuteOfDay;
}
export function timeInputFromMinute(minute: MinuteOfDay): string {
  const value = clampMinute(minute);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
export function formatHourLabel(minute: MinuteOfDay): string {
  if (minute === 0) return "";
  return String(Math.floor(minute / 60));
}
export function formatTimeRange(startMinute: MinuteOfDay, endMinute: MinuteOfDay): string {
  return `${formatTime(startMinute)} – ${formatTime(endMinute)}`;
}
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours ? `${hours}h` : ""}${remainder ? String(remainder).padStart(2, "0") : ""}`;
}
export function formatDayLabel(key: DateKey): { weekday: string; dayNumber: number } {
  const date = dateFromKey(key);
  return { weekday: dayFormatter.format(date), dayNumber: date.getDate() };
}
export function formatMonthLabel(key: DateKey): string {
  return monthFormatter.format(dateFromKey(key));
}
export function minuteToPixel(minute: MinuteOfDay, hourHeight: number): number {
  return (minute / 60) * hourHeight;
}
export function pixelToMinute(pixel: number, hourHeight: number): number {
  return (pixel / hourHeight) * 60;
}

function formatTime(minute: MinuteOfDay): string {
  const hour = String(Math.floor(minute / 60));
  return minute % 60 ? `${hour}:${String(minute % 60).padStart(2, "0")}` : hour;
}
