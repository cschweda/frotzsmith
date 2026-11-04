/**
 * check-sw — tests against a temp public dir (node env).
 *
 * The postgenerate step runs the CLI on the real build; these pin what a
 * broken service worker looks like, so a config slip (ZILF precached, the
 * play iframe's per-load params not ignored, a cached 404 for the runtime)
 * fails the build instead of shipping.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkBuild, checkSelfDestroyingWorker, checkServiceWorker } from './check-sw.mjs'

const REQUIRED = [
  '/',
  'index.html',
  'zil/index.html',
  'technical/index.html',
  'play/index.html',
  'play/web/zvm.js',
  'play/web/main.js',
  '_nuxt/inform6.Bx3k9.wasm',
]

const IGNORED = 'ignoreURLParametersMatching:[/^utm_/,/^fbclid$/,/^story$/,/^theme$/,/^n$/]'
const ZILF_ROUTE =
  'e.registerRoute((({url:e})=>/^\\/zilf\\/r[^/]+\\/_framework\\//.test(e.pathname)),new e.CacheFirst({cacheName:"frotzsmith-zilf",plugins:[new e.CacheableResponsePlugin({statuses:[200]}),new e.ExpirationPlugin({maxEntries:120})]}),"GET")'

/** A sw.js shaped like the one generateSW minifies. */
function swText(
  urls: string[] = REQUIRED,
  { ignored = IGNORED, route = ZILF_ROUTE }: { ignored?: string; route?: string } = {},
): string {
  const entries = urls.map((url, i) => `{url:"${url}",revision:${i % 2 ? 'null' : `"r${i}"`}}`).join(',')
  return (
    'define(["./workbox-abc123"],(function(e){"use strict";self.addEventListener("message",(e=>{}));' +
    `e.clientsClaim(),e.precacheAndRoute([${entries}],{${ignored}}),e.cleanupOutdatedCaches(),` +
    'e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("/"),{denylist:[/\\/[^/?]+\\.[^/]+$/]})),' +
    `${route}}));`
  )
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'check-sw-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeSw(text: string) {
  writeFileSync(join(dir, 'sw.js'), text)
}

describe('checkServiceWorker', () => {
  it('passes a worker that precaches the app and caches ZILF at runtime', () => {
    writeSw(swText())
    expect(checkServiceWorker(dir)).toEqual([])
  })

  it('reports a missing sw.js', () => {
    expect(checkServiceWorker(dir)).toEqual([expect.stringMatching(/sw\.js is missing/)])
  })

  it.each([
    'zilf/r5262550/_framework/dotnet.js',
    '/zilf/r5262550/_framework/dotnet.js',
    'pa/init.js',
    '/pa/init.js',
    'og-image.png',
    '/og-image.png',
    '200.html',
    '/404.html',
  ])(
    'reports a precached %s',
    (url) => {
      writeSw(swText([...REQUIRED, url]))
      expect(checkServiceWorker(dir)).toEqual([expect.stringContaining(`precaches ${url}`)])
    },
  )

  it.each(REQUIRED.slice(0, -1))('reports %s missing from the precache', (url) => {
    writeSw(swText(REQUIRED.filter((u) => u !== url)))
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining(`does not precache ${url}`)])
  })

  it('reports no inform6 wasm in the precache', () => {
    writeSw(swText(REQUIRED.filter((u) => !u.endsWith('.wasm'))))
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining('_nuxt/inform6*.wasm')])
  })

  it('reports a worker without the ZILF runtime route', () => {
    writeSw(swText(REQUIRED, { route: '' }))
    const problems = checkServiceWorker(dir)
    expect(problems).toContainEqual(expect.stringContaining('frotzsmith-zilf'))
  })

  it.each(['story', 'theme', 'n'])('reports %s not among the ignored URL parameters', (param) => {
    writeSw(swText(REQUIRED, { ignored: IGNORED.replace(`/^${param}$/,`, '').replace(`,/^${param}$/`, '') }))
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining(`"${param}"`)])
  })

  it('reports a worker with no ignored URL parameters at all', () => {
    writeSw(swText(REQUIRED, { ignored: '' }))
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining('ignoreURLParametersMatching')])
  })

  it('reports a ZILF route that caches responses other than 200', () => {
    writeSw(swText(REQUIRED, { route: ZILF_ROUTE.replace('statuses:[200]', 'statuses:[0,200]') }))
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining('200')])
  })

  it('reports a worker without the "/" app shell (the navigation fallback needs it)', () => {
    writeSw(swText(REQUIRED.filter((u) => u !== '/')))
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining('does not precache /')])
  })

  it('reports a ZILF route that is not CacheFirst', () => {
    writeSw(swText(REQUIRED, { route: ZILF_ROUTE.replace('CacheFirst', 'StaleWhileRevalidate') }))
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining('CacheFirst')])
  })

  it('reports a ZILF route that matches a RegExp on the full URL, not the pathname', () => {
    writeSw(
      swText(REQUIRED, {
        route: ZILF_ROUTE.replace(
          '(({url:e})=>/^\\/zilf\\/r[^/]+\\/_framework\\//.test(e.pathname))',
          '/\\/zilf\\/r[^/]+\\/_framework\\//',
        ),
      }),
    )
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining('pathname')])
  })

  it('reports a ZILF route with no cacheable-response rule', () => {
    writeSw(
      swText(REQUIRED, {
        route: ZILF_ROUTE.replace('new e.CacheableResponsePlugin({statuses:[200]}),', ''),
      }),
    )
    expect(checkServiceWorker(dir)).toEqual([expect.stringContaining('200')])
  })
})

