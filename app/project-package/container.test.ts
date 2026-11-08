import { describe, expect, test } from 'vitest'
import { crc32 } from 'node:zlib'
import { deflateSync, unzipSync, zipSync } from 'fflate'
import { LIMITS, MIMETYPE, readContainer, writeContainer } from './container'
import { PackageError } from './errors'

// ---------------------------------------------------------------------------
// A tiny raw-zip builder, independent of the code under test, so hostile
// archives can be crafted field by field. Every field of the local header,
// central-directory entry, data descriptor and EOCD can be overridden.
// ---------------------------------------------------------------------------

const enc = new TextEncoder()
const MiB = 1024 * 1024

interface Header {
  name: Uint8Array
  method: number
  flags: number
  crc: number
  csize: number
  usize: number
  extra: Uint8Array
}

interface RawEntry extends Header {
  /** The bytes written after the local header (already compressed). */
  payload: Uint8Array
  versionMadeBy: number
  externalAttrs: number
  diskStart: number
  /** Overrides for the local header only (to make it disagree with the central entry). */
  local?: Partial<Header>
  /** Written after the payload when set. */
  descriptor?: { signature: boolean; crc: number; csize: number; usize: number }
  /** Force the central directory's local-header offset. */
  offset?: number
  /** List it in the central directory without writing a local header + data. */
  centralOnly?: boolean
}

interface EocdOverrides {
  disk?: number
  cdDisk?: number
  countDisk?: number
  count?: number
  cdSize?: number
  cdOffset?: number
  comment?: Uint8Array
  commentLength?: number
}

interface BuildOptions {
  prefix?: Uint8Array
  /** Bytes between the last local entry and the central directory. */
  gap?: Uint8Array
  eocd?: EocdOverrides
  trailing?: Uint8Array
}

function nameBytes(n: string | Uint8Array): Uint8Array {
  return typeof n === 'string' ? enc.encode(n) : n
}

function stored(name: string | Uint8Array, data: Uint8Array | string, o: Partial<RawEntry> = {}): RawEntry {
  const bytes = typeof data === 'string' ? enc.encode(data) : data
  return {
    name: nameBytes(name),
    method: 0,
    flags: 0x0800,
    crc: crc32(bytes) >>> 0,
    csize: bytes.length,
    usize: bytes.length,
    extra: new Uint8Array(0),
    payload: bytes,
    versionMadeBy: (3 << 8) | 20,
    externalAttrs: (0o100644 << 16) >>> 0,
    diskStart: 0,
    ...o,
  }
}

function deflated(name: string | Uint8Array, data: Uint8Array | string, o: Partial<RawEntry> = {}): RawEntry {
  const bytes = typeof data === 'string' ? enc.encode(data) : data
  const payload = deflateSync(bytes)
  return stored(name, bytes, { method: 8, csize: payload.length, payload, ...o })
}

const mimetypeEntry = (o: Partial<RawEntry> = {}) => stored('mimetype', MIMETYPE, o)

class Out {
  parts: number[] = []
  u8(v: number) { this.parts.push(v & 0xff) }
  u16(v: number) { this.u8(v); this.u8(v >>> 8) }
  u32(v: number) { this.u16(v & 0xffff); this.u16((v >>> 16) & 0xffff) }
  bytes(b: Uint8Array) { for (const x of b) this.parts.push(x) }
  get length() { return this.parts.length }
  done() { return Uint8Array.from(this.parts) }
}

function writeLocal(out: Out, e: RawEntry) {
  const l = { ...e, ...e.local }
  out.u32(0x04034b50)
  out.u16(20)
  out.u16(l.flags)
  out.u16(l.method)
  out.u16(0) // time
  out.u16(0x21) // date 1980-01-01
  out.u32(l.crc)
  out.u32(l.csize)
  out.u32(l.usize)
  out.u16(l.name.length)
  out.u16(l.extra.length)
  out.bytes(l.name)
  out.bytes(l.extra)
  out.bytes(e.payload)
  if (e.descriptor) {
    if (e.descriptor.signature) out.u32(0x08074b50)
    out.u32(e.descriptor.crc)
    out.u32(e.descriptor.csize)
    out.u32(e.descriptor.usize)
  }
}

function buildZip(entries: RawEntry[], opts: BuildOptions = {}): Uint8Array {
  const out = new Out()
  if (opts.prefix) out.bytes(opts.prefix)
  const offsets: number[] = []
  for (const e of entries) {
    offsets.push(out.length)
    if (!e.centralOnly) writeLocal(out, e)
  }
  if (opts.gap) out.bytes(opts.gap)
  const cdOffset = out.length
  entries.forEach((e, i) => {
    out.u32(0x02014b50)
    out.u16(e.versionMadeBy)
    out.u16(20)
    out.u16(e.flags)
    out.u16(e.method)
    out.u16(0)
    out.u16(0x21)
    out.u32(e.crc)
    out.u32(e.csize)
    out.u32(e.usize)
    out.u16(e.name.length)
    out.u16(e.extra.length)
    out.u16(0) // comment length
    out.u16(e.diskStart)
    out.u16(0) // internal attrs
    out.u32(e.externalAttrs)
    out.u32(e.offset ?? offsets[i]!)
    out.bytes(e.name)
    out.bytes(e.extra)
  })
  const cdSize = out.length - cdOffset
  const x = opts.eocd ?? {}
  const comment = x.comment ?? new Uint8Array(0)
  out.u32(0x06054b50)
  out.u16(x.disk ?? 0)
  out.u16(x.cdDisk ?? 0)
  out.u16(x.countDisk ?? x.count ?? entries.length)
  out.u16(x.count ?? entries.length)
  out.u32(x.cdSize ?? cdSize)
  out.u32(x.cdOffset ?? cdOffset)
  out.u16(x.commentLength ?? comment.length)
  out.bytes(comment)
  if (opts.trailing) out.bytes(opts.trailing)
  return out.done()
}

