import { defineConfig } from 'vitest/config'
import { availableParallelism } from 'node:os'
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
// (server.environments.client) while vitest@2.1.9 bundles Vite 5. The startup
// error is "Cannot read properties of undefined (reading 'client')" in
// @nuxt/vite-builder/dist/index.mjs:851. Using happy-dom + window stubs achieves
// identical test fidelity for state-logic tests.
//
// vitest 5 (2026-11-09). 3.2.6 and 4.1.12 had timed out on CI, which looked like the runner being
// slower. It wasn't: timed on one CI machine, a ZILF golden's compile takes about 50 s alone under
// vitest 2 and 5 alike, against what was a 60 s hook limit, so any extra load beside it tipped it
// over. The limits in the ZILF goldens are now for a hang (240 s), and one core is left free.
// See docs/security-audits/2026-11-09-review.md.

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
    // One core left free, as vitest 2 did by default; vitest 4 and later use every core. Each
    // ZILF golden compiles in a 13 MB .NET runtime that fills a core: three at once on CI's four
    // took 55 s each with a core free and 81 s without (2026-11-09).
    maxWorkers: Math.max(1, availableParallelism() - 1),
    // Two projects (environmentMatchGlobs is gone since vitest 4): pure logic in node, and the
    // composable tests that need DOM/localStorage (`*.nuxt.test.ts`) in happy-dom. Both take
    // the plugins, defines and aliases of this file (`extends: true`).
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['app/**/*.{test,spec}.ts', 'tools/*.{test,spec}.ts'],
          exclude: ['**/*.nuxt.test.ts', '**/node_modules/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'happy-dom',
          environment: 'happy-dom',
          include: ['app/**/*.nuxt.test.ts'],
        },
      },
    ],
    // @frotzinc/nuxt-base is a Nuxt layer shipped as TypeScript source; Node
    // won't strip types under node_modules, so Vite transforms it instead.
    server: { deps: { inline: [/@frotzinc\/nuxt-base/] } },
    setupFiles: ['./test/nuxt-setup.ts'],
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
