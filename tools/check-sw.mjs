#!/usr/bin/env node
// Post-build check of the service worker @vite-pwa/nuxt generated (sw.js).
//
// The worker decides what works offline and what a visitor downloads, and a
// config slip there fails silently: ZILF's ~13 MB .NET runtime precached for
// every visitor, the play iframe's per-load `story`/`theme`/`n` params
// missing the cache, a 404 cached forever for the compiler. This reads the
// built sw.js as text (no Workbox import) and fails the build on any of it.
//
// The desktop build (FROTZSMITH_DESKTOP=1) has no worker at all; there the
// check is that neither sw.js nor the web manifest was emitted.
//
// Usage: node tools/check-sw.mjs [publicDir=.output/public]
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Precached in every good build. */
const REQUIRED = [
  'index.html',
  'zil/index.html',
  'technical/index.html',
  'play/index.html',
  'play/web/zvm.js',
  'play/web/main.js',
]

/** Never precached: not the app's own files, or fetched only on demand (ZILF). */
const FORBIDDEN = ['zilf/', 'pa/', 'og-image', '200.html', '404.html']

/** The play iframe's per-load query params: without these ignored, offline Play misses the cache. */
const IGNORED_PARAMS = ['story', 'theme', 'n']

const ZILF_CACHE = 'frotzsmith-zilf'

/** The precache manifest's URLs: the `url:"…"` pairs Workbox emits. */
export function precachedUrls(sw) {
  return [...sw.matchAll(/\burl:"([^"]*)"/g)].map((m) => m[1])
}

/** Problems with the web build's sw.js in `publicDir`; empty means OK. */
export function checkServiceWorker(publicDir) {
  const file = join(publicDir, 'sw.js')
  if (!existsSync(file)) return [`sw.js is missing from ${publicDir}`]
  const sw = readFileSync(file, 'utf8')
  const problems = []

  const urls = precachedUrls(sw)
  for (const url of urls) {
    const bad = FORBIDDEN.find((prefix) => url.startsWith(prefix))
    if (bad) problems.push(`sw.js precaches ${url} (nothing under "${bad}" may be precached)`)
  }
  for (const url of REQUIRED) {
    if (!urls.includes(url)) problems.push(`sw.js does not precache ${url}`)
  }
  if (!urls.some((url) => /^_nuxt\/inform6[^/]*\.wasm$/.test(url))) {
    problems.push('sw.js does not precache the Inform 6 compiler (_nuxt/inform6*.wasm)')
  }

  const ignored = sw.match(/ignoreURLParametersMatching:\[([^\]]*)\]/)
  if (!ignored) {
    problems.push('sw.js has no ignoreURLParametersMatching (the play iframe params would miss the precache)')
  } else {
    for (const param of IGNORED_PARAMS) {
      if (!ignored[1].includes(`/^${param}$/`)) {
        problems.push(`sw.js does not ignore the URL parameter "${param}" (offline Play would miss the precache)`)
      }
    }
  }

  const zilf = sw.indexOf(`cacheName:"${ZILF_CACHE}"`)
  if (zilf === -1) {
    problems.push(`sw.js has no ZILF runtime route (cache "${ZILF_CACHE}")`)
  } else {
    // The route's options object: from its cacheName to the end of its plugins list.
    const options = sw.slice(zilf, sw.indexOf('"GET"', zilf) === -1 ? zilf + 400 : sw.indexOf('"GET"', zilf))
    if (!/CacheableResponsePlugin\(\{statuses:\[200\]\}\)/.test(options)) {
      problems.push(`sw.js's ZILF route (cache "${ZILF_CACHE}") does not cache status 200 only`)
    }
  }

  return problems
}

/** Problems with the desktop build in `publicDir`: it must have no worker and no web manifest. */
export function checkNoServiceWorker(publicDir) {
  return ['sw.js', 'manifest.webmanifest']
    .filter((name) => existsSync(join(publicDir, name)))
    .map((name) => `${name} is present in the desktop build (${publicDir}); it must have no service worker`)
}

/** The check for the build mode: the desktop build has no worker, the web build a correct one. */
export function checkBuild(publicDir, { desktop }) {
  return desktop ? checkNoServiceWorker(publicDir) : checkServiceWorker(publicDir)
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMain) {
  const publicDir = resolve(process.argv[2] ?? '.output/public')
  const desktop = process.env.FROTZSMITH_DESKTOP === '1'
  const problems = checkBuild(publicDir, { desktop })
  if (problems.length) {
    for (const problem of problems) console.error(`check-sw: ${problem}`)
    process.exit(1)
  }
  if (desktop) {
    console.log('check-sw: OK — desktop build has no service worker or web manifest')
  } else {
    const count = precachedUrls(readFileSync(join(publicDir, 'sw.js'), 'utf8')).length
    console.log(`check-sw: OK — ${count} precached entries, ZILF cached at runtime (${ZILF_CACHE})`)
  }
}