/** A minimal valid package: mimetype + one deflated file. */
function validEntries(): RawEntry[] {
  return [mimetypeEntry(), deflated('story.inf', 'Constant Story "Hi";\n')]
}

function refusal(bytes: Uint8Array): PackageError {
  try {
    readContainer(bytes)
  } catch (e) {
    expect(e).toBeInstanceOf(PackageError)
    return e as PackageError
  }
  throw new Error('expected readContainer to refuse the archive')
}

function expectRefused(bytes: Uint8Array, code: string) {
  const e = refusal(bytes)
  expect(e.code).toBe(code)
  // One plain sentence, no raw bytes / control characters.
  expect(e.message).toMatch(/^[A-Z].*[.]$/)
  expect(e.message).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/)
  return e
}

// ---------------------------------------------------------------------------

describe('constants', () => {
  test('mimetype and limits', () => {
    expect(MIMETYPE).toBe('application/vnd.frotzsmith.package+zip')
    expect(LIMITS).toEqual({
      archiveBytes: 32 * MiB,
      entries: 2000,
      entryBytes: 8 * MiB,
      totalBytes: 32 * MiB,
      ratio: 200,
    })
  })
})

describe('the builder itself', () => {
  test('produces archives fflate can read (sanity check of the fixtures)', () => {
    const files = unzipSync(buildZip(validEntries()))
    expect(new TextDecoder().decode(files['mimetype'])).toBe(MIMETYPE)
    expect(new TextDecoder().decode(files['story.inf'])).toBe('Constant Story "Hi";\n')
  })
})

describe('writeContainer', () => {
  const entries = [
    { path: 'frotzsmith.json', bytes: enc.encode('{"format":"frotzsmith-package"}') },
    { path: 'story.inf', bytes: enc.encode('Constant Story "Hi";\n'.repeat(50)) },
    { path: 'tests/walk.txt', bytes: enc.encode('look\nnorth\n') },
    { path: 'café/ünïcode.h', bytes: enc.encode('! hi') },
    { path: 'empty.txt', bytes: new Uint8Array(0) },
    { path: 'binary.bin', bytes: Uint8Array.from({ length: 300 }, (_, i) => (i * 7919) & 0xff) },
  ]

  test('round-trips through readContainer', () => {
    const map = readContainer(writeContainer(entries))
    expect([...map.keys()].sort()).toEqual(entries.map((e) => e.path).sort())
    for (const e of entries) expect(map.get(e.path)).toEqual(e.bytes)
    expect(map.has('mimetype')).toBe(false)
  })

  test('is readable by a general-purpose unzipper', () => {
    const files = unzipSync(writeContainer(entries))
    expect(new TextDecoder().decode(files['mimetype'])).toBe(MIMETYPE)
    for (const e of entries) expect(files[e.path]).toEqual(e.bytes)
  })

  test('writes mimetype first, stored, with no extra field, and sets bit 11 everywhere', () => {
    const z = writeContainer(entries)
    const dv = new DataView(z.buffer, z.byteOffset, z.byteLength)
    expect(dv.getUint32(0, true)).toBe(0x04034b50)
    expect(dv.getUint16(6, true) & 0x0800).toBe(0x0800) // flags
    expect(dv.getUint16(8, true)).toBe(0) // stored
    expect(dv.getUint16(26, true)).toBe(8) // name length
    expect(dv.getUint16(28, true)).toBe(0) // extra length
    expect(new TextDecoder().decode(z.subarray(30, 38))).toBe('mimetype')
    // The recognisable first bytes, as EPUB does.
    expect(new TextDecoder().decode(z.subarray(38, 38 + MIMETYPE.length))).toBe(MIMETYPE)

    // Walk the central directory: every entry has bit 11; text is deflated.
    const eocd = z.length - 22
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50)
    let p = dv.getUint32(eocd + 16, true)
    const methods: Record<string, number> = {}
    for (let i = 0; i < dv.getUint16(eocd + 10, true); i++) {
      expect(dv.getUint32(p, true)).toBe(0x02014b50)
      expect(dv.getUint16(p + 8, true) & 0x0800).toBe(0x0800)
      const nameLen = dv.getUint16(p + 28, true)
      const name = new TextDecoder().decode(z.subarray(p + 46, p + 46 + nameLen))
      methods[name] = dv.getUint16(p + 10, true)
      p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true)
    }
    expect(Object.keys(methods)[0]).toBe('mimetype')
    expect(methods['mimetype']).toBe(0)
    expect(methods['story.inf']).toBe(8)
    expect(methods['frotzsmith.json']).toBe(8)
  })

  test('is deterministic', () => {
    expect(writeContainer(entries)).toEqual(writeContainer(entries))
  })

  test('stores (rather than deflates) an entry that would exceed the ratio limit, so it can be reopened', () => {
    const spaces = new Uint8Array(2 * MiB).fill(0x20)
    const map = readContainer(writeContainer([{ path: 'big.inf', bytes: spaces }]))
    expect(map.get('big.inf')).toEqual(spaces)
  })

  test.each(['../x.h', '/abs.h', 'a\\b.h', 'a//b', 'a\u0000b', ''])('refuses the unsafe path %j', (p) => {
    expect(() => writeContainer([{ path: p, bytes: new Uint8Array(1) }])).toThrow(PackageError)
  })

  test('refuses case-insensitive duplicates (after NFC)', () => {
    expect(() =>
      writeContainer([
        { path: 'A.h', bytes: new Uint8Array(1) },
        { path: 'a.h', bytes: new Uint8Array(1) },
      ]),
    ).toThrow(PackageError)
    expect(() =>
      writeContainer([
        { path: 'Cafe\u0301.h', bytes: new Uint8Array(1) },
        { path: 'CAFÉ.h', bytes: new Uint8Array(1) },
      ]),
    ).toThrow(PackageError)
  })

  test('refuses a caller-supplied mimetype entry', () => {
    expect(() => writeContainer([{ path: 'MimeType', bytes: new Uint8Array(1) }])).toThrow(PackageError)
  })
})

