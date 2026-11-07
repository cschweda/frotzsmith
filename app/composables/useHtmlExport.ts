import { buildStandaloneHtml, uint8ToBase64, type ExportAssets } from '~/utils/export-html'
import { cachedAsync } from '~/utils/cached-async'

/**
 * Export the compiled story as a single self-contained, offline-playable
 * HTML file — the no-hosting "publish" (upload it to itch.io / any static
 * host, or double-click it locally), in the player the Play tab uses:
 *
 * - frotzplay (the default): `bundle()` from @frotzinc/player — the
 *   <frotz-play> element and the story in one file under its own hash-based
 *   CSP (`default-src 'none'`), about 150 KB plus the story. The element's
 *   script is a lazily-loaded chunk of this app (so it works offline too).
 * - Parchment: our own vendored /play/web/ files (same-origin fetch, ~330 KB,
 *   cached after the first export); assembly is the pure buildStandaloneHtml
 *   (unit-tested).
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

/** frotzplay's single file (frotzlens docs/16 §5). */
async function frotzplayHtml(story: Uint8Array, title: string, ext: string): Promise<string> {
  const [{ bundle }, element] = await Promise.all([
    import('@frotzinc/player'),
    import('@frotzinc/player/frotz-play.js?raw'),
  ])
  const { html } = await bundle(story, { title, storyName: `story.${ext}`, elementJs: element.default })
  return html
}

export function useHtmlExport() {
  const { result, storyTitle, storyBase } = useIde()
  const { player } = usePlayerChoice()
  const exporting = ref(false)

  /** Build and download `<storyBase>.html`. Returns false when it couldn't. */
  async function exportHtml(): Promise<boolean> {
    const r = result.value
    if (!r?.storyFile || exporting.value) return false
    exporting.value = true
    try {
      const title = storyTitle.value || 'Interactive Fiction'
      const html =
        player.value === 'frotzplay'
          ? await frotzplayHtml(new Uint8Array(r.storyFile), title, r.storyExt)
          : buildStandaloneHtml({
              title,
              storyBase64: uint8ToBase64(r.storyFile),
              storyExt: r.storyExt,
              assets: await getAssets(),
            })
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${storyBase.value}.html`
      a.click()
      // Revoking synchronously can cancel the download in some Safari/Firefox builds.
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
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
