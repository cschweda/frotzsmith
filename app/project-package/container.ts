/**
 * The `.frotzsmith` ZIP container (spec §2 and §12).
 *
 * `readContainer` parses UNTRUSTED bytes. It walks the archive itself instead
 * of using a general-purpose unzipper, in three phases, and nothing is
 * inflated until the first two have passed:
 *
 *   1. Structure + policy, from the central directory alone: exactly one
 *      EOCD, no ZIP64 / multi-disk / encryption, the first entry is
 *      `mimetype` at byte 0, every path is safe and unique ignoring case, no
 *      links or special files, empty directories only, methods 0/8 only, and
 *      every size limit and compression ratio from the DECLARED sizes.
 *   2. Local headers: each agrees with its central entry (name, method,
 *      flags, CRC and sizes, or the data descriptor's), and the entries tile
 *      the archive exactly — in order, no gaps, no overlap.
 *   3. Extraction: inflate each entry into a buffer of its declared size,
 *      stopping the moment it would exceed it; the real length must equal the
 *      declared size and the CRC-32 must match.
 *
 * Any violation throws a `PackageError` whose message is one plain sentence.
 */
import { Inflate, deflateSync } from 'fflate'
import { PackageError, quotedPath } from './errors'
import { pathKey, pathProblem } from './paths'

export const MIMETYPE = 'application/vnd.frotzsmith.package+zip'

const MiB = 1024 * 1024

export const LIMITS = Object.freeze({
  archiveBytes: 32 * MiB,
  entries: 2000,
  entryBytes: 8 * MiB,
  totalBytes: 32 * MiB,
  ratio: 200,
})

// ---------------------------------------------------------------------------
// ZIP constants
// ---------------------------------------------------------------------------

const SIG_LOCAL = 0x04034b50
const SIG_CENTRAL = 0x02014b50
const SIG_EOCD = 0x06054b50
const SIG_DESCRIPTOR = 0x08074b50

const LOCAL_LEN = 30
const CENTRAL_LEN = 46
const EOCD_LEN = 22
const MAX_COMMENT = 0xffff

const FLAG_ENCRYPTED = 0x0001
const FLAG_DESCRIPTOR = 0x0008
const FLAG_STRONG_ENCRYPTION = 0x0040
const FLAG_UTF8 = 0x0800
const FLAG_MASKED_HEADERS = 0x2000
/** Flag bits that must be identical in the local and central headers. */
const FLAGS_MUST_AGREE = FLAG_ENCRYPTED | FLAG_DESCRIPTOR | FLAG_UTF8

const METHOD_STORED = 0
const METHOD_DEFLATED = 8

const HOST_UNIX = 3
const S_IFMT = 0o170000
const S_IFREG = 0o100000
const S_IFDIR = 0o040000
const S_IFLNK = 0o120000

/** Info-ZIP Unicode Path and Unicode Comment extra fields: a second name (or
 *  comment) that some unzippers show instead of the entry's real one. */
const EXTRA_UNICODE_PATH = 0x7075
const EXTRA_UNICODE_COMMENT = 0x6375

/** DOS date 1980-01-01, time 00:00 — fixed so output is deterministic. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1
const DOS_TIME = 0

/** Input chunk size when inflating: bounds the output of one push to ~1 MiB. */
const INFLATE_CHUNK = 1024

const MIMETYPE_BYTES = new TextEncoder().encode(MIMETYPE)
const MIMETYPE_NAME = new TextEncoder().encode('mimetype')

// ---------------------------------------------------------------------------
// User-facing refusals (one sentence each)
// ---------------------------------------------------------------------------