describe('readContainer — accepts', () => {
  test('a crafted minimal package (stored and deflated entries)', () => {
    const map = readContainer(buildZip([...validEntries(), stored('notes.txt', 'plain')]))
    expect(new TextDecoder().decode(map.get('story.inf'))).toBe('Constant Story "Hi";\n')
    expect(new TextDecoder().decode(map.get('notes.txt'))).toBe('plain')
    expect(map.size).toBe(2)
  })

  test('empty directory entries, which are skipped', () => {
    const dir = stored('tests/', new Uint8Array(0), { externalAttrs: (0o040755 << 16) >>> 0 })
    const map = readContainer(buildZip([mimetypeEntry(), dir, deflated('tests/a.txt', 'x')]))
    expect([...map.keys()]).toEqual(['tests/a.txt'])
  })

  test('a deflated entry that uses a data descriptor (with and without its signature)', () => {
    for (const signature of [true, false]) {
      const e = deflated('story.inf', 'hello hello hello')
      const withDd = {
        ...e,
        flags: e.flags | 0x08,
        local: { crc: 0, csize: 0, usize: 0 },
        descriptor: { signature, crc: e.crc, csize: e.csize, usize: e.usize },
      }
      const map = readContainer(buildZip([mimetypeEntry(), withDd]))
      expect(new TextDecoder().decode(map.get('story.inf'))).toBe('hello hello hello')
    }
  })

  test('an archive written by fflate.zipSync with mimetype stored first', () => {
    const z = zipSync(
      { mimetype: [enc.encode(MIMETYPE), { level: 0 }], 'story.inf': enc.encode('x'.repeat(100)) },
      { level: 6 },
    )
    expect(new TextDecoder().decode(readContainer(z).get('story.inf'))).toBe('x'.repeat(100))
  })

  test('exactly 2,000 entries', () => {
    const many = [mimetypeEntry()]
    for (let i = 1; i < LIMITS.entries; i++) many.push(stored(`f${i}.txt`, 'x'))
    expect(readContainer(buildZip(many)).size).toBe(LIMITS.entries - 1)
  })

})

describe('readContainer — not a package', () => {
  const NOT = "That file isn't a frotzsmith project (.frotzsmith)."

  test('a plain zip with no mimetype', () => {
    const e = expectRefused(buildZip([deflated('story.inf', 'x'), stored('readme.txt', 'y')]), 'not-a-package')
    expect(e.message).toBe(NOT)
  })

  test('a plain zip made by a general-purpose zipper', () => {
    const e = refusal(zipSync({ 'story.inf': enc.encode('x') }))
    expect(e.message).toBe(NOT)
  })

  test.each([
    ['empty', new Uint8Array(0)],
    ['random bytes', Uint8Array.from({ length: 500 }, (_, i) => (i * 31) & 0xff)],
    ['text', enc.encode('Constant Story "Hi";')],
  ])('%s', (_l, bytes) => {
    expect(refusal(bytes).message).toBe(NOT)
  })

  test('mimetype present but not first', () => {
    const [m, s] = validEntries()
    expectRefused(buildZip([s!, m!]), 'not-a-package')
  })

  test('mimetype deflated', () => {
    expectRefused(buildZip([deflated('mimetype', MIMETYPE), deflated('story.inf', 'x')]), 'bad-mimetype')
  })

  test.each([
    ['trailing newline', `${MIMETYPE}\n`],
    ['another type', 'application/epub+zip'],
    ['upper case', MIMETYPE.toUpperCase()],
    ['empty', ''],
  ])('wrong mimetype text: %s', (_l, text) => {
    expectRefused(buildZip([stored('mimetype', text), deflated('story.inf', 'x')]), 'bad-mimetype')
  })

  test('mimetype with an extra field', () => {
    const extra = Uint8Array.from([0x55, 0x54, 0x01, 0x00, 0x00])
    expectRefused(buildZip([mimetypeEntry({ extra }), deflated('story.inf', 'x')]), 'bad-mimetype')
  })

  test('mimetype not at offset 0 (prepended data)', () => {
    // Offsets in the central directory are correct relative to the file start,
    // but the first local header no longer sits at byte 0.
    expectRefused(buildZip(validEntries(), { prefix: new Uint8Array(16) }), 'not-a-package')
  })
})

