import { ref } from 'vue'

// What the service worker has told the page. `app/plugins/service-worker.client.ts` sets these;
// `UpdatePrompt.vue` reads them. (Desktop-only parts of Drafter's model come back in milestone 3.)

/** A new version is installed and waiting: the author is offered a reload. */
export const needRefresh = ref(false)

/**
 * Another tab already let the new version take over. This tab still runs the old files, so a
 * reload is all it needs (there is no waiting worker left to tell).
 */
export const replaced = ref(false)

/**
 * The new version is being fetched and is taking over: the source editor is read-only meanwhile
 * (SourcePane.vue), so nothing typed is lost to the reload.
 */
export const applyingUpdate = ref(false)

/**
 * A chunk of the app failed to load (Nuxt's `app:chunkError`, with `emitRouteChunkError: 'manual'`
 * in nuxt.config.ts). Under the service worker that means another tab let a new version take over
 * and its clean-up removed this version's files. Nuxt would reload the page on the next
 * navigation, without the pending saves written; instead the tab is told it was replaced and the
 * offer is shown, so the reload is the author's, through Reload.
 */
export function noteChunkError(): void {
  replaced.value = true
  needRefresh.value = true
}

let updater: () => Promise<void> = async () => {}
let beforeReload: () => Promise<void> = async () => {}

/** What has to be written before the page reloads into a new version (the pending saves). */
export function setBeforeReload(flush: () => Promise<void>): void {
  beforeReload = flush
}

/** Writes it, waiting `ms` at most and never rejecting: the reload is not held up for long. */
export async function flushBeforeReload(ms = 1000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    beforeReload().catch(() => {}),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms)
    }),
  ])
  clearTimeout(timer)
}

/** The plugin says how an update is applied. */
export function setUpdater(apply: () => Promise<void>): void {
  updater = apply
}

/** Lets the waiting version take over and reloads this page. Only ever called by a choice the author made. */
export function applyUpdate(): Promise<void> {
  return updater()
}

/**
 * Tells a change of the page's controlling worker apart (the browser's `controllerchange`):
 * - In the tab whose author asked for the update (`apply`), it is the cue to reload.
 * - Anywhere else, the new version has taken over without this tab's author choosing it: the tab
 *   is left as it is, with the offer still up (`replaced`), and its Reload only has to reload.
 * - The first change on a first visit is the worker claiming the page (`clientsClaim`), not an
 *   update. A tab that was offered an update has seen a worker already, whether or not one
 *   controlled the page (a hard reload loads the page without one), so its changes always count.
 */
export function createControllerWatch(options: { controlled: boolean; reload: () => void }) {
  let controlled = options.controlled
  let applying = false
  return {
    /** This tab's author asked for the new version. */
    apply() {
      applying = true
    },
    onChange() {
      if (applying) {
        options.reload()
        return
      }
      const claiming = !controlled && !needRefresh.value
      controlled = true
      if (!claiming) replaced.value = true
    },
  }
}
