// Stand-in for vite-plugin-pwa's `virtual:pwa-register` (it exists only in a Nuxt build), so the
// service-worker plugin can be imported under Vitest; tests replace it with vi.mock.
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {}
}
