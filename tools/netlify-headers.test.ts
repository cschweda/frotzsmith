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

/** The directives of the site-wide CSP, as a map of directive → sources. */
function csp(): Record<string, string[]> {
  const m = headersFor('/*').match(/Content-Security-Policy = "([^"]+)"/)
  expect(m, 'no CSP on /*').not.toBeNull()
  return Object.fromEntries(
    m![1]!.split(';').map(d => d.trim()).filter(Boolean).map(d => {
      const [name, ...sources] = d.split(/\s+/)
      return [name!, sources]
    }),
  )
}

// Audit 2026-11-04 (F11/F17): pin the security headers so a loosening is a
// visible, reviewed change. Each loose source is explained in netlify.toml and
// docs/06-security.md §9.
describe('netlify.toml security headers (site-wide)', () => {
  it('pins the exact CSP', () => {
    expect(csp()).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'", 'blob:'],
      'worker-src': ["'self'"],
      'frame-src': ["'self'"],
      'child-src': ["'self'"],
      'frame-ancestors': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'object-src': ["'none'"],
    })
  })

  it('allows no third-party origin anywhere (analytics is first-party)', () => {
    for (const sources of Object.values(csp())) for (const s of sources) expect(s).not.toMatch(/^https?:|\*/)
  })

  it('blob: is only fetchable, never runnable as a script, worker or frame', () => {
    const c = csp()
    for (const d of ['script-src', 'worker-src', 'frame-src', 'child-src', 'default-src']) expect(c[d]).not.toContain('blob:')
  })

  it('pins the other security headers', () => {
    const block = headersFor('/*')
    expect(block).toMatch(/X-Frame-Options = "SAMEORIGIN"/)
    expect(block).toMatch(/X-Content-Type-Options = "nosniff"/)
    expect(block).toMatch(/Referrer-Policy = "strict-origin-when-cross-origin"/)
    expect(block).toMatch(/Permissions-Policy = "camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\)"/)
  })
})
