export function CalendarDataStatus(props: {
  state: import("../../shared/calendar/calendar-model").CalendarLoadState;
  onRetry(): void;
}) {
  return (
    <div class="calendar-status">
      {props.state.phase === "error" ? (
        <>
          <b>Calendar unavailable</b>
          <button onClick={props.onRetry}>Retry</button>
        </>
      ) : (
        <span>Loading calendar…</span>
      )}
    </div>
  );
}
