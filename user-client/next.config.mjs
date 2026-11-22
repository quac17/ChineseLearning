/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // E2E runs its own client next to the dev server; a separate build folder
  // keeps the two from overwriting each other's .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Owner-edited content (src/content/legal/*.md) is imported as plain text and
  // rendered by src/lib/markdown.tsx, so no Markdown dependency is needed.
  webpack(config) {
    config.module.rules.push({ test: /\.md$/, type: 'asset/source' });
    return config;
  },
  async headers() {
    return [
      {
        // The browser must always re-check the service worker script.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
