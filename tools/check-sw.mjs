#!/usr/bin/env node
// Post-build check of the service worker @vite-pwa/nuxt generated (sw.js).
//
// The worker decides what works offline and what a visitor downloads, and a
// config slip there fails silently: ZILF's ~13 MB .NET runtime precached for
// every visitor, the play iframe's per-load `story`/`theme`/`n` params
// missing the cache, a 404 cached forever for the compiler. The checker is
// @frotzinc/nuxt-base (netlify/check-sw); this file is frotzsmith's config.
//
// The desktop build (FROTZSMITH_DESKTOP=1) has no worker at all; there the
// check is that neither sw.js nor the web manifest was emitted. The kill-switch
// build (FROTZSMITH_SW_KILL=1, docs/06-security.md §9.1) ships the
// self-destroying worker instead; there the check is that sw.js is that worker
// and precaches nothing.
//
// Usage: node tools/check-sw.mjs [publicDir]
//   publicDir defaults to wherever this generate wrote the site: dist/ on
//   Netlify (its preset), .output/public elsewhere — see resolveOutDir.
import * as base from '@frotzinc/nuxt-base/netlify/check-sw'

export { checkSelfDestroyingWorker, precachedUrls } from '@frotzinc/nuxt-base/netlify/check-sw'

const ZILF_CACHE = 'frotzsmith-zilf'

/** frotzsmith's expectations of its web build's sw.js. */
export const CONFIG = {
  /** Precached in every good build. */
  required: [
    'index.html',
    'zil/index.html',
    'technical/index.html',
    'play/index.html',
    'play/web/zvm.js',
    'play/web/main.js',
  ],
  /** Never precached: not the app's own files, or fetched only on demand (ZILF). */
  forbidden: ['zilf/', 'pa/', 'og-image', '200.html', '404.html'],
  requiredMatches: [{ pattern: /^_nuxt\/inform6[^/]*\.wasm$/, what: 'the Inform 6 compiler (_nuxt/inform6*.wasm)' }],
  /** The play iframe's per-load query params: without these ignored, offline Play misses the cache. */
  ignoredParams: ['story', 'theme', 'n'],
  ignoredParamsWhy: 'offline Play would miss the precache',
  runtimeCaches: [{ cacheName: ZILF_CACHE, label: 'ZILF', handler: 'CacheFirst', only200: true, pathname: true }],
}

/** Problems with the web build's sw.js in `publicDir`; empty means OK. */
export const checkServiceWorker = (publicDir) => base.checkServiceWorker(publicDir, CONFIG)

/** Problems with the desktop build in `publicDir`: it must have no worker and no web manifest. */
export const checkNoServiceWorker = (publicDir) => base.checkNoServiceWorker(publicDir, 'the desktop build')

/**
 * The check for the build mode: the desktop build has no worker, the kill-switch build the
 * self-destroying one, the web build a correct one.
 */
export function checkBuild(publicDir, { desktop, kill = false }) {
  return base.checkBuild(publicDir, { noWorker: desktop, kill, noWorkerWhat: 'the desktop build' }, CONFIG)
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMain) {
  base.runCheckSw(CONFIG, {
    ...(process.argv[2] ? { publicDir: process.argv[2] } : {}),
    noWorker: process.env.FROTZSMITH_DESKTOP === '1',
    noWorkerWhat: 'desktop build',
    kill: process.env.FROTZSMITH_SW_KILL === '1',
    okNote: `ZILF cached at runtime (${ZILF_CACHE})`,
  })
}
