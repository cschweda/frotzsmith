import { describe, it, expect } from 'vitest'
import { upsertScript, renameScript, deleteScript, setScriptText, nextActiveId } from './test-scripts'

const s = (id: string, name = id, text = '') => ({ id, name, text })

describe('test-scripts pure helpers', () => {
  it('upsert adds a new script and replaces an existing one by id', () => {
    expect(upsertScript([s('a')], s('b'))).toEqual([s('a'), s('b')])
    expect(upsertScript([s('a', 'A')], s('a', 'A2'))).toEqual([s('a', 'A2')])
  })

  it('rename changes only the matching script name', () => {
    expect(renameScript([s('a', 'A'), s('b', 'B')], 'b', 'Bee')).toEqual([s('a', 'A'), s('b', 'Bee')])
  })

  it('delete removes the matching script', () => {
    expect(deleteScript([s('a'), s('b')], 'a')).toEqual([s('b')])
  })

  it('setScriptText updates only the matching script text', () => {
    expect(setScriptText([s('a', 'A', 'x')], 'a', 'y')).toEqual([s('a', 'A', 'y')])
  })

  it('nextActiveId keeps a still-valid active, else picks the first, else ""', () => {
    expect(nextActiveId([s('a'), s('b')], 'b')).toBe('b')
    expect(nextActiveId([s('a'), s('b')], 'gone')).toBe('a')
    expect(nextActiveId([], 'gone')).toBe('')
  })
})
