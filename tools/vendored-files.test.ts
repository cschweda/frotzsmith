/**
 * Vendored third-party files (audit 2026-11-04, F16): every file we serve but
 * didn't write is listed in tools/vendored-files.json with its source and the
 * sha256 of the committed bytes. Any change to one fails here until the
 * manifest is updated on purpose. Where we patched a file, the patch is undone
 * and checked against the original download's sha256 too.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ZVM_F2_EDITS, unpatchVendoredZvm } from './vendored-zvm-patch.mjs'

const root = resolve(__dirname, '..')
const manifest = JSON.parse(readFileSync(resolve(__dirname, 'vendored-files.json'), 'utf8')) as {
  files: { path: string; sha256: string; source: string; upstreamSha256?: string; patched?: string }[]
}
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const read = (p: string) => readFileSync(resolve(root, p))
const entry = (p: string) => manifest.files.find(f => f.path === p)!

describe('vendored files', () => {
  it('every vendored file is listed (play/web except its README, pa except our init.js)', () => {
    const listed = manifest.files.map(f => f.path).sort()
    const onDisk = [
      ...readdirSync(resolve(root, 'public/play/web')).filter(f => f !== 'README.md').map(f => `public/play/web/${f}`),
      ...readdirSync(resolve(root, 'public/pa')).filter(f => f !== 'init.js').map(f => `public/pa/${f}`),
    ].sort()
    expect(listed).toEqual(onDisk)
  })

  it.each(manifest.files.map(f => [f.path, f] as const))('%s matches its recorded sha256', (path, f) => {
    expect(f.source.length).toBeGreaterThan(10)
    expect(sha256(read(path))).toBe(f.sha256)
  })

  it('zvm.js minus the F2 patch is the original Parchment bytes', () => {
    let s = read('public/play/web/zvm.js').toString('utf8')
    s = s.slice(s.indexOf('*/\n') + 3) // the header comment
    for (const [patched] of ZVM_F2_EDITS) expect(s.split(patched)).toHaveLength(2)
    s = unpatchVendoredZvm(s)
    expect(sha256(s)).toBe(entry('public/play/web/zvm.js').upstreamSha256)
  })

  it('pa/script.js minus its header is the upstream download', () => {
    const s = read('public/pa/script.js').toString('utf8')
    expect(sha256(s.slice(s.indexOf('*/\n') + 3))).toBe(entry('public/pa/script.js').upstreamSha256)
  })

  it('jquery.min.js is the official 3.5.1 file (less its trailing newline)', () => {
    expect(sha256(Buffer.concat([read('public/play/web/jquery.min.js'), Buffer.from('\n')])))
      .toBe(entry('public/play/web/jquery.min.js').upstreamSha256)
  })
})
