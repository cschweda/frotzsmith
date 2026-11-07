/**
 * The Play page and its iframe (audit 2026-11-04, F17): the story gate in
 * public/play/index.html and the iframe's sandbox attribute in PlayPanel.vue.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')
const html = readFileSync(resolve(root, 'public/play/index.html'), 'utf8')
const panel = readFileSync(resolve(root, 'app/components/ide/PlayPanel.vue'), 'utf8')

/** The page's own gate function, run as written. */
function gate(): (story: unknown, origin: string) => string {
  const m = html.match(/\/\* frotz-story-gate:start \*\/([\s\S]*?)\/\* frotz-story-gate:end \*\//)
  expect(m, 'story gate markers missing from play/index.html').not.toBeNull()
  return new Function(`${m![1]}; return __frotzStoryUrl`)() as (story: unknown, origin: string) => string
}

const O = 'https://frotzsmith.frotzinc.com'
const DEMO = '/play/demo.z5'

describe('play/index.html story gate', () => {
  it('the page routes ?story= through the gate with its own origin', () => {
    expect(html).toContain("var __story = __frotzStoryUrl(__params.get('story'), location.origin);")
    expect(html).toContain('default_story: [__story]')
  })

  it('accepts a blob: URL minted by this origin (with the #game.zN tag)', () => {
    const url = `blob:${O}/0b6f6c2e-1d1b-4c7e-9d7a-3f6e8f4b2a10#game.z5`
    expect(gate()(url, O)).toBe(url)
  })

  it.each([
    ['missing', null],
    ['empty', ''],
    ['https URL', 'https://evil.example/x.z5'],
    ['data: URL', 'data:application/octet-stream;base64,AAAA'],
    ['another origin’s blob', 'blob:https://evil.example/0b6f6c2e'],
    ['a look-alike origin', `blob:${O}.evil.example/0b6f6c2e`],
    ['an origin-less blob', 'blob:0b6f6c2e'],
    ['relative path', '../../evil.z5'],
    ['javascript:', 'javascript:alert(1)'],
    ['not a string', ['blob:x']],
  ])('falls back to the demo for %s', (_l, story) => {
    expect(gate()(story, O)).toBe(DEMO)
  })
})

describe('PlayPanel iframe', () => {
  it('is sandboxed with exactly allow-same-origin allow-scripts', () => {
    const tags = panel.match(/<iframe[\s\S]*?\/>/g) ?? []
    expect(tags).toHaveLength(1)
    const sandbox = tags[0]!.match(/\ssandbox="([^"]*)"/)
    expect(sandbox?.[1]?.split(/\s+/).sort()).toEqual(['allow-same-origin', 'allow-scripts'])
    expect(tags[0]).not.toMatch(/:sandbox=|allow-popups|allow-top-navigation|allow-forms|allow-downloads/)
  })

  it('checks the message source window, not just the origin', () => {
    expect(panel).toContain('acceptPlayMessage(e, playFrame.value?.contentWindow, window.location.origin)')
  })
})
