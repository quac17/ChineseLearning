import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { REPO_ROOT, TEST_DB, UPLOAD_DIR, testDbEnv } from './env';

/**
 * Every run starts from 03_seed_data.sql on chinese_learner_test. Runs before the web
 * servers start, so the API never sees a half-reset database.
 */
export default function globalSetup() {
  const env = { ...process.env, ...testDbEnv() };
  if (env.POSTGRES_DB !== TEST_DB || !env.DATABASE_URL?.endsWith(`/${TEST_DB}`)) {
    throw new Error(`E2E global setup only resets ${TEST_DB}.`);
  }

  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const serverDir = path.join(REPO_ROOT, 'server');
  for (const cmd of ['init', 'reset', 'seed']) {
    execFileSync('npx', ['ts-node', 'db/scripts/db-cli.ts', cmd], {
      cwd: serverDir,
      env,
      stdio: process.env.CI ? 'inherit' : 'pipe',
    });
  }
}
