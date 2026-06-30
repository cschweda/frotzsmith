/**
 * Nuxt composable test setup — runs for every test file in happy-dom env.
 *
 * In the happy-dom environment `vi.stubGlobal` places values on `window`.
 * Composable source files (*.ts) reference `useState`, `computed`, `watch`, etc.
 * as free variables (Nuxt auto-imports) — not as explicit ESM imports. In a
 * browser-like runtime (happy-dom) free-variable lookups fall through to `window`,
 * so our stubs become visible to the composable code without any vite plugin.
 *
 * What we provide:
 *   - useState  — keyed ref store, shared within a test, cleared between tests
 *   - computed, watch, watchEffect, readonly, nextTick — real Vue
 *   - slugify, storyBaseName — real utils (used as auto-imports by useIde)
 *
 * We do NOT provide composable globals like useCompiler, useTranscript, useIde,
 * etc. — each test file provides the specific stubs it needs via vi.stubGlobal.
 */
import { ref, computed, watch, watchEffect, readonly, nextTick } from 'vue'
import { vi, beforeEach } from 'vitest'
import { slugify, storyBaseName } from '../app/utils/slug'

// Only install in the happy-dom env (node env has no window).
if (typeof window !== 'undefined') {
  /** Shared per-test key→Ref store that mirrors Nuxt useState's SSR state map. */
  const _stateMap = new Map<string, ReturnType<typeof ref>>()

  /** Drop the value on window so test files can also clear state mid-test. */
  ;(window as Record<string, unknown>).__nuxtStateMap = _stateMap

  beforeEach(() => {
    _stateMap.clear()
  })

  vi.stubGlobal('useState', function <T>(key: string, init?: () => T) {
    if (!_stateMap.has(key)) {
      _stateMap.set(key, ref<T | undefined>(init?.()) as ReturnType<typeof ref>)
    }
    return _stateMap.get(key)
  })

  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  vi.stubGlobal('watchEffect', watchEffect)
  vi.stubGlobal('readonly', readonly)
  vi.stubGlobal('nextTick', nextTick)

  // App-level auto-imported utilities (used in useIde without import statements)
  vi.stubGlobal('slugify', slugify)
  vi.stubGlobal('storyBaseName', storyBaseName)
}
