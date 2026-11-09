import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

// Standalone from nuxt.config — powers both the pure-logic suite (node env) and
// composable/state tests (happy-dom env). Pure tests keep the `node` default;
// `*.nuxt.test.ts` files run in `happy-dom` so they get localStorage + window.
// Nuxt auto-imports (useState, computed, watch, etc.) are provided as window
// globals by `test/nuxt-setup.ts`.
//
// NOTE: The intended approach was `defineVitestConfig` from @nuxt/test-utils with
// `// @vitest-environment nuxt` per file, but that path is blocked: nuxt@4.4.8
// ships @nuxt/vite-builder which uses the Vite 6 Environment API
// (server.environments.client) while vitest@2.1.9 bundled Vite 5. (vitest is 3.2.x since
// 2026-11-09. vitest 4 was tried: it needs `projects` in place of environmentMatchGlobs, and
// on CI's runners the ZILF goldens ran at half speed under it and timed out, for no reason
// found locally. Try it again with a later 4.x.) The startup
// error is "Cannot read properties of undefined (reading 'client')" in
// @nuxt/vite-builder/dist/index.mjs:851. Using happy-dom + window stubs achieves
// identical test fidelity for state-logic tests.

/**
 * Vite plugin that replaces `import.meta.client` with `true` in all app source
 * files so client-side code guards (if (!import.meta.client) return) pass in the
 * happy-dom test environment. The Nuxt vite-builder normally does this via its own
 * define; without it we replicate the effect via a transform plugin.
 */
function nuxtClientMetaPlugin(): Plugin {
  return {
    name: 'nuxt-client-meta',
    enforce: 'pre',
    transform(code: string, id: string) {
      // Only transform app source files, not node_modules
      if (id.includes('node_modules')) return
      if (!code.includes('import.meta.client')) return
      return {
        code: code.replace(/import\.meta\.client/g, 'true'),
        map: null,
      }
    },
  }
}

export default defineConfig({
  plugins: [nuxtClientMetaPlugin()],
  define: {
    __FROTZSMITH_VERSION__: JSON.stringify('0.1.0-test'),
    __FROTZSMITH_COMMIT__: JSON.stringify('abc1234'),
    __FROTZSMITH_COMMIT_DATE__: JSON.stringify('2026-11-04'),
    __FROTZSMITH_DESKTOP__: 'false',
  },
  test: {
    environment: 'node',
    // @frotzinc/nuxt-base is a Nuxt layer shipped as TypeScript source; Node
    // won't strip types under node_modules, so Vite transforms it instead.
    server: { deps: { inline: [/@frotzinc\/nuxt-base/] } },
    include: ['app/**/*.{test,spec}.ts', 'tools/*.{test,spec}.ts'],
    setupFiles: ['./test/nuxt-setup.ts'],
    environmentMatchGlobs: [
      // Composable tests that need DOM/localStorage run in happy-dom
      ['**/*.nuxt.test.ts', 'happy-dom'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/**/*.ts'],
      exclude: [
        'app/**/*.test.ts',
        'app/**/*.vue',
        // Composable exclusion removed so nuxt tests contribute to coverage
        '**/*.d.ts',
        'app/app.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      // vite-plugin-pwa's virtual module exists only in a Nuxt build (see the stub).
      'virtual:pwa-register': fileURLToPath(new URL('./test/pwa-register-stub.ts', import.meta.url)),
    },
  },
})
