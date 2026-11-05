/** planZilFiles: the limits and path rules for a project's extra ZIL files. */
import { describe, it, expect } from 'vitest'
import { planZilFiles } from './zil-project'

const f = (path: string, text = '') => ({ path, text })
const MiB = 1024 * 1024

describe('planZilFiles', () => {
  it('accepts an ordinary file set', () => {
    expect(planZilFiles([f('rooms.zil', 'x'), f('lib/items.ZIL', 'y')], 'story.zil')).toEqual({ ok: true })
    expect(planZilFiles([], 'story.zil')).toEqual({ ok: true })
  })

  it('refuses the 101st file, and accepts exactly 100', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => f(`f${i}.zil`))
    expect(planZilFiles(hundred, 'story.zil')).toEqual({ ok: true })
    const r = planZilFiles([...hundred, f('f100.zil')], 'story.zil')
    expect(r.ok).toBe(false)
  })

  it('refuses a file over 1 MiB, accepts exactly 1 MiB', () => {
    expect(planZilFiles([f('a.zil', 'x'.repeat(MiB))], 'story.zil')).toEqual({ ok: true })
    const r = planZilFiles([f('a.zil', 'x'.repeat(MiB + 1))], 'story.zil')
    expect(r).toMatchObject({ ok: false })
    expect((r as { message: string }).message).toContain('a.zil')
  })

  it('refuses more than 4 MiB in total, accepts exactly 4 MiB', () => {
    const four = [1, 2, 3, 4].map(i => f(`f${i}.zil`, 'x'.repeat(MiB)))
    expect(planZilFiles(four, 'story.zil')).toEqual({ ok: true })
    const r = planZilFiles([...four.slice(0, 3), f('f4.zil', 'x'.repeat(MiB)), f('f5.zil', 'x')], 'story.zil')
    expect(r.ok).toBe(false)
  })

  it('refuses unsafe paths and non-.zil names', () => {
    expect(planZilFiles([f('../a.zil')], 'story.zil').ok).toBe(false)
    expect(planZilFiles([f('a.h')], 'story.zil').ok).toBe(false)
    expect(planZilFiles([f('/abs.zil')], 'story.zil').ok).toBe(false)
  })

  it('refuses a path equal to the main file by pathKey', () => {
    expect(planZilFiles([f('story.zil')], 'story.zil').ok).toBe(false)
    expect(planZilFiles([f('STORY.zil')], 'story.zil').ok).toBe(false)
  })

  it('refuses two paths that differ only in case', () => {
    const r = planZilFiles([f('Rooms.zil'), f('rooms.zil')], 'story.zil')
    expect(r.ok).toBe(false)
  })
})
