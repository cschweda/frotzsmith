import { registerSW } from 'virtual:pwa-register'
import { fetchNewest, startUpdatePolling } from '~/update/check'
import {
  createControllerWatch,
  flushBeforeReload,
  needRefresh,
  noteChunkError,
  replaced,
  setBeforeReload,
  setUpdater,
} from '~/update/state'
import { justUpdated, markUpdating, sessionStore, takeUpdated } from '~/update/updated'

// Registers the service worker (`@vite-pwa/nuxt` writes it at build time: nuxt.config.ts `pwa`) and
// tells the page when a newer version is waiting. The module's own client plugin is off
// (`client.registerPlugin: false`), because with it a tab reloads itself as soon as ANY tab lets
// a new version take over; here a reload happens only in the tab whose author chose it.
// The desktop build leaves this plugin out (nuxt.config.ts `app:resolve`).

/**
 * How long the page waits, after telling the new version to take over, for the change of
 * controller that is its cue to reload. It takes moments; if it never comes (the waiting worker
 * is gone, or never answers), the page reloads regardless rather than leaving the author's choice
 * looking ignored, and the new version is there on the next load.
 */
const TAKEOVER_MS = 3000

export default defineNuxtPlugin((nuxtApp) => {
  // There is no worker in `nuxt dev`, and a registration there would only fail.
  if (import.meta.dev || !('serviceWorker' in navigator)) return

  // This load is the one an update the author chose reloaded into: the toast says so, once.
  if (takeUpdated(sessionStore())) justUpdated.value = true

  // A chunk that fails to load means this version's files are gone (another tab let a new version
  // take over): the offer is shown instead of the reload Nuxt would do on its own
  // (nuxt.config.ts `experimental.emitRouteChunkError: 'manual'`).
  nuxtApp.hook('app:chunkError', () => noteChunkError())

  // The pending saves are written before any reload into a new version. The composables are
  // reached only then, in the app's context (a click is outside it): calling them here, before the
  // page has set its language, would seed the source buffer for the wrong one.
  setBeforeReload(async () => {
    await nuxtApp.runWithContext(async () => {
      useSourceDocument().flushPendingSave()
      await useSkein().flushSaves()
    })
  })

  let fallback: ReturnType<typeof setTimeout> | undefined
  let reloading = false
  /**
   * The reload the author chose, after the pending saves are written. `updated`: the new version
   * has taken over, so the next load says Frotzsmith is up to date; a reload because it didn't
   * (the fallback) says nothing of the kind.
   */
  const reload = async (updated: boolean) => {
    clearTimeout(fallback)
    if (reloading) return
    reloading = true
    await flushBeforeReload()
    if (updated) markUpdating(sessionStore())
    window.location.reload()
  }
  /** What the updater returns once a reload is under way: it never settles (flow.ts says why). */
  const away = () => new Promise<never>(() => {})

  // On a first visit the worker takes over a moment after it installs (`clientsClaim`): that first
  // change of controller is not an update (state.ts says how the rest are told apart).
  const watch = createControllerWatch({
    controlled: navigator.serviceWorker.controller !== null,
    reload: () => void reload(true),
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => watch.onChange())

  const skipWaiting = registerSW({
    immediate: true,
    onNeedRefresh() {
      needRefresh.value = true
    },
    // Called when a new version takes over, in place of the reload the library would do on its own
    // (and only if the page was controlled when it registered). The controller change above
    // decides what a take-over means here.
    onNeedReload() {},
  })

  // A tab left open still hears of a new deploy: hourly, the registration asks for it. What it
  // finds only raises the offer above (onNeedRefresh); nothing here reloads. (Nuxt's own hourly
  // check is off, nuxt.config.ts `experimental.checkOutdatedBuildInterval`: it reloads by itself.)
  startUpdatePolling(() => navigator.serviceWorker.getRegistration())

  setUpdater(async () => {
    // Another tab let the new version take over: it is this page's on a reload.
    if (replaced.value) {
      void reload(true)
      return away()
    }
    // The newest version on the server, not only the one waiting when the offer appeared
    // (update/check.ts says why).
    await fetchNewest(() => navigator.serviceWorker.getRegistration())
    // Another tab may have let it take over meanwhile.
    if (replaced.value) {
      void reload(true)
      return away()
    }
    watch.apply()
    await skipWaiting(true)
    fallback = setTimeout(() => void reload(false), TAKEOVER_MS)
    return away()
  })
})
