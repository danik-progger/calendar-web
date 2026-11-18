# Calendar

SolidJS calendar with Google sign-in through Better Auth. Signed-in calendar events are stored in Postgres through the authenticated Rust API. New accounts start with an empty calendar.

Use Bun to install dependencies and run scripts. Start the separate [BFF](../bff/README.md) and Rust API first; see [shared backend setup](../shared/BACKEND.md).

```sh
bun install
bun run dev
```

Open http://127.0.0.1:5174 and choose **Continue with Google**. Use http://127.0.0.1:5174/?demo=1 for the local demo with sample events. Run `bun run build` to build the frontend into `dist/`.

This project contains the frontend and Better Auth client only. Set `VITE_CALENDAR_API_URL` to the Rust API origin and `BFF_URL` to the auth service origin: `http://127.0.0.1:3001` for Vite development/preview, or the deployed HTTPS BFF origin on Vercel. Vite proxies `/api/auth/*` locally; `vercel.ts` configures the production rewrite. Auth requests stay on the frontend origin so cookies and OAuth callbacks work without cross-site cookie access. Calendar requests go directly to Rust with the session token in an Authorization header; the token stays in memory. Database credentials, auth secrets, and auth migrations belong in `bff/`.

The [desktop app](../desktop) uses the same auth and calendar services. The [iPhone and iPad](../ios) and [Android](../android) apps currently store events on the device.

After updating AnimateIcons or changing the shared icon set, run `node scripts/export-calendar-icons.mjs` from this folder to refresh the assets bundled by the native apps.

## CI checks

Oxlint handles linting and Oxfmt handles formatting. Use `bun run lint:fix` and `bun run format` to apply fixes. GitHub Actions runs `bun run format:check`, `bun run lint`, `bun run typecheck`, tests and the production build on every push and pull request. Install with `bun install --frozen-lockfile` before running the same commands locally.
