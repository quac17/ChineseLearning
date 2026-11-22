import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load server/.env first, then fallback to root .env
const serverRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(serverRoot, '..');
dotenv.config({ path: path.join(serverRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

const SQL_DIR = path.join(serverRoot, 'db', 'sql');
const DUMPS_DIR = path.join(serverRoot, 'db', 'dumps');

const MASTER_TABLES = new Set(['roles', 'program_modules']);

const TABLES_IN_ORDER = [
  'roles',
  'program_modules',
  'users',
  'courses',
  'lessons',
  'course_documents',
  'course_enrollments',
];

function getPgConfig(databaseOverride?: string) {
  if (process.env.DATABASE_URL && !databaseOverride) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5433,
    user: process.env.POSTGRES_USER || 'chinese_learner',
    password: process.env.POSTGRES_PASSWORD || 'chinese_learner_secret',
    database: databaseOverride || process.env.POSTGRES_DB || 'chinese_learner_db',
  };
}

function getTargetDatabaseName(): string {
  if (process.env.POSTGRES_DB) return process.env.POSTGRES_DB;
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return u.pathname.replace(/^\//, '') || 'chinese_learner_db';
    } catch {
      return 'chinese_learner_db';
    }
  }
  return 'chinese_learner_db';
}

function readSqlFile(fileName: string): string {
  const fullPath = path.join(SQL_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Không tìm thấy file SQL: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function readSqlFileIfExists(fileName: string): string {
  const fullPath = path.join(SQL_DIR, fileName);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
}

function ensureSampleDocument(): number {
  const uploadDir = path.resolve(
    serverRoot,
    process.env.UPLOAD_DIR || './uploads',
  );
  const docsDir = path.join(uploadDir, 'documents');
  fs.mkdirSync(docsDir, { recursive: true });
  const filePath = path.join(docsDir, 'sample-hsk1-bai1.doc');
  if (!fs.existsSync(filePath)) {
    const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Arial;}}
\\fs28\\b CHINESE LEARNER - TAI LIEU HOC TAP HSK 1 (BAI 1 & 2)\\b0\\par
\\fs22\\par
1. Tu vung co ban:\\par
- Ni hao (Xin chao)\\par
- Xie xie (Cam on)\\par
- Zai jian (Tam biet)\\par
- Lao shi (Giao vien)\\par
- Xue sheng (Hoc sinh)\\par
\\par
2. Mau cau gioi thieu ban than:\\par
- Wo shi Yuenan ren. (Toi la nguoi Viet Nam.)\\par
- Wo xihuan xuexi Hanyu. (Toi thich hoc tieng Trung.)\\par
}`;
    fs.writeFileSync(filePath, rtf, 'utf-8');
  }
  return fs.statSync(filePath).size;
}

function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function formatColumnType(col: any): string {
  const udt = col.udt_name;
  if (udt === 'varchar') {
    return col.character_maximum_length
      ? `VARCHAR(${col.character_maximum_length})`
      : 'VARCHAR';
  }
  if (udt === 'bpchar') {
    return col.character_maximum_length
      ? `CHAR(${col.character_maximum_length})`
      : 'CHAR';
  }
  if (udt === 'int4') return 'INTEGER';
  if (udt === 'int8') return 'BIGINT';
  if (udt === 'int2') return 'SMALLINT';
  if (udt === 'bool') return 'BOOLEAN';
  if (udt === 'timestamptz') return 'TIMESTAMPTZ';
  if (udt === 'timestamp') return 'TIMESTAMP';
  if (udt === 'text') return 'TEXT';
  if (udt === 'numeric') {
    return col.numeric_precision
      ? `NUMERIC(${col.numeric_precision},${col.numeric_scale ?? 0})`
      : 'NUMERIC';
  }
  if (udt === 'jsonb') return 'JSONB';
  if (udt === 'json') return 'JSON';
  if (udt === 'uuid') return 'UUID';
  return col.data_type.toUpperCase();
}

async function getOrderedPublicTables(client: Client): Promise<string[]> {
  const res = await client.query<{ tablename: string }>(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename ASC`,
  );
  const existing = new Set(res.rows.map((r) => r.tablename));
  const ordered: string[] = [];

  for (const t of TABLES_IN_ORDER) {
    if (existing.has(t)) {
      ordered.push(t);
      existing.delete(t);
    }
  }
  for (const extra of existing) {
    ordered.push(extra);
  }
  return ordered;
}

