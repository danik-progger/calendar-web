import { Motion, Presence } from "solid-motionone";
import { createEffect, createSignal, For, onCleanup } from "solid-js";

export function TimePicker(props: {
  value: string;
  label: string;
  testId: string;
  onChange(value: string): void;
}) {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal(props.value);
  let root!: HTMLDivElement;
  createEffect(() => setText(props.value));
  const commit = () => {
    const match = text()
      .trim()
      .match(/^(\d{1,2}):([0-5]\d)$/);
    if (match && (Number(match[1]) <= 23 || (match[1] === "24" && match[2] === "00"))) {
      props.onChange(`${match[1].padStart(2, "0")}:${match[2]}`);
    } else {
      setText(props.value);
    }
  };
  const closeOutside = (event: PointerEvent) => {
    if (!root.contains(event.target as Node)) {
      commit();
      setOpen(false);
    }
  };
  document.addEventListener("pointerdown", closeOutside);
  onCleanup(() => document.removeEventListener("pointerdown", closeOutside));
  const options = Array.from(
    { length: 48 },
    (_, index) => `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
  );
  return (
    <div class="picker time-picker" ref={root}>
      <input
        type="text"
        inputmode="numeric"
        value={text()}
        aria-label={props.label}
        data-testid={props.testId}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onInput={(event) => setText(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            commit();
            setOpen(false);
          }
          if (event.key === "Escape" && open()) {
            event.stopPropagation();
            setText(props.value);
            setOpen(false);
          }
        }}
        onBlur={(event) => {
          if (!root.contains(event.relatedTarget as Node | null)) {
            commit();
            setOpen(false);
          }
        }}
      />
      <Presence>
        {open() && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.18,
            }}
            class="picker__panel time-picker__list"
            role="group"
            aria-label={`${props.label} suggestions`}
            ref={(element) =>
              queueMicrotask(() => {
                const [hours, minutes] = props.value.split(":").map(Number);
                const index = Math.min(47, Math.floor((hours * 60 + minutes) / 30));
                const item = element.children.item(index) as HTMLElement | null;
                if (item) element.scrollTop = item.offsetTop - element.offsetTop;
              })
            }
          >
            <For each={options}>
              {(option) => (
                <button
                  type="button"
                  class="picker__option"
                  data-selected={option === props.value}
                  onClick={() => {
                    props.onChange(option);
                    setOpen(false);
                  }}
                >
                  {option}
                </button>
              )}
            </For>
          </Motion.div>
        )}
      </Presence>
    </div>
  );
}
