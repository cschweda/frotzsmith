import { ref, watch } from 'vue'
import { createUpdateFlow } from './flow'
import { applyingUpdate, applyUpdate } from './state'

// What the update offer has been told, kept out of the component so it survives the toast being
// taken away and given back (e.g. by focus mode).

/** "Later" was chosen: the offer stays hidden until the next load. */
export const later = ref(false)

let flow: ReturnType<typeof createUpdateFlow> | undefined

/** The one flow for this visit, made on first use. */
export function useUpdateFlow(): ReturnType<typeof createUpdateFlow> {
  if (!flow) {
    flow = createUpdateFlow({ apply: applyUpdate })
    // Sync, so the editor is read-only from the moment the update starts applying.
    watch(
      flow.stage,
      (stage) => {
        applyingUpdate.value = stage === 'applying'
      },
      { flush: 'sync' },
    )
  }
  return flow
}
