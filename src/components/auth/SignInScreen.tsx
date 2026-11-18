import { createSignal, onMount } from "solid-js";
import { authClient } from "../../shared/auth-client";
import "./sign-in.css";

export function SignInScreen() {
  const [pending, setPending] = createSignal(false);
  const [message, setMessage] = createSignal("");
  let heading!: HTMLHeadingElement;
  onMount(() => heading.focus());

  async function signIn() {
    if (pending()) return;
    setMessage("");
    setPending(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: window.location.origin,
      });
      if (error) {
        setMessage("Couldn’t sign in with Google. Try again.");
        setPending(false);
      }
    } catch {
      setMessage("Couldn’t connect. Try again.");
      setPending(false);
    }
  }

  return (
    <main class="sign-in-screen" aria-labelledby="sign-in-title">
      <section class="sign-in-screen__content">
        <h1 id="sign-in-title" ref={heading} tabIndex={-1}>
          Sign in to Calendar
        </h1>
        <button type="button" disabled={pending()} onClick={() => void signIn()}>
          {pending() ? "Connecting…" : "Continue with Google"}
        </button>
        <p class="sign-in-screen__error" role="status">
          {message()}
        </p>
      </section>
    </main>
  );
}
