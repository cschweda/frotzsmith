/**
 * inject-preloads — postgenerate step (see package.json). The work is done by
 * @frotzinc/nuxt-base (netlify/inject-preloads): it reads the client manifest
 * the layer's `build:manifest` hook dumps and injects <link rel="modulepreload">
 * hints for each route's page + IDE chunk chain, so all of it downloads in
 * parallel from the first byte. This file is frotzsmith's route table.
 */
import { runInjectPreloads } from '@frotzinc/nuxt-base/netlify/inject-preloads'

export {
  collectChunks,
  injectPreloads,
  resolveOutDir,
  workerPreloads,
} from '@frotzinc/nuxt-base/netlify/inject-preloads'

// Route table: generated HTML file → its page component's manifest key.
const ROUTES = {
  'index.html': 'pages/index.vue',
  'zil/index.html': 'pages/zil.vue',
  'technical/index.html': 'pages/technical.vue',
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isMain) runInjectPreloads({ routes: ROUTES })
