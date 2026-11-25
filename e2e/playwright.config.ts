import { defineConfig, devices } from '@playwright/test';
import { API_URL, REPO_ROOT, WEB_PORT, WEB_URL, serverEnv } from './env';

const isCI = Boolean(process.env.CI);

// Clean .next-e2e before starting so leftover `next build` output (from check:ci)
// never corrupts `next dev` webpack chunks ("Cannot find module './vendor-chunks/next.js'").
const cleanDist = `node -e "require('fs').rmSync('.next-e2e',{recursive:true,force:true})"`;

// Local runs use `next dev`; CI builds once and serves the production build.
const clientCommand = isCI
  ? `${cleanDist} && yarn build && yarn next start -p ${WEB_PORT}`
  : `${cleanDist} && yarn next dev -p ${WEB_PORT}`;

export default defineConfig({
  testDir: './specs',
  outputDir: '../test-results',
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Cap local workers so concurrent cold route compilations in `next dev` do not thrash webpack.
  workers: 2,
  timeout: isCI ? 30_000 : 60_000,
  reporter: isCI ? [['github'], ['html', { open: 'never', outputFolder: '../playwright-report' }]] : 'list',
  // Locally `next dev` compiles each route on first visit, which can take
  // longer than the 5s default; CI serves a production build.
  expect: { timeout: isCI ? 5_000 : 15_000 },
  use: {
    baseURL: WEB_URL,
    locale: 'vi-VN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      // `db-cli init` creates chinese_learner_test if missing (the server checks the
      // database on boot). Compiled into its own folder so it never fights
      // `nest start --watch` over dist/.
      command:
        'npx ts-node db/scripts/db-cli.ts init && npx tsc -p tsconfig.e2e.json && node dist-e2e/main.js',
      cwd: `${REPO_ROOT}/server`,
      env: serverEnv(),
      // /health only runs SELECT 1, so it is ready before globalSetup creates the tables.
      url: `${API_URL}/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: clientCommand,
      cwd: `${REPO_ROOT}/user-client`,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_FEATURE_PAYOS_ENABLED: 'true',
        NEXT_PUBLIC_FEATURE_MAIL_ENABLED: 'true',
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      url: WEB_URL,
      reuseExistingServer: !isCI,
      timeout: 240_000,
    },
  ],
});
