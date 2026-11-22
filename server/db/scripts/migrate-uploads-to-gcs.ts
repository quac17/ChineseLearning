/**
 * Copies the files the DB points at from server/uploads (UPLOAD_DIR) into the
 * GCS bucket, under the SAME object name as the storage key. Keys in the DB do
 * not change, so after switching to STORAGE_BACKEND=gcs every lesson, document,
 * subtitle and cover still resolves.
 *
 * Idempotent: an object that already exists with the same size is skipped.
 * Nothing is deleted locally or in the bucket, and the DB is only read.
 *
 *   yarn storage:to-gcs --dry-run     # list what would be copied
 *   yarn storage:to-gcs               # copy
 *
 * Needs GCS_BUCKET, the DB connection (POSTGRES_* or DATABASE_URL) and
 * Application Default Credentials (`gcloud auth application-default login`
 * or GOOGLE_APPLICATION_CREDENTIALS pointing at a key file kept OUTSIDE the repo).
 */
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { Storage } from '@google-cloud/storage';

const serverRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(serverRoot, '.env') });
dotenv.config({ path: path.join(serverRoot, '..', '.env') });

const KEY_QUERIES = [
  `SELECT storage_key AS key, mime_type AS type FROM lessons WHERE storage_key IS NOT NULL`,
  `SELECT subtitle_key AS key, 'text/vtt; charset=utf-8' AS type FROM lessons WHERE subtitle_key IS NOT NULL`,
  `SELECT storage_key AS key, mime_type AS type FROM course_documents WHERE storage_key IS NOT NULL`,
  `SELECT cover_key AS key, NULL AS type FROM courses WHERE cover_key IS NOT NULL`,
];

const COVER_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function pgConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5433,
    user: process.env.POSTGRES_USER || 'vankinh',
    password: process.env.POSTGRES_PASSWORD || 'vankinh_secret',
    database: process.env.POSTGRES_DB || 'vankinh_db',
  };
}

/** Same rule as StorageService.resolveFullPath: a key never leaves the upload folder. */
function localPath(uploadDir: string, key: string): string | null {
  const full = path.resolve(uploadDir, path.normalize(key));
  return full.startsWith(uploadDir + path.sep) ? full : null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const bucketName = process.env.GCS_BUCKET?.trim();
  if (!bucketName) throw new Error('Set GCS_BUCKET to the target bucket name.');
  const uploadDir = path.resolve(serverRoot, process.env.UPLOAD_DIR || 'uploads');

  const db = new Client(pgConfig());
  await db.connect();
  const rows: { key: string; type: string | null }[] = [];
  try {
    for (const sql of KEY_QUERIES) rows.push(...(await db.query(sql)).rows);
  } finally {
    await db.end();
  }

  const bucket = new Storage(process.env.GCS_PROJECT_ID ? { projectId: process.env.GCS_PROJECT_ID } : {}).bucket(bucketName);
  const counts = { copied: 0, skipped: 0, missing: 0, invalid: 0 };
  const seen = new Set<string>();

  console.log(`${dryRun ? '[dry-run] ' : ''}${rows.length} keys in the DB, source ${uploadDir}, bucket gs://${bucketName}`);
  for (const { key, type } of rows) {
    if (seen.has(key)) continue;
    seen.add(key);

    const file = localPath(uploadDir, key);
    if (!file) {
      counts.invalid++;
      console.warn(`invalid key, skipped: ${key}`);
      continue;
    }
    if (!fs.existsSync(file)) {
      counts.missing++;
      console.warn(`missing locally: ${key}`);
      continue;
    }

    const size = fs.statSync(file).size;
    const object = bucket.file(key);
    const [exists] = await object.exists();
    if (exists) {
      const [meta] = await object.getMetadata();
      if (Number(meta.size) === size) {
        counts.skipped++;
        continue;
      }
    }

    const contentType = type || COVER_TYPES[path.extname(key).toLowerCase()] || 'application/octet-stream';
    console.log(`${dryRun ? 'would copy' : 'copy'} ${key} (${size} bytes, ${contentType})`);
    if (!dryRun) {
      await bucket.upload(file, { destination: key, contentType, resumable: size > 8 * 1024 * 1024 });
    }
    counts.copied++;
  }

  console.log(
    `${dryRun ? '[dry-run] would copy' : 'copied'} ${counts.copied}, already in bucket ${counts.skipped}, ` +
      `missing locally ${counts.missing}, invalid ${counts.invalid}`,
  );
  if (counts.missing || counts.invalid) process.exitCode = 1;
}

main().catch((err) => {
  console.error((err as { message?: string; code?: string })?.message || (err as { code?: string })?.code || err);
  process.exit(1);
});
