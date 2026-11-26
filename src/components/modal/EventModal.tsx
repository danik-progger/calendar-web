import { Motion } from "solid-motionone";
import { onCleanup, onMount, Show } from "solid-js";
import type { CalendarCommandResult } from "../../shared/calendar/model";
import type { CalendarDefinition } from "../../shared/calendar/calendars";
import type { EditorChange, EditorSession } from "../../shared/calendar/editor";
import { EventModalDetails } from "./EventModalDetails";
import { EventModalMetadata } from "./EventModalMetadata";
import "./modal.css";

export function EventModal(props: {
  session: Exclude<EditorSession, null>;
  calendars: readonly CalendarDefinition[];
  onChange(change: EditorChange): void;
  onSave(): Promise<CalendarCommandResult>;
  onCancel(): void;
  onDelete(): Promise<CalendarCommandResult>;
}) {
  let modal!: HTMLElement;
  const draft = () => props.session.draft;
  onMount(() => {
    const pointer = () => {
      modal.dataset.pointerFocus = "true";
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Tab") delete modal.dataset.pointerFocus;
    };
    modal.addEventListener("pointerdown", pointer, true);
    modal.addEventListener("keydown", keyboard, true);
    onCleanup(() => {
      modal.removeEventListener("pointerdown", pointer, true);
      modal.removeEventListener("keydown", keyboard, true);
    });
    modal.querySelector<HTMLElement>("[autofocus]")?.focus();
  });
  return (
    <Motion.div
      class="event-editor__backdrop"
      onPointerDown={props.onCancel}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.18,
      }}
    >
      <section
        ref={modal}
        data-testid="event-modal"
        class="event-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Edit event"
        tabIndex={-1}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.isComposing) return;
          if (event.key === "Tab") {
            const focusable = Array.from(
              event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
              ),
            ).filter((element) => element.tabIndex >= 0);
            const target = event.target;
            if (event.shiftKey && target === focusable[0]) {
              event.preventDefault();
              focusable.at(-1)?.focus();
            } else if (!event.shiftKey && target === focusable.at(-1)) {
              event.preventDefault();
              focusable[0]?.focus();
            }
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            props.onCancel();
            return;
          }
          if (
            event.key === "Enter" &&
            !(event.target instanceof HTMLTextAreaElement) &&
            !(event.target instanceof HTMLButtonElement)
          ) {
            event.preventDefault();
            void props.onSave();
          }
        }}
      >
        <EventModalDetails draft={draft()} onChange={props.onChange} />
        <EventModalMetadata draft={draft()} calendars={props.calendars} onChange={props.onChange} />
        <Show when={props.session.error}>
          <p class="event-editor__error" role="alert">
            {props.session.error === "title-required"
              ? "Add a title to save this event."
              : props.session.error === "item-not-found"
                ? "This event was deleted."
                : "Please check the event details."}
          </p>
        </Show>
        <div class="event-editor__footer">
          <Show when={props.session.mode === "edit"}>
            <button
              type="button"
              class="action-button event-editor__delete"
              aria-label="Delete event"
              onClick={() => void props.onDelete()}
            >
              Delete
            </button>
          </Show>
          <button
            type="button"
            class="action-button"
            aria-keyshortcuts="Escape"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            class="action-button event-editor__save"
            aria-keyshortcuts="Enter"
            onClick={() => void props.onSave()}
          >
            Save
          </button>
        </div>
      </section>
    </Motion.div>
  );
}
