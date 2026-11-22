---
name: e2e-playwright
description: >-
  Write and run Playwright end-to-end tests for Vân Kính against a dedicated
  test database (vankinh_test) reset and seeded on every run, logging in as the
  four seed accounts to cover role and paid-access flows. Use when adding or
  fixing e2e tests, setting up Playwright, or verifying a user flow end to end.
  Triggers: "viết test e2e", "test e2e", "kiểm thử", "Playwright", "test luồng",
  "chạy e2e", "e2e test", "QA".
---

# E2E tests with Playwright

## Where things live

```
e2e/
├── env.ts                  ports, test DB name, env for child processes
├── playwright.config.ts
├── global-setup.ts         resets + seeds vankinh_test
├── fixtures/auth.ts        ACCOUNTS, SEED ids, apiAs(role), anonymousApi(),
│                           storageStateFor(role), loginThroughForm()
├── fixtures/data.ts        uniq(), createPaidCourse(), setAccess()
└── specs/
    ├── auth.setup.ts       logs in each seed account once → e2e/.auth/<role>.json
    └── <flow>.spec.ts      one file per user flow
```

Root scripts: `yarn e2e` (headless), `yarn e2e:ui` (Playwright UI mode).
If `e2e/` does not exist yet, create this layout first, add
`@playwright/test` as a root devDependency, and add the scripts.

## Test database, never the dev database

- E2E uses `POSTGRES_DB=vankinh_test` (same Docker Postgres). `global-setup`
  runs `db:init`, `db:reset` and `db:seed` with that env, so every run starts
  from `03_seed_data.sql`.
- The E2E stack runs on **its own ports** so it never reuses the dev servers
  (which point at `vankinh_db`): API on **4100** (compiled to
  `server/dist-e2e` via `tsconfig.e2e.json`), client on **3100** with
  `NEXT_DIST_DIR=.next-e2e` and `NEXT_PUBLIC_API_URL=http://localhost:4100/api`.
  Locally the client is `next dev`; in CI it is `next build && next start`.
  `reuseExistingServer: !process.env.CI`. If a run times out waiting for a
  web server, look for a stale process on 3100/4100 (`lsof -iTCP:3100`).
- `env.ts` pins `DATABASE_URL` to `vankinh_test` too, because dotenv never
  overrides and a `DATABASE_URL` in `server/.env` would otherwise win.
- Refuse to run if `POSTGRES_DB` is not `vankinh_test`. A reset on the dev DB
  destroys local work.

## Seed accounts (from 03_seed_data.sql)

| Key | Email | Role | Access |
|---|---|---|---|
| `admin` | admin@vankinh.vn | ADMIN | everything |
| `teacher` | teacher@vankinh.vn | TEACHER | owns the seed courses |
| `studentA` | studentA@vankinh.vn | STUDENT | enrolled in HSK 1 |
| `studentB` | studentB@vankinh.vn | STUDENT | no paid access |

This table is the **contract** the tests rely on. `yarn db:dump` can silently
change the seed (extra users, `studentB` gaining access); if
`03_seed_data.sql` no longer matches the table, fix the seed file rather
than the tests. Passwords are in the README (demo-only). Log in once per role in a setup
project and reuse `storageState` files under `e2e/.auth/` (gitignored), so
specs do not repeat the login UI.

## Flows that must stay covered

1. Register, login, logout; the cookie survives a reload.
2. Logged out: free preview plays; paid lesson shows the locked state.
3. `studentB` cannot play a paid lesson **and** a direct request to its stream
   URL returns 403 (check with `request` fixture, not only the UI).
4. `studentA` plays the HSK 1 paid lesson.
5. Teacher grants `studentB` access → `studentB` can play; revoke → locked.
6. Teacher uploads a YouTube lesson and a document; student downloads it.
7. Admin locks a user → that user cannot log in.
8. Payment (once it exists): checkout as `studentB` → simulated signed
   webhook → lesson unlocks. Never hit the real PayOS API.

## Writing specs

- Locate by role and accessible name (`getByRole('button', { name: 'Đăng nhập' })`),
  then `getByLabel`, then `getByTestId`. Avoid CSS selectors; add
  `data-testid` when needed.
- UI text is Vietnamese: match the exact Vietnamese strings.
- No `waitForTimeout`; use web-first assertions (`expect(…).toBeVisible()`).
- Each spec creates the data it mutates (or uses a unique title) so specs can
  run in parallel; never depend on another spec's side effects.
- Uploads use small in-memory buffers (`createPaidCourse`): the server checks
  the file extension, not the content. If a spec ever needs a real file, put
  it in `e2e/fixtures/files/` and keep it under 1 MB.
- On failure keep traces/screenshots (`trace: 'retain-on-failure'`) and attach
  them in CI.

## Running

```bash
yarn db:up
yarn e2e
```

A flow is "done" only when its spec passes locally and in CI.
