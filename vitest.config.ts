import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Standalone from nuxt.config — only powers the unit suite. Pure logic runs in
// the node environment; the aliases mirror Nuxt 4 (`~` → app/, `~~` → root) so
// test files can use either relative or aliased imports.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/**/*.ts'],
      exclude: [
        'app/**/*.test.ts',
        'app/**/*.vue',
        'app/**/use*.ts',
        '**/*.d.ts',
        'app/app.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