const fail = {
  notAPackage: () => new PackageError('not-a-package', "That file isn't a Frotzsmith project (.frotzsmith)."),
  badMimetype: () =>
    new PackageError('bad-mimetype', "That file isn't a valid Frotzsmith project: its mimetype entry is wrong."),
  damaged: () => new PackageError('damaged', 'This project file is damaged or incomplete.'),
  damagedEntry: (p: string) =>
    new PackageError('damaged', `This project file is damaged: ${quotedPath(p)} can't be read.`),
  ambiguous: () =>
    new PackageError('ambiguous', 'This project file is damaged: its table of contents is ambiguous.'),
  tooLarge: () => new PackageError('too-large', 'This project is larger than Frotzsmith can open (32 MB).'),
  tooMany: () => new PackageError('too-many-entries', 'This project has more files than Frotzsmith can open (2,000).'),
  entryTooLarge: (p: string) =>
    new PackageError('entry-too-large', `This project contains a file larger than Frotzsmith can open (8 MB): ${quotedPath(p)}.`),
  totalTooLarge: () =>
    new PackageError('total-too-large', 'This project is larger than Frotzsmith can open (32 MB) once unpacked.'),
  ratio: (p: string) =>
    new PackageError('ratio', `This project contains a suspiciously compressed file: ${quotedPath(p)}.`),
  zip64: () => new PackageError('zip64', 'This project uses ZIP64, which Frotzsmith doesn’t support.'),
  multiDisk: () =>
    new PackageError('multi-disk', 'This project is split across several files, which Frotzsmith doesn’t support.'),
  encrypted: () => new PackageError('encrypted', 'This project is encrypted, which Frotzsmith doesn’t support.'),
  method: (p: string) =>
    new PackageError('unsupported-method', `This project uses a compression method Frotzsmith doesn’t support: ${quotedPath(p)}.`),
  unsafePath: (p: string) =>
    new PackageError('unsafe-path', `This project contains a file with an unsafe name: ${quotedPath(p)}.`),
  badName: () => new PackageError('unsafe-path', 'This project contains a file whose name isn’t valid text.'),
  duplicate: (a: string, b: string) =>
    new PackageError(
      'duplicate-path',
      `This project contains two files whose names differ only in case: ${quotedPath(a, 40)} and ${quotedPath(b, 40)}.`,
    ),
  symlink: (p: string) =>
    new PackageError('symlink', `This project contains a symbolic link, which Frotzsmith doesn’t allow: ${quotedPath(p)}.`),
  special: (p: string) =>
    new PackageError('special-file', `This project contains something that isn’t an ordinary file: ${quotedPath(p)}.`),
  directoryWithData: (p: string) =>
    new PackageError('directory-with-data', `This project contains a folder entry with data in it: ${quotedPath(p)}.`),
  headerMismatch: (p: string) =>
    new PackageError('header-mismatch', `This project file is damaged: the headers for ${quotedPath(p)} disagree.`),
  sizeMismatch: (p: string) =>
    new PackageError('size-mismatch', `This project file is damaged: ${quotedPath(p)} isn’t the size its header says.`),
  crcMismatch: (p: string) =>
    new PackageError('crc-mismatch', `This project file is damaged: ${quotedPath(p)} failed its checksum.`),
  trailingData: (p: string) =>
    new PackageError('trailing-data', `This project file is damaged: ${quotedPath(p)} has extra data after its end.`),
  comment: () =>
    new PackageError('archive-comment', 'This project file has a comment at its end, which Frotzsmith doesn’t allow.'),
  unicodeExtra: (p: string) =>
    new PackageError('unicode-extra', `This project contains a file with a second, hidden name, which Frotzsmith doesn’t allow: ${quotedPath(p)}.`),
  pathConflict: (file: string, folder: string) =>
    new PackageError(
      'path-conflict',
      `This project contains a file and a folder with the same name: ${quotedPath(file, 40)} and ${quotedPath(folder, 40)}.`,
    ),
}

/**
 * Walk an extra field's records (id, length, data). Returns 'damaged' when the
 * records don't fill it exactly, 'unicode' when one is an Info-ZIP Unicode Path
 * or Unicode Comment field (a second name other unzippers would show), else null.
 */
