# AGENTS.md

Shared instructions for every coding agent on this repo (Claude Code, Codex,
Gemini CLI). `CLAUDE.md` imports this file and `.gemini/settings.json` points
Gemini at it, so **edit only this file**.

## Project

云径 · Vân Kính sells Chinese video courses to Vietnamese learners.

- `server/`: NestJS 10, raw SQL through `pg` (no ORM), HTTP-only cookie JWT
  (`vankinh_token`), global prefix `/api`, port 4000.
- `user-client/`: Next.js 14 App Router, React 18, plain CSS, port 3000.
- `server/db/sql/`: `01_schema.sql`, `02_master_data.sql`, `03_seed_data.sql`.
- PostgreSQL 16 in Docker (`docker-compose.yml`, host port 5433). Deploy
  target: GCP (`tmp/HUONG-DAN-DEPLOY-GCP.md`).
- Roles: `ADMIN`, `TEACHER`, `STUDENT`. Paid content is gated by
  `course_enrollments.can_view`.

## Commands (run from the repo root)

```bash
yarn env                          # create missing .env files
yarn db:up && yarn db:init && yarn db:reset && yarn db:seed
yarn db:demo                      # optional: extra demo courses, accounts and videos (local only)
yarn server:dev                   # http://localhost:4000/api
yarn client:dev                   # http://localhost:3000
yarn server:build && yarn client:build
yarn skills:install               # install the agent skills that are not committed
```

## Ground rules

- **The repo is public.** Never commit secrets, real user data or real keys.
  Only placeholders go into `.env.example` files.
- Code, identifiers, SQL and commit messages are in **English**. Everything a
  user sees (UI copy, API error messages) is in **Vietnamese**. Domain terms
  follow `GLOSSARY.md`.
- Every change must satisfy `CODING_STANDARDS.md`. Reviews check it.
- Work on a branch, open a PR to `main`, and get it reviewed by the *other*
  developer's agent (Claude reviews Codex/Gemini work and vice versa) before
  merging. CI must be green.
- Do not run `yarn db:dump` or `yarn db:reset` against anything but your
  local database.

## Agent skills

Skills live in `.agents/skills/` (read natively by Codex and Gemini CLI;
`.claude/skills` is a symlink to it for Claude Code). Load the matching skill
before starting the task:

| Task | Skill |
|---|---|
| Backend endpoint / module | `nestjs-module` |
| Schema, seed, migration | `raw-sql-migration` |
| Frontend page / component | `nextjs-page` |
| Visual design, restyle (approved design: `docs/design/`) | `vankinh-ui` first, then `design-taste-frontend` (+ `impeccable`, `transitions-dev`, `transitions-polish` if installed) |
| Logo, brand assets (`docs/brand/BRAND.md`) | `svg-logo-designer` (installed on demand) |
| Video, documents, access | `video-access` |
| Prices, checkout, PayOS | `payment-integration` |
| End-to-end tests | `e2e-playwright` |
| Unit / integration tests, test-first | `tdd` (Jest in `server/`) |
| Review a branch / PR | `code-review` |
| Write a PR description | `pr` |
| Stress-test a plan or spec | `grilling` |
| Domain terms, ADRs | `domain-modeling` |

Third-party skills and their licenses: `.agents/skills/THIRD_PARTY.md`.

### Issue tracker

Issues and specs are GitHub issues on `quac17/ChineseLearning`, managed with
`gh`. See `docs/agents/issue-tracker.md`.

### Open work

Who does what next: `docs/TODO.md`. Remove an item in the PR that finishes it.

### Domain docs

Single-context: `GLOSSARY.md` at the root, ADRs in `docs/adr/`. See
`docs/agents/domain.md`.
