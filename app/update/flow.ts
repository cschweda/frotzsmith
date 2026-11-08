import { ref } from 'vue'

// The choices behind "A new version of frotzsmith is ready". Nothing here reloads by itself:
// every path to `apply` starts with the author pressing a button.

export const UPDATE_READY = 'A new version of frotzsmith is ready'

export const APPLYING_MESSAGE = 'Getting the newest version…'

export interface UpdateDeps {
  /**
   * Lets the new version take over and reloads, and never settles once a reload is under way:
   * it settles only when nothing went.
   */
  apply(): Promise<void> | void
}

/**
 * `toast`: the offer, with Reload. `applying`: the new version is being fetched and is taking
 * over (a few seconds at most); its buttons can't be pressed again.
 *
 * Deviation from Drafter: the web IDE has no file to save. All work lives in browser storage and
 * only debounced writes can be pending, so there is no Save-first / Reload-anyway question;
 * `reload()` just applies. The pending writes are flushed by the plugin's reload via
 * `flushBeforeReload`, as Drafter's plugin does.
 */
export type UpdateStage = 'toast' | 'applying'

export function createUpdateFlow(deps: UpdateDeps) {
  const stage = ref<UpdateStage>('toast')

  /**
   * Says so, then applies. When the page reloads `deps.apply` never comes back. When it does come
   * back, or fails, nothing went, so the toast returns and the editor can be typed in.
   */
  async function reload(): Promise<void> {
    stage.value = 'applying'
    try {
      await deps.apply()
    } finally {
      stage.value = 'toast'
    }
  }

  return { stage, reload }
}
