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
    // Proxies to another origin only: the old domain's sw.js → /sw-retire.js
    // rewrite serves a file of our own (pinned below).
    expect(scriptProxies(externalRules(rules))).toEqual([])
    expect(scriptProxies(rules).every(([, to]) => to === '/sw-retire.js')).toBe(true)
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
    // Only the old domain's sw.js rewrites may precede them (next test).
    expect(rules.slice(2, 4)).toEqual(domain)
    // Every external rule is either the beacon proxy or one of these redirects.
    expect(externalRules(rules)).toHaveLength(3)
  })

  it('serves the old domain a self-retiring sw.js, ahead of its 301', () => {
    // An installed worker on frotzsmith.com answers navigations from cache and
    // never sees the 301; its update fetch of sw.js can't follow a cross-origin
    // redirect. So sw.js there is rewritten (200) to a worker that unregisters.
    expect(rules.slice(0, 2)).toEqual([
      ['https://frotzsmith.com/sw.js', '/sw-retire.js', '200!'],
      ['https://www.frotzsmith.com/sw.js', '/sw-retire.js', '200!'],
    ])
    const sw = readFileSync(resolve(root, 'public', 'sw-retire.js'), 'utf8')
    expect(sw).toContain('self.skipWaiting()')
    expect(sw).toContain('self.registration.unregister()')
    expect(sw).toContain('caches.delete')
  })

  it('serves the vendored tracker that init.js loads', () => {
    expect(existsSync(resolve(root, 'public', 'pa', 'script.js'))).toBe(true)
    expect(readFileSync(resolve(root, 'public', 'pa', 'init.js'), 'utf8')).toContain("s.src = '/pa/script.js'")
  })
})
