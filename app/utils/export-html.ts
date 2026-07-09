/**
 * Build a self-contained, offline-playable HTML file for a compiled story —
 * the no-hosting "publish": authors upload the single file to itch.io,
 * Neocities, or any static host (or just double-click it locally).
 *
 * How it stays a single file (mirrors public/play/index.html, which this
 * template is derived from):
 * - jquery / web.css / Parchment's main.js are inlined;
 * - Parchment loads Z-machine engines via `import("./zvm.js")` — an import
 *   map rewrites that specifier to a data: URI of the inlined interpreter;
 * - the story rides as a base64 data: URL tagged `#game.zN`, the same
 *   fragment trick the IDE's blob URLs use so format detection works;
 * - the IDE-only postMessage hooks (transcript/auto-map capture) are omitted.
 *
 * Pure string assembly — unit-tested in export-html.test.ts; the caller
 * (useHtmlExport) fetches the real /play/web/ assets and triggers download.
 */
import type { StoryExt } from '~/modules/inform6/types'

export interface ExportAssets {
  jquery: string
  main: string
  zvm: string
  css: string
  ieJs: string
  waitingGifBase64: string
}

export interface ExportOptions {
  title: string
  storyBase64: string
  storyExt: StoryExt
  assets: ExportAssets
}

/** Browser+node-safe Uint8Array → base64 (chunked; btoa can't take huge args). */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/** base64 of a string's UTF-8 bytes — plain btoa throws on non-Latin-1
 *  (the real zvm.js contains Unicode ZSCII tables). */
function utf8ToBase64(s: string): string {
  return uint8ToBase64(new TextEncoder().encode(s))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A raw `</script` inside inlined JS would truncate its <script> element. */
function escapeInlineScript(src: string): string {
  return src.replace(/<\/script/gi, '<\\/script')
}

export function buildStandaloneHtml(opts: ExportOptions): string {
  const { title, storyBase64, storyExt, assets } = opts
  const storyUrl = `data:application/octet-stream;base64,${storyBase64}#game.${storyExt}`
  const zvmDataUri = `data:text/javascript;base64,${utf8ToBase64(assets.zvm)}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1.0,minimum-scale=1.0">
<style>
${assets.css}
/* Frotzsmith export: parchment tint, edge-to-edge. */
:root {
  --glkote-buffer-bg: #f5f1e8; --glkote-buffer-fg: #2a2622;
  --glkote-grid-bg: #efe9da;   --glkote-grid-fg: #2a2622;
}
html, body { height: 100%; background: #e7e2d6; }
#gameport { max-width: none !important; }
.WindowFrame, .BufferWindow { background-color: #f5f1e8 !important; }
.BufferWindow { color: #2a2622 !important; }
</style>
<script>${escapeInlineScript(assets.jquery)}</script>
<script nomodule>${escapeInlineScript(assets.ieJs)}</script>
<script type="importmap">
{ "imports": { "./zvm.js": "${zvmDataUri}" } }
</script>
<script>
  // Parchment reads this global. lib_path is unused for .js engines (the
  // import map supplies the interpreter); the story is embedded below.
  parchment_options = { default_story: ['${storyUrl}'], lib_path: '' };
</script>
<script type="module">${escapeInlineScript(assets.main)}</script>
</head>
<body>
<div id="gameport">
  <div id="windowport"></div>
  <div id="loadingpane" style="display:none;"><img src="data:image/gif;base64,${assets.waitingGifBase64}" alt="Loading"><br><em>&nbsp;&nbsp;&nbsp;Loading…</em></div>
  <div id="errorpane" style="display:none;"><div id="errorcontent">...</div></div>
</div>
</body>
</html>
`
}
