#!/usr/bin/env node
/**
 * Connects to Production Cloud SQL (through local cloud-sql-proxy) using `pg`
 * from `server/node_modules`, initializes `01_schema.sql` + `02_master_data.sql`
 * ONLY when the database is empty (first deploy), and applies all idempotent
 * `server/db/migrations/*.sql` files in sorted order.
 *
 * NEVER loads 03_seed_data.sql or 04_demo_data.sql, and NEVER drops tables.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const serverRoot = path.join(repoRoot, 'server');
const requireFromServer = createRequire(path.join(serverRoot, 'package.json'));
const { Client } = requireFromServer('pg');

const host = process.env.PRD_PG_HOST || '127.0.0.1';
const port = Number(process.env.PRD_PG_PORT || '5434');
const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const database = process.env.POSTGRES_DB;

if (!user || !password || !database) {
  console.error('Lỗi: Thiếu POSTGRES_USER, POSTGRES_PASSWORD hoặc POSTGRES_DB.');
  process.exit(1);
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
          reject(new Error(`Không kết nối được tới cloud-sql-proxy tại ${targetHost}:${targetPort} sau ${timeoutMs / 1000}s.`));
        } else {
          setTimeout(tryConnect, 500);
        }
      });
    };
    tryConnect();
  });
}

async function runSqlFile(client, label, fullPath) {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file SQL: ${fullPath}`);
  }
  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`→ Đang chạy ${label}...`);
  await client.query(sql);
}

async function main() {
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
    const checkRes = await client.query(`SELECT to_regclass('public.users') AS users_table`);
    const isFreshDb = !checkRes.rows[0]?.users_table;

    const sqlDir = path.join(serverRoot, 'db', 'sql');
    if (isFreshDb) {
      console.log('→ Phát hiện Database Production còn trống (lần đầu khởi tạo):');
      await runSqlFile(client, '01_schema.sql', path.join(sqlDir, '01_schema.sql'));
      await runSqlFile(client, '02_master_data.sql', path.join(sqlDir, '02_master_data.sql'));
    } else {
      console.log('✓ Database đã có bảng nền — bỏ qua 01_schema.sql & 02_master_data.sql để bảo toàn dữ liệu thật.');
    }

    const migrationsDir = path.join(serverRoot, 'db', 'migrations');
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      console.log(`→ Áp dụng ${files.length} file migration trong server/db/migrations/...`);
      for (const file of files) {
        await runSqlFile(client, `migrations/${file}`, path.join(migrationsDir, file));
      }
    }

    const summary = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS table_count,
         (SELECT COUNT(*)::int FROM program_modules) AS program_count,
         (SELECT COUNT(*)::int FROM users WHERE role = 'ADMIN') AS admin_count`,
    );
    const stats = summary.rows[0];
    console.log(
      `\n✔ Hoàn tất nạp Database Production! (Số bảng: ${stats.table_count}, Chương trình: ${stats.program_count}, Admin: ${stats.admin_count})`,
    );
    if (isFreshDb) {
      console.log('⚠ QUAN TRỌNG: Hãy đăng nhập admin@chineselearner.vn trên web production và ĐỔI MẬT KHẨU NGAY tại /account!');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n✖ Lỗi khi nạp Database Production:', err?.message || err);
  process.exit(1);
});
