---
name: raw-sql-migration
description: >-
  Change the PostgreSQL schema, master data or seed data of Vân Kính, which
  uses plain SQL files and a custom db-cli (no ORM, no Prisma). Use when adding
  a table, column, index or constraint, changing seed accounts, or writing a
  migration for an existing database. Triggers: "thêm bảng", "thêm cột",
  "sửa schema", "migration", "seed dữ liệu", "đổi database", "add column".
---

# Raw SQL schema changes (server/db/)

## How the database is built

| File | Role |
|---|---|
| `server/db/sql/01_schema.sql` | Full DDL. `CREATE TABLE IF NOT EXISTS`, constraints named explicitly, indexes at the bottom. |
| `server/db/sql/02_master_data.sql` | Reference rows (`roles`, `program_modules`). |
| `server/db/sql/03_seed_data.sql` | Demo accounts, courses, lessons, enrollments. E2E tests depend on it. |
| `server/db/sql/04_demo_data.sql` | Extra local-only demo data (`yarn db:demo`, ids `demo-*`). Never loaded by e2e; keep it free of ratings and student counts; prices there are test values. |
| `server/db/scripts/db-cli.ts` | `init`, `generate`, `reset`, `seed`, `dump`. Table order lives in `TABLES_IN_ORDER`. |

`yarn db:reset` drops every table and rebuilds from 01 + 02. `yarn db:seed`
loads 03. `yarn db:dump` **overwrites** 01 and 03 from the live DB (backup goes
to `server/db/dumps/`).

There is no migration runner. A database that already has data (staging,
production on GCP) cannot be reset, so every schema change ships in two forms.

## Steps for a schema change

1. **Edit `01_schema.sql` by hand** so a fresh `db:reset` builds the new shape.
   Keep the file's style: lowercase snake_case names, `VARCHAR(64)` ids,
   `TIMESTAMPTZ NOT NULL DEFAULT now()` for `created_at` / `updated_at`,
   named constraints (`<table>_<col>_fkey`, `uq_…`, `<table>_<col>_check`),
   `ON DELETE CASCADE` only where children are meaningless without the parent.
2. **Write an idempotent migration** for existing databases:
   `server/db/migrations/YYYYMMDD_HHmm_<short_name>.sql`, using
   `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
   and `DO $$ … $$` blocks for constraints. It must be safe to run twice.
   New `NOT NULL` columns need a `DEFAULT` or a backfill step before the
   constraint.
3. If a new table was added, append it to `TABLES_IN_ORDER` in `db-cli.ts`
   (parents before children) so `reset`, `seed` and `dump` handle it.
4. Update `03_seed_data.sql` if seed rows need the new column, and keep the
   four seed accounts (`admin@`, `teacher@`, `studentA@`, `studentB@vankinh.vn`)
   and their access rules unchanged unless the change is about them: e2e tests
   rely on them.
5. Verify locally:
   ```bash
   yarn db:reset && yarn db:seed
   ```
   then apply the migration file against a DB that still has the old shape
   (`psql "$DATABASE_URL" -f server/db/migrations/<file>.sql`) and run it a
   second time to prove it is idempotent.
6. Update the service SQL, DTOs and `user-client/src/lib/types.ts`.

## Rules

- Never run `yarn db:dump` to "save" a hand-written schema change: it rewrites
  01/03 from whatever the local DB holds, including local junk data. Use it
  only when you deliberately want the live local state as the new baseline,
  and review the diff.
- Never put real user data, real emails or secrets in seed files: the repo is
  public.
- Money is stored as integer VND (`INTEGER`/`BIGINT`), never floats.
- Prefer a `CHECK` constraint for small enums (as `lessons_source_type_check`)
  and mirror the values in `common/types/domain.types.ts`.
