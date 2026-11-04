/**
 * compile-main mount order (audit F1, defence in depth): extensions are
 * written FIRST and the library after, so a stored extension named like a
 * library file can't replace it — unless the author explicitly chose to
 * override (overridesLibrary), which is written after the library.
 */
import { describe, it, expect, vi } from 'vitest'
import { PROFILE_FILES } from './profile-files'

const files = new Map<string, string | Uint8Array>()
vi.mock('~/composables/useCompilerWasm', () => ({
  useCompilerWasm: () => ({
    createInstance: async () => ({
      FS: {
        mkdir: () => {},
        writeFile: (p: string, d: string | Uint8Array) => files.set(p, d),
        chdir: () => {},
        readFile: () => {
          throw new Error('not found')
        },
      },
      callMain: () => 0,
    }),
  }),
}))

const { runI6Compile } = await import('./compile-main')
const lib = (profile: 'std' | 'puny', path: string) => PROFILE_FILES[profile].find(f => f.path === path)!.content

describe('runI6Compile mounts the library after extensions', () => {
  it('a library-named extension without an override does not replace the library', async () => {
    files.clear()
    await runI6Compile('!', { profileId: 'std', extensions: [{ name: 'VerbLib', content: 'EVIL' }, { name: 'lamp', content: 'LAMP' }] })
    expect(files.get('/lib/std/VerbLib.h')).toBe(lib('std', '/lib/std/VerbLib.h'))
    expect(files.get('/lib/std/lamp.h')).toBe('LAMP')
  })

  it('…in PunyInform too', async () => {
    files.clear()
    await runI6Compile('!', { profileId: 'puny', extensions: [{ name: 'puny', content: 'EVIL' }] })
    expect(files.get('/lib/puny/puny.h')).toBe(lib('puny', '/lib/puny/puny.h'))
  })

  it('an explicit override is written after the library', async () => {
    files.clear()
    await runI6Compile('!', { profileId: 'std', extensions: [{ name: 'VerbLib', content: 'MINE', overridesLibrary: true }] })
    expect(files.get('/lib/std/VerbLib.h')).toBe('MINE')
  })
})
