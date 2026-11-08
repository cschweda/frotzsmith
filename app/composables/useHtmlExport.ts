import { buildStandaloneHtml, uint8ToBase64, type ExportAssets } from '~/utils/export-html'
import { cachedAsync } from '~/utils/cached-async'

/**
 * Export the compiled story to play outside frotzsmith (upload it to itch.io /
 * any static host, or double-click it locally).
 *
 * Export playable HTML: one self-contained file, in the player the Play tab uses:
 *
 * - frotzplay (the default): `bundle()` from @frotzinc/player — the
 *   <frotz-play> element and the story in one file under its own hash-based
 *   CSP (`default-src 'none'`), about 150 KB plus the story. The element's
 *   script is a lazily-loaded chunk of this app (so it works offline too).
 * - Parchment: our own vendored /play/web/ files (same-origin fetch, ~330 KB,
 *   cached after the first export); assembly is the pure buildStandaloneHtml
 *   (unit-tested).
 *
 * Export folder (.zip): always frotzplay's `bundleFolder()` + `zip()` —
 * index.html, boot.js, frotzplay.js, frotzplay.css, story.js, story.<ext> and README.txt
 * in a folder named after the story. index.html still plays from a double-click
 * (story.js carries the story), and the folder is what itch.io's HTML upload
 * expects. Parchment has no folder build.
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

const loadPlayer = () =>
  Promise.all([import('@frotzinc/player'), import('@frotzinc/player/frotz-play.js?raw')])

/** frotzplay's single file (frotzlens docs/16 §5). */
async function frotzplayHtml(story: Uint8Array, title: string, ext: string): Promise<string> {
  const [{ bundle }, element] = await loadPlayer()
  const { html } = await bundle(story, { title, storyName: `story.${ext}`, elementJs: element.default })
  return html
}

/** frotzplay's folder, zipped inside a folder named `folder` (frotzlens docs/16 §5). */
export async function frotzplayFolderZip(
  story: Uint8Array,
  title: string,
  ext: string,
  folder: string,
): Promise<Uint8Array> {
  const [{ bundleFolder, zip }, element] = await loadPlayer()
  return zip(bundleFolder(story, { title, storyName: `story.${ext}`, elementJs: element.default }), folder)
}

function download(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  // Revoking synchronously can cancel the download in some Safari/Firefox builds.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
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
      download(html, `${storyBase.value}.html`, 'text/html')
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

  /** Build and download `<storyBase>.zip` (frotzplay's folder). Returns false when it couldn't. */
  async function exportFolder(): Promise<boolean> {
    const r = result.value
    if (!r?.storyFile || exporting.value) return false
    exporting.value = true
    try {
      const title = storyTitle.value || 'Interactive Fiction'
      const data = await frotzplayFolderZip(new Uint8Array(r.storyFile), title, r.storyExt, storyBase.value)
      download(data as BlobPart, `${storyBase.value}.zip`, 'application/zip')
      return true
    } catch (err: unknown) {
      useToast().add({
        title: 'Folder export failed',
        description: String(err),
        color: 'error',
        icon: 'i-lucide-folder-x',
      })
      return false
    } finally {
      exporting.value = false
    }
  }

  return { exportHtml, exportFolder, exporting }
}
