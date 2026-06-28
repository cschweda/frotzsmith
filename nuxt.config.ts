// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',

  // Frotzsmith is a pure client-side tool — static, no SSR (ADR-011).
  ssr: false,

  modules: ['@nuxt/ui'],

  // Name components by filename (e.g. <SourcePane>), not directory-prefixed.
  components: [{ path: '~/components', pathPrefix: false }],

  // Nuxt UI 4 bundles Tailwind v4; this CSS entry pulls both in.
  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },

  // Dark mode by default, with an accessible toggle that persists (D15).
  colorMode: {
    preference: 'dark',
  },

  app: {
    head: {
      title: 'Frotzsmith — Inform 6 IDE',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'A browser-based IDE for Inform 6 — compile and play, client-side.',
        },
      ],
    },
  },
})
