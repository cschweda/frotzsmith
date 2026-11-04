import { describe, expect, test } from 'vitest'
import { currentAbout, isDesktopBuild } from './about'

// vitest.config.ts defines the four build-time constants with test values.
describe('currentAbout', () => {
  test('reads the build-time defines', () => {
    expect(currentAbout()).toEqual({
      version: '0.1.0-test',
      commit: 'abc1234',
      date: '2026-11-04',
      app: 'web',
    })
    expect(isDesktopBuild()).toBe(false)
  })
})
