import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works from any sub-path
  // (e.g. https://example.com/livewall/ on GitHub Pages).
  base: './',
  build: { target: 'es2022', sourcemap: true },
  server: { port: 8080 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
