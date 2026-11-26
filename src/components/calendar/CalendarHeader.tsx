import { AnimatedIcon } from "../icons/AnimatedIcon";
import { ChevronLeft, ChevronRight } from "@animateicons/vanilla/lucide";
import type { ViewMode } from "../../shared/calendar/view";
import { AccountDropdown } from "./AccountDropdown";
import "./calendar-header.css";

export function CalendarHeader(props: {
  email: string;
  onLogout: () => Promise<void>;
  mode: ViewMode;
  isMobile: boolean;
  monthLabel: string;
  onPrevious(): void;
  onToday(): void;
  onNext(): void;
  onModeChange(mode: ViewMode): void;
}) {
  return (
    <header class="calendar-toolbar">
      <div class="calendar-toolbar__nav">
        <h1>{props.monthLabel}</h1>
        <div class="calendar-toolbar__navigation" aria-label="Calendar navigation">
          <button
            data-testid="calendar-previous"
            class="calendar-toolbar__arrow"
            aria-label="Previous period"
            onClick={props.onPrevious}
          >
            <AnimatedIcon icon={ChevronLeft} size={17} />
          </button>
          <button
            data-testid="calendar-today"
            class="calendar-toolbar__today"
            onClick={props.onToday}
          >
            Today
          </button>
          <button
            data-testid="calendar-next"
            class="calendar-toolbar__arrow"
            aria-label="Next period"
            onClick={props.onNext}
          >
            <AnimatedIcon icon={ChevronRight} size={17} />
          </button>
        </div>
      </div>
      <div class="calendar-toolbar__actions">
        {!props.isMobile && (
          <div class="calendar-toolbar__modes">
            <button
              data-testid="calendar-mode-three-day"
              classList={{ active: props.mode === "three-day" }}
              onClick={() => props.onModeChange("three-day")}
            >
              3-day
            </button>
            <button
              data-testid="calendar-mode-week"
              classList={{ active: props.mode === "week" }}
              onClick={() => props.onModeChange("week")}
            >
              Week
            </button>
          </div>
        )}
        <AccountDropdown email={props.email} onLogout={props.onLogout} />
      </div>
    </header>
  );
}
