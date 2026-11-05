import { encodeShareFragment, decodeShareFragment } from '~/utils/share-link'
import { isPristine } from '~/utils/pristine'
import { useOutsideSource } from '~/composables/outside-source'
import { useZilProjectFiles } from '~/composables/useZilProjectFiles'

/**
 * Share the editor's source as a URL — zero backend: the source rides
 * deflated+base64url in the FRAGMENT (never sent to any server).
 *
 * Consumption is non-destructive: a link only auto-loads over a PRISTINE
 * buffer (language seed / empty). Over real work it offers a toast action
 * instead — a click on a share link must never eat someone's game, because
 * the crash-recovery autosave would persist the replacement within a second.
 */
export function useShareLink() {
  const { source, loadSource } = useIde()
  const { profile } = useLanguage()
  const { markOutside } = useOutsideSource()
  const zilFiles = useZilProjectFiles()

  /** Handle an incoming #src= fragment (call once after restore() on mount).
   *  Returns true when a valid fragment for THIS language was recognized. */
  function consumeShareFragment(): boolean {
    if (!import.meta.client) return false
    const decoded = decodeShareFragment(window.location.hash)
    if (!decoded) return false
    // A link for the other language: leave it alone (and the hash intact) so
    // the author can navigate to the right page themselves.
    if (decoded.lang !== profile.value.id) return false

    // Recognized → clear the hash so a refresh doesn't re-prompt.
    history.replaceState(null, '', window.location.pathname + window.location.search)

    if (isPristine(source.value)) {
      loadSource(decoded.source)
      if (profile.value.id === 'zil') zilFiles.clear() // a shared link carries one source only
      markOutside() // no Skein auto-run until Play/Run (audit F2)
      useToast().add({
        title: 'Loaded shared source',
        description: 'This link carried a game source — it is now in your editor. Compile to play it.',
        color: 'success',
        icon: 'i-lucide-inbox',
      })
    } else {
      useToast().add({
        title: 'This link carries a shared game source',
        description: 'You have work in the editor, so nothing was replaced. Load it?',
        color: 'info',
        icon: 'i-lucide-inbox',
        duration: 0, // sticky — an accidental dismiss would lose the offer
        actions: [
          {
            label: 'Replace editor contents',
            // The toast can outlive a route change; only load into the
            // language the link was made for.
            onClick: () => {
              if (profile.value.id === decoded.lang) {
                loadSource(decoded.source)
                if (profile.value.id === 'zil') zilFiles.clear()
                markOutside()
              }
            },
          },
        ],
      })
    }
    return true
  }

  /** Encode the current source into a share URL and copy it. */
  async function copyShareLink(): Promise<boolean> {
    const frag = encodeShareFragment(source.value, profile.value.id)
    if (frag === null) {
      useToast().add({
        title: 'Source too large to share as a link',
        description: 'Links carry the source compressed in the URL itself. For a game this size, use Save As or Export playable HTML instead.',
        color: 'warning',
        icon: 'i-lucide-unlink',
      })
      return false
    }
    const url = `${window.location.origin}${profile.value.route}#${frag}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Denied permission, insecure context, or an unfocused document.
      useToast().add({
        title: 'Could not copy the share link',
        description: 'The browser blocked clipboard access. Click into the page and try again.',
        color: 'error',
        icon: 'i-lucide-unlink',
      })
      return false
    }
    // A link holds one source: say so when the ZIL project has more files.
    const leavesOut = profile.value.id === 'zil' && zilFiles.files.value.length > 0
    useToast().add({
      title: 'Share link copied',
      description:
        'Anyone opening it gets this source in their editor — the code travels inside the link; nothing is uploaded.' +
        (leavesOut ? ' The link carries only the main file, not the project’s other ZIL files; Download project shares all of them.' : ''),
      color: 'success',
      icon: 'i-lucide-link',
    })
    return true
  }

  return { consumeShareFragment, copyShareLink }
}
