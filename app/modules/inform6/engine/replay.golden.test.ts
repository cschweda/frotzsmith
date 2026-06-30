/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runReplay } from './replayCore'

// The bundled demo, compiled from samples/demo.inf:
//   Constant Story "FROTZSMITH DEMO"; Initialise prints a welcome; start room
//   Cottage, north → Meadow. Stable golden text for an end-to-end engine check.
const demo = new Uint8Array(
  readFileSync(fileURLToPath(new URL('../../../../public/play/demo.z5', import.meta.url))),
)

describe('runReplay (headless ZVM, demo.z5)', () => {
  it('captures the boot banner as turn 0', async () => {
    const { turns } = await runReplay(demo, 'zmachine', [])
    expect(turns).toHaveLength(1)
    expect(turns[0]!.command).toBe('')
    expect(turns[0]!.output).toContain('Welcome to the Frotzsmith demo!')
    expect(turns[0]!.output).toContain('Cottage')
  })

  it('advances the world per command', async () => {
    const { turns } = await runReplay(demo, 'zmachine', ['north', 'south'])
    expect(turns).toHaveLength(3) // boot + 2 commands
    expect(turns[1]!.command).toBe('north')
    expect(turns[1]!.output).toContain('Meadow')
    expect(turns[1]!.output).not.toMatch(/^north/)
    expect(turns[1]!.output.trimEnd().endsWith('>')).toBe(false)
    expect(turns[2]!.command).toBe('south')
    expect(turns[2]!.output).toContain('Cottage')
  })
})
