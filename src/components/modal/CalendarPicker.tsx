import { createSignal, For, onCleanup } from "solid-js";
import { AnimatedIcon } from "../icons/AnimatedIcon";
import { ChevronDown } from "@animateicons/vanilla/lucide";
import { Motion, Presence } from "solid-motionone";
import type { CalendarDefinition, CalendarId } from "../../shared/calendar/calendars";

export function CalendarPicker(props: {
  value: CalendarId;
  calendars: readonly CalendarDefinition[];
  onChange(value: CalendarId): void;
}) {
  const [open, setOpen] = createSignal(false);
  const selected = () => props.calendars.find((calendar) => calendar.id === props.value);
  let root!: HTMLDivElement;
  let trigger!: HTMLButtonElement;
  const closeOutside = (event: PointerEvent) => {
    if (!root.contains(event.target as Node)) setOpen(false);
  };
  document.addEventListener("pointerdown", closeOutside);
  onCleanup(() => document.removeEventListener("pointerdown", closeOutside));
  return (
    <div
      class="picker calendar-picker"
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
        class="picker__trigger calendar-picker__trigger"
        aria-label={`Calendar, ${selected()?.label ?? "Select"}`}
        aria-haspopup="dialog"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        <span
          class="event-editor__color"
          style={{ "background-color": selected()?.color }}
          aria-hidden="true"
        />
        <span>{selected()?.label}</span>
        <AnimatedIcon icon={ChevronDown} size={13} />
      </button>
      <Presence>
        {open() && (
          <Motion.div
            class="picker__panel calendar-picker__panel"
            role="dialog"
            aria-label="Choose calendar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.18,
            }}
          >
            <For each={props.calendars}>
              {(calendar) => (
                <button
                  type="button"
                  class="picker__option"
                  data-selected={calendar.id === props.value}
                  aria-pressed={calendar.id === props.value}
                  onClick={() => {
                    props.onChange(calendar.id);
                    setOpen(false);
                    trigger.focus();
                  }}
                >
                  <span
                    class="calendar-picker__swatch"
                    style={{ "background-color": calendar.color }}
                    aria-hidden="true"
                  />
                  <span>{calendar.label}</span>
                </button>
              )}
            </For>
          </Motion.div>
        )}
      </Presence>
    </div>
  );
}
