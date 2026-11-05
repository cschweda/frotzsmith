/**
 * Supply-chain pins (audit 2026-11-04, F16): CI actions by full commit SHA,
 * no unpinned `npx -y`, and Netlify installs exactly what yarn.lock says.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')
const workflows = readdirSync(resolve(root, '.github/workflows'))
  .filter(f => /\.ya?ml$/.test(f))
  .map(f => [f, readFileSync(resolve(root, '.github/workflows', f), 'utf8')] as const)

describe('supply-chain pins', () => {
  it.each(workflows)('%s pins every action by a 40-hex commit SHA with its tag noted', (_f, yml) => {
    const uses = [...yml.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)]
    expect(uses.length).toBeGreaterThan(0)
    for (const [, ref, rest] of uses) {
      expect(ref, ref).toMatch(/^[\w.-]+\/[\w.\/-]+@[0-9a-f]{40}$/)
      expect(rest, ref).toMatch(/#\s*v\d/)
    }
  })

  it.each(workflows)('%s pins the version of every npx -y package', (_f, yml) => {
    for (const [, pkg] of yml.matchAll(/npx -y (\S+)/g)) expect(pkg).toMatch(/^(@[\w.-]+\/)?[\w.-]+@\d+\.\d+\.\d+$/)
  })

  it('Netlify installs from the lockfile exactly', () => {
    const toml = readFileSync(resolve(root, 'netlify.toml'), 'utf8')
    expect(toml).toMatch(/^\s*command = "yarn install --frozen-lockfile && yarn generate"$/m)
  })

  it("Netlify's own pre-build install is frozen too (YARN_FLAGS in [build.environment])", () => {
    const toml = readFileSync(resolve(root, 'netlify.toml'), 'utf8')
    const env = toml.split(/^\[build\.environment\]\s*$/m)[1]?.split(/^\[/m)[0] ?? ''
    expect(env).toMatch(/^\s*YARN_FLAGS = "--frozen-lockfile"$/m)
  })
})
