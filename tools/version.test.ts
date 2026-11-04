import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
// @ts-expect-error — plain .mjs build script, no type declarations
import { buildCommit, frotzsmithVersion } from './version.mjs'

// The web build defines its version from desktop/package.json (the one a release tag must equal
// and Electron reports as the app version); the root package.json carries it too.
const root = new URL('../', import.meta.url)
const versionOf = (path: string) =>
  (JSON.parse(readFileSync(new URL(path, root), 'utf8')) as { version?: string }).version

describe('the version the web build defines', () => {
  test('is the desktop app’s version', () => {
    expect(frotzsmithVersion()).toBe(versionOf('desktop/package.json'))
    expect(frotzsmithVersion()).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
  })

  test('is the root package’s version', () => {
    expect(versionOf('package.json')).toBe(frotzsmithVersion())
  })

  test('the build’s commit is a short hash and a date, or nothing', () => {
    const commit = buildCommit()
    if (commit === null) return
    expect(commit.commit).toMatch(/^[0-9a-f]{7,12}$/)
    expect(commit.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