function extraProblem(extra: Uint8Array): 'damaged' | 'unicode' | null {
  const dv = new DataView(extra.buffer, extra.byteOffset, extra.byteLength)
  let p = 0
  while (p < extra.length) {
    if (p + 4 > extra.length) return 'damaged'
    const id = dv.getUint16(p, true)
    const len = dv.getUint16(p + 2, true)
    if (p + 4 + len > extra.length) return 'damaged'
    if (id === EXTRA_UNICODE_PATH || id === EXTRA_UNICODE_COMMENT) return 'unicode'
    p += 4 + len
  }
  return null
}

/**
 * The first file whose name is also a folder of another entry (`a` next to
 * `a/b`, compared by pathKey), as [file, folder], else null. Unpacked, one of
 * the two can't be created — or a link-following extractor could be steered.
 */
export function findPathConflict(entries: { name: string; isDir: boolean }[]): [string, string] | null {
  const folders = new Map<string, string>() // pathKey -> the entry that makes it a folder
  for (const e of entries) {
    const segments = (e.isDir ? e.name.slice(0, -1) : e.name).split('/')
    const upTo = e.isDir ? segments.length : segments.length - 1
    for (let i = 1; i <= upTo; i++) {
      const key = pathKey(segments.slice(0, i).join('/'))
      if (!folders.has(key)) folders.set(key, e.name)
    }
  }
  for (const e of entries) {
    if (e.isDir) continue
    const folder = folders.get(pathKey(e.name))
    if (folder !== undefined) return [e.name, folder]
  }
  return null
}

// ---------------------------------------------------------------------------
// CRC-32 (IEEE 802.3, as ZIP uses)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

interface CentralEntry {
  nameBytes: Uint8Array
  name: string
  isDir: boolean
  flags: number
  method: number
  crc: number
  csize: number
  usize: number
  offset: number
  /** Filled in by phase 2. */
  dataStart: number
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

const strictUtf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

export function readContainer(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > LIMITS.archiveBytes) throw fail.tooLarge()
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (p: number) => dv.getUint16(p, true)
  const u32 = (p: number) => dv.getUint32(p, true)

  // --- Phase 1a: the one EOCD -------------------------------------------------
  const eocd = findEocd(bytes, dv)
  const disk = u16(eocd + 4)
  const cdDisk = u16(eocd + 6)
  const countDisk = u16(eocd + 8)
  const count = u16(eocd + 10)
  const cdSize = u32(eocd + 12)
  const cdOffset = u32(eocd + 16)
  if (
    disk === 0xffff || cdDisk === 0xffff || countDisk === 0xffff || count === 0xffff
    || cdSize === 0xffffffff || cdOffset === 0xffffffff
  ) throw fail.zip64()
  if (disk !== 0 || cdDisk !== 0 || countDisk !== count) throw fail.multiDisk()
  if (count > LIMITS.entries) throw fail.tooMany()
  // The central directory must end exactly where the EOCD begins: no prefix
  // tricks, no hidden ZIP64 records, no unexplained bytes.
  if (cdOffset + cdSize !== eocd) throw fail.damaged()
  if (count === 0) throw fail.notAPackage()
  // Our writer never writes a comment, and other unzippers can find a whole
  // second archive inside one (a different set of files from the one we open).
  if (u16(eocd + 20) !== 0) throw fail.comment()

  // --- Phase 1b: walk the central directory (structure only) -----------------
  interface RawCentral {
    versionMadeBy: number
    flags: number
    method: number
    crc: number
    csize: number
    usize: number
    nameBytes: Uint8Array
    extraLen: number
    extra: Uint8Array
    diskStart: number
    externalAttrs: number
    offset: number
  }
  const raws: RawCentral[] = []
  let p = cdOffset
  for (let i = 0; i < count; i++) {
    if (p + CENTRAL_LEN > eocd || u32(p) !== SIG_CENTRAL) throw fail.damaged()
    const nameLen = u16(p + 28)
    const extraLen = u16(p + 30)
    const commentLen = u16(p + 32)
    const end = p + CENTRAL_LEN + nameLen + extraLen + commentLen
    if (end > eocd) throw fail.damaged()
    raws.push({
      versionMadeBy: u16(p + 4),
      flags: u16(p + 8),
      method: u16(p + 10),
      crc: u32(p + 16),
      csize: u32(p + 20),
      usize: u32(p + 24),
      nameBytes: bytes.subarray(p + CENTRAL_LEN, p + CENTRAL_LEN + nameLen),
      extraLen,
      extra: bytes.subarray(p + CENTRAL_LEN + nameLen, p + CENTRAL_LEN + nameLen + extraLen),
      diskStart: u16(p + 34),
      externalAttrs: u32(p + 38),
      offset: u32(p + 42),
    })
    p = end
  }
  if (p !== eocd) throw fail.damaged()

