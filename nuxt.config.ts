// https://nuxt.com/docs/api/configuration/nuxt-config
import { mkdirSync, writeFileSync } from 'node:fs'
import { frotzsmith } from './frotzsmith.config'

// All app-wide constants live in frotzsmith.config.ts (single source of truth).
const SITE_URL = frotzsmith.siteUrl

export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',

  // Frotzsmith is a pure client-side tool — static, no SSR (ADR-011).
  ssr: false,

  modules: ['@nuxt/ui'],

  // The replay engine runs in a module Worker (`{ type: 'module' }`, see
  // useReplay) whose import chain code-splits (e.g. the lazily-loaded glkapi).
  // Code-splitting needs an ESM worker bundle; Vite's default 'iife' can't do it.
  vite: {
    worker: {
      format: 'es',
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
      mkdirSync('.nuxt', { recursive: true })
      writeFileSync('.nuxt/client-manifest.json', JSON.stringify(manifest, null, 2))
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
        // canonical is set per page (index/zil/technical) — a global one would
        // declare every route a duplicate of the homepage.
      ],
      // Privacy-friendly analytics by Plausible (no cookies, no personal
      // data), served FIRST-PARTY via the netlify.toml /pa/* proxy — closes
      // the audit's SRI item (no third-party script execution) and lets CSP
      // drop plausible.io. The bootstrap is a real file (public/pa/init.js),
      // not an inline script.
      script: [
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
