/**
 * export-html — pure builder for the self-contained playable HTML bundle
 * (node env). The exported file must work from file:// or any static host:
 * all assets inline, the interpreter supplied to Parchment's
 * `import("./zvm.js")` via an import map → data: URI, and the story as a
 * base64 data: URL tagged `#game.zN` (the same fragment trick the IDE's blob
 * URLs use for format detection).
 */
import { describe, it, expect } from 'vitest'
import { buildStandaloneHtml } from './export-html'

const ASSETS = {
  jquery: 'window.$=function(){/*jq*/}',
  main: 'console.log("main")//uses import("./zvm.js")',
  zvm: 'console.log("zvm")',
  css: '.BufferWindow{color:#000}',
  ieJs: 'alert("old browser")',
  waitingGifBase64: 'R0lGODlh',
}

function build(overrides: Partial<Parameters<typeof buildStandaloneHtml>[0]> = {}) {
  return buildStandaloneHtml({
    title: 'Cloak of Darkness',
    storyBase64: 'AAECAw==',
    storyExt: 'z5',
    assets: ASSETS,
    ...overrides,
  })
}

describe('buildStandaloneHtml', () => {
  it('inlines every asset — no external URLs beyond data:', () => {
    const html = build()
    expect(html).toContain('window.$=function')
    expect(html).toContain('console.log("main")')
    expect(html).toContain('.BufferWindow{color:#000}')
    // Nothing may reference the web/ directory at runtime.
    expect(html).not.toMatch(/src="web\//)
    expect(html).not.toMatch(/href="web\//)
  })

  it('maps ./zvm.js to a data: URI via an import map placed before the module script', () => {
    const html = build()
    const importmap = html.indexOf('<script type="importmap">')
    const module = html.indexOf('<script type="module">')
    expect(importmap).toBeGreaterThan(-1)
    expect(module).toBeGreaterThan(importmap)
    expect(html).toContain(`"./zvm.js": "data:text/javascript;base64,${btoa(ASSETS.zvm)}"`)
  })

  it('base64-encodes a zvm containing non-Latin-1 characters as UTF-8 (btoa alone throws)', () => {
    // The real vendored zvm.js contains Unicode (ZSCII tables); a plain
    // btoa(source) throws InvalidCharacterError — caught by the first live
    // export smoke test.
    const zvm = 'const arrow = "→"; const zscii = "äöü"'
    const html = build({ assets: { ...ASSETS, zvm } })
    const expected = Buffer.from(zvm, 'utf8').toString('base64') // independent oracle
    expect(html).toContain(`data:text/javascript;base64,${expected}`)
  })

  it('hands the story to Parchment as a base64 data: URL tagged with the format fragment', () => {
    const html = build({ storyExt: 'z8' })
    expect(html).toContain('data:application/octet-stream;base64,AAECAw==#game.z8')
  })

  it('escapes </script> sequences in inlined sources (jquery contains them)', () => {
    const html = build({ assets: { ...ASSETS, jquery: 'var s="</script><b>"' } })
    expect(html).not.toContain('"</script><b>"') // raw close-tag would truncate the script
    expect(html).toContain('"<\\/script><b>"')
  })

  it('HTML-escapes the title', () => {
    const html = build({ title: 'Bad <Title> & "Co"' })
    expect(html).toContain('<title>Bad &lt;Title&gt; &amp; &quot;Co&quot;</title>')
    expect(html).not.toContain('<title>Bad <Title>')
  })

  it('strips the IDE-only postMessage hooks (no frotzsmith-play channel in exports)', () => {
    expect(build()).not.toContain('frotzsmith-play')
  })
})
