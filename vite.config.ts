import { defineConfig } from 'vitest/config';

// base './' – strona działa pod dowolną ścieżką (GitHub Pages: /earthlings/).
// Grafiki i fonty z assets/ są kopiowane bez zmian (publicDir).
export default defineConfig({
  base: './',
  publicDir: 'assets',
  build: { outDir: 'dist', assetsInlineLimit: 0, target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
