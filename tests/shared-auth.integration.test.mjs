import { test, expect } from "bun:test";
import { createApiCalendarItemRepository } from "../src/shared/data/api-calendar-item-repository.ts";
import { createTimedEvent } from "../src/shared/calendar/calendar-item.ts";

const database = process.env.BFF_TEST_DATABASE_URL;
if (database && !["127.0.0.1", "localhost"].includes(new URL(database).hostname))
  throw new Error("Integration tests require a disposable loopback database.");
const base = process.env.SHARED_TEST_URL;
const api = process.env.CALENDAR_TEST_API_URL;
for (const url of [base, api]) {
  if (url && !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("Integration tests require disposable loopback services.");
}

test.skipIf(!base || !api || !database || !process.env.BETTER_AUTH_SECRET)(
  "web and native bearer sessions share private calendars; logout revokes access",
  async () => {
    async function auth(path, body, headers = {}) {
      return fetch(`${base}/api/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base, ...headers },
        body: JSON.stringify(body),
      });
    }
    const { createAuth } = await import("../../bff/src/auth.ts");
    const { createSessionFixture } = await import("../../bff/tests/session-fixture.mjs");
    const fixtureAuth = await createAuth(base, {
      DATABASE_URL: database,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    });
    try {
      const alice = await createSessionFixture(fixtureAuth);
      const bob = await createSessionFixture(fixtureAuth);
      const webFetch = (path, options = {}) =>
        fetch(`${api}${path}`, {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${alice.token}` },
        });
      const native = (token, path = "/api/v1/events", method = "GET", body) =>
        fetch(`${api}${path}`, {
          method,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      const preflight = await fetch(`${api}/api/v1/events`, {
        method: "OPTIONS",
        headers: {
          Origin: base,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      });
      expect(preflight.ok).toBe(true);
      expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
      expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
      const repository = createApiCalendarItemRepository(webFetch);
      expect(await repository.loadAll()).toEqual({ ok: true, value: [] });
      const item = createTimedEvent({
        id: crypto.randomUUID(),
        title: "Shared calendar",
        calendarId: "work",
        date: "2026-11-18",
        startMinute: 540,
        presentation: "focus",
        notes: "Preserve notes",
      });
      expect((await repository.write({ type: "save", item, previous: null })).ok).toBe(true);
      const events = await (await native(alice.token)).json();
      expect(events).toHaveLength(1);
      expect(events[0].metadata.calendarId).toBe("work");
      expect(events[0].metadata.presentation).toBe("focus");
      expect(await (await native(bob.token)).json()).toEqual([]);
      const path = `/api/v1/events/${item.id}`;
      for (const method of ["GET", "PUT", "DELETE"]) {
        expect(
          (
            await native(
              bob.token,
              path,
              method,
              method === "PUT"
                ? { title: "Hijack", startAt: events[0].startAt, endAt: events[0].endAt }
                : undefined,
            )
          ).status,
        ).toBe(404);
      }
      const retry = { ...events[0] };
      delete retry.createdAt;
      delete retry.updatedAt;
      expect((await native(alice.token, "/api/v1/events", "POST", retry)).status).toBe(201);
      expect((await native(bob.token, "/api/v1/events", "POST", retry)).ok).toBe(false);
      const edited = { ...item, title: "Edited from web" };
      expect((await repository.write({ type: "save", item: edited, previous: item })).ok).toBe(
        true,
      );
      expect((await (await native(alice.token, path)).json()).title).toBe(edited.title);
      const freshRepository = createApiCalendarItemRepository(webFetch);
      expect((await freshRepository.loadAll()).value).toEqual([edited]);
      const allDay = {
        ...edited,
        durationMinute: 80,
        placement: { type: "all-day", date: "2026-11-19" },
      };
      expect((await repository.write({ type: "save", item: allDay, previous: edited })).ok).toBe(
        true,
      );
      expect((await freshRepository.loadAll()).value).toEqual([allDay]);
      expect((await fetch(`${api}/api/v1/events`)).status).toBe(401);
      expect((await fetch(`${base}/api/v1/events`)).status).toBe(404);
      expect((await repository.write({ type: "delete", id: item.id })).ok).toBe(true);
      expect((await native(alice.token, path)).status).toBe(404);
      expect((await auth("sign-out", {}, { Authorization: `Bearer ${alice.token}` })).status).toBe(
        200,
      );
      expect((await native(alice.token)).status).toBe(401);
      expect((await webFetch("/api/v1/events")).status).toBe(401);
    } finally {
      await fixtureAuth.options.database.end();
    }
  },
  30_000,
);
