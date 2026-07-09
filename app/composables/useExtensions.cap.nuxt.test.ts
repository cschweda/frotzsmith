/**
 * useExtensions — cumulative storage cap on uploads (happy-dom env).
 *
 * Per-import caps (5 MB) existed, but nothing bounded the TOTAL: uploads
 * persist into one localStorage value, and 2-3 large ones exceed the typical
 * 5-10 MB origin quota — after which every persist in the app (including the
 * crash-recovery autosave) fails. addUploaded must refuse past the cap with
 * a ZipLimitError (ExtensionsModal already surfaces those messages).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLanguage } from './useLanguage'
import { ZipLimitError, EXTENSIONS_TOTAL_MAX_BYTES } from '~/utils/zip-limits'

vi.stubGlobal('useLanguage', useLanguage)
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const { useExtensions } = await import('./useExtensions')

const MB = 1024 * 1024

describe('useExtensions — cumulative upload cap', () => {
  beforeEach(() => {
    localStorage.clear()
    const { uploaded } = useExtensions()
    uploaded.value = []
  })

  it('accepts uploads under the total cap', () => {
    const { addUploaded, uploaded } = useExtensions()
    addUploaded('small.h', 'x'.repeat(1 * MB))
    expect(uploaded.value).toHaveLength(1)
  })

  it('refuses an upload that would push the TOTAL past the cap', () => {
    const { addUploaded, uploaded } = useExtensions()
    addUploaded('a.h', 'x'.repeat(3 * MB))
    expect(() => addUploaded('b.h', 'y'.repeat(EXTENSIONS_TOTAL_MAX_BYTES - 2 * MB))).toThrow(ZipLimitError)
    expect(uploaded.value).toHaveLength(1) // the refused upload was not added
  })

  it('replacing an existing upload counts its old size out (same id)', () => {
    const { addUploaded, uploaded } = useExtensions()
    addUploaded('big.h', 'x'.repeat(3 * MB))
    // Replacing big.h with a same-sized body stays within the cap even though
    // old + new together would exceed it.
    expect(() => addUploaded('big.h', 'y'.repeat(3 * MB))).not.toThrow()
    expect(uploaded.value).toHaveLength(1)
    expect(uploaded.value[0]!.content[0]).toBe('y')
  })
})
