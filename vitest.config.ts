import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Standalone from nuxt.config — only powers the unit suite. Pure logic runs in
// the node environment; the aliases mirror Nuxt 4 (`~` → app/, `~~` → root) so
// test files can use either relative or aliased imports.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['app/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
})
