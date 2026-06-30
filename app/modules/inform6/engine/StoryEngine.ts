export type EngineTarget = 'zmachine' | 'glulx'

export interface TurnRecord {
  /** The input for this turn; '' for the boot banner (turn 0). */
  command: string
  /** Normalized buffer-window text produced after this turn. */
  output: string
  /** Raw grid/status-window text (excluded from `output` by default — ADR-006). */
  status?: string
}

export interface ReplayResult {
  turns: TurnRecord[]
  ms: number
}

/** Opaque VM snapshot. Declared for the seam (ADR-002); unused in v1. */
export interface EngineState {
  data: Uint8Array
}

export interface StoryEngine {
  readonly target: EngineTarget
  /** Load + run to the first input request; returns the boot banner text. */
  boot(story: Uint8Array): Promise<string>
  /** Feed one command; run to the next input request; return its turn record. */
  send(command: string): Promise<TurnRecord>
  /** Capture VM state (deferred body in v1). */
  snapshot(): EngineState
  /** Restore captured state (deferred body in v1). */
  restore(state: EngineState): void
  /** Re-boot fresh from the same story; returns the boot banner. */
  reset(): Promise<string>
}

// createEngine() is added in Task 4 once GlulxEngine exists.