describe('readContainer — unsafe names', () => {
  test.each([
    ['../x.h'],
    ['a/../b.h'],
    ['/abs.h'],
    ['a\\b.h'],
    ['C:/x.h'],
    ['a//b.h'],
    ['./a.h'],
    ['a\u0000b.h'],
    ['a\u0085b.h'],
    ['a\u001bb.h'],
  ])('%j', (name) => {
    const e = expectRefused(buildZip([mimetypeEntry(), stored(name, 'x')]), 'unsafe-path')
    expect(e.message).toMatch(/^This project contains a file with an unsafe name: .+\.$/)
  })

  test('a name that is not valid UTF-8', () => {
    expectRefused(buildZip([mimetypeEntry(), stored(Uint8Array.from([0x61, 0xff, 0x62]), 'x')]), 'unsafe-path')
  })

  test('the message does not echo control characters or bidi overrides', () => {
    const e = expectRefused(buildZip([mimetypeEntry(), stored('a\u0000\u202eb/../c', 'x')]), 'unsafe-path')
    expect(e.message).not.toMatch(/[\u0000\u202e]/)
  })

  test('the message truncates a very long name', () => {
    const e = expectRefused(buildZip([mimetypeEntry(), stored('a'.repeat(1100), 'x')]), 'unsafe-path')
    expect(e.message.length).toBeLessThan(200)
  })

  test('A.h + a.h', () => {
    const e = expectRefused(buildZip([mimetypeEntry(), stored('A.h', 'x'), stored('a.h', 'y')]), 'duplicate-path')
    expect(e.message).toContain('A.h')
    expect(e.message).toContain('a.h')
  })

  test('NFC-equivalent names that differ only in case', () => {
    expectRefused(buildZip([mimetypeEntry(), stored('Cafe\u0301.h', 'x'), stored('CAFÉ.h', 'y')]), 'duplicate-path')
  })

  test('an exact duplicate', () => {
    expectRefused(buildZip([mimetypeEntry(), stored('a.h', 'x'), stored('a.h', 'y')]), 'duplicate-path')
  })

  test('a second mimetype entry', () => {
    expectRefused(buildZip([mimetypeEntry(), stored('MIMETYPE', 'x')]), 'duplicate-path')
  })
})

