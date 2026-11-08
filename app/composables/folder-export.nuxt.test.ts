import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { frotzplayFolderZip } from './useHtmlExport'

/** The names in a .zip's central directory (signature PK\x01\x02). */
function zipNames(z: Uint8Array): string[] {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength)
  const names: string[] = []
  for (let i = 0; i + 46 <= z.length; i++) {
    if (v.getUint32(i, true) !== 0x02014b50) continue
    const n = v.getUint16(i + 28, true)
    names.push(new TextDecoder().decode(z.subarray(i + 46, i + 46 + n)))
  }
  return names
}

describe('frotzplayFolderZip', () => {
  const story = new Uint8Array(readFileSync(resolve(__dirname, '../../public/play/demo.z5')))

  it('zips frotzplay’s folder, inside a folder named after the story', async () => {
    const z = await frotzplayFolderZip(story, 'The Demo', 'z5', 'the-demo')
    expect(zipNames(z).sort()).toEqual(
      ['README.txt', 'boot.js', 'frotzplay.css', 'frotzplay.js', 'index.html', 'story.js', 'story.z5'].map(
        f => `the-demo/${f}`,
      ),
    )
  })

  it('carries the story byte for byte and the title in index.html', async () => {
    const z = await frotzplayFolderZip(story, 'The Demo', 'z5', 'the-demo')
    const text = new TextDecoder('latin1').decode(z)
    expect(text).toContain('<title>The Demo')
    // stored (uncompressed): the story's bytes appear as they are
    const at = text.indexOf(new TextDecoder('latin1').decode(story.subarray(0, 64)))
    expect(at).toBeGreaterThan(0)
  })
})
