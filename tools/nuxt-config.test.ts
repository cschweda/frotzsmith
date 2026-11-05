/**
 * nuxt.config.ts — the settings that keep "nothing reloads by itself" true.
 *
 * Nuxt's defaults reload the page on their own: an hourly check for a newer
 * build has the next in-app navigation reload (checkOutdatedBuildInterval), and
 * a chunk that fails to load reloads too (emitRouteChunkError: 'automatic').
 * Neither writes the pending saves first. These pin them off, and pin the
 * kill switch to its env var.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

type Config = {
  experimental?: { checkOutdatedBuildInterval?: number | false; emitRouteChunkError?: string }
  pwa?: { registerType?: string; selfDestroying?: boolean; workbox?: { skipWaiting?: boolean } }
  app?: { head?: { script?: Array<{ src?: string }> } }
}

async function load(env: Record<string, string | undefined> = {}): Promise<Config> {
  vi.resetModules()
  vi.stubGlobal('defineNuxtConfig', (config: Config) => config)
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value as string)
  return (await import('../nuxt.config')).default as Config
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('nuxt.config', () => {
  it("turns off Nuxt's hourly outdated-build check (it reloads on the next navigation)", async () => {
    const config = await load()
    expect(config.experimental?.checkOutdatedBuildInterval).toBe(false)
  })

  it("handles chunk errors itself ('manual'), so Nuxt does not reload on one", async () => {
    const config = await load()
    expect(config.experimental?.emitRouteChunkError).toBe('manual')
  })

  it('waits for the author to apply a new version', async () => {
    const config = await load()
    expect(config.pwa?.registerType).toBe('prompt')
    expect(config.pwa?.workbox?.skipWaiting).toBe(false)
  })

  it('ships the normal worker unless FROTZSMITH_SW_KILL=1', async () => {
    expect((await load({ FROTZSMITH_SW_KILL: '' })).pwa?.selfDestroying).toBe(false)
    expect((await load({ FROTZSMITH_SW_KILL: '1' })).pwa?.selfDestroying).toBe(true)
  })

  it('the website loads first-party analytics; the desktop build loads none', async () => {
    expect((await load({ FROTZSMITH_DESKTOP: '' })).app?.head?.script?.map(s => s.src)).toEqual(['/pa/init.js'])
    expect((await load({ FROTZSMITH_DESKTOP: '1' })).app?.head?.script ?? []).toEqual([])
  })
})
