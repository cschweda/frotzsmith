import { describe, it, expect } from 'vitest'
import { replayBudgetMs } from './useTranscript'

describe('replayBudgetMs', () => {
  it('gives short scripts the 15s base', () => {
    expect(replayBudgetMs(0)).toBe(15_000)
    expect(replayBudgetMs(10)).toBe(17_500)
  })
  it('scales 250ms per command', () => {
    expect(replayBudgetMs(100)).toBe(40_000)
  })
  it('caps at 120s for very long scripts', () => {
    expect(replayBudgetMs(10_000)).toBe(120_000)
  })
})
