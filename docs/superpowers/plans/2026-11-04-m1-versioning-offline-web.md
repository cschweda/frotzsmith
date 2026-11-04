# Milestone 1 — Versioning, About & Offline Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Frotzsmith one version number (shown in an About view with Check for updates), and make the website installable and usable offline through a service worker that offers — never forces — a Reload when a new deploy is waiting.

**Architecture:** A build-time version/commit (read by `tools/version.mjs`, injected with Vite `define`) feeds an About modal. `@vite-pwa/nuxt` generates a Workbox service worker that precaches the app's own files; the ~13 MB ZILF runtime is cached at runtime on first use only. Our own client plugin (not the module's) registers the worker and drives Drafter's update model: a waiting version raises a toast; Reload flushes pending autosaves, then lets the new worker take over and reloads.

**Tech Stack:** Nuxt 4.4.8 (ssr:false, Netlify preset), `@vite-pwa/nuxt@1.1.1` (Workbox `generateSW`), Vue 3, @nuxt/ui 4, Vitest 2 + happy-dom.

**Spec:** `docs/superpowers/specs/2026-11-04-desktop-app-design.md` (§5.7, §5.8; milestone 1 of §9). **Canonical model:** Drafter — read these before writing the matching file here (fetch with `gh api repos/cschweda/drafter/contents/<path> -q .content | base64 -d`): `apps/web/nuxt.config.ts` (the `pwa` block and `app:resolve` hook), `apps/web/scripts/version.mjs`, `apps/web/test/version.test.ts`, `apps/web/app/plugins/service-worker.client.ts`, `apps/web/app/update/{state,flow,updated,check,use-check}.ts`, `apps/web/app/components/{UpdatePrompt,UpdateCheckDialog}.vue`.

## Global Constraints

