/**
 * public/_redirects (audit 2026-11-04, F5): the Plausible tracker is a
 * vendored file served from our origin, so no rule may proxy (and so run)
 * plausible.io's live script. Only the event beacon is proxied.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { externalRules, readRedirects, scriptProxies } from '@frotzinc/nuxt-base/netlify/redirects'

const root = resolve(__dirname, '..')
const rules = readRedirects(resolve(root, 'public', '_redirects'))

describe('public/_redirects', () => {
  it('does not proxy any script (the tracker is vendored)', () => {
    expect(scriptProxies(rules)).toEqual([])
    expect(rules.some(([from]) => from === '/pa/script.js')).toBe(false)
  })

  it('proxies only the event beacon to plausible.io', () => {
    const proxies = externalRules(rules).filter(([, , status]) => status === '200')
    expect(proxies).toEqual([['/pa/event', 'https://plausible.io/api/event', '200']])
  })

  it('301s the old frotzsmith.com domain (apex and www) to the primary, first', () => {
    const domain = [
      ['https://frotzsmith.com/*', 'https://frotzsmith.frotzinc.com/:splat', '301!'],
      ['https://www.frotzsmith.com/*', 'https://frotzsmith.frotzinc.com/:splat', '301!'],
    ]
    expect(rules.slice(0, 2)).toEqual(domain)
    // Every external rule is either the beacon proxy or one of these redirects.
    expect(externalRules(rules)).toHaveLength(3)
  })

  it('serves the vendored tracker that init.js loads', () => {
    expect(existsSync(resolve(root, 'public', 'pa', 'script.js'))).toBe(true)
    expect(readFileSync(resolve(root, 'public', 'pa', 'init.js'), 'utf8')).toContain("s.src = '/pa/script.js'")
  })
})
