/**
 * The solution recorder's accessibility, read from the templates (there is no
 * component mount harness): the recorder's notices are announced once, by the
 * single live region in RightPaneTabs, though two or three recorder bars can
 * be mounted at once; the Retry save button's name contains its visible text;
 * the recording light's pulse respects prefers-reduced-motion.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from '@vue/compiler-sfc'

type Node = {
  type: number
  tag?: string
  props?: { type: number; name: string; value?: { content: string }; arg?: { content: string }; exp?: { content: string } }[]
  children?: Node[]
  content?: { content: string } | string
}

function template(file: string): Node {
  const src = readFileSync(resolve(__dirname, file), 'utf8')
  const ast = parse(src).descriptor.template?.ast as unknown as Node | undefined
  expect(ast, `${file} has no template`).toBeTruthy()
  return ast!
}

function walk(n: Node, out: Node[] = []): Node[] {
  out.push(n)
  for (const c of n.children ?? []) walk(c, out)
  return out
}

/** A static attribute's value, or a bound one's expression. */
function attr(n: Node, name: string): string | undefined {
  for (const p of n.props ?? []) {
    if (p.type === 6 && p.name === name) return p.value?.content ?? ''
    if (p.type === 7 && p.name === 'bind' && p.arg?.content === name) return p.exp?.content ?? ''
  }
  return undefined
}

const isLive = (n: Node) => n.type === 1 && (attr(n, 'aria-live') !== undefined || attr(n, 'role') === 'status')

/** The expressions interpolated anywhere inside `n`. */
function interpolations(n: Node): string[] {
  return walk(n)
    .filter(c => c.type === 5)
    .map(c => (typeof c.content === 'string' ? c.content : c.content?.content ?? '').trim())
}

/** All the static text inside `n`. */
function text(n: Node): string {
  return walk(n)
    .filter(c => c.type === 2)
    .map(c => (typeof c.content === 'string' ? c.content : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('recorder notices are announced once', () => {
  const bar = walk(template('SolutionRecorderBar.vue'))
  const tabs = walk(template('RightPaneTabs.vue'))

  it('the recorder bar shows its notice without a live region of its own', () => {
    const shown = bar.filter(n => n.type === 1 && interpolations(n).some(e => /\bnotice\b|\bmessage\b/.test(e)))
    expect(shown.length).toBeGreaterThan(0) // the text is still visible in the bar
    for (const n of shown) expect(isLive(n), `<${n.tag}> rendering the notice is a live region`).toBe(false)
    // Only the clicked bar's own failure is a status (one bar shows it).
    for (const n of bar.filter(isLive)) expect(interpolations(n)).toEqual(['failure'])
  })

  it('RightPaneTabs has the one live region, and it carries the state and the notice', () => {
    const live = tabs.filter(isLive)
    expect(live).toHaveLength(1)
    const exprs = interpolations(live[0]!)
    expect(exprs).toContain('announcement')
    expect(exprs).toContain('recNotice')
  })
})

describe('recorder bar details', () => {
  const bar = walk(template('SolutionRecorderBar.vue'))

  it('every labelled button’s accessible name contains its visible text (WCAG 2.5.3)', () => {
    const buttons = bar.filter(n => n.type === 1 && n.tag === 'UButton' && attr(n, 'aria-label') !== undefined)
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) {
      const visible = text(b).toLowerCase()
      expect(attr(b, 'aria-label')!.toLowerCase(), `button "${visible}"`).toContain(visible)
    }
  })

  it('the recording light pulses only when motion is allowed', () => {
    const src = readFileSync(resolve(__dirname, 'SolutionRecorderBar.vue'), 'utf8')
    expect(src).toContain('motion-safe:animate-pulse')
    expect(src.replace(/motion-safe:animate-pulse/g, '')).not.toContain('animate-pulse')
  })
})