- Version source of truth: `desktop/package.json` `"version"`, starting at `0.1.0`; root `package.json` carries the same value.
- Build defines (exact names): `__FROTZSMITH_VERSION__`, `__FROTZSMITH_COMMIT__`, `__FROTZSMITH_COMMIT_DATE__`, `__FROTZSMITH_DESKTOP__` (true iff env `FROTZSMITH_DESKTOP=1`).
- The desktop build (`FROTZSMITH_DESKTOP=1`) gets **no** service worker, no web manifest, no registration plugin (Drafter's `app:resolve` filter).
- **Nothing reloads or updates by itself.** Every reload starts with the author pressing Reload. `registerType: 'prompt'`, `skipWaiting: false`, `clientsClaim: true`, module client plugin off.
- Precache the app's own files; **never** precache `zilf/**`, `pa/**`, `og-image.*`, `200.html`, `404.html`.
- ZILF (`/zilf/r<rev>/_framework/*`) is cached **at runtime, CacheFirst, only status 200**, cache name `frotzsmith-zilf` — a visitor who never compiles ZIL downloads none of it. (Deviation from Drafter's "no runtime caching": forced by the spec's 13 MB constraint.)
- Copy (exact): toast "A new version of Frotzsmith is ready" with buttons **Reload** / **Later**; while applying "Getting the newest version…"; after an author-chosen update "Frotzsmith is up to date."
- Existing gates stay green: `yarn test`, `yarn typecheck`, `yarn generate` (postgenerate: inject-preloads + replay smoke), axe zero violations.

## Review Focus

1. **Offline reload at any route** (`/`, `/zil/`, `/zil`, `/technical`) → the IDE shell loads and routes client-side. Test in Task 3 (build check) + Task 6 (browser).
2. **Play iframe offline** — `/play/index.html?story=blob:…&theme=dark&n=3` must hit the precache despite its query. Test in Task 3 (`ignoreURLParametersMatching` covers `story`, `theme`, `n`) + Task 6.
3. **ZIL offline**: after one online ZIL compile, an offline ZIL compile works; a never-used ZIL offline fails with the existing compile-error result, not a hang; a 404 from `/zilf/` is never cached. Test in Task 3 (route config) + Task 6.
4. **A deploy lands while a tab is open (or two tabs)** → toast appears; no tab reloads by itself; Reload in tab A leaves tab B on its offer (Drafter's `replaced`). Test in Task 2 (`createControllerWatch`).
5. **Reload within 1 s of typing** → the edit survives (source debounce + Skein 500 ms save flushed first). Test in Task 2 (`flushBeforeReload` calls both, bounded at 1000 ms).

---

### Task 1: One version number, build commit, About data

**Files:**
- Create: `desktop/package.json`, `tools/version.mjs`, `tools/version.test.ts`, `app/utils/about.ts`, `app/utils/about.test.ts`
- Modify: `package.json` (version), `nuxt.config.ts` (`vite.define`), `vitest.config.ts` (`define`), `app/shims.d.ts` (globals)

**Interfaces:**
- Produces: `frotzsmithVersion(): string`, `buildCommit(): { commit: string; date: string } | null` (tools/version.mjs, as Drafter's `drafterVersion`/`buildCommit`); `currentAbout(): AboutInfo` where `interface AboutInfo { version: string; commit: string; date: string; app: 'web' | 'desktop' }` (app/utils/about.ts, reads the four defines); `isDesktopBuild(): boolean`.

- [ ] **Step 1: Write the failing tests.** `tools/version.test.ts` (port Drafter's `version.test.ts`): `frotzsmithVersion()` equals `desktop/package.json` version and the root `package.json` version, and matches `/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/`; `buildCommit()` is `null` or `{ commit: /^[0-9a-f]{7,12}$/, date: /^\d{4}-\d{2}-\d{2}$/ }`. `app/utils/about.test.ts`: `currentAbout()` returns `{ version: '0.1.0-test', commit: 'abc1234', date: '2026-11-04', app: 'web' }` given the vitest defines below.
- [ ] **Step 2: Run** `npx vitest run tools/version.test.ts app/utils/about.test.ts` — FAIL (modules missing).
- [ ] **Step 3: Implement.** `desktop/package.json`: `{ "name": "frotzsmith-desktop", "version": "0.1.0", "private": true, "license": "GPL-3.0-or-later" }` (milestone 3 fills it in). Root `package.json` `"version": "0.1.0"`. `tools/version.mjs` as Drafter's (git `log -1 --format=%h %cs`, 5 s timeout, null on failure). `nuxt.config.ts`: compute `VERSION`, `COMMIT`, `DESKTOP = process.env.FROTZSMITH_DESKTOP === '1'`, add the four `vite.define` entries (`JSON.stringify`). `vitest.config.ts`: `define` the four with test values `'0.1.0-test'`, `'abc1234'`, `'2026-11-04'`, `false`. `app/shims.d.ts`: `declare const __FROTZSMITH_VERSION__: string` (etc., `__FROTZSMITH_DESKTOP__: boolean`).
- [ ] **Step 4: Run** the two test files, then `yarn typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(version): one version number (desktop/package.json) with build commit/date defines`.

### Task 2: Update state and flow (pure, no service worker yet)

**Files:**
- Create: `app/update/state.ts`, `app/update/flow.ts`, `app/update/prompt.ts`, `app/update/updated.ts`, `app/update/state.test.ts`, `app/update/flow.test.ts`, `app/update/updated.test.ts`
- Modify: `app/composables/useSourceDocument.ts` (export `flushPendingSave` in the return), `app/composables/useSkein.ts` (add `flushSaves(): Promise<void>` that fires every pending per-bucket timer now and awaits the stores)

**Interfaces:**
- Produces (state.ts, Drafter's names): `needRefresh: Ref<boolean>`, `replaced: Ref<boolean>`, `applyingUpdate: Ref<boolean>`, `setUpdater(fn: () => Promise<void>)`, `applyUpdate(): Promise<void>`, `setBeforeReload(fn: () => Promise<void>)`, `flushBeforeReload(ms = 1000): Promise<void>`, `createControllerWatch({ controlled, reload }): { apply(): void; onChange(): void }`.
- Produces (flow.ts): `UPDATE_READY = 'A new version of Frotzsmith is ready'`, `APPLYING_MESSAGE = 'Getting the newest version…'`, `createUpdateFlow({ apply }): { stage: Ref<'toast' | 'applying'>; reload(): Promise<void> }`. **Deviation from Drafter (state it in a comment):** the web IDE has no file to save — all work lives in browser storage and only debounced writes can be pending — so there is no Save-first/Reload-anyway question; `reload()` just applies. The pending writes are flushed by the plugin's reload via `flushBeforeReload` (as Drafter's plugin does).
- Produces (prompt.ts, as Drafter's): `later: Ref<boolean>` ("Later" hides the offer until next load), `useUpdateFlow()` — one flow per visit, `createUpdateFlow({ apply: applyUpdate })`, mirroring `stage === 'applying'` into `applyingUpdate`.
- Produces (updated.ts): `justUpdated`, `markUpdating(storage)`, `takeUpdated(storage)`, `sessionStore()`, `UP_TO_DATE = 'Frotzsmith is up to date.'`, storage key `'frotzsmith-updated'`.
- Produces: `useSourceDocument().flushPendingSave(): void`; `useSkein().flushSaves(): Promise<void>`.

- [ ] **Step 1: Write the failing tests** (port Drafter's semantics):
  - `createControllerWatch`: uncontrolled first change with no offer → not `replaced`, no reload (first-visit claim); change after `apply()` → `reload` called once; change without `apply()` while controlled → `replaced === true`, `reload` not called.
  - `flushBeforeReload`: awaits the registered flush; a flush that never resolves → returns after `ms` (fake timers, 1000); a rejecting flush → resolves.
  - `createUpdateFlow`: `reload()` calls `apply` once; `stage` is `'applying'` during apply and back to `'toast'` if `apply` returns or throws; `useUpdateFlow()` returns the same instance twice.
  - `takeUpdated`: true once after `markUpdating`, false on the next call; storage that throws → false, no throw.
  - **Review Focus 5:** `useSourceDocument` — type, then `flushPendingSave()` → recovery key written immediately with the new text (fake timers, no advance). `useSkein` — `recordPlayCommand('north')` then `await flushSaves()` → memory store has the node without advancing timers.
- [ ] **Step 2: Run** `npx vitest run app/update app/composables/useSourceDocument.watch.nuxt.test.ts app/composables/useSkein.nuxt.test.ts` — new tests FAIL.
- [ ] **Step 3: Implement** the four modules (Drafter's bodies, renamed copy, trimmed per the deviation) and the two exports.
- [ ] **Step 4: Run** the same command — PASS.
- [ ] **Step 5: Commit** `feat(update): update state, controller watch and reload flow (Drafter model)`.

### Task 3: Service worker — config, registration, icons, headers, build check

**Files:**
- Modify: `package.json` (add `@vite-pwa/nuxt` `1.1.1` exact), `nuxt.config.ts` (`modules`, `pwa`, `hooks['app:resolve']`, manifest `<link>`), `netlify.toml` (headers), `package.json` `postgenerate` (append `&& node tools/check-sw.mjs`)
- Create: `app/plugins/service-worker.client.ts`, `app/update/virtual.d.ts`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `tools/check-sw.mjs`, `tools/check-sw.test.ts`

**Interfaces:**
- Consumes: Task 2's `needRefresh`, `replaced`, `setUpdater`, `createControllerWatch`, `flushBeforeReload`, `markUpdating`, `takeUpdated`, `justUpdated`, `sessionStore`; Task 1's `DESKTOP`.
- Produces: `checkServiceWorker(publicDir: string): string[]` (tools/check-sw.mjs; returns problems, empty = OK; CLI exits 1 on any).

- [ ] **Step 1: Write the failing test** `tools/check-sw.test.ts` against a temp dir fixture: a `sw.js` whose precache list contains `index.html`, `zil/index.html`, `technical/index.html`, `play/index.html`, `play/web/zvm.js`, `play/web/main.js`, an `_nuxt/inform6*.wasm` → `[]`. Each of these yields a named problem: missing `sw.js`; any precached URL starting `zilf/`, `pa/`, `og-image`, `200.html`, `404.html`; missing a required entry; `sw.js` lacking the ZILF runtime route string `frotzsmith-zilf`; `sw.js` lacking `story`, `theme`, `n` in its ignored URL parameters (**Review Focus 2**); ZILF route without a 200-only cacheable-response rule (**Review Focus 3**).
- [ ] **Step 2: Run** `npx vitest run tools/check-sw.test.ts` — FAIL.
- [ ] **Step 3: Implement `checkServiceWorker`** by reading `sw.js` text and extracting the precache manifest entries (`url:"…"` pairs Workbox emits) — no Workbox import.
- [ ] **Step 4: Configure the worker** in `nuxt.config.ts` (`modules: ['@nuxt/ui', ...(DESKTOP ? [] : ['@vite-pwa/nuxt'])]`), `pwa` as Drafter's with these values: manifest `name/short_name: 'Frotzsmith'`, `description: frotzsmith.description`, `background_color/theme_color: '#0b0b0e'`, the three icons; workbox `globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,wasm,woff2,z5}']`, `globIgnores: ['zilf/**', 'pa/**', 'og-image.*', '200.html', '404.html']`, `maximumFileSizeToCacheInBytes: 4 * 1024 * 1024`, `navigateFallback: '/'`, `navigateFallbackDenylist: [/\/[^/?]+\.[^/]+$/]`, `ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^story$/, /^theme$/, /^n$/]`, `runtimeCaching: [{ urlPattern: /^\/zilf\/r[^/]+\/_framework\//, handler: 'CacheFirst', options: { cacheName: 'frotzsmith-zilf', cacheableResponse: { statuses: [200] }, expiration: { maxEntries: 120 } } }]` (match on `url.pathname`), `cleanupOutdatedCaches: true`, `clientsClaim: true`, `skipWaiting: false`; `client: { registerPlugin: false, installPrompt: false, periodicSyncForUpdates: 0 }`, `devOptions: { enabled: false }`. Add `{ rel: 'manifest', href: '/manifest.webmanifest' }` to `app.head.link` unless `DESKTOP`, and the `app:resolve` hook dropping `plugins/service-worker.client.ts` when `DESKTOP`.
- [ ] **Step 5: Implement `app/plugins/service-worker.client.ts`** as Drafter's (TAKEOVER_MS 3000, `fetchNewest` arrives in Task 4 — call it there; for now `setUpdater` does `watch.apply(); await skipWaiting(true)` + fallback). Register `setBeforeReload(async () => { useSourceDocument().flushPendingSave(); await useSkein().flushSaves() })`. Port `virtual.d.ts`.
- [ ] **Step 6: Icons** — rasterize `public/favicon.svg` to the three PNGs (192, 512, and a 512 maskable with ~20% safe padding on `#0b0b0e`) with any SVG rasterizer (e.g. `npx @resvg/resvg-js-cli`); commit the PNGs only.
- [ ] **Step 7: Headers** in `netlify.toml`: `/sw.js` and `/manifest.webmanifest` → `Cache-Control = "no-cache"` (place after `/*`); `workbox-*.js` is hashed and needs nothing.
- [ ] **Step 8: Run** `yarn generate` — PASS including the new `check-sw` and the existing replay smoke; `npx vitest run tools` PASS; `yarn typecheck` PASS. Then `FROTZSMITH_DESKTOP=1 yarn nuxt generate` and confirm `.output/public/sw.js` and `manifest.webmanifest` are **absent** (then rebuild without the flag).
- [ ] **Step 9: Commit** `feat(pwa): offline website — precached app, ZILF cached on first use, prompt-only updates`.

### Task 4: Check for updates

**Files:**
- Create: `app/update/check.ts`, `app/update/check.test.ts`, `app/update/use-check.ts`
- Modify: `app/plugins/service-worker.client.ts` (call `fetchNewest` before applying, as Drafter)

**Interfaces:**
- Consumes: Task 2 state; Task 1 `currentAbout`.
- Produces: `type CheckStatus = 'idle' | 'checking' | 'fetching' | 'latest' | 'ready' | 'unavailable' | 'error'`, `createUpdateCheck(deps: { serviceWorker: { getRegistration(): Promise<RegistrationLike | undefined> } | null; offered(): boolean; installMs?: number }): { state: Ref<{ status: CheckStatus }>; run(): Promise<{ status: CheckStatus }> }`, `fetchNewest(getRegistration, ms = 5000): Promise<void>`, `checkMessage(state, version): string`; use-check.ts: `useUpdateCheck()`, `runUpdateCheck(): Promise<void>` (a `ready` result sets `needRefresh = true`), `takeUpdate(): void` (clears `later`, runs the flow's `reload`). Desktop branches are milestone 3 — leave them out.

- [ ] **Step 1: Write the failing tests** with fake registrations: offer already up → `ready` without calling `update()`; no service worker → `unavailable`; `update()` rejects (offline) → `error`; `waiting` set after update → `ready`; `installing` that reaches `installed` → reports `fetching` then `ready`; reaches `redundant` → `latest`; never settles → `error` after `installMs`; concurrent `run()` calls share one promise. `fetchNewest` resolves by its deadline when `update()` hangs. `checkMessage` strings: `latest` → `Frotzsmith 0.1.0 is the newest version.`; `error` → `Couldn’t check for updates — are you offline?`; `unavailable` → `This copy can’t check for updates.`; `ready` → the `UPDATE_READY` text.
- [ ] **Step 2: Run** `npx vitest run app/update/check.test.ts` — FAIL.
- [ ] **Step 3: Implement** (Drafter's `check.ts` minus desktop), and wire `fetchNewest` into the plugin's updater.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(update): Check for updates — finds the newest deploy, never applies it unasked`.

### Task 5: About modal, update toast, footer entry

**Files:**
- Create: `app/components/ide/AboutModal.vue`, `app/components/ide/UpdatePrompt.vue`
- Modify: `app/components/ide/IdeLayout.vue` (footer button "About · v{version}" opening the modal; mount `<UpdatePrompt />` once), `app/pages/technical.vue` (show the version line)

**Interfaces:**
- Consumes: `currentAbout()`, `useUpdateCheck()/runUpdateCheck()/takeUpdate()/checkMessage()`, `needRefresh`, `applyingUpdate`, `later`, `justUpdated`, `UP_TO_DATE`, `UPDATE_READY`, `APPLYING_MESSAGE`.

- [ ] **Step 1:** `UpdatePrompt.vue` — an always-present `role="status"` region; when `needRefresh && !later` shows `UPDATE_READY` with **Reload** (calls `takeUpdate`) and **Later** (sets `later`); while applying shows `APPLYING_MESSAGE` with buttons disabled; on `justUpdated` shows `UP_TO_DATE` for 4 s (no fade under reduced motion). Focus moves to Reload when the offer appears only if focus was on `<body>` (never steal it from the editor). Style with Nuxt UI tokens (warning tone), bottom-right, not modal.
- [ ] **Step 2:** `AboutModal.vue` (`UModal`, title "About Frotzsmith"): version, `commit · date` (omitted when empty), GPLv3 + repo link, and **Check for updates** button → `runUpdateCheck`, message from `checkMessage` in a `role="status"` line under the version; when `ready`, a **Reload** button (→ `takeUpdate`). Focus returns to the footer button on close.
- [ ] **Step 3: Verify** `yarn typecheck`, `yarn test`, then `yarn generate` and the axe gate on `/`, `/zil/`, `/technical/` (axecap MCP, AA + best practices, desktop and mobile) — zero violations with the modal open too.
- [ ] **Step 4: Commit** `feat(about): About Frotzsmith with Check for updates, and the update toast`.

### Task 6: Offline verification in a real browser, docs

**Files:**
- Modify: `README.md` (offline + "installable" note; About/version), `CHANGELOG.md` (entry), `docs/06-security.md` (service worker: precache scope, ZILF runtime cache, no third-party caching)

- [ ] **Step 1: Serve the build** with `npx http-server .output/public -p 8081 -s -c-1` (not `serve` — it 301s `/play/index.html` and drops the query).
- [ ] **Step 2: Online pass** (Chrome DevTools MCP, fresh isolated context): load `/`, wait for the worker to activate; compile + Play the demo; open `/zil/`, compile the skeleton once (fills `frotzsmith-zilf`).
- [ ] **Step 3: Offline pass** (`emulate networkConditions: 'Offline'`): reload `/`, `/zil/`, `/zil`, `/technical` — each renders (**RF 1**); compile I6 + Play renders the game (**RF 2**); compile ZIL succeeds from cache (**RF 3**); Test Script Run works offline. In a second fresh context that never visited `/zil/` online: offline ZIL compile ends with a compile-error result within the existing timeout, no hang (**RF 3**).
- [ ] **Step 4: Update pass**: with a tab open, rebuild with a trivial change and re-serve; Check for updates finds it; the toast appears; nothing reloads until Reload; type in the editor, press Reload within 1 s → after reload the typed text is present (**RF 5**) and "Frotzsmith is up to date." shows. With two tabs, Reload in one; the other keeps its offer (**RF 4**).
- [ ] **Step 5: Docs** — README: the site works offline after the first visit and can be installed; ZIL works offline once used online; About shows the version. CHANGELOG entry. Security doc §: what the worker caches and that it never caches `/pa/` or third-party responses.
- [ ] **Step 6: Commit** `docs: offline website, versioning and updates`.
