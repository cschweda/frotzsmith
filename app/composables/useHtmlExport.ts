import { buildStandaloneHtml, uint8ToBase64, type ExportAssets } from '~/utils/export-html'
import { cachedAsync } from '~/utils/cached-async'

/**
 * Export the compiled story as a single self-contained, offline-playable
 * HTML file — the no-hosting "publish" (upload it to itch.io / any static
 * host, or double-click it locally). Assets come from our own vendored
 * /play/web/ files (same-origin fetch, ~330 KB, cached after the first
 * export); assembly is the pure buildStandaloneHtml (unit-tested).
 */

const getAssets = cachedAsync(async (): Promise<ExportAssets> => {
  const text = async (path: string) => {
    const r = await fetch(path)
    if (!r.ok) throw new Error(`Could not fetch ${path} (${r.status})`)
    return r.text()
  }
  const bytes = async (path: string) => {
    const r = await fetch(path)
    if (!r.ok) throw new Error(`Could not fetch ${path} (${r.status})`)
    return new Uint8Array(await r.arrayBuffer())
  }
  const [jquery, main, zvm, css, ieJs, gif] = await Promise.all([
    text('/play/web/jquery.min.js'),
    text('/play/web/main.js'),
    text('/play/web/zvm.js'),
    text('/play/web/web.css'),
    text('/play/web/ie.js'),
    bytes('/play/web/waiting.gif'),
  ])
  return { jquery, main, zvm, css, ieJs, waitingGifBase64: uint8ToBase64(gif) }
})

export function useHtmlExport() {
  const { result, storyTitle, storyBase } = useIde()
  const exporting = ref(false)

  /** Build and download `<storyBase>.html`. Returns false when it couldn't. */
  async function exportHtml(): Promise<boolean> {
    const r = result.value
    if (!r?.storyFile || exporting.value) return false
    exporting.value = true
    try {
      const assets = await getAssets()
      const html = buildStandaloneHtml({
        title: storyTitle.value || 'Interactive Fiction',
        storyBase64: uint8ToBase64(r.storyFile),
        storyExt: r.storyExt,
        assets,
      })
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${storyBase.value}.html`
      a.click()
      URL.revokeObjectURL(url)
      return true
    } catch (err: unknown) {
      useToast().add({
        title: 'HTML export failed',
        description: String(err),
        color: 'error',
        icon: 'i-lucide-file-x',
      })
      return false
    } finally {
      exporting.value = false
    }
  }

  return { exportHtml, exporting }
}
