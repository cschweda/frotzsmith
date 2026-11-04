import { describe, expect, it } from 'vitest'
import { parseManifest, serializeManifest, sha256 } from './manifest'

const enc = new TextEncoder()
const base = { format: 'frotzsmith-package', version: '0.1', language: 'i6', main: 'g.inf' }

describe('parseManifest', () => {
  it('applies defaults', () => {
    expect(parseManifest(enc.encode(JSON.stringify(base)))).toMatchObject({
      language: 'i6', main: 'g.inf', target: 'auto', extensions: [], tests: [], extra: {},
    })
  })

  it('ignores library for ZIL but keeps it as an unknown field', () => {
    const p = parseManifest(enc.encode(JSON.stringify({ ...base, language: 'zil', main: 'g.zil', library: 'puny' })))
    expect(p.library).toBeUndefined()
    expect(p.extra).toEqual({ library: 'puny' })
  })

  it('keeps unknown fields and the reserved libraryOverrides', () => {
    const p = parseManifest(enc.encode(JSON.stringify({ ...base, libraryOverrides: { a: 1 }, 'com.x.y': [1] })))
    expect(p.extra).toEqual({ libraryOverrides: { a: 1 }, 'com.x.y': [1] })
  })
})

describe('serializeManifest', () => {
  it('writes known fields first, then extras, and lets extras never override known ones', () => {
    const out = new TextDecoder().decode(serializeManifest({ format: 'f', main: 'm' }, { main: 'evil', z: 1 }))
    expect(Object.keys(JSON.parse(out))).toEqual(['format', 'main', 'z'])
    expect(JSON.parse(out).main).toBe('m')
  })
})

describe('sha256', () => {
  it('formats as sha256:<64 hex>', async () => {
    expect(await sha256(enc.encode('abc'))).toBe('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('parseManifest: nesting depth (spec §12)', () => {
  const nest = (n: number) => '['.repeat(n) + ']'.repeat(n)
  const withExtra = (json: string) => enc.encode(JSON.stringify(base).slice(0, -1) + `,"x":${json}}`)

  it('refuses a 200,000-deep array with one sentence', () => {
    expect(() => parseManifest(withExtra(nest(200_000)))).toThrow(
      "This project's manifest (frotzsmith.json) is nested too deeply.",
    )
  })
  it('refuses depth 65 (the manifest object is depth 1)', () => {
    expect(() => parseManifest(withExtra(nest(64)))).toThrow(/nested too deeply/)
  })
  it('accepts depth 64', () => {
    expect(parseManifest(withExtra(nest(63))).extra.x).toBeDefined()
  })
  it('counts objects too', () => {
    const deepObj = '{"a":'.repeat(70) + '1' + '}'.repeat(70)
    expect(() => parseManifest(withExtra(deepObj))).toThrow(/nested too deeply/)
  })
})
