// https://nuxt.com/docs/api/configuration/nuxt-config
import { mkdirSync, writeFileSync } from 'node:fs'
import { frotzsmith } from './frotzsmith.config'
import { ifvmsThisFix } from './tools/ifvms-this-fix.mjs'
import { ifvmsTextFix } from './tools/ifvms-text-fix.mjs'
import { buildCommit, frotzsmithVersion } from './tools/version.mjs'

// All app-wide constants live in frotzsmith.config.ts (single source of truth).
const SITE_URL = frotzsmith.siteUrl

// One version number (desktop/package.json) and the commit being built, for About.
const VERSION = frotzsmithVersion()
const COMMIT = buildCommit()
// The Electron desktop build sets FROTZSMITH_DESKTOP=1.
const DESKTOP = process.env.FROTZSMITH_DESKTOP === '1'
// The service worker's kill switch: a deploy built with FROTZSMITH_SW_KILL=1 ships a worker that
// unregisters itself, deletes every cache and reloads its pages (docs/06-security.md §9.1).
const SW_KILL = process.env.FROTZSMITH_SW_KILL === '1'

export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',

  // Frotzsmith is a pure client-side tool — static, no SSR (ADR-011).
  ssr: false,

  // No service worker in the desktop build (its updates come from its own
  // updater): no PWA module, no web manifest, no registration plugin.
  modules: ['@nuxt/ui', ...(DESKTOP ? [] : ['@vite-pwa/nuxt'])],

  // Offline website (Drafter's model). The worker precaches the app's own
  // files; ZILF's .NET runtime (~13 MB) is the one thing cached at runtime,
  // on first compile, so a visitor who never compiles ZIL downloads none of
  // it. A new version waits ('prompt') until the author presses Reload
  // (UpdatePrompt.vue); the module's own client plugin is off and
  // plugins/service-worker.client.ts registers the worker instead.
  // tools/check-sw.mjs checks the generated sw.js after every build.
  pwa: {
    registerType: 'prompt',
    // The one path that reloads pages without the author: removing the worker for good. A
    // rollback alone can't (a 404 for sw.js leaves installed workers serving their precache).
    selfDestroying: SW_KILL,
    client: { registerPlugin: false, installPrompt: false, periodicSyncForUpdates: 0 },
    devOptions: { enabled: false },
    manifest: {
      name: 'Frotzsmith',
      short_name: 'Frotzsmith',
      description: frotzsmith.description,
      lang: 'en',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#0b0b0e',
      theme_color: '#0b0b0e',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      // Every file the app needs, by extension: the pages, the chunks and
      // workers in _nuxt/ (the Inform 6 compiler's wasm among them), the
      // Parchment player under play/, the bundled demo story (.z5), fonts
      // and icons.
      globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,wasm,woff2,z5}'],
      // Not precached: ZILF (runtime-cached below), the first-party Plausible
      // proxy, the social-sharing image, and the hosting fallbacks.
      globIgnores: ['zilf/**', 'pa/**', 'og-image.*', '200.html', '404.html'],
      // Headroom over Workbox's 2 MiB default, so a compiler wasm that grows
      // is still precached rather than silently dropped (with a warning).
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      // A navigation with no precached page gets the app shell, so a reload
      // works offline anywhere. Not for a path that names a file.
      navigateFallback: '/',
      navigateFallbackDenylist: [/\/[^/?]+\.[^/]+$/],
      // Workbox's defaults (utm_*, fbclid), plus the play iframe's per-load
      // params (/play/index.html?story=<blob>&theme=…&n=<nonce>): without
      // them every Play would miss the precached player offline.
      ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^story$/, /^theme$/, /^n$/],
      runtimeCaching: [
        {
          // A function, not a RegExp: Workbox matches a RegExp against the
          // full URL (origin included). The path is revisioned
          // (/zilf/r<rev>/), so CacheFirst never serves a stale runtime;
          // only a 200 is kept, never a 404 or an opaque response.
          urlPattern: ({ url }) => /^\/zilf\/r[^/]+\/_framework\//.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'frotzsmith-zilf',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 120 },
          },
        },
      ],
      cleanupOutdatedCaches: true,
      // The first visit's page is controlled once the worker is active; a
      // later update waits for the author ('prompt').
      clientsClaim: true,
      skipWaiting: false,
    },
  },

  // Nothing reloads by itself (only the author's Reload does, after the pending saves are written).
  // Nuxt's defaults would: its hourly check for a newer build (checkOutdatedBuildInterval) has the
  // next in-app navigation reload the page, and a chunk that fails to load reloads it too
  // (emitRouteChunkError: 'automatic'). The hourly check is off — the service worker plugin asks
  // for a new version instead, which only raises the offer — and a chunk error is handled by
  // plugins/service-worker.client.ts (`app:chunkError` shows the offer). The app manifest stays
  // on: the route-rules middleware reads it.
  experimental: {
    checkOutdatedBuildInterval: false,
    emitRouteChunkError: 'manual',
  },

  // The replay engine runs in a module Worker (`{ type: 'module' }`, see
  // useReplay) whose import chain code-splits (e.g. the lazily-loaded glkapi).
  // Code-splitting needs an ESM worker bundle; Vite's default 'iife' can't do it.
  //
  // ifvmsThisFix: ifvms has one top-level `this.e` that Rollup's CommonJS
  // wrapper turns into a crash in the production build — every headless
  // replay died with "reading 'e'". Applied to both the worker and the client
  // graphs (see tools/ifvms-this-fix.mjs).
  //
  // ifvmsTextFix: a story's Unicode table could inject JavaScript through
  // ifvms's abbreviation JIT (audit 2026-11-04, F2). Same build-fails-if-the-
  // line-moves style (see tools/ifvms-text-fix.mjs).
  vite: {
    define: {
      __FROTZSMITH_VERSION__: JSON.stringify(VERSION),
      __FROTZSMITH_COMMIT__: JSON.stringify(COMMIT?.commit ?? 'unknown'),
      __FROTZSMITH_COMMIT_DATE__: JSON.stringify(COMMIT?.date ?? ''),
      __FROTZSMITH_DESKTOP__: JSON.stringify(DESKTOP),
    },
    plugins: [ifvmsThisFix(), ifvmsTextFix()],
    worker: {
      format: 'es',
      plugins: () => [ifvmsThisFix(), ifvmsTextFix()],
    },
  },

  // Dump the client build manifest for tools/inject-preloads.mjs, which runs
  // after `nuxt generate` (postgenerate) and injects <link rel="modulepreload">
  // hints for each route's page + IDE chunk chain into the generated HTML.
  // ssr:false ships an empty shell, so without hints the browser discovers
  // those chunks serially — entry → route resolve → page chunk → IDE chunk —
  // which is the LCP waterfall Lighthouse flags as the network-dependency tree.
  hooks: {
    'build:manifest': (manifest) => {
      // Never preload Web Worker chunks into the page. Nuxt 4.6 began emitting
      // <link rel=modulepreload> for them (~234 KB gz of compiler/replay
      // workers on every first visit) — but a Worker fetches its own script,
      // so the page-level preload can't help it. The worker URLs come from
      // `new Worker(new URL(...))` in code, not from this manifest, so turning
      // their hints off changes nothing else. tools/inject-preloads.mjs fails
      // the build if one comes back.
      for (const chunk of Object.values(manifest)) {
        if (/\.worker-[^/]*\.js$/.test(chunk.file ?? '')) {
          chunk.preload = false
          chunk.prefetch = false
        }
      }
      mkdirSync('.nuxt', { recursive: true })
      writeFileSync('.nuxt/client-manifest.json', JSON.stringify(manifest, null, 2))
    },
    // The desktop build has no PWA module, so the plugin that registers its
    // worker (and imports the module's `virtual:pwa-register`) is left out.
    'app:resolve'(app) {
      if (DESKTOP) {
        app.plugins = app.plugins.filter(
          (plugin) => !plugin.src.endsWith('/plugins/service-worker.client.ts'),
        )
      }
    },
    // The module turns each page's `x/index.html` into the precache entry `x`
    // (and `index.html` into `/`), which answers `/x` only. The play iframe
    // loads `/play/index.html?story=…` by name, and `/zil/` resolves to
    // `zil/index.html` (Workbox's directoryIndex): offline, both would miss.
    // Each page is listed under its file name too (same revision).
    // tools/check-sw.mjs checks that they are.
    'pwa:beforeBuildServiceWorker'(options) {
      type Entry = { url: string; revision?: string | null; size?: number }
      const workbox = options.workbox as {
        manifestTransforms?: Array<(entries: Entry[]) => unknown>
      }
      workbox.manifestTransforms = [
        ...(workbox.manifestTransforms ?? []),
        async (entries: Entry[]) => ({
          manifest: [
            ...entries,
            ...entries.flatMap((entry) =>
              entry.url === '/'
                ? [{ ...entry, url: 'index.html' }]
                : /^[^_./][^.]*$/.test(entry.url)
                  ? [{ ...entry, url: `${entry.url}/index.html` }]
                  : [],
            ),
          ],
          warnings: [],
        }),
      ]
    },
  },

  // Name components by filename (e.g. <SourcePane>), not directory-prefixed.
  components: [{ path: '~/components', pathPrefix: false }],

  // Nuxt UI 4 bundles Tailwind v4; this CSS entry pulls both in.
  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },

  // Dark mode by default, with an accessible toggle that persists (D15).
  colorMode: {
    preference: 'dark',
  },

  // Bundle used icons into the client (scan the source) so none are fetched from
  // api.iconify.design at runtime — works offline and under a strict CSP.
  // Requires @iconify-json/lucide (installed).
  icon: {
    clientBundle: {
      scan: true,
      sizeLimitKb: 512,
    },
  },

  app: {
    head: {
      title: 'Frotzsmith — Interactive Fiction IDE',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: frotzsmith.description },
        { name: 'theme-color', content: '#0b0b0e' },
        { name: 'robots', content: 'index, follow' },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Frotzsmith' },
        { property: 'og:title', content: 'Frotzsmith — a browser-based Interactive Fiction IDE' },
        {
          property: 'og:description',
          content: 'Write, compile, and play interactive fiction entirely in your browser — Inform 6 and ZIL.',
        },
        { property: 'og:url', content: `${SITE_URL}/` },
        { property: 'og:image', content: `${SITE_URL}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Frotzsmith — a browser-based Interactive Fiction IDE' },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Frotzsmith — a browser-based Interactive Fiction IDE' },
        {
          name: 'twitter:description',
          content: 'Write, compile, and play interactive fiction entirely in your browser — Inform 6 and ZIL.',
        },
        { name: 'twitter:image', content: `${SITE_URL}/og-image.png` },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        ...(DESKTOP ? [] : [{ rel: 'manifest' as const, href: '/manifest.webmanifest' }]),
        // canonical is set per page (index/zil/technical) — a global one would
        // declare every route a duplicate of the homepage.
      ],
      // Privacy-friendly analytics by Plausible (no cookies, no personal
      // data), first-party: the tracker is a VENDORED, reviewed copy
      // (public/pa/script.js, sha256 in tools/vendored-files.json), and only
      // the event beacon /pa/event is proxied to plausible.io by
      // public/_redirects (not netlify.toml — Nitro's catch-all shadows toml
      // redirects). That closes the 2026-06-30 SRI item / 2026-11-04 F5 and
      // lets CSP drop plausible.io. The bootstrap is a real file
      // (public/pa/init.js), not an inline script. The desktop build ships
      // no analytics at all.
      script: DESKTOP ? [] : [
        // One entry only: init.js runs the queue shim + init() and then
        // injects the async library itself. Two head entries raced — unhead's
        // capo sorting hoists async scripts above blocking ones, so the
        // library could boot before its config existed and silently send
        // nothing. Ordering by construction beats ordering by markup.
        { src: '/pa/init.js' },
      ],
    },
  },
})
