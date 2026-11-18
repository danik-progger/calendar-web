import { clampTimeRange, pixelToMinute, snapMinute } from "../calendar/date-time";
import { DRAG_SNAP_MINUTES, type MinuteOfDay } from "../calendar/calendar-item";
export function grabOffsetMinute(pointerY: number, rectTop: number, hourHeight: number): number {
  return Math.max(0, pixelToMinute(pointerY - rectTop, hourHeight));
}
export function resolveTimedDropMinute(
  pointerY: number,
  zoneTop: number,
  hourHeight: number,
  grabOffset: number,
  duration: number,
): MinuteOfDay {
  const raw = pixelToMinute(pointerY - zoneTop, hourHeight) - grabOffset;
  return clampTimeRange(
    snapMinute(raw, DRAG_SNAP_MINUTES),
    snapMinute(raw, DRAG_SNAP_MINUTES) + duration,
  ).startMinute;
}
export function resolveTimedResizeEndMinute(
  originalEndMinute: number,
  deltaPixel: number,
  hourHeight: number,
  startMinute: number,
): MinuteOfDay {
  const endMinute = snapMinute(
    originalEndMinute + pixelToMinute(deltaPixel, hourHeight),
    DRAG_SNAP_MINUTES,
  );
  return Math.min(1440, Math.max(startMinute + 5, endMinute)) as MinuteOfDay;
}
