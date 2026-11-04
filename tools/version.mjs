// Frotzsmith's version and the build's commit, read at build time (nuxt.config.ts defines them as
// `__FROTZSMITH_VERSION__`, `__FROTZSMITH_COMMIT__`, and `__FROTZSMITH_COMMIT_DATE__` for About).
// The version is the desktop app's (desktop/package.json): the one a release tag must equal,
// so the web build and the desktop app agree. The root package.json carries it too;
// tools/version.test.ts checks that.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../', import.meta.url)

/** The repository's version, such as `0.1.0`. */
export function frotzsmithVersion() {
  const desktop = JSON.parse(readFileSync(new URL('desktop/package.json', ROOT), 'utf8'))
  return String(desktop.version)
}

/**
 * The commit being built, as its short hash and its date (`2026-11-04`), or null when git isn't
 * there to ask (a build from a source archive). The commit's date, not the build's, so building
 * the same commit twice gives the same files.
 */
export function buildCommit() {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%h %cs'], {
      cwd: fileURLToPath(ROOT),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim()
    const [commit = '', date = ''] = out.split(' ')
    if (/^[0-9a-f]{7,12}$/.test(commit) && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { commit, date }
    }
  } catch {
    // No git, or not a repository.
  }
  return null
}
