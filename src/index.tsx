import { createResource, Match, Switch } from "solid-js";
import { render } from "solid-js/web";
import { App } from "./App";
import { SignInScreen } from "./components/auth/SignInScreen";
import { authClient } from "./shared/auth-client";
import "./global.css";
import "./app/app-shell.css";
import "./components/feedback/status.css";

function CalendarRoot() {
  const [session, { mutate, refetch }] = createResource(async () => {
    try {
      const { data, error } = await authClient.getSession();
      return error ? undefined : data;
    } catch {
      return undefined;
    }
  });
  async function signOut() {
    const { error } = await authClient.signOut();
    if (error) throw new Error("Sign-out failed");
    mutate(null);
  }

  return (
    <Switch fallback={<SignInScreen />}>
      <Match when={session.loading}>
        <main class="sign-in-screen">
          <p role="status">Checking your session…</p>
        </main>
      </Match>
      <Match when={session() === undefined}>
        <main class="sign-in-screen">
          <section class="sign-in-screen__content">
            <p role="status">Couldn’t check your session.</p>
            <button type="button" onClick={() => void refetch()}>
              Try again
            </button>
          </section>
        </main>
      </Match>
      <Match when={session()?.user} keyed>
        {(user) => (
          <App
            userId={user.id}
            token={session()?.session.token}
            email={user.email}
            onLogout={signOut}
          />
        )}
      </Match>
    </Switch>
  );
}

const localPreview =
  ["127.0.0.1", "localhost", "[::1]"].includes(window.location.hostname) &&
  new URLSearchParams(window.location.search).get("demo") === "1";
render(() => (localPreview ? <App /> : <CalendarRoot />), document.getElementById("root")!);
