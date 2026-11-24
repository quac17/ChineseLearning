import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const runE2e = process.argv.includes('--e2e') || process.env.RUN_E2E === '1';
const isWindows = process.platform === 'win32';

function run(label, cmd, extraEnv = {}) {
  console.log(`\n=== ${label} ===`);
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

try {
  run('[1/4] Server: TypeScript check (tsc --noEmit)', 'yarn --cwd server tsc --noEmit');
  run('[2/4] Server: Build (nest build)', 'yarn --cwd server build');

  const jestFlags = isWindows ? '--runInBand' : '--ci';
  run(`[3/4] Server: Unit tests (jest ${jestFlags})`, `yarn --cwd server test ${jestFlags}`);

  // Use .next-e2e (already in tsconfig.json and .gitignore) so check:ci / git push
  // never hits EPERM on .next/trace when `yarn client:dev` is running on Windows.
  run('[4/4] Client: TypeScript check + Next.js build', 'yarn --cwd user-client tsc --noEmit && yarn --cwd user-client build', {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || '.next-e2e',
  });

  if (runE2e) {
    run('[5/5] E2E: Playwright suite', 'yarn e2e');
  } else {
    console.log('\n(Bỏ qua E2E mặc định để push nhanh. Dùng `RUN_E2E=1 git push` hoặc `yarn check:all` để chạy cả E2E.)');
  }

  console.log('\n✔ Tất cả kiểm tra CI đã PASS! Sẵn sàng push.');
} catch {
  console.error('\n✖ Kiểm tra CI thất bại. Đã chặn git push để bảo vệ nhánh remote.');
  process.exit(1);
}
