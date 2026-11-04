/**
 * netlify.toml headers the offline website depends on. Verified live
 * 2026-11-04: without an explicit Content-Type, Netlify serves
 * manifest.webmanifest as application/octet-stream.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const toml = readFileSync(resolve(__dirname, '..', 'netlify.toml'), 'utf8')

/** The [headers.values] text of the `for = "<path>"` block. */
function headersFor(path: string): string {
  const start = toml.indexOf(`for = "${path}"`)
  expect(start, `no [[headers]] block for ${path}`).toBeGreaterThan(-1)
  const next = toml.indexOf('[[headers]]', start)
  return toml.slice(start, next === -1 ? undefined : next)
}

describe('netlify.toml offline-web headers', () => {
  it('sw.js is never HTTP-cached (updates must be seen)', () => {
    expect(headersFor('/sw.js')).toMatch(/Cache-Control = "no-cache"/)
  })

  it('the web manifest is no-cache and served as application/manifest+json', () => {
    const block = headersFor('/manifest.webmanifest')
    expect(block).toMatch(/Cache-Control = "no-cache"/)
    expect(block).toMatch(/Content-Type = "application\/manifest\+json"/)
  })
})
