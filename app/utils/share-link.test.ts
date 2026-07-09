/**
 * share-link — zero-backend source sharing via the URL FRAGMENT (node env).
 * The fragment never reaches any server (or ours — there isn't one): the
 * source is deflated (fflate, already a dependency) and base64url-encoded
 * into `#src=…&lang=…`, TypeScript-playground style.
 */
import { describe, it, expect } from 'vitest'
import { encodeShareFragment, decodeShareFragment, SHARE_FRAGMENT_MAX_CHARS } from './share-link'

const I6_SOURCE = `Constant Story "SHARED";
Include "Parser";
Include "VerbLib";
[ Initialise; location = Room; ];
Object Room "Room" with description "A room.", has light;
Include "Grammar";
`

describe('encode/decode roundtrip', () => {
  it('roundtrips an Inform 6 source', () => {
    const frag = encodeShareFragment(I6_SOURCE, 'i6')
    expect(frag).toMatch(/^src=[A-Za-z0-9_-]+&lang=i6$/) // base64url, no +/=
    expect(decodeShareFragment(frag!)).toEqual({ source: I6_SOURCE, lang: 'i6' })
  })

  it('roundtrips ZIL with unicode content', () => {
    const src = '<CONSTANT GAME-BANNER "Über—Häuser|→ test">'
    const frag = encodeShareFragment(src, 'zil')
    expect(decodeShareFragment(frag!)).toEqual({ source: src, lang: 'zil' })
  })

  it('accepts a leading # on decode (location.hash shape)', () => {
    const frag = encodeShareFragment(I6_SOURCE, 'i6')
    expect(decodeShareFragment(`#${frag}`)?.source).toBe(I6_SOURCE)
  })

  it('compresses: a repetitive source encodes far smaller than raw', () => {
    const src = 'Include "Parser";\n'.repeat(200)
    const frag = encodeShareFragment(src, 'i6')
    expect(frag!.length).toBeLessThan(src.length / 4)
  })
})

describe('limits', () => {
  it('returns null when the fragment would exceed the cap (caller shows a toast)', () => {
    // Deterministic xorshift noise — genuinely incompressible, so the encoded
    // fragment must exceed the cap (a periodic pattern would deflate away).
    let x = 0x9e3779b9
    let noise = ''
    for (let i = 0; i < SHARE_FRAGMENT_MAX_CHARS * 2; i++) {
      x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0
      noise += String.fromCharCode(32 + (x % 90))
    }
    expect(encodeShareFragment(noise, 'i6')).toBeNull()
  })
})

describe('decode is tolerant — never throws on hostile fragments', () => {
  for (const bad of [
    '',
    '#',
    '#other=thing',
    'src=&lang=i6',
    'src=%%%%&lang=i6',
    'src=not!valid!b64&lang=i6',
    `src=${'A'.repeat(50)}&lang=i6`, // valid b64url, not valid deflate
    'src=eJwr&lang=py', // unknown lang
  ]) {
    it(`returns null for ${JSON.stringify(bad.slice(0, 30))}`, () => {
      expect(decodeShareFragment(bad)).toBeNull()
    })
  }
})
