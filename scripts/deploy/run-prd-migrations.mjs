#!/usr/bin/env node
/**
 * Applies SQL migrations from `server/db/migrations_prd/*.sql` (sorted by name)
 * to the Production Cloud SQL PostgreSQL database via local `cloud-sql-proxy`.
 *
 * Tracks applied files and SHA-256 checksums in `public.schema_migrations_prd`:
 * - New `.sql` files are executed inside a transaction and recorded.
 * - Modified `.sql` files (checksum changed) are re-applied and updated.
 * - Unchanged `.sql` files already applied are skipped (unless `--force` is passed).
 * - `--dry-run` previews pending/modified/applied files without modifying the DB.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as net from 'node:net';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const serverRoot = path.join(repoRoot, 'server');
const migrationsDir = path.join(serverRoot, 'db', 'migrations_prd');

const requireFromServer = createRequire(path.join(serverRoot, 'package.json'));
const { Client } = requireFromServer('pg');

const args = new Set(process.argv.slice(2));
const forceRun = args.has('--force');
const dryRun = args.has('--dry-run');

const host = process.env.PRD_PG_HOST || '127.0.0.1';
const port = Number(process.env.PRD_PG_PORT || '5434');
const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const database = process.env.POSTGRES_DB;

if (!user || !password || !database) {
  console.error('Lỗi: Thiếu POSTGRES_USER, POSTGRES_PASSWORD hoặc POSTGRES_DB trong .env.prd.');
  process.exit(1);
}

function sha256Normalized(sql) {
  const normalized = sql.replace(/\r\n/g, '\n').trim();
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function waitForPort(targetHost, targetPort, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host: targetHost, port: targetPort });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start >= timeoutMs) {
          reject(
            new Error(
              `Không kết nối được tới cloud-sql-proxy tại ${targetHost}:${targetPort} sau ${timeoutMs / 1000}s.`,
            ),
          );
        } else {
          setTimeout(tryConnect, 500);
        }
      });
    };
    tryConnect();
  });
}

async function main() {
  if (!fs.existsSync(migrationsDir)) {
    console.log(`⚠ Thư mục ${migrationsDir} chưa tồn tại — không có migration nào để chạy.`);
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.toLowerCase().endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('✓ Không có file .sql nào trong server/db/migrations_prd/.');
    return;
  }

  console.log(`→ Tìm thấy ${files.length} file SQL trong server/db/migrations_prd/.`);
  console.log(`→ Đợi kết nối tới Cloud SQL Auth Proxy (${host}:${port})...`);
  await waitForPort(host, port);

  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations_prd (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const existingRes = await client.query(
      `SELECT filename, checksum, applied_at FROM public.schema_migrations_prd`,
    );
    const appliedMap = new Map(existingRes.rows.map((r) => [r.filename, r]));

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      if (!sql.trim()) {
        console.log(`⚠ Bỏ qua file rỗng: ${file}`);
        skippedCount++;
        continue;
      }

      const checksum = sha256Normalized(sql);
      const prev = appliedMap.get(file);

      if (prev && prev.checksum === checksum && !forceRun) {
        console.log(`✓ Bỏ qua (đã áp dụng, nội dung không đổi): ${file}`);
        skippedCount++;
        continue;
      }

      const reason = !prev ? 'mới' : forceRun && prev.checksum === checksum ? '--force' : 'nội dung thay đổi';
      if (dryRun) {
        console.log(`[DRY-RUN] Sẽ chạy (${reason}): ${file}`);
        appliedCount++;
        continue;
      }

      console.log(`→ Đang áp dụng (${reason}): migrations_prd/${file}...`);
      const canWrapInTx = !/\bCONCURRENTLY\b/i.test(sql);

      if (canWrapInTx) {
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            `INSERT INTO public.schema_migrations_prd (filename, checksum, applied_at)
             VALUES ($1, $2, now())
             ON CONFLICT (filename) DO UPDATE
               SET checksum = EXCLUDED.checksum,
                   applied_at = now()`,
            [file, checksum],
          );
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw new Error(`Lỗi tại file ${file}: ${err?.message || err}`);
        }
      } else {
        await client.query(sql);
        await client.query(
          `INSERT INTO public.schema_migrations_prd (filename, checksum, applied_at)
           VALUES ($1, $2, now())
           ON CONFLICT (filename) DO UPDATE
             SET checksum = EXCLUDED.checksum,
                 applied_at = now()`,
          [file, checksum],
        );
      }

      console.log(`✔ Đã áp dụng thành công: ${file}`);
      appliedCount++;
    }

    if (dryRun) {
      console.log(`\n✔ [DRY-RUN] Tổng kết: ${appliedCount} file sẽ chạy, ${skippedCount} file đã khớp.`);
    } else {
      console.log(
        `\n✔ Hoàn tất migration DB Production! (Đã chạy: ${appliedCount}, Bỏ qua: ${skippedCount}, Tổng file: ${files.length})`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n✖ Lỗi khi chạy migration Database Production:', err?.message || err);
  process.exit(1);
});
