-- Accent-insensitive course search: GET /courses?q=giao tiep finds "Giao tiếp".
-- unaccent is a trusted extension (PostgreSQL 13+), shipped with the postgres:16
-- images and supported on Cloud SQL, so the database owner can create it.
-- Idempotent: safe to run twice on a database that already has data.
-- Apply: psql "$DATABASE_URL" -f server/db/migrations/20261122_2000_unaccent_search.sql

CREATE EXTENSION IF NOT EXISTS unaccent;
