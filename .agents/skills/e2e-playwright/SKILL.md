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
├── playwright.config.ts
├── global-setup.ts         resets + seeds vankinh_test
├── fixtures/auth.ts        loginAs('admin' | 'teacher' | 'studentA' | 'studentB')
└── specs/<flow>.spec.ts    one file per user flow
```

Root scripts: `yarn e2e` (headless), `yarn e2e:ui` (Playwright UI mode).
If `e2e/` does not exist yet, create this layout first, add
`@playwright/test` as a root devDependency, and add the scripts.

## Test database, never the dev database

- E2E uses `POSTGRES_DB=vankinh_test` (same Docker Postgres). `global-setup`
  runs `db:init`, `db:reset` and `db:seed` with that env, so every run starts
  from `03_seed_data.sql`.
- `webServer` in the config starts the server (port 4000, test env) and the
  client (port 3000) with `NEXT_PUBLIC_API_URL=http://localhost:4000/api`, and
  `reuseExistingServer: !process.env.CI`.
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
- Upload fixtures live in `e2e/fixtures/files/` (tiny mp4, docx). Keep them
  under 1 MB.
- On failure keep traces/screenshots (`trace: 'retain-on-failure'`) and attach
  them in CI.

## Running

```bash
yarn db:up
yarn e2e
```

A flow is "done" only when its spec passes locally and in CI.
