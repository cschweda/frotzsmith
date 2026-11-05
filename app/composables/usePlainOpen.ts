import { computed, ref, shallowRef } from 'vue'
import { isPristine } from '~/utils/pristine'
import { otherZilFilesPhrase } from '~/utils/package-messages'
import { useZilProjectFiles } from '~/composables/useZilProjectFiles'

/**
 * Opening a plain source file: it replaces the editor's text and, in a ZIL
 * project, removes the project's other .zil files (a plain file brings none).
 * It asks first unless neither holds anything of the author's: the editor is
 * pristine or already holds the same text, and there are no extra files.
 */
export function usePlainOpen() {
  const { source, loadOpenedFile } = useIde()
  const { profile } = useLanguage()
  const zilFiles = useZilProjectFiles()

  const pending = shallowRef<{ name: string; text: string } | null>(null)
  const confirm = ref(false)
  /** Whether the pending open replaces the editor's text (else only the extra files go). */
  const replacesSource = ref(false)

  const extraCount = computed(() => (profile.value.id === 'zil' ? zilFiles.files.value.length : 0))

  const heading = computed(() =>
    extraCount.value > 0 ? 'Replace the project in the editor?' : 'Replace the source in the editor?',
  )
  const description = computed(() => {
    const n = extraCount.value
    if (n === 0) return 'Opening this file replaces the source in the editor.'
    const files = otherZilFilesPhrase(n)
    return replacesSource.value
      ? `Opening this file replaces the source in the editor and removes ${files}.`
      : `Opening this file removes ${files}.`
  })

  /** Open now ('opened') or ask first ('asking'). */
  function request(name: string, text: string): 'opened' | 'asking' {
    const sourceIsWork = !isPristine(source.value) && text !== source.value
    if (!sourceIsWork && extraCount.value === 0) {
      loadOpenedFile(text) // outside source: no Skein auto-run until Play/Run
      return 'opened'
    }
    replacesSource.value = sourceIsWork
    pending.value = { name, text }
    confirm.value = true
    return 'asking'
  }

  function replace() {
    const p = pending.value
    confirm.value = false
    pending.value = null
    if (p) loadOpenedFile(p.text)
  }

  function cancel() {
    confirm.value = false
    pending.value = null
  }

  return { pending, confirm, heading, description, request, replace, cancel }
}
