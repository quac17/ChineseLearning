import * as path from 'path';

/**
 * Everything the E2E run needs to know about its own stack. It runs on its own
 * ports and its own database so it never touches the dev server or vankinh_db.
 */
/**
 * Overridable so several checkouts (worktrees, parallel agents) can run e2e at
 * the same time without sharing ports or resetting each other's database.
 * The database name must still start with "vankinh_test".
 */
export const TEST_DB = process.env.E2E_DB || 'vankinh_test';
export const API_PORT = Number(process.env.E2E_API_PORT) || 4100;
export const WEB_PORT = Number(process.env.E2E_WEB_PORT) || 3100;
if (!/^vankinh_test(_[a-z0-9_]+)?$/.test(TEST_DB)) {
  throw new Error(`E2E_DB must be vankinh_test or vankinh_test_<name>, got "${TEST_DB}".`);
}
export const API_URL = `http://localhost:${API_PORT}/api`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

export const REPO_ROOT = path.resolve(__dirname, '..');
export const AUTH_DIR = path.join(__dirname, '.auth');
export const UPLOAD_DIR = path.join(__dirname, '.tmp', 'uploads');
/** Checksum key of the fake payment gateway in the e2e stack (not a real key). */
export const FAKE_CHECKSUM_KEY = 'e2e-fake-checksum-key';

/**
 * Env for every child process (db-cli, server). Values set here win over
 * server/.env (dotenv never overrides), so DATABASE_URL is pinned explicitly
 * rather than removed: a DATABASE_URL in server/.env would otherwise point the
 * reset at the dev database.
 */
export function testDbEnv(): Record<string, string> {
  if (process.env.POSTGRES_DB && process.env.POSTGRES_DB !== TEST_DB) {
    throw new Error(
      `E2E refuses to run with POSTGRES_DB=${process.env.POSTGRES_DB}: it resets the database. ` +
        `Unset it or set it to ${TEST_DB}.`,
    );
  }
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5433';
  const user = process.env.POSTGRES_USER || 'vankinh';
  const password = process.env.POSTGRES_PASSWORD || 'vankinh_secret';
  return {
    POSTGRES_HOST: host,
    POSTGRES_PORT: port,
    POSTGRES_USER: user,
    POSTGRES_PASSWORD: password,
    POSTGRES_DB: TEST_DB,
    DATABASE_URL: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${TEST_DB}`,
    UPLOAD_DIR,
  };
}

/** Env for the API server under test. */
export function serverEnv(): Record<string, string> {
  return {
    ...testDbEnv(),
    PORT: String(API_PORT),
    CORS_ORIGIN: WEB_URL,
    JWT_SECRET: process.env.JWT_SECRET || 'e2e-only-not-a-secret',
    COOKIE_SECURE: 'false',
    COOKIE_SAME_SITE: 'lax',
    // Fake gateway: specs sign PayOS-style webhooks with this key. Never real PayOS.
    PAYMENT_GATEWAY: 'fake',
    FAKE_PAYMENT_CHECKSUM_KEY: FAKE_CHECKSUM_KEY,
    APP_URL: WEB_URL,
    // Console mailer with the in-memory outbox (GET /api/dev/mails): specs read reset links there.
    MAIL_TRANSPORT: 'console',
    MAIL_DEV_OUTBOX: 'true',
    // Every spec calls from 127.0.0.1, so the per-IP limit is lifted; the per-account limit stays real.
    PASSWORD_RESET_MAX_PER_IP: '1000',
  };
}