async function exportCurrentSchemaSql(
  client: Client,
  tables: string[],
  timestampIso: string,
): Promise<string> {
  const lines: string[] = [
    '-- ============================================================================',
    '-- Chinese Learner - PostgreSQL Schema (DDL)',
    `-- Dumped from current DB at: ${timestampIso}`,
    '-- ============================================================================',
    '',
  ];

  for (const table of tables) {
    const colsRes = await client.query(
      `SELECT column_name, data_type, udt_name, character_maximum_length,
              numeric_precision, numeric_scale, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position ASC`,
      [table],
    );

    const constraintsRes = await client.query<{
      conname: string;
      contype: string;
      def: string;
    }>(
      `SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = $1
         AND c.contype IN ('p', 'u', 'c', 'f')
       ORDER BY CASE c.contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'c' THEN 3 ELSE 4 END, c.conname`,
      [table],
    );

    const colDefs = colsRes.rows.map((col) => {
      const parts = [`  ${col.column_name}`, formatColumnType(col)];
      if (col.is_nullable === 'NO') parts.push('NOT NULL');
      if (col.column_default !== null) parts.push(`DEFAULT ${col.column_default}`);
      return parts.join(' ');
    });

    const constraintDefs = constraintsRes.rows.map(
      (con) => `  CONSTRAINT ${con.conname} ${con.def}`,
    );

    lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
    lines.push([...colDefs, ...constraintDefs].join(',\n'));
    lines.push(');');
    lines.push('');
  }

  // Non-constraint indexes
  const idxRes = await client.query<{ indexdef: string }>(
    `SELECT i.indexdef
     FROM pg_indexes i
     WHERE i.schemaname = 'public'
       AND NOT EXISTS (
         SELECT 1
         FROM pg_constraint c
         JOIN pg_namespace n ON n.oid = c.connamespace
         WHERE n.nspname = 'public' AND c.conname = i.indexname
       )
     ORDER BY i.tablename, i.indexname`,
  );

  if (idxRes.rows.length > 0) {
    lines.push('-- Indexes');
    for (const row of idxRes.rows) {
      const def = row.indexdef
        .replace(/^CREATE UNIQUE INDEX /i, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
        .replace(/^CREATE INDEX /i, 'CREATE INDEX IF NOT EXISTS ');
      lines.push(`${def};`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function exportCurrentSeedDataSql(
  client: Client,
  tables: string[],
  timestampIso: string,
): Promise<{ sql: string; rowCount: number }> {
  const lines: string[] = [
    '-- ============================================================================',
    '-- Chinese Learner - Seed Data (Dumped from current DB)',
    `-- Dumped at: ${timestampIso}`,
    '-- Lưu ý: Master data (roles, program_modules) được giữ nguyên tại 02_master_data.sql',
    '-- ============================================================================',
    '',
  ];

  let totalRows = 0;

  for (const table of tables) {
    if (MASTER_TABLES.has(table)) continue;

    // Lấy cột khóa chính để sinh ON CONFLICT (...) DO UPDATE
    const pkRes = await client.query<{ attname: string }>(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public' AND t.relname = $1 AND i.indisprimary`,
      [table],
    );
    const pkCols = pkRes.rows.map((r) => r.attname);

    const res = await client.query(`SELECT * FROM "${table}"`);
    lines.push(`-- Table: ${table} (${res.rows.length} rows)`);

    if (res.rows.length === 0) {
      lines.push('');
      continue;
    }

    const colNames = res.fields.map((f) => f.name);
    const colsSql = colNames.map((c) => `"${c}"`).join(', ');
    const nonPkCols = colNames.filter((c) => !pkCols.includes(c));

    const conflictClause =
      pkCols.length > 0 && nonPkCols.length > 0
        ? `ON CONFLICT (${pkCols.map((c) => `"${c}"`).join(', ')}) DO UPDATE SET ${nonPkCols
            .map((c) => `"${c}" = EXCLUDED."${c}"`)
            .join(', ')}`
        : 'ON CONFLICT DO NOTHING';

    for (const row of res.rows) {
      const valsSql = colNames.map((c) => escapeSqlValue(row[c])).join(', ');
      lines.push(
        `INSERT INTO "${table}" (${colsSql}) VALUES (${valsSql}) ${conflictClause};`,
      );
      totalRows++;
    }
    lines.push('');
  }

  return { sql: lines.join('\n'), rowCount: totalRows };
}

async function cmdInit() {
  const dbName = getTargetDatabaseName();
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Tên database không hợp lệ: ${dbName}`);
  }

  const client = new Client(getPgConfig('postgres'));
  await client.connect();
  try {
    const res = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (res.rowCount && res.rowCount > 0) {
      console.log(`✔ Database "${dbName}" đã tồn tại.`);
    } else {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✔ Đã tạo mới database "${dbName}".`);
    }
  } finally {
    await client.end();
  }
}

async function cmdGenerate() {
  const client = new Client(getPgConfig());
  await client.connect();
  try {
    const schemaSql = readSqlFile('01_schema.sql');
    await client.query(schemaSql);
    console.log('✔ Đã tạo schema & các bảng từ server/db/sql/01_schema.sql.');
  } finally {
    await client.end();
  }
}

async function cmdReset() {
  const client = new Client(getPgConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    const existingTables = await getOrderedPublicTables(client);
    if (existingTables.length > 0) {
      const dropSql = `DROP TABLE IF EXISTS ${[...existingTables]
        .reverse()
        .map((t) => `"${t}"`)
        .join(', ')} CASCADE;`;
      await client.query(dropSql);
    }
    await client.query(readSqlFile('01_schema.sql'));
    await client.query(readSqlFile('02_master_data.sql'));
    await client.query('COMMIT');
    console.log(
      '✔ Đã reset toàn bộ bảng và nạp master data (01_schema.sql + 02_master_data.sql).',
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function cmdSeed() {
  const sampleSize = ensureSampleDocument();
  const client = new Client(getPgConfig());
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(readSqlFile('01_schema.sql'));
    await client.query(readSqlFile('02_master_data.sql'));
    await client.query(readSqlFile('03_seed_data.sql'));
    await client.query(
      `UPDATE course_documents SET file_size = $1 WHERE id = 'doc-hsk1-b1'`,
      [sampleSize],
    );
    await client.query('COMMIT');
    console.log('✔ Đã nạp seed data từ server/db/sql/03_seed_data.sql.');
    console.log('  Tài khoản mẫu:');
    console.log('  - Admin:      admin@chineselearner.vn    / Admin@123');
    console.log('  - Giáo viên:  teacher@chineselearner.vn  / Teacher@123');
    console.log('  - Học sinh A: studentA@chineselearner.vn / Student@123');
    console.log('  - Học sinh B: studentB@chineselearner.vn / Student@123');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

async function cmdDump() {
  fs.mkdirSync(DUMPS_DIR, { recursive: true });
  const client = new Client(getPgConfig());
  await client.connect();

  try {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const timePart = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('');
    const secPart = String(now.getSeconds()).padStart(2, '0');

    // 1. Tạo bản backup của schema + data cũ trước khi dump
    let backupFile = path.join(DUMPS_DIR, `backup_${datePart}_${timePart}.sql`);
    if (fs.existsSync(backupFile)) {
      backupFile = path.join(DUMPS_DIR, `backup_${datePart}_${timePart}${secPart}.sql`);
    }

    const prevSchema = readSqlFileIfExists('01_schema.sql');
    const prevMaster = readSqlFileIfExists('02_master_data.sql');
    const prevSeed = readSqlFileIfExists('03_seed_data.sql');

    const backupContent = [
      '-- ============================================================================',
      `-- BACKUP BẢN CŨ TRƯỚC KHI DUMP (${now.toISOString()})`,
      '-- Bao gồm toàn bộ 01_schema.sql + 02_master_data.sql + 03_seed_data.sql cũ',
      '-- ============================================================================',
      '',
      '-- >>> [1/3] 01_schema.sql (bản cũ)',
      prevSchema.trim(),
      '',
      '-- >>> [2/3] 02_master_data.sql (bản cũ)',
      prevMaster.trim(),
      '',
      '-- >>> [3/3] 03_seed_data.sql (bản cũ)',
      prevSeed.trim(),
      '',
    ].join('\n');

    fs.writeFileSync(backupFile, backupContent, 'utf-8');

    // 2. Đọc hiện trạng schema & data từ DB hiện tại
    const tables = await getOrderedPublicTables(client);
    const timestampIso = now.toISOString();

    const newSchemaSql = await exportCurrentSchemaSql(client, tables, timestampIso);
    const { sql: newSeedSql, rowCount } = await exportCurrentSeedDataSql(
      client,
      tables,
      timestampIso,
    );

    // 3. Ghi đè thẳng vào 01_schema.sql và 03_seed_data.sql (giữ nguyên 02_master_data.sql)
    const schemaPath = path.join(SQL_DIR, '01_schema.sql');
    const seedPath = path.join(SQL_DIR, '03_seed_data.sql');

    fs.writeFileSync(schemaPath, newSchemaSql, 'utf-8');
    fs.writeFileSync(seedPath, newSeedSql, 'utf-8');

    console.log('✔ Đã sao lưu bản cũ trước khi dump:');
    console.log(`  - Backup: ${backupFile}`);
    console.log(`✔ Đã đẩy hiện trạng DB (${tables.length} bảng, ${rowCount} bản ghi) vào:`);
    console.log(`  - Schema: ${schemaPath}`);
    console.log(`  - Seed:   ${seedPath}`);
    console.log('  - Master: giữ nguyên server/db/sql/02_master_data.sql');
  } finally {
    await client.end();
  }
}

async function main() {
  const action = process.argv[2];
  try {
    switch (action) {
      case 'init':
        await cmdInit();
        break;
      case 'generate':
        await cmdGenerate();
        break;
      case 'reset':
        await cmdReset();
        break;
      case 'seed':
        await cmdSeed();
        break;
      case 'dump':
        await cmdDump();
        break;
      default:
        console.error(
          'Lệnh không hợp lệ. Sử dụng: init | generate | reset | seed | dump',
        );
        process.exit(1);
    }
  } catch (err: any) {
    console.error(`✖ Lỗi khi chạy db:${action}:`, err?.message || err);
    process.exit(1);
  }
}

main();
