import { describe, it, expect } from 'vitest'
import { slugify, storyBaseName } from './slug'

describe('slugify', () => {
  it('kebab-cases a title', () => {
    expect(slugify('Haunted House')).toBe('haunted-house')
    expect(slugify('FROTZSMITH DEMO')).toBe('frotzsmith-demo')
  })
  it('drops apostrophes and collapses punctuation', () => {
    expect(slugify("The Hermit's Tale!")).toBe('the-hermits-tale')
  })
  it('trims leading/trailing separators', () => {
    expect(slugify('  --Cave--  ')).toBe('cave')
  })
  it('is empty when no usable characters', () => {
    expect(slugify('!!!')).toBe('')
    expect(slugify('')).toBe('')
  })
})

describe('storyBaseName', () => {
  it('uses the slug of the title', () => {
    expect(storyBaseName('Haunted House', false)).toBe('haunted-house')
  })
  it('falls back to "story" when no usable title', () => {
    expect(storyBaseName('', false)).toBe('story')
    expect(storyBaseName(undefined, false)).toBe('story')
    expect(storyBaseName('!!!', false)).toBe('story')
  })
  it('appends -puny for PunyInform', () => {
    expect(storyBaseName('Haunted House', true)).toBe('haunted-house-puny')
    expect(storyBaseName('', true)).toBe('story-puny')
  })
})
