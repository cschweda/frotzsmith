/**
 * inject-preloads — pure-core tests (node env).
 *
 * The runner half of tools/inject-preloads.mjs (fs + route table) is exercised
 * by the postgenerate step itself; these tests pin the manifest walk and the
 * HTML injection, which is where a silent regression would quietly bring the
 * LCP waterfall back.
 */
import { describe, it, expect } from 'vitest'
import { collectChunks, injectPreloads, resolveOutDir } from './inject-preloads.mjs'

// Shaped like Nuxt's build:manifest payload: keys are module ids, `imports`
// are keys, `file`/`css` are emitted names.
const MANIFEST = {
  '../node_modules/nuxt/dist/app/entry.js': {
    file: 'ENTRY.js',
    isEntry: true,
    imports: ['_runtime.js'],
    css: ['entry.css'],
  },
  '_runtime.js': { file: 'runtime.js' },
  'pages/index.vue': {
    file: 'page-index.js',
    isDynamicEntry: true,
    imports: ['_ide.js', '../node_modules/nuxt/dist/app/entry.js', '_shared.js'],
  },
  '_ide.js': {
    file: 'ide.js',
    imports: ['_shared.js'],
    css: ['IdeLayout.css'],
  },
  '_shared.js': { file: 'shared.js' },
}

describe('collectChunks', () => {
  it('walks transitive imports from the page and dedups shared chunks', () => {
    const { js } = collectChunks(MANIFEST, 'pages/index.vue')
    expect(js).toEqual(['page-index.js', 'ide.js', 'shared.js'])
  })

  it('skips the app entry (already script-loaded) and its own import chain', () => {
    const { js } = collectChunks(MANIFEST, 'pages/index.vue')
    expect(js).not.toContain('ENTRY.js')
    expect(js).not.toContain('runtime.js')
  })

  it('gathers css from every visited chunk', () => {
    const { css } = collectChunks(MANIFEST, 'pages/index.vue')
    expect(css).toEqual(['IdeLayout.css'])
  })

  it('throws loudly for an unknown page key (a rename must fail the build)', () => {
    expect(() => collectChunks(MANIFEST, 'pages/renamed.vue')).toThrow(/pages\/renamed\.vue/)
  })
})

describe('injectPreloads', () => {
  const HTML = '<html><head><link rel="modulepreload" href="/_nuxt/ENTRY.js"></head><body></body></html>'

  it('inserts modulepreload links for js and preload-as-style for css before </head>', () => {
    const out = injectPreloads(HTML, { js: ['page-index.js', 'ide.js'], css: ['IdeLayout.css'] })
    expect(out).toContain('<link rel="modulepreload" crossorigin href="/_nuxt/page-index.js">')
    expect(out).toContain('<link rel="modulepreload" crossorigin href="/_nuxt/ide.js">')
    expect(out).toContain('<link rel="preload" as="style" href="/_nuxt/IdeLayout.css">')
    expect(out.indexOf('page-index.js')).toBeLessThan(out.indexOf('</head>'))
  })

  it('is idempotent — an href already present is not injected twice', () => {
    const once = injectPreloads(HTML, { js: ['page-index.js'], css: [] })
    const twice = injectPreloads(once, { js: ['page-index.js'], css: [] })
    expect(twice.match(/page-index\.js/g)).toHaveLength(1)
    // The Nuxt-emitted entry preload also counts as already present.
    expect(injectPreloads(HTML, { js: ['ENTRY.js'], css: [] })).toBe(HTML)
  })

  it('throws when the html has no </head> marker', () => {
    expect(() => injectPreloads('<html><body></body></html>', { js: ['x.js'], css: [] })).toThrow(/head/)
  })
})

describe('resolveOutDir', () => {
  // Nitro's Netlify preset writes the site to dist/ (netlify.toml publishes
  // it); the local/CI static preset writes .output/public. The injector must
  // patch whichever actually exists, or production quietly loses the hints.
  it('prefers dist/ when its index.html exists (Netlify preset)', () => {
    expect(resolveOutDir('/r', p => p === '/r/dist/index.html')).toBe('/r/dist')
  })

  it('falls back to .output/public (static preset; broken dist symlink on CI)', () => {
    expect(resolveOutDir('/r', p => p === '/r/.output/public/index.html')).toBe('/r/.output/public')
  })

  it('throws when neither output exists', () => {
    expect(() => resolveOutDir('/r', () => false)).toThrow(/output/)
  })
})
