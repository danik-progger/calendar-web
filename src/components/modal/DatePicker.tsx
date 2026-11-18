import { createEffect, createSignal, For, onCleanup } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import { CalendarDays, ChevronLeft, ChevronRight } from "@animateicons/vanilla/lucide";
import { AnimatedIcon } from "../icons/AnimatedIcon";
import type { DateKey } from "../../shared/calendar/calendar-item";

const dayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const dateKey = (date: Date): DateKey =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` as DateKey;

export function DatePicker(props: { value: DateKey; onChange(value: DateKey): void }) {
  const [open, setOpen] = createSignal(false);
  const [month, setMonth] = createSignal(parseDate(props.value));
  let root!: HTMLDivElement;
  let trigger!: HTMLButtonElement;
  createEffect(() => {
    if (!open()) setMonth(parseDate(props.value));
  });
  const closeOutside = (event: PointerEvent) => {
    if (!root.contains(event.target as Node)) setOpen(false);
  };
  document.addEventListener("pointerdown", closeOutside);
  onCleanup(() => document.removeEventListener("pointerdown", closeOutside));
  const days = () => {
    const value = month();
    const first = new Date(value.getFullYear(), value.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from(
      { length: 42 },
      (_, index) => new Date(value.getFullYear(), value.getMonth(), 1 - offset + index),
    );
  };
  const shift = (amount: number) =>
    setMonth((value) => new Date(value.getFullYear(), value.getMonth() + amount, 1));
  return (
    <div
      class="picker date-picker"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open()) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        class="picker__trigger date-picker__trigger"
        aria-label={`Start date, ${dayLabel.format(parseDate(props.value))}`}
        aria-expanded={open()}
        aria-haspopup="dialog"
        data-testid="event-start-date"
        onClick={() => setOpen(!open())}
      >
        <AnimatedIcon icon={CalendarDays} size={16} />
        <span>{shortDate.format(parseDate(props.value)).replace(/\//g, ".")}</span>
      </button>
      <Presence>
        {open() && (
          <Motion.div
            class="picker__panel date-picker__panel"
            role="dialog"
            aria-label="Choose date"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.18,
            }}
          >
            <div class="date-picker__header">
              <span aria-live="polite">{monthLabel.format(month())}</span>
              <div class="date-picker__navigation">
                <button type="button" aria-label="Previous month" onClick={() => shift(-1)}>
                  <AnimatedIcon icon={ChevronLeft} size={17} />
                </button>
                <button type="button" aria-label="Next month" onClick={() => shift(1)}>
                  <AnimatedIcon icon={ChevronRight} size={17} />
                </button>
              </div>
            </div>
            <div class="date-picker__grid">
              <For each={["M", "T", "W", "T", "F", "S", "S"]}>
                {(day) => <span aria-hidden="true">{day}</span>}
              </For>
              <For each={days()}>
                {(day) => (
                  <button
                    type="button"
                    aria-label={dayLabel.format(day)}
                    aria-current={dateKey(day) === props.value ? "date" : undefined}
                    tabIndex={
                      dateKey(day) === props.value ||
                      (day.getDate() === 1 &&
                        day.getMonth() === month().getMonth() &&
                        !days().some((value) => dateKey(value) === props.value))
                        ? 0
                        : -1
                    }
                    onKeyDown={(event) => {
                      const delta = (
                        { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<
                          string,
                          number
                        >
                      )[event.key];
                      if (delta === undefined) return;
                      event.preventDefault();
                      const buttons = Array.from(
                        event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                          "button",
                        ),
                      );
                      buttons[buttons.indexOf(event.currentTarget) + delta]?.focus();
                    }}
                    data-outside={day.getMonth() !== month().getMonth()}
                    data-selected={dateKey(day) === props.value}
                    onClick={() => {
                      props.onChange(dateKey(day));
                      setOpen(false);
                      trigger.focus();
                    }}
                  >
                    {day.getDate()}
                  </button>
                )}
              </For>
            </div>
          </Motion.div>
        )}
      </Presence>
    </div>
  );
}