  // Is this a Frotzsmith package at all? First entry `mimetype`, at byte 0.
  const first = raws[0]!
  if (!sameBytes(first.nameBytes, MIMETYPE_NAME) || first.offset !== 0) throw fail.notAPackage()
  if (first.method !== METHOD_STORED || first.extraLen !== 0 || first.usize !== MIMETYPE_BYTES.length) {
    throw fail.badMimetype()
  }

  // --- Phase 1c: policy and limits, from declared sizes only -----------------
  const entries: CentralEntry[] = []
  const seen = new Map<string, string>()
  let total = 0
  for (const r of raws) {
    if (r.flags & (FLAG_ENCRYPTED | FLAG_STRONG_ENCRYPTION | FLAG_MASKED_HEADERS)) throw fail.encrypted()
    if (r.csize === 0xffffffff || r.usize === 0xffffffff || r.offset === 0xffffffff || r.diskStart === 0xffff) {
      throw fail.zip64()
    }
    if (r.diskStart !== 0) throw fail.multiDisk()

    let name: string
    try {
      name = strictUtf8.decode(r.nameBytes)
    } catch {
      throw fail.badName()
    }
    if (r.method !== METHOD_STORED && r.method !== METHOD_DEFLATED) throw fail.method(name)

    const isDir = name.endsWith('/')
    if (pathProblem(isDir ? name.slice(0, -1) : name) !== null) throw fail.unsafePath(name)
    const extra = extraProblem(r.extra)
    if (extra === 'damaged') throw fail.damagedEntry(name)
    if (extra === 'unicode') throw fail.unicodeExtra(name)

    // Unix mode bits are read whatever host made the entry: a desktop
    // extractor or another unzipper may honour them regardless. A type of 0
    // (no type recorded, e.g. MS-DOS attributes only) is an ordinary file.
    const type = (r.externalAttrs >>> 16) & S_IFMT
    if (type === S_IFLNK) throw fail.symlink(name)
    if (type !== 0 && type !== S_IFREG && type !== S_IFDIR) throw fail.special(name)
    if (type === S_IFDIR && !isDir) throw fail.special(name)

    if (isDir) {
      if (r.csize !== 0 || r.usize !== 0) throw fail.directoryWithData(name)
    } else {
      const key = pathKey(name)
      const prior = seen.get(key)
      if (prior !== undefined) throw fail.duplicate(prior, name)
      seen.set(key, name)
    }

    if (r.method === METHOD_STORED && r.csize !== r.usize) throw fail.damagedEntry(name)
    if (r.usize > LIMITS.entryBytes) throw fail.entryTooLarge(name)
    if (r.usize > 0 && (r.csize === 0 || r.usize > r.csize * LIMITS.ratio)) throw fail.ratio(name)
    total += r.usize

    entries.push({
      nameBytes: r.nameBytes,
      name,
      isDir,
      flags: r.flags,
      method: r.method,
      crc: r.crc,
      csize: r.csize,
      usize: r.usize,
      offset: r.offset,
      dataStart: 0,
    })
  }
  if (total > LIMITS.totalBytes) throw fail.totalTooLarge()
  const conflict = findPathConflict(entries)
  if (conflict) throw fail.pathConflict(conflict[0], conflict[1])

