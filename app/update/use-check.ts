import { isDesktopBuild } from '~/utils/about'
import { createUpdateCheck } from './check'
import { later, useUpdateFlow } from './prompt'
import { needRefresh } from './state'

// Check for updates, in the page: the one check for the visit, and what a found update does. A
// found update becomes the offer the app already has: Reload goes through its flow.

let check: ReturnType<typeof createUpdateCheck> | undefined

/** The check, made once. */
export function useUpdateCheck(): ReturnType<typeof createUpdateCheck> {
  if (!check) {
    const sw = typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    check = createUpdateCheck({
      // A dev server and the desktop build register no worker (plugins/service-worker.client.ts).
      serviceWorker: sw && !import.meta.dev && !isDesktopBuild() ? navigator.serviceWorker : null,
      offered: () => needRefresh.value,
    })
  }
  return check
}

/** Runs the check; a found update is held as the offer. */
export async function runUpdateCheck(): Promise<void> {
  const result = await useUpdateCheck().run()
  if (result.status === 'ready') needRefresh.value = true
}

/** The author chose Reload on the offer. */
export function takeUpdate(): void {
  // Later, chosen before, is undone: the author asked for this one.
  later.value = false
  void useUpdateFlow().reload()
}
