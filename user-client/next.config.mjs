/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // E2E runs its own client next to the dev server; a separate build folder
  // keeps the two from overwriting each other's .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
