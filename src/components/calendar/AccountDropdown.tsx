import { LogOut, Mail, UserRound } from "@animateicons/vanilla/lucide";
import { createSignal, Show } from "solid-js";
import { AnimatedIcon } from "../icons/AnimatedIcon";
import "./account-dropdown.css";

export function AccountDropdown(props: { email?: string; onLogout?(): Promise<void> }) {
  const [pending, setPending] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  async function logOut() {
    if (!props.onLogout) return;
    setPending(true);
    setFailed(false);
    try {
      await props.onLogout();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        type="button"
        class="account-trigger"
        aria-label="Account"
        popovertarget="account-dropdown"
      >
        <AnimatedIcon icon={UserRound} size={17} />
      </button>
      <div id="account-dropdown" class="account-dropdown" popover="auto">
        <ul class="account-dropdown__list" role="list">
          <li class="account-dropdown__row">
            <AnimatedIcon icon={Mail} size={16} />
            <span>{props.email ?? "Demo calendar"}</span>
          </li>
          <Show when={props.onLogout}>
            <li>
              <button
                type="button"
                class="account-dropdown__row"
                autofocus
                disabled={pending()}
                onClick={() => void logOut()}
              >
                <AnimatedIcon icon={LogOut} size={16} />
                Log out
              </button>
            </li>
          </Show>
        </ul>
        <Show when={failed()}>
          <p class="account-dropdown__row" role="alert">
            Couldn’t log out. Try again.
          </p>
        </Show>
      </div>
    </>
  );
}
