import { createMemo, createSignal, type Accessor } from "solid-js";
import {
  addDays,
  dateFromKey,
  dateKeyFromDate,
  formatDayLabel,
  formatMonthLabel,
} from "./date-time";
import type { DateKey, MinuteOfDay } from "./calendar-item";
export type ViewMode = "day" | "three-day" | "week";
export type CalendarDay = Readonly<{
  key: DateKey;
  weekday: string;
  dayNumber: number;
  isToday: boolean;
}>;
export type CalendarViewOptions = Readonly<{ now: () => Date; initialViewportWidth: number }>;
export type CalendarView = Readonly<{
  mode: Accessor<ViewMode>;
  isMobile: Accessor<boolean>;
  anchorDate: Accessor<DateKey>;
  days: Accessor<readonly CalendarDay[]>;
  monthLabel: Accessor<string>;
  todayKey: Accessor<DateKey>;
  currentMinute: Accessor<MinuteOfDay>;
  currentTimeLabel: Accessor<string>;
  boardShift: Accessor<"forward" | "backward" | null>;
  setMode(mode: ViewMode): void;
  setViewportWidth(width: number): void;
  goToday(): void;
  shiftDays(amount: number): void;
  pushHorizontalWheel(delta: number): void;
  dispose(): void;
}>;
export function createCalendarView(options: CalendarViewOptions): CalendarView {
  const initialMode = modeForWidth(options.initialViewportWidth);
  const initialDate = dateKeyFromDate(options.now());
  const [mode, setModeSignal] = createSignal<ViewMode>(initialMode);
  const [isMobile, setIsMobile] = createSignal(options.initialViewportWidth < 720);
  const [anchorDate, setAnchorDate] = createSignal(
    initialMode === "week" ? mondayOf(initialDate) : initialDate,
  );
  const [now, setNow] = createSignal(options.now());
  const [boardShift, setBoardShift] = createSignal<"forward" | "backward" | null>(null);
  let shiftTimer: ReturnType<typeof setTimeout> | undefined;
  let wheelDistance = 0;
  let wheelTimer: ReturnType<typeof setTimeout> | undefined;
  const clockTimer =
    typeof window === "undefined"
      ? undefined
      : window.setInterval(() => setNow(options.now()), 30_000);
  const todayKey = createMemo(() => dateKeyFromDate(now()));
  const dayCount = createMemo(() => (mode() === "day" ? 1 : mode() === "three-day" ? 3 : 7));
  const days = createMemo(() => {
    return Array.from({ length: dayCount() }, (_, index) => {
      const key = addDays(anchorDate(), index);
      const label = formatDayLabel(key);
      return {
        key,
        weekday: label.weekday,
        dayNumber: label.dayNumber,
        isToday: key === todayKey(),
      };
    });
  });
  const monthLabel = createMemo(() => formatMonthLabel(anchorDate()));
  const currentMinute = createMemo(() => now().getHours() * 60 + now().getMinutes());
  const currentTimeLabel = createMemo(
    () =>
      `${String(now().getHours()).padStart(2, "0")}:${String(now().getMinutes()).padStart(2, "0")}`,
  );
  const setMode = (next: ViewMode) => {
    if (isMobile() && next !== "day") return;
    if (next === "week" && mode() !== "week") setAnchorDate((key) => mondayOf(key));
    setModeSignal(next);
  };
  const shiftDays = (amount: number) => {
    setAnchorDate((key) => addDays(key, amount));
    setBoardShift(amount > 0 ? "forward" : "backward");
    if (shiftTimer) globalThis.clearTimeout(shiftTimer);
    shiftTimer = globalThis.setTimeout(() => setBoardShift(null), 180);
  };
  const pushHorizontalWheel = (delta: number) => {
    wheelDistance += delta;
    if (wheelTimer) globalThis.clearTimeout(wheelTimer);
    wheelTimer = globalThis.setTimeout(() => {
      wheelDistance = 0;
    }, 140);
    if (Math.abs(wheelDistance) >= 80) {
      shiftDays(wheelDistance > 0 ? 1 : -1);
      wheelDistance = 0;
    }
  };
  return {
    mode,
    isMobile,
    anchorDate,
    days,
    monthLabel,
    todayKey,
    currentMinute,
    currentTimeLabel,
    boardShift,
    setMode,
    setViewportWidth(width) {
      setIsMobile(width < 720);
      if (width < 720) setModeSignal("day");
      else if (mode() === "day" && width >= 1440) {
        setAnchorDate((key) => mondayOf(key));
        setModeSignal("week");
      }
    },
    goToday() {
      setAnchorDate(mode() === "week" ? mondayOf(todayKey()) : todayKey());
    },
    shiftDays,
    pushHorizontalWheel,
    dispose() {
      if (shiftTimer) globalThis.clearTimeout(shiftTimer);
      if (wheelTimer) globalThis.clearTimeout(wheelTimer);
      if (clockTimer) globalThis.clearInterval(clockTimer);
    },
  };
}
function modeForWidth(width: number): ViewMode {
  return width < 960 ? "day" : width < 1440 ? "three-day" : "week";
}

function mondayOf(key: DateKey): DateKey {
  const date = dateFromKey(key);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKeyFromDate(date);
}
