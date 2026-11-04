import { effectScope, toRaw } from 'vue'

/**
 * Run `setup` (typically one or more `watch()` calls) exactly ONCE per Nuxt
 * app instance, inside a detached effect scope so the watchers live for the
 * whole session instead of dying with whichever component happened to call
 * the composable first.
 *
 * Why not a module flag or a WeakSet of refs?
 *  - Nuxt's `useState` returns a NEW `toRef(payload.state, key)` wrapper on
 *    every call, so a WeakSet keyed by the returned ref never matches — every
 *    caller re-registered (the Skein's watchers ran 3× per compile).
 *  - Composables are also called outside component setup (e.g. from
 *    `runCompile`), where an unguarded `watch()` is never disposed — one leaked
 *    watcher per compile.
 *  - A bare module flag is right in production but pins the watcher to the
 *    first test's state in the suite.
 *
 * The anchor is a plain object held in `useState`: `anchor.value` resolves to
 * the same underlying object for every caller in one app (and a fresh one per
 * test, since the test harness rebuilds state), so keying on it gives exactly
 * "once per app".
 */
const registry = new WeakMap<object, Set<string>>()

export function registerSessionOnce(key: string, setup: () => void): void {
  if (!import.meta.client) return
  const anchor = useState<Record<string, true>>('frotz:session-anchor', () => ({}))
  const raw = toRaw(anchor.value) as object
  let keys = registry.get(raw)
  if (!keys) registry.set(raw, (keys = new Set()))
  if (keys.has(key)) return
  keys.add(key)
  effectScope(true).run(setup)
}
