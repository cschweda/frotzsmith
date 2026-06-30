import type { EngineState, EngineTarget, StoryEngine, TurnRecord } from './StoryEngine'
import { createGlk } from './glk'
import { HeadlessGlkOte } from './headless-glkote'
import { HeadlessDialog } from './headless-dialog'
import { normalizeTurnOutput } from './normalizeTurnOutput'
// @ts-expect-error — ifvms ships no types.
import ZVMm from 'ifvms'

const ZVM = (ZVMm as { ZVM: new () => unknown }).ZVM

export class ZmachineEngine implements StoryEngine {
  readonly target: EngineTarget = 'zmachine'
  private story!: Uint8Array
  private glkote!: HeadlessGlkOte

  async boot(story: Uint8Array): Promise<string> {
    this.story = story
    this.glkote = new HeadlessGlkOte()
    // Fresh Glk per boot — glkapi is a singleton; see glk.ts.
    const Glk = await createGlk()
    const vm = new ZVM() as { prepare(data: Uint8Array, opts: unknown): void }
    const options = { vm, Dialog: new HeadlessDialog(), Glk, GlkOte: this.glkote }
    vm.prepare(story, options)
    Glk.init(options)
    const turn = await this.glkote.nextTurn()
    return normalizeTurnOutput(turn.buffer, this.target)
  }

  async send(command: string): Promise<TurnRecord> {
    this.glkote.sendLine(command)
    const turn = await this.glkote.nextTurn()
    const out = normalizeTurnOutput(turn.buffer, this.target)
    // glkapi echoes the accepted input line into the buffer; drop a leading echo
    // of the command (the UI already shows it as the `>` prompt header).
    const nl = out.indexOf('\n')
    const firstLine = (nl === -1 ? out : out.slice(0, nl)).trim()
    const output = firstLine === command.trim() ? out.slice(nl === -1 ? out.length : nl + 1).replace(/^\n+/, '') : out
    return { command, output, status: turn.grid || undefined }
  }

  snapshot(): EngineState {
    // Deferred (ADR-002): no v1 consumer. ZVM supports Quetzal save/restore.
    throw new Error('snapshot() not implemented in v1')
  }
  restore(_state: EngineState): void {
    throw new Error('restore() not implemented in v1')
  }
  async reset(): Promise<string> {
    return this.boot(this.story)
  }
}
