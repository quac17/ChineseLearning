#!/usr/bin/env node
/**
 * Renders a short title-card video (.webm) for every demo lesson, so uploaded
 * lessons play through the real /lessons/:id/stream access check.
 *
 * Run by `yarn db:demo` after server/db/sql/04_demo_data.sql is loaded.
 * Uses the Playwright Chromium already installed for e2e (canvas +
 * MediaRecorder), so no ffmpeg is needed. Existing files are kept; pass
 * --force to render them again.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverRoot = path.join(repoRoot, 'server');
// pg and dotenv are server dependencies; load them from there.
const requireFromServer = createRequire(path.join(serverRoot, 'package.json'));
const { Client } = requireFromServer('pg');
const dotenv = requireFromServer('dotenv');
dotenv.config({ path: path.join(serverRoot, '.env') });
dotenv.config({ path: path.join(repoRoot, '.env') });

const force = process.argv.includes('--force');
const SECONDS = 4;

const PROGRAM = {
  easy: { color: '#4E8A2E', han: '易', name: 'Easy Steps' },
  yct: { color: '#C46A12', han: '少', name: 'YCT' },
  hsk: { color: '#1F4FA0', han: '考', name: 'HSK' },
  talk: { color: '#1E6E5C', han: '说', name: 'Giao tiếp' },
};

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

/** Runs in the page: draws the card for `seconds` and returns the webm as base64. */
async function renderInPage({ title, course, program, index, seconds }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const sans = '"Be Vietnam Pro", "Helvetica Neue", Arial, sans-serif';
  const han = '"Noto Serif SC", "PingFang SC", "Songti SC", "Noto Sans CJK SC", serif';

  const draw = (t) => {
    ctx.fillStyle = program.color;
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.font = `700 420px ${han}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(program.han, 1240, 600);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 30px ${sans}`;
    ctx.fillText(`${program.name} · ${course}`.slice(0, 70), 80, 120);
    ctx.font = `800 64px ${sans}`;
    const words = title.split(' ');
    let line = '';
    let y = 300;
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > 1000 && line) {
        ctx.fillText(line, 80, y);
        line = w;
        y += 80;
      } else line = test;
    }
    ctx.fillText(line, 80, y);

    ctx.font = `500 26px ${sans}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Bài ${index + 1} · Video mẫu, dữ liệu demo`, 80, 640);

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(80, 665, 1120, 6);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(80, 665, 1120 * Math.min(1, t / seconds), 6);
  };

  draw(0);
  // Frame rate 0 + requestFrame(): frames are pushed by hand after each draw,
  // because background pages barely render and an automatic capture would
  // record only the first few frames (a 0.2 s "video").
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 600_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.start(250);
  const start = performance.now();
  // setTimeout, not requestAnimationFrame: rAF does not run in background pages.
  await new Promise((resolve) => {
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      draw(t);
      track.requestFrame();
      if (t >= seconds) resolve();
      else setTimeout(tick, 1000 / 30);
    };
    tick();
  });
  recorder.stop();
  await done;
  const blob = new Blob(chunks, { type: 'video/webm' });
  // MediaRecorder webm has no duration header; seek far to make the browser
  // compute the real length, so a broken capture is caught here.
  const duration = await new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return resolve(v.duration);
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        resolve(v.duration);
      };
      v.currentTime = 1e6;
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(blob);
  });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { b64: btoa(bin), duration };
}

async function main() {
  const uploadDir = path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads');
  const client = new Client(pgConfig());
  await client.connect();
  const { rows } = await client.query(
    `SELECT l.id, l.title, l.storage_key, l.sort_order, c.title AS course_title, c.module
     FROM lessons l JOIN courses c ON c.id = l.course_id
     WHERE l.id LIKE 'demo-%' AND l.source_type = 'UPLOAD'
     ORDER BY c.sort_order, l.sort_order`,
  );

  const missing = (r) => {
    const filePath = path.join(uploadDir, r.storage_key);
    return !fs.existsSync(filePath) || fs.statSync(filePath).size === 0;
  };
  const todo = rows.filter((r) => force || missing(r));
  if (todo.length === 0) {
    console.log(`✔ Video demo đã có đủ (${rows.length} bài). Dùng --force để tạo lại.`);
  } else {
    console.log(`… Đang tạo ${todo.length} video demo (${SECONDS}s mỗi video, khoảng ${Math.ceil((todo.length * (SECONDS + 1)) / 60)} phút)…`);
    // One at a time: MediaRecorder records in real time and parallel pages
    // (even in separate browsers) starve each other and record 0-second
    // videos. Every file is checked for its real duration below.
    const queue = [...todo];
    const worker = async () => {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        for (let r = queue.shift(); r; r = queue.shift()) {
          const args = {
            title: r.title,
            course: r.course_title,
            program: PROGRAM[r.module] ?? PROGRAM.hsk,
            index: r.sort_order,
            seconds: SECONDS,
          };
          let out = { b64: '', duration: 0 };
          for (let attempt = 0; attempt < 3 && out.duration < SECONDS - 0.5; attempt++) {
            out = await page.evaluate(renderInPage, args);
          }
          if (out.duration < SECONDS - 0.5) {
            throw new Error(`Video demo của bài ${r.id} chỉ dài ${out.duration.toFixed(1)} giây`);
          }
          const filePath = path.join(uploadDir, r.storage_key);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, Buffer.from(out.b64, 'base64'));
        }
      } finally {
        await browser.close();
      }
    };
    await worker();
  }

  for (const r of rows) {
    const filePath = path.join(uploadDir, r.storage_key);
    if (fs.existsSync(filePath)) {
      await client.query('UPDATE lessons SET file_size = $1 WHERE id = $2', [fs.statSync(filePath).size, r.id]);
    }
  }
  await client.end();
  console.log(`✔ Video demo nằm trong ${path.join(uploadDir, 'videos')}.`);
}

main().catch((err) => {
  console.error('✖ Không tạo được video demo:', err?.message || err);
  console.error('  Cần Chromium của Playwright: npx playwright install chromium');
  process.exit(1);
});
