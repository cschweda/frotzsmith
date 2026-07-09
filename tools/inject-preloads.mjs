/**
 * inject-preloads — postgenerate step (see package.json).
 *
 * ssr:false ships an empty HTML shell, so the browser discovers each route's
 * chunks serially: entry → route resolve → page chunk → IDE chunk. That
 * waterfall IS the LCP bottleneck once payloads are trimmed. This script reads
 * the client manifest dumped by the `build:manifest` hook (nuxt.config.ts →
 * .nuxt/client-manifest.json) and injects <link rel="modulepreload"> hints for
 * every route's page chunk + transitive static imports into the generated
 * HTML, so all of it downloads in parallel from the first byte.
 *
 * Fails loudly (non-zero exit) if the manifest or a page key is missing —
 * a silent skip would quietly bring the waterfall back.
 *
 * Pure helpers (collectChunks / injectPreloads) are unit-tested in
 * inject-preloads.test.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Walk a page's transitive static imports through the manifest.
 * Skips the app entry chunk (and its chain) — the HTML already loads it.
 * @returns {{ js: string[], css: string[] }} emitted file names, page first.
 */
export function collectChunks(manifest, pageKey) {
  if (!manifest[pageKey]) throw new Error(`inject-preloads: "${pageKey}" not in the client manifest — was the page renamed?`)
  const js = []
  const css = []
  const seen = new Set()
  const visit = (key) => {
    if (seen.has(key)) return
    seen.add(key)
    const node = manifest[key]
    if (!node || node.isEntry) return // entry (and anything unknown) is already handled by the shell
    if (node.file) js.push(node.file)
    for (const c of node.css ?? []) if (!css.includes(c)) css.push(c)
    for (const imp of node.imports ?? []) visit(imp)
  }
  visit(pageKey)
  return { js, css }
}

/**
 * Insert preload links before </head>. Idempotent: hrefs already present in
 * the document (including Nuxt's own entry modulepreload) are skipped.
 */
export function injectPreloads(html, { js, css }) {
  const marker = '</head>'
  if (!html.includes(marker)) throw new Error('inject-preloads: no </head> marker in the HTML')
  const links = []
  for (const file of js) {
    if (html.includes(`/_nuxt/${file}`)) continue
    links.push(`<link rel="modulepreload" crossorigin href="/_nuxt/${file}">`)
  }
  for (const file of css) {
    if (html.includes(`/_nuxt/${file}`)) continue
    links.push(`<link rel="preload" as="style" href="/_nuxt/${file}">`)
  }
  if (!links.length) return html
  return html.replace(marker, `${links.join('')}${marker}`)
}

/**
 * Where did this generate write the site? Nitro's Netlify preset emits to
 * dist/ (what netlify.toml publishes); the local/CI static preset emits to
 * .output/public (locally dist is a convenience symlink to it, which on CI
 * is broken — an absolute macOS path). Probe for index.html rather than the
 * directory so a dangling symlink doesn't fool the check.
 */
export function resolveOutDir(root, exists = existsSync) {
  for (const dir of ['dist', '.output/public']) {
    if (exists(`${resolve(root, dir)}/index.html`)) return resolve(root, dir)
  }
  throw new Error('inject-preloads: no generated output found (looked in dist/ and .output/public/)')
}

// ─── runner ───────────────────────────────────────────────────────────────
// Route table: generated HTML file → its page component's manifest key.
const ROUTES = {
  'index.html': 'pages/index.vue',
  'zil/index.html': 'pages/zil.vue',
  'technical/index.html': 'pages/technical.vue',
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMain) {
  const root = process.cwd()
  const outDir = resolveOutDir(root)
  const manifest = JSON.parse(readFileSync(resolve(root, '.nuxt/client-manifest.json'), 'utf8'))
  for (const [htmlPath, pageKey] of Object.entries(ROUTES)) {
    const abs = resolve(outDir, htmlPath)
    const html = readFileSync(abs, 'utf8')
    const chunks = collectChunks(manifest, pageKey)
    const out = injectPreloads(html, chunks)
    writeFileSync(abs, out)
    const injected = out === html ? 0 : chunks.js.length + chunks.css.length
    console.log(`inject-preloads: ${htmlPath} ← ${chunks.js.length} js + ${chunks.css.length} css (${injected ? 'injected' : 'already present'})`)
  }
}
