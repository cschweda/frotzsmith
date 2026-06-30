import { describe, it, expect } from 'vitest'
import { parseScript } from './parseScript'

describe('parseScript', () => {
  it('splits on newlines', () => {
    expect(parseScript('north\nlook\nsouth')).toEqual(['north', 'look', 'south'])
  })

  it('splits on periods', () => {
    expect(parseScript('n. examine rock. lift rock')).toEqual(['n', 'examine rock', 'lift rock'])
  })

  it('splits on a mix of newlines and periods', () => {
    expect(parseScript('n. examine rock\nlift rock\ns')).toEqual(['n', 'examine rock', 'lift rock', 's'])
  })

  it('ignores blank lines and empty segments', () => {
    expect(parseScript('n\n\n.\nlook')).toEqual(['n', 'look'])
  })

  it('drops `!` comment lines but keeps commands', () => {
    expect(parseScript('! walkthrough\nnorth\n! get the lamp\ntake lamp')).toEqual(['north', 'take lamp'])
  })

  it('strips a leading "> " so pasted transcripts work', () => {
    expect(parseScript('> north\n>look')).toEqual(['north', 'look'])
  })

  it('returns an empty array for empty / whitespace input', () => {
    expect(parseScript('   \n\n')).toEqual([])
  })
})
