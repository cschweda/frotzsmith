/**
 * useShareLink — share-by-fragment behavior (happy-dom env).
 *
 * Non-destructive by design: an arriving share link only auto-loads over a
 * PRISTINE buffer (the language seed / empty). Over real work it offers a
 * toast action instead — a link click must never eat someone's game, because
 * the crash-recovery autosave would persist the replacement within a second.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { encodeShareFragment } from '~/utils/share-link'
import demoSource from '~/modules/inform6/samples/demo.inf?raw'

const _toastAdd = vi.fn()
vi.stubGlobal('useToast', () => ({ add: _toastAdd }))

const _source = ref('')
const _loadSource = vi.fn((text: string) => {
  _source.value = text
})
vi.stubGlobal('useIde', () => ({ source: _source, loadSource: _loadSource }))

const _profile = ref({ id: 'i6', route: '/', stateKey: 'i6' })
vi.stubGlobal('useLanguage', () => ({ profile: _profile }))

const { useShareLink } = await import('./useShareLink')

function setHash(frag: string | null) {
  history.replaceState(null, '', frag ? `/#${frag}` : '/')
}

describe('consumeShareFragment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _profile.value = { id: 'i6', route: '/', stateKey: 'i6' }
    setHash(null)
  })

  it('auto-loads over a pristine buffer (the language seed) and clears the hash', () => {
    _source.value = demoSource
    setHash(encodeShareFragment('Constant Story "SHARED";', 'i6')!)

    const consumed = useShareLink().consumeShareFragment()

    expect(consumed).toBe(true)
    expect(_loadSource).toHaveBeenCalledWith('Constant Story "SHARED";')
    expect(window.location.hash).toBe('')
  })

  it('over real work: does NOT overwrite — offers a toast action that loads on click', () => {
    _source.value = 'Constant Story "MY WIP";\n! hours of work'
    setHash(encodeShareFragment('Constant Story "SHARED";', 'i6')!)

    const consumed = useShareLink().consumeShareFragment()

    expect(consumed).toBe(true)
    expect(_loadSource).not.toHaveBeenCalled()
    expect(_toastAdd).toHaveBeenCalledTimes(1)
    const toast = _toastAdd.mock.calls[0]![0] as { actions?: Array<{ onClick: () => void }> }
    expect(toast.actions?.length).toBeGreaterThan(0)
    toast.actions![0]!.onClick()
    expect(_loadSource).toHaveBeenCalledWith('Constant Story "SHARED";')
  })

  it('ignores a fragment for the other language (leaves the hash intact)', () => {
    _source.value = demoSource
    setHash(encodeShareFragment('<ROUTINE GO () <CRLF>>', 'zil')!)

    expect(useShareLink().consumeShareFragment()).toBe(false)
    expect(_loadSource).not.toHaveBeenCalled()
    expect(window.location.hash).not.toBe('')
  })

  it('ignores absent or garbage fragments', () => {
    expect(useShareLink().consumeShareFragment()).toBe(false)
    setHash('src=%%%&lang=i6')
    expect(useShareLink().consumeShareFragment()).toBe(false)
    expect(_loadSource).not.toHaveBeenCalled()
  })
})

describe('copyShareLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _profile.value = { id: 'i6', route: '/', stateKey: 'i6' }
  })

  it('copies origin + route + fragment to the clipboard and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    _source.value = 'Constant Story "SHARE ME";'

    expect(await useShareLink().copyShareLink()).toBe(true)
    const url = writeText.mock.calls[0]![0] as string
    expect(url).toContain('/#src=')
    expect(url).toContain('&lang=i6')
    expect(_toastAdd).toHaveBeenCalledTimes(1)
  })

  it('refuses an oversize source with an explanatory toast', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    let x = 0x2545f491
    let noise = ''
    for (let i = 0; i < 70_000; i++) {
      x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0
      noise += String.fromCharCode(32 + (x % 90))
    }
    _source.value = noise

    expect(await useShareLink().copyShareLink()).toBe(false)
    expect(writeText).not.toHaveBeenCalled()
    expect(_toastAdd).toHaveBeenCalledTimes(1)
  })
})