  // --- Phase 2: local headers agree and tile the archive exactly -------------
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    const next = i + 1 < entries.length ? entries[i + 1]!.offset : cdOffset
    const off = e.offset
    if (off + LOCAL_LEN > cdOffset || u32(off) !== SIG_LOCAL) throw fail.damagedEntry(e.name)
    const lflags = u16(off + 6)
    const lmethod = u16(off + 8)
    const lcrc = u32(off + 14)
    const lcsize = u32(off + 18)
    const lusize = u32(off + 22)
    const lnameLen = u16(off + 26)
    const lextraLen = u16(off + 28)
    const dataStart = off + LOCAL_LEN + lnameLen + lextraLen
    if (dataStart > cdOffset) throw fail.damagedEntry(e.name)

    if (!sameBytes(bytes.subarray(off + LOCAL_LEN, off + LOCAL_LEN + lnameLen), e.nameBytes)) {
      throw fail.headerMismatch(e.name)
    }
    if ((lflags & FLAGS_MUST_AGREE) !== (e.flags & FLAGS_MUST_AGREE) || lmethod !== e.method) {
      throw fail.headerMismatch(e.name)
    }
    const usesDescriptor = (e.flags & FLAG_DESCRIPTOR) !== 0
    const agrees = (local: number, central: number) => local === central || (usesDescriptor && local === 0)
    if (!agrees(lcrc, e.crc) || !agrees(lcsize, e.csize) || !agrees(lusize, e.usize)) {
      throw fail.headerMismatch(e.name)
    }
    if (i === 0 && lextraLen !== 0) throw fail.badMimetype()
    const lextra = extraProblem(bytes.subarray(off + LOCAL_LEN + lnameLen, dataStart))
    if (lextra === 'damaged') throw fail.damagedEntry(e.name)
    if (lextra === 'unicode') throw fail.unicodeExtra(e.name)

    const dataEnd = dataStart + e.csize
    if (dataEnd > cdOffset) throw fail.damagedEntry(e.name)
    let end = dataEnd
    if (usesDescriptor) {
      // Optional signature, then CRC, compressed size, uncompressed size.
      const forms = [
        { at: dataEnd + 4, len: 16, ok: dataEnd + 4 <= cdOffset && u32(dataEnd) === SIG_DESCRIPTOR },
        { at: dataEnd, len: 12, ok: true },
      ].filter((f) => f.ok && dataEnd + f.len === next && next <= cdOffset)
      if (forms.length === 0) throw fail.damagedEntry(e.name)
      const matches = forms.some((f) => u32(f.at) === e.crc && u32(f.at + 4) === e.csize && u32(f.at + 8) === e.usize)
      if (!matches) throw fail.headerMismatch(e.name)
      end = next
    }
    if (end !== next) throw fail.damagedEntry(e.name)
    e.dataStart = dataStart
  }

  // --- Phase 3: extract and verify -------------------------------------------
  const out = new Map<string, Uint8Array>()
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    if (e.isDir) continue
    const data = bytes.subarray(e.dataStart, e.dataStart + e.csize)
    const content = e.method === METHOD_STORED ? data.slice() : inflateBounded(data, e.usize, e.name)
    if (content.length !== e.usize) throw fail.sizeMismatch(e.name)
    if (crc32(content) !== e.crc) throw fail.crcMismatch(e.name)
    if (i === 0) {
      if (!sameBytes(content, MIMETYPE_BYTES)) throw fail.badMimetype()
      continue
    }
    out.set(e.name, content)
  }
  return out
}

