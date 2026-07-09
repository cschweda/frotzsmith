/**
 * Static guard: the compile workers must register their message handlers via
 * addEventListener and NEVER assign `self.onmessage =`.
 *
 * For zilf.worker.ts this is load-bearing, not style: dotnet.js treats the
 * worker as a managed-pthread deputy — and hangs `dotnet.create()` forever —
 * whenever BOTH `importScripts` exists AND `globalThis.onmessage` is set
 * (dotnet/runtime#114918). A single refactor back to `self.onmessage =` would
 * reintroduce the boot hang while every protocol unit test still passed.
 * inform6.worker.ts follows the same convention so code copied between the
 * two compile workers can't smuggle the assignment in.
 *
 * engine/replay.worker.ts is deliberately NOT covered: it hosts no dotnet
 * runtime, predates the convention, and uses `self.onmessage =` harmlessly.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const COMPILE_WORKERS = ['./zil/zilf.worker.ts', './inform6/inform6.worker.ts']

const ONMESSAGE_ASSIGNMENT = /\b(?:self|globalThis)\s*\.\s*onmessage\s*=(?!=)/

describe('compile-worker message-handler invariant (dotnet/runtime#114918)', () => {
  it('the detector itself catches an onmessage assignment', () => {
    expect(ONMESSAGE_ASSIGNMENT.test('self.onmessage = handle')).toBe(true)
    expect(ONMESSAGE_ASSIGNMENT.test('globalThis.onmessage = fn')).toBe(true)
    // Comparisons and addEventListener registration must NOT trip it.
    expect(ONMESSAGE_ASSIGNMENT.test('if (self.onmessage === null) {}')).toBe(false)
    expect(ONMESSAGE_ASSIGNMENT.test("self.addEventListener('message', fn)")).toBe(false)
  })

  for (const rel of COMPILE_WORKERS) {
    it(`${rel} registers via addEventListener and never assigns onmessage`, () => {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
      // Strip line comments first — the zilf worker's header comment shows the
      // forbidden pattern as documentation.
      const code = src
        .split('\n')
        .map(line => line.replace(/^\s*(?:\/\/|\*|\/\*).*$/, ''))
        .join('\n')
      expect(ONMESSAGE_ASSIGNMENT.test(code)).toBe(false)
      expect(code).toMatch(/addEventListener\(\s*'message'/)
    })
  }
})
