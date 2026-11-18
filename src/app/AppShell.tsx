import type { JSX } from "solid-js";

export function AppShell(props: { toolbar: JSX.Element; children: JSX.Element }) {
  return (
    <main class="app-shell">
      <div class="app-shell__toolbar">{props.toolbar}</div>
      <div data-testid="calendar-content" class="app-shell__content">
        {props.children}
      </div>
    </main>
  );
}