/** Find the single End Of Central Directory record whose comment ends exactly at EOF. */
function findEocd(bytes: Uint8Array, dv: DataView): number {
  const candidates: number[] = []
  const lowest = Math.max(0, bytes.length - EOCD_LEN - MAX_COMMENT)
  for (let p = bytes.length - EOCD_LEN; p >= lowest; p--) {
    if (dv.getUint32(p, true) === SIG_EOCD && p + EOCD_LEN + dv.getUint16(p + 20, true) === bytes.length) {
      candidates.push(p)
    }
  }
  if (candidates.length > 1) throw fail.ambiguous()
  if (candidates.length === 1) return candidates[0]!
  // No EOCD. If it starts like a package, it is a damaged one; otherwise it's something else.
  const looksLikePackage =
    bytes.length >= LOCAL_LEN + MIMETYPE_NAME.length
    && dv.getUint32(0, true) === SIG_LOCAL
    && sameBytes(bytes.subarray(LOCAL_LEN, LOCAL_LEN + MIMETYPE_NAME.length), MIMETYPE_NAME)
  throw looksLikePackage ? fail.damaged() : fail.notAPackage()
}

/**
 * Inflate raw DEFLATE data into exactly `expected` bytes. Stops (and refuses)
 * the moment the output would exceed `expected`, so a lying header can never
 * make us allocate or decode more than declared (+ one ~1 MiB chunk).
 */
function inflateBounded(data: Uint8Array, expected: number, name: string): Uint8Array {
  const out = new Uint8Array(expected)
  let length = 0
  let overflow = false
  const inflater = new Inflate((chunk) => {
    if (overflow) return
    if (length + chunk.length > expected) {
      overflow = true
      return
    }
    out.set(chunk, length)
    length += chunk.length
  })
  try {
    if (data.length === 0) inflater.push(new Uint8Array(0), true)
    for (let i = 0; i < data.length && !overflow; i += INFLATE_CHUNK) {
      const end = Math.min(data.length, i + INFLATE_CHUNK)
      inflater.push(data.subarray(i, end), end === data.length)
    }
  } catch {
    if (!overflow) throw fail.damagedEntry(name)
  }
  if (overflow) throw fail.sizeMismatch(name)
  if (length !== expected) return out.subarray(0, length)
  // The stream must end exactly at the entry's last byte (spec §2: no gaps).
  // A valid DEFLATE stream always needs its last byte, so if it still
  // inflates completely without it, bytes followed the stream's end.
  if (data.length > 0 && inflatesWhole(data.subarray(0, data.length - 1), expected)) throw fail.trailingData(name)
  return out
}

