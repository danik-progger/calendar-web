import { LogOut, Mail, UserRound } from "@animateicons/vanilla/lucide";
import { createSignal, Show } from "solid-js";
import { Dropdown, DropdownButton } from "../dropdown/Dropdown";
import { AnimatedIcon } from "../icons/AnimatedIcon";
import "./account-dropdown.css";

export function AccountDropdown(props: { email: string; onLogout(): Promise<void> }) {
  const [pending, setPending] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  async function logOut() {
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
      <Dropdown id="account-dropdown" class="account-dropdown" popover="auto">
        <ul class="account-dropdown__list" role="list">
          <li class="dropdown__row">
            <AnimatedIcon icon={Mail} size={16} />
            <span>{props.email}</span>
          </li>
          <li>
            <DropdownButton disabled={pending()} onClick={() => void logOut()}>
              <AnimatedIcon icon={LogOut} size={16} />
              <span>Log out</span>
            </DropdownButton>
          </li>
        </ul>
        <Show when={failed()}>
          <p class="dropdown__row" role="alert">
            <span class="error-message">Couldn’t log out. Try again.</span>
          </p>
        </Show>
      </Dropdown>
    </>
  );
}