/** vite-plugin-pwa's self-destroying sw.js (selfDestroying: true), as it writes it. */
const KILL_SW = `
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  self.registration.unregister()
    .then(() => self.clients.matchAll())
    .then((clients) => {
      clients.forEach((client) => {
        if (client instanceof WindowClient)
          client.navigate(client.url);
      });
      return Promise.resolve();
    })
    .then(() => {
      self.caches.keys().then((cacheNames) => {
        Promise.all(
          cacheNames.map((cacheName) => {
            return self.caches.delete(cacheName);
          }),
        );
      })
    });
});
    `

describe('checkSelfDestroyingWorker', () => {
  it('passes the self-destroying worker', () => {
    writeSw(KILL_SW)
    expect(checkSelfDestroyingWorker(dir)).toEqual([])
  })

  it('reports a missing sw.js (installed workers would never be replaced)', () => {
    expect(checkSelfDestroyingWorker(dir)).toEqual([expect.stringMatching(/sw\.js is missing/)])
  })

  it('reports the normal precaching worker', () => {
    writeSw(swText())
    const problems = checkSelfDestroyingWorker(dir)
    expect(problems).toContainEqual(expect.stringContaining('unregister itself'))
    expect(problems).toContainEqual(expect.stringContaining('still precaches'))
  })

  it.each([
    ['self.skipWaiting();', 'take over at once'],
    ['self.registration.unregister()', 'unregister itself'],
    ['self.caches.delete(cacheName)', 'delete the caches'],
    ['client.navigate(client.url);', 'reload its pages'],
  ])('reports a worker without %s', (part, what) => {
    writeSw(KILL_SW.replace(part, ''))
    expect(checkSelfDestroyingWorker(dir)).toEqual([expect.stringContaining(what)])
  })
})

describe('checkBuild', () => {
  it('kill mode checks for the self-destroying worker', () => {
    writeSw(swText())
    expect(checkBuild(dir, { desktop: false, kill: true })).not.toEqual([])
    writeSw(KILL_SW)
    expect(checkBuild(dir, { desktop: false, kill: true })).toEqual([])
    // The web check would reject it.
    expect(checkBuild(dir, { desktop: false })).not.toEqual([])
  })

  it('desktop mode wins over kill mode (the desktop build has no worker at all)', () => {
    expect(checkBuild(dir, { desktop: true, kill: true })).toEqual([])
  })

  it('web mode checks the worker', () => {
    expect(checkBuild(dir, { desktop: false })).toEqual([expect.stringMatching(/sw\.js is missing/)])
    writeSw(swText())
    expect(checkBuild(dir, { desktop: false })).toEqual([])
  })

  it('desktop mode passes when there is no worker and no web manifest', () => {
    expect(checkBuild(dir, { desktop: true })).toEqual([])
  })

  it('desktop mode reports a worker or a web manifest', () => {
    writeSw(swText())
    writeFileSync(join(dir, 'manifest.webmanifest'), '{}')
    expect(checkBuild(dir, { desktop: true })).toEqual([
      expect.stringContaining('sw.js'),
      expect.stringContaining('manifest.webmanifest'),
    ])
  })
})
