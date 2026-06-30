// https://nuxt.com/docs/api/configuration/nuxt-config
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
      title: 'Frotzsmith — Inform 6 IDE',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: frotzsmith.description },
        { name: 'theme-color', content: '#0b0b0e' },
        { name: 'robots', content: 'index, follow' },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Frotzsmith' },
        { property: 'og:title', content: 'Frotzsmith — a browser-based Inform 6 IDE' },
        {
          property: 'og:description',
          content: 'Write, compile, and play Inform 6 interactive fiction entirely in your browser.',
        },
        { property: 'og:url', content: `${SITE_URL}/` },
        { property: 'og:image', content: `${SITE_URL}/og-image.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Frotzsmith — a browser-based Inform 6 IDE' },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Frotzsmith — a browser-based Inform 6 IDE' },
        {
          name: 'twitter:description',
          content: 'Write, compile, and play Inform 6 interactive fiction entirely in your browser.',
        },
        { name: 'twitter:image', content: `${SITE_URL}/og-image.png` },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'canonical', href: `${SITE_URL}/` },
      ],
      // Privacy-friendly analytics by Plausible (no cookies, no personal data).
      script: [
        { src: 'https://plausible.io/js/pa-2FCOIzY7AvsOrnssGbGde.js', async: true },
        {
          innerHTML:
            'window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()',
        },
      ],
    },
  },
})
