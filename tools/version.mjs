// frotzsmith's version and the build's commit, read at build time (nuxt.config.ts defines them as
// `__FROTZSMITH_VERSION__`, `__FROTZSMITH_COMMIT__`, and `__FROTZSMITH_COMMIT_DATE__` for About).
// The version is the desktop app's (desktop/package.json): the one a release tag must equal,
// so the web build and the desktop app agree. The root package.json carries it too;
// tools/version.test.ts checks that. The readers come from @frotzinc/nuxt-base.
import { buildCommit as commitIn, packageVersion } from '@frotzinc/nuxt-base/netlify/version'

const ROOT = new URL('../', import.meta.url)

/** The repository's version, such as `0.1.0`. */
export function frotzsmithVersion() {
  return packageVersion(new URL('desktop/package.json', ROOT))
}

/** The commit being built (short hash + date), or null without git. */
export function buildCommit() {
  return commitIn(ROOT)
}