describe('readContainer — entry types', () => {
  test('a symbolic link', () => {
    const link = stored('story.inf', '/etc/passwd', { externalAttrs: (0o120777 << 16) >>> 0 })
    expectRefused(buildZip([mimetypeEntry(), link]), 'symlink')
  })

  // F8: a desktop extractor or another unzipper may honour Unix mode bits
  // whatever the "made by" host says, so they are read from every entry.
  test.each([0, 3, 16, 19, 30])('a symbolic link made by host %i', (host) => {
    const link = stored('notes', '../../../../tmp', { versionMadeBy: (host << 8) | 20, externalAttrs: (0o120777 << 16) >>> 0 })
    expectRefused(buildZip([mimetypeEntry(), link]), 'symlink')
  })

  test.each([0, 19])('a FIFO or device made by host %i', (host) => {
    for (const mode of [0o010644, 0o020644, 0o060644, 0o140644]) {
      const odd = stored('story.inf', 'x', { versionMadeBy: (host << 8) | 20, externalAttrs: (mode << 16) >>> 0 })
      expectRefused(buildZip([mimetypeEntry(), odd]), 'special-file')
    }
  })

  test('a directory mode on a name that is not a folder, from any host', () => {
    const odd = stored('story.inf', '', { versionMadeBy: (19 << 8) | 20, externalAttrs: (0o040755 << 16) >>> 0 })
    expectRefused(buildZip([mimetypeEntry(), odd]), 'special-file')
  })

  test('plain files from any host, with or without Unix mode bits, are accepted', () => {
    for (const host of [0, 3, 10, 19]) {
      for (const attrs of [0, 0x20, (0o100644 << 16) >>> 0, (0o644 << 16) >>> 0]) {
        const f = stored('story.inf', 'x', { versionMadeBy: (host << 8) | 20, externalAttrs: attrs })
        expect(readContainer(buildZip([mimetypeEntry(), f])).size).toBe(1)
      }
    }
  })

  test('a file and a folder with the same name (a file "a" next to "a/b")', () => {
    for (const [first, second] of [['a', 'a/b'], ['a/b', 'a'], ['A', 'a/b'], ['x/y', 'X/y/z.h']]) {
      const e = expectRefused(buildZip([mimetypeEntry(), stored(first!, '1'), stored(second!, '2')]), 'path-conflict')
      expect(e.message).toMatch(/^This project contains a file and a folder with the same name: /)
    }
  })

  test('a directory entry with the same name as a file', () => {
    const dir = stored('a/', new Uint8Array(0), { externalAttrs: (0o040755 << 16) >>> 0 })
    expectRefused(buildZip([mimetypeEntry(), stored('a', 'x'), dir]), 'path-conflict')
    expectRefused(buildZip([mimetypeEntry(), dir, stored('A', 'x')]), 'path-conflict')
  })

  test('a directory entry and files inside it are fine', () => {
    const dir = stored('a/', new Uint8Array(0), { externalAttrs: (0o040755 << 16) >>> 0 })
    expect([...readContainer(buildZip([mimetypeEntry(), dir, stored('a/b', 'x'), stored('a/c/d', 'y')])).keys()]).toEqual(['a/b', 'a/c/d'])
  })

  test('another special Unix file type (a FIFO)', () => {
    const fifo = stored('story.inf', 'x', { externalAttrs: (0o010644 << 16) >>> 0 })
    expectRefused(buildZip([mimetypeEntry(), fifo]), 'special-file')
  })

  test('a directory entry with data', () => {
    expectRefused(buildZip([mimetypeEntry(), stored('tests/', 'surprise')]), 'directory-with-data')
  })

  test('a directory entry that declares a size but has no payload', () => {
    const dir = stored('tests/', new Uint8Array(0), { usize: 5 })
    expectRefused(buildZip([mimetypeEntry(), dir]), 'directory-with-data')
  })

  test('a directory entry with an unsafe name', () => {
    expectRefused(buildZip([mimetypeEntry(), stored('../', new Uint8Array(0))]), 'unsafe-path')
  })

  test('compression method 12 (bzip2)', () => {
    const e = deflated('story.inf', 'x'.repeat(50), { method: 12 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'unsupported-method')
  })

  test('an encrypted entry', () => {
    const e = stored('story.inf', 'x', { flags: 0x0801 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'encrypted')
  })

  // Audit F17: general-purpose flag bit 6 (strong encryption) and bit 13
  // (masked local headers, central directory encryption) are refused too.
  test.each([
    ['bit 6 (strong encryption)', 0x0840],
    ['bit 13 (masked headers)', 0x2800],
  ])('an entry flagged %s', (_l, flags) => {
    const e = stored('story.inf', 'x', { flags })
    expectRefused(buildZip([mimetypeEntry(), e]), 'encrypted')
  })

  test.each([
    ['bit 0', 0x0801],
    ['bit 6', 0x0840],
    ['bit 13', 0x2800],
  ])('a local header alone flagged with encryption %s', (_l, flags) => {
    const e = { ...stored('story.inf', 'x'), local: { flags } }
    expectRefused(buildZip([mimetypeEntry(), e]), flags === 0x0801 ? 'header-mismatch' : 'encrypted')
  })

  test('a stored entry whose compressed and uncompressed sizes differ', () => {
    const e = stored('story.inf', 'abcdef', { usize: 3 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'damaged')
  })
})

describe('readContainer — limits (checked from the central directory before inflating)', () => {
  test('bytes > 32 MiB', () => {
    const z = buildZip(validEntries())
    const big = new Uint8Array(LIMITS.archiveBytes + 1)
    big.set(z, big.length - z.length) // a valid zip at the end; still refused for size
    const e = expectRefused(big, 'too-large')
    expect(e.message).toBe('This project is larger than frotzsmith can open (32 MB).')
  })

  test('> 2,000 entries', () => {
    const many = [mimetypeEntry()]
    for (let i = 1; i <= LIMITS.entries; i++) many.push(stored(`f${i}.txt`, 'x'))
    expect(many.length).toBe(LIMITS.entries + 1)
    expectRefused(buildZip(many), 'too-many-entries')
  })

  test('> 2,000 entries declared in the EOCD alone', () => {
    expectRefused(buildZip(validEntries(), { eocd: { count: 60000 } }), 'too-many-entries')
  })

  test('an entry declaring > 8 MiB (no data needed: refused before reading it)', () => {
    const e = stored('story.inf', 'x', { usize: LIMITS.entryBytes + 1, csize: LIMITS.entryBytes + 1 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'entry-too-large')
  })

  test('an entry declaring exactly 8 MiB is not refused for size', () => {
    // It is refused later (the data isn't there), but not by the size limit.
    const e = stored('story.inf', 'x', { usize: LIMITS.entryBytes, csize: LIMITS.entryBytes })
    expect(refusal(buildZip([mimetypeEntry(), e])).code).not.toBe('entry-too-large')
  })

  test('total > 32 MiB', () => {
    const size = 7 * MiB
    const entries = [mimetypeEntry()]
    for (let i = 0; i < 5; i++) entries.push(deflated(`f${i}.txt`, 'x', { usize: size, csize: Math.ceil(size / 100) }))
    expectRefused(buildZip(entries), 'total-too-large')
  })

  test('ratio > 200', () => {
    // A real bomb: 4 MiB of zeros deflates to a few KiB (≈1000:1).
    const zeros = new Uint8Array(4 * MiB)
    const e = deflated('story.inf', zeros)
    expect(e.usize / e.csize).toBeGreaterThan(200)
    expectRefused(buildZip([mimetypeEntry(), e]), 'ratio')
  })

  test('compressed size 0 with uncompressed > 0 violates the ratio', () => {
    const e = deflated('story.inf', 'x', { csize: 0, usize: 10, payload: new Uint8Array(0) })
    expectRefused(buildZip([mimetypeEntry(), e]), 'ratio')
  })

  test('ratio exactly 200 is allowed', () => {
    // Declared 200:1, so the ratio check passes; the lie is caught after inflating.
    const e = deflated('story.inf', 'abc')
    const lying = { ...e, usize: e.csize * 200, local: { usize: e.csize * 200 } }
    expect(refusal(buildZip([mimetypeEntry(), lying])).code).toBe('size-mismatch')
  })
})

describe('readContainer — lying headers', () => {
  test('declared uncompressed size smaller than the real inflated size', () => {
    const real = enc.encode('All work and no play makes Jack a dull boy. '.repeat(40))
    const e = deflated('story.inf', real, { usize: 100 })
    expect(e.usize).toBeLessThan(real.length)
    expectRefused(buildZip([mimetypeEntry(), e]), 'size-mismatch')
  })

  test('declared size much smaller than a huge inflated size: stops early', () => {
    // 6 MiB of zeros, declared as 1 KiB; ratio declared 1024/csize is fine.
    const zeros = new Uint8Array(6 * MiB)
    const e = deflated('story.inf', zeros, { usize: 1024, crc: 0 })
    const t0 = Date.now()
    expectRefused(buildZip([mimetypeEntry(), e]), 'size-mismatch')
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  test('declared uncompressed size larger than the real inflated size', () => {
    const e = deflated('story.inf', 'short text', { usize: 20 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'size-mismatch')
  })

  test('a CRC-32 that does not match the data', () => {
    const e = deflated('story.inf', 'hello', { crc: 0x12345678 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'crc-mismatch')
  })

  test('a stored entry with a bad CRC-32', () => {
    expectRefused(buildZip([mimetypeEntry(), stored('a.txt', 'hello', { crc: 1 })]), 'crc-mismatch')
  })

  test('deflate data that is corrupt', () => {
    const e = stored('story.inf', 'x', { method: 8, payload: Uint8Array.from([0xff, 0xff, 0xff]), csize: 3, usize: 1 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'damaged')
  })

  test.each([
    ['name', { name: enc.encode('other.inf') }],
    ['method', { method: 0 }],
    ['crc', { crc: 0 }],
    ['compressed size', { csize: 1 }],
    ['uncompressed size', { usize: 99999 }],
    ['encryption flag', { flags: 0x0801 }],
    ['data-descriptor flag', { flags: 0x0808 }],
  ])('local header disagrees with the central directory: %s', (_l, local) => {
    const e = { ...deflated('story.inf', 'hello hello'), local }
    expectRefused(buildZip([mimetypeEntry(), e]), 'header-mismatch')
  })

  test('the local header of an unsafe name is hidden behind a safe central name', () => {
    const e = { ...stored('story.inf', 'x'), local: { name: enc.encode('../../x.h') } }
    expectRefused(buildZip([mimetypeEntry(), e]), 'header-mismatch')
  })

  test('a data descriptor that disagrees with the central directory', () => {
    const e = deflated('story.inf', 'hello hello hello')
    const bad = {
      ...e,
      flags: e.flags | 0x08,
      local: { crc: 0, csize: 0, usize: 0 },
      descriptor: { signature: true, crc: e.crc, csize: e.csize, usize: e.usize + 1 },
    }
    expectRefused(buildZip([mimetypeEntry(), bad]), 'header-mismatch')
  })

  test('a data descriptor flag but no descriptor', () => {
    const e = deflated('story.inf', 'hello hello hello')
    const bad = { ...e, flags: e.flags | 0x08, local: { crc: 0, csize: 0, usize: 0 } }
    // The bytes after the data are the central directory, not a descriptor.
    expect(['header-mismatch', 'damaged']).toContain(refusal(buildZip([mimetypeEntry(), bad])).code)
  })

  test('a local header offset pointing outside the archive', () => {
    const e = { ...stored('story.inf', 'x'), offset: 0x00ffffff }
    expectRefused(buildZip([mimetypeEntry(), e]), 'damaged')
  })

  test('a local header offset pointing at the wrong place', () => {
    const e = { ...stored('story.inf', 'x'), offset: 5 }
    expectRefused(buildZip([mimetypeEntry(), e]), 'damaged')
  })

  test('a central entry pointing at an earlier entry (overlap)', () => {
    const z = buildZip([mimetypeEntry(), stored('a.txt', 'x'), { ...stored('b.txt', 'y'), offset: 0 }])
    expect(['header-mismatch', 'damaged']).toContain(refusal(z).code)
  })

  test('a local header hidden inside another entry\'s data (overlapping entries)', () => {
    // b's real local header + data live inside a's stored payload; the central
    // directory lists both. Each header agrees with its own central entry.
    const b = stored('b.txt', 'hidden')
    const hidden = new Out()
    writeLocal(hidden, b)
    const a = stored('a.txt', hidden.done())
    const aDataStart = 30 + 8 + MIMETYPE.length + 30 + a.name.length
    const z = buildZip([mimetypeEntry(), a, { ...b, centralOnly: true, offset: aDataStart }])
    expectRefused(z, 'damaged')
  })

  test('a payload that runs past the central directory', () => {
    const e = stored('story.inf', 'x'.repeat(10), { csize: 5000, usize: 5000 })
    expectRefused(buildZip([mimetypeEntry(), { ...e, payload: enc.encode('x'.repeat(10)) }]), 'damaged')
  })
})

describe('readContainer — structure', () => {
  test('ZIP64 sentinel sizes', () => {
    const e = stored('story.inf', 'x', { csize: 0xffffffff, usize: 0xffffffff })
    expectRefused(buildZip([mimetypeEntry(), e]), 'zip64')
  })

  test('ZIP64 sentinel offset', () => {
    expectRefused(buildZip([mimetypeEntry(), { ...stored('story.inf', 'x'), offset: 0xffffffff }]), 'zip64')
  })

  test('ZIP64 sentinel entry count in the EOCD', () => {
    expectRefused(buildZip(validEntries(), { eocd: { count: 0xffff } }), 'zip64')
  })

  test('ZIP64 sentinel central-directory offset in the EOCD', () => {
    expectRefused(buildZip(validEntries(), { eocd: { cdOffset: 0xffffffff } }), 'zip64')
  })

  test('multi-disk (EOCD disk number)', () => {
    expectRefused(buildZip(validEntries(), { eocd: { disk: 1, cdDisk: 1 } }), 'multi-disk')
  })

  test('multi-disk (entry starts on another disk)', () => {
    const e = stored('story.inf', 'x', { diskStart: 1 })
    expectRefused(buildZip([mimetypeEntry(), e]), 'multi-disk')
  })

  test('entries on this disk differ from the total', () => {
    expectRefused(buildZip(validEntries(), { eocd: { countDisk: 1, count: 2 } }), 'multi-disk')
  })

  // F6(a): a reader that scans for the EOCD differently (macOS unzip,
  // bsdtar, Python's zipfile) can find a whole second archive in a comment.
  test('any archive comment', () => {
    const z = buildZip(validEntries(), { eocd: { comment: enc.encode('made by hand') } })
    expectRefused(z, 'archive-comment')
  })

  test('a different archive hidden in the comment (no second EOCD at the end)', () => {
    const real = buildZip(validEntries())
    const hidden = buildZip([mimetypeEntry(), stored('../../escape.txt', 'outside!')])
    const comment = new Uint8Array([...hidden, 0x20]) // its EOCD no longer ends at EOF
    expectRefused(buildZip(validEntries(), { eocd: { comment } }), 'archive-comment')
    expect(real.length).toBeGreaterThan(0)
  })

  test('trailing garbage after the EOCD', () => {
    expectRefused(buildZip(validEntries(), { trailing: enc.encode('garbage') }), 'damaged')
  })

  test('a comment length that does not reach the end', () => {
    const z = buildZip(validEntries(), { eocd: { comment: enc.encode('abc'), commentLength: 10 } })
    expectRefused(z, 'damaged')
  })

  test('a second, fake EOCD hidden in the comment', () => {
    const real = buildZip(validEntries())
    const fake = real.subarray(real.length - 22) // a copy of the EOCD, comment length 0
    const z = buildZip(validEntries(), { eocd: { comment: fake } })
    expectRefused(z, 'ambiguous')
  })

  test('central directory size that disagrees with the entries', () => {
    const z = buildZip(validEntries())
    const dv = new DataView(z.buffer)
    const eocd = z.length - 22
    dv.setUint32(eocd + 12, dv.getUint32(eocd + 12, true) + 4, true)
    expectRefused(z, 'damaged')
  })

  test('central directory count smaller than its real entries', () => {
    const z = buildZip([...validEntries(), stored('b.txt', 'b')], { eocd: { count: 2 } })
    expectRefused(z, 'damaged')
  })

  test('unexplained bytes between the entries and the central directory', () => {
    expectRefused(buildZip(validEntries(), { gap: enc.encode('hidden') }), 'damaged')
  })

  test('a truncated archive', () => {
    const z = buildZip(validEntries())
    expectRefused(z.subarray(0, z.length - 30), 'damaged')
  })
})

/** An extra-field record: header id, length, data. */
function extraField(id: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length)
  const dv = new DataView(out.buffer)
  dv.setUint16(0, id, true)
  dv.setUint16(2, data.length, true)
  out.set(data, 4)
  return out
}

/** An Info-ZIP Unicode Path (0x7075) or Unicode Comment (0x6375) field. */
function unicodeField(id: number, forName: string, text: string, o: { version?: number; crc?: number } = {}): Uint8Array {
  const t = enc.encode(text)
  const data = new Uint8Array(5 + t.length)
  data[0] = o.version ?? 1
  new DataView(data.buffer).setUint32(1, (o.crc ?? crc32(enc.encode(forName))) >>> 0, true)
  data.set(t, 5)
  return extraField(id, data)
}

describe('readContainer — second names in extra fields (F6b)', () => {
  test('an Info-ZIP Unicode Path field in the central directory', () => {
    const e = stored('story.inf', 'x', { extra: unicodeField(0x7075, 'story.inf', '../../unicode-escape.inf'), local: { extra: new Uint8Array(0) } })
    const err = expectRefused(buildZip([mimetypeEntry(), e]), 'unicode-extra')
    expect(err.message).toContain('story.inf')
  })

  test('an Info-ZIP Unicode Path field in the local header only', () => {
    const e = stored('story.inf', 'x', { local: { extra: unicodeField(0x7075, 'story.inf', 'other.inf') } })
    expectRefused(buildZip([mimetypeEntry(), e]), 'unicode-extra')
  })

  test('an Info-ZIP Unicode Comment field', () => {
    const e = stored('story.inf', 'x', { extra: unicodeField(0x6375, 'story.inf', 'hello'), local: { extra: new Uint8Array(0) } })
    expectRefused(buildZip([mimetypeEntry(), e]), 'unicode-extra')
  })

  test('a Unicode Path field after another, harmless field', () => {
    const extra = new Uint8Array([...extraField(0x5455, Uint8Array.of(1, 0, 0, 0, 0)), ...unicodeField(0x7075, 'story.inf', 'x.inf')])
    expectRefused(buildZip([mimetypeEntry(), stored('story.inf', 'x', { extra, local: { extra: new Uint8Array(0) } })]), 'unicode-extra')
  })

  // Review m-3: Info-ZIP zip built with UNICODE_SUPPORT (usual on Linux) adds
  // a 0x7075 field for every non-ASCII name — one that repeats the name adds
  // no second name, so it is accepted.
  test('a Unicode Path field that repeats the entry name (Info-ZIP on Linux) is accepted', () => {
    const extra = unicodeField(0x7075, 'café.inf', 'café.inf')
    const map = readContainer(buildZip([mimetypeEntry(), stored('café.inf', 'x', { extra })]))
    expect([...map.keys()]).toEqual(['café.inf'])
    const local = readContainer(buildZip([mimetypeEntry(), stored('café.inf', 'x', { local: { extra } })]))
    expect([...local.keys()]).toEqual(['café.inf'])
  })

  test('a Unicode Path field with the same name but another version is refused', () => {
    const extra = unicodeField(0x7075, 'café.inf', 'café.inf', { version: 2 })
    expectRefused(buildZip([mimetypeEntry(), stored('café.inf', 'x', { extra })]), 'unicode-extra')
  })

  test('a Unicode Path field with the same name but a CRC of another name is refused', () => {
    const extra = unicodeField(0x7075, 'café.inf', 'café.inf', { crc: crc32(enc.encode('other.inf')) })
    expectRefused(buildZip([mimetypeEntry(), stored('café.inf', 'x', { extra })]), 'unicode-extra')
  })

  test('a Unicode Path field that differs only in normalization or case is refused', () => {
    for (const other of ['cafe\u0301.inf', 'CAFÉ.inf']) {
      const extra = unicodeField(0x7075, 'café.inf', other)
      expectRefused(buildZip([mimetypeEntry(), stored('café.inf', 'x', { extra })]), 'unicode-extra')
    }
  })

  test('ordinary extra fields (timestamps, Unix ids) are accepted', () => {
    const extra = new Uint8Array([...extraField(0x5455, Uint8Array.of(1, 0, 0, 0, 0)), ...extraField(0x7875, Uint8Array.of(1, 4, 0xe8, 3, 0, 0, 4, 0xe8, 3, 0, 0))])
    const map = readContainer(buildZip([mimetypeEntry(), stored('story.inf', 'x', { extra })]))
    expect(map.size).toBe(1)
  })

  test('an extra field whose records overrun it', () => {
    const extra = Uint8Array.of(0x55, 0x54, 9, 0, 1) // says 9 bytes of data, has 1
    expectRefused(buildZip([mimetypeEntry(), stored('story.inf', 'x', { extra })]), 'damaged')
    expectRefused(buildZip([mimetypeEntry(), stored('story.inf', 'x', { local: { extra } })]), 'damaged')
  })
})

describe('readContainer — deflate data ends where the entry ends (F14)', () => {
  test.each([1, 3, 64])('%i trailing byte(s) after the deflate stream', (n) => {
    const text = 'Constant Story "Hi";\n'.repeat(20)
    const payload = new Uint8Array([...deflateSync(enc.encode(text)), ...new Uint8Array(n).fill(0x41)])
    const e = stored('story.inf', text, { method: 8, csize: payload.length, payload })
    const err = expectRefused(buildZip([mimetypeEntry(), e]), 'trailing-data')
    expect(err.message).toContain('story.inf')
  })

  test('a second deflate stream appended to the first', () => {
    const text = 'look\n'
    const payload = new Uint8Array([...deflateSync(enc.encode(text)), ...deflateSync(enc.encode('xyzzy\n'))])
    const e = stored('story.inf', text, { method: 8, csize: payload.length, payload })
    expectRefused(buildZip([mimetypeEntry(), e]), 'trailing-data')
  })

  test('exact deflate streams of many shapes still open (stored, fixed and dynamic blocks; empty)', () => {
    const samples = [
      new Uint8Array(0),
      enc.encode('a'),
      enc.encode('hello hello hello hello'),
      Uint8Array.from({ length: 70_000 }, (_, i) => (i * 7919) & 0xff), // mostly stored blocks
      enc.encode('The quick brown fox. '.repeat(5000)),
    ]
    for (const bytes of samples) {
      for (const level of [0, 1, 6, 9] as const) {
        const e = deflated('story.inf', bytes, { payload: deflateSync(bytes, { level }) })
        e.csize = e.payload.length
        if (bytes.length > e.csize * LIMITS.ratio) continue
        expect(readContainer(buildZip([mimetypeEntry(), e])).get('story.inf')).toEqual(bytes)
      }
    }
  })
})

describe('writeContainer refuses what the reader refuses (F8, F9 parity)', () => {
  test.each(['CON.h', 'notes/aux', 'a:b.h', 'file.', ' lead.h', '\u202eexe.txt', 'a\u200bb.h', 'a\u2215b.h', 'a?.h'])(
    'the name %j',
    (p) => {
      expect(() => writeContainer([{ path: p, bytes: new Uint8Array(1) }])).toThrow(PackageError)
    },
  )

  test.each([
    ['s.h', '\u017f.h'],
    ['ss.h', '\u00df.h'],
    ['i.h', '\u0131.h'],
    ['ff.h', '\ufb00.h'],
  ])('names that fold together: %j and %j', (a, b) => {
    expect(() => writeContainer([{ path: a, bytes: new Uint8Array(1) }, { path: b, bytes: new Uint8Array(1) }])).toThrow(PackageError)
    // …and the reader refuses the same pair from a hand-made archive.
    expectRefused(buildZip([mimetypeEntry(), stored(a, '1'), stored(b, '2')]), 'duplicate-path')
  })

  test('a file and a folder with the same name', () => {
    for (const [a, b] of [['a', 'a/b'], ['A/b', 'a']]) {
      let err: unknown
      try {
        writeContainer([{ path: a!, bytes: new Uint8Array(1) }, { path: b!, bytes: new Uint8Array(1) }])
      } catch (e) {
        err = e
      }
      expect(err).toBeInstanceOf(PackageError)
      expect((err as PackageError).code).toBe('path-conflict')
    }
  })
})

describe('readContainer — nothing escapes', () => {
  test('every refusal is a PackageError, never another exception', () => {
    // Flip every byte of a small valid archive, one at a time.
    const z = writeContainer([
      { path: 'frotzsmith.json', bytes: enc.encode('{}') },
      { path: 'story.inf', bytes: enc.encode('Constant Story "Hi";\n'.repeat(5)) },
    ])
    for (let i = 0; i < z.length; i++) {
      const c = z.slice()
      c[i] = c[i]! ^ 0xff
      try {
        readContainer(c)
      } catch (e) {
        if (!(e instanceof PackageError)) throw new Error(`byte ${i}: ${String(e)}`)
      }
    }
  })
})
