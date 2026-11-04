/** What the About dialog shows: the build's version, commit, and which app it is. */
export interface AboutInfo {
  version: string
  commit: string
  date: string
  app: 'web' | 'desktop'
}

/** True in the Electron desktop build (FROTZSMITH_DESKTOP=1 at build time). */
export function isDesktopBuild(): boolean {
  return __FROTZSMITH_DESKTOP__
}

/** The running build's identity, from the constants nuxt.config.ts defines at build time. */
export function currentAbout(): AboutInfo {
  return {
    version: __FROTZSMITH_VERSION__,
    commit: __FROTZSMITH_COMMIT__,
    date: __FROTZSMITH_COMMIT_DATE__,
    app: isDesktopBuild() ? 'desktop' : 'web',
  }
}