/** Whether `data` is a complete DEFLATE stream of exactly `expected` bytes. */
function inflatesWhole(data: Uint8Array, expected: number): boolean {
  let length = 0
  let overflow = false
  const inflater = new Inflate((chunk) => {
    length += chunk.length
    if (length > expected) overflow = true
  })
  try {
    if (data.length === 0) inflater.push(new Uint8Array(0), true)
    for (let i = 0; i < data.length && !overflow; i += INFLATE_CHUNK) {
      const end = Math.min(data.length, i + INFLATE_CHUNK)
      inflater.push(data.subarray(i, end), end === data.length)
    }
  } catch {
    return false
  }
  return !overflow && length === expected
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export interface ContainerEntry {
  path: string
  bytes: Uint8Array
}

/**
 * Write a package: `mimetype` first (stored, no extra field), then every entry
 * in the given order, deflated — or stored when deflating would break the
 * reader's compression-ratio limit. UTF-8 names (bit 11), fixed timestamps.
 */
export function writeContainer(entries: ContainerEntry[]): Uint8Array {
  const utf8 = new TextEncoder()
  const seen = new Map<string, string>([[pathKey('mimetype'), 'mimetype']])
  for (const e of entries) {
    if (pathProblem(e.path) !== null) {
      throw new PackageError('unsafe-path', `Frotzsmith can’t save a file with an unsafe name: ${quotedPath(e.path)}.`)
    }
    const key = pathKey(e.path)
    const prior = seen.get(key)
    if (prior !== undefined) {
      throw new PackageError(
        'duplicate-path',
        `Frotzsmith can’t save two files whose names differ only in case: ${quotedPath(prior, 40)} and ${quotedPath(e.path, 40)}.`,
      )
    }
    seen.set(key, e.path)
    if (e.bytes.length >= 0xffffffff) throw new PackageError('too-large', 'This project is too large to save.')
  }
  const conflict = findPathConflict(entries.map(e => ({ name: e.path, isDir: false })))
  if (conflict) {
    throw new PackageError(
      'path-conflict',
      `Frotzsmith can’t save a file and a folder with the same name: ${quotedPath(conflict[0], 40)} and ${quotedPath(conflict[1], 40)}.`,
    )
  }
  if (entries.length + 1 >= 0xffff) throw new PackageError('too-many-entries', 'This project has too many files to save.')

  interface Item { name: Uint8Array; method: number; crc: number; usize: number; data: Uint8Array; offset: number }
  const items: Item[] = [
    { name: utf8.encode('mimetype'), method: METHOD_STORED, crc: crc32(MIMETYPE_BYTES), usize: MIMETYPE_BYTES.length, data: MIMETYPE_BYTES, offset: 0 },
  ]
  for (const e of entries) {
    const deflated = deflateSync(e.bytes)
    const deflate = e.bytes.length <= deflated.length * LIMITS.ratio
    items.push({
      name: utf8.encode(e.path),
      method: deflate ? METHOD_DEFLATED : METHOD_STORED,
      crc: crc32(e.bytes),
      usize: e.bytes.length,
      data: deflate ? deflated : e.bytes,
      offset: 0,
    })
  }

  let size = EOCD_LEN
  for (const it of items) size += LOCAL_LEN + CENTRAL_LEN + 2 * it.name.length + it.data.length
  if (size >= 0xffffffff) throw new PackageError('too-large', 'This project is too large to save.')
  const out = new Uint8Array(size)
  const dv = new DataView(out.buffer)
  let p = 0
  const versionNeeded = (it: Item) => (it.method === METHOD_DEFLATED ? 20 : 10)

  for (const it of items) {
    it.offset = p
    dv.setUint32(p, SIG_LOCAL, true)
    dv.setUint16(p + 4, versionNeeded(it), true)
    dv.setUint16(p + 6, FLAG_UTF8, true)
    dv.setUint16(p + 8, it.method, true)
    dv.setUint16(p + 10, DOS_TIME, true)
    dv.setUint16(p + 12, DOS_DATE, true)
    dv.setUint32(p + 14, it.crc, true)
    dv.setUint32(p + 18, it.data.length, true)
    dv.setUint32(p + 22, it.usize, true)
    dv.setUint16(p + 26, it.name.length, true)
    dv.setUint16(p + 28, 0, true)
    out.set(it.name, p + LOCAL_LEN)
    out.set(it.data, p + LOCAL_LEN + it.name.length)
    p += LOCAL_LEN + it.name.length + it.data.length
  }

  const cdOffset = p
  for (const it of items) {
    dv.setUint32(p, SIG_CENTRAL, true)
    dv.setUint16(p + 4, (HOST_UNIX << 8) | 20, true)
    dv.setUint16(p + 6, versionNeeded(it), true)
    dv.setUint16(p + 8, FLAG_UTF8, true)
    dv.setUint16(p + 10, it.method, true)
    dv.setUint16(p + 12, DOS_TIME, true)
    dv.setUint16(p + 14, DOS_DATE, true)
    dv.setUint32(p + 16, it.crc, true)
    dv.setUint32(p + 20, it.data.length, true)
    dv.setUint32(p + 24, it.usize, true)
    dv.setUint16(p + 28, it.name.length, true)
    // extra length, comment length, disk start, internal attributes: 0
    dv.setUint32(p + 38, ((S_IFREG | 0o644) << 16) >>> 0, true)
    dv.setUint32(p + 42, it.offset, true)
    out.set(it.name, p + CENTRAL_LEN)
    p += CENTRAL_LEN + it.name.length
  }

  dv.setUint32(p, SIG_EOCD, true)
  dv.setUint16(p + 8, items.length, true)
  dv.setUint16(p + 10, items.length, true)
  dv.setUint32(p + 12, p - cdOffset, true)
  dv.setUint32(p + 16, cdOffset, true)
  return out
}
