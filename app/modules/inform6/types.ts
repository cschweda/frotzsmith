/** Story-file targets (compile targets) Frotzsmith can emit. */
export type StoryExt = 'z3' | 'z4' | 'z5' | 'z8' | 'ulx'

/** Severity of a compiler diagnostic. */
export type Severity = 'error' | 'warning' | 'fatal'

/** A single parsed compiler message. */
export interface Diagnostic {
  severity: Severity
  /** 1-based source line, when the message carries one. */
  line?: number
  column?: number
  message: string
  file?: string
}

/** Compiler statistics (from the `-s` switch), useful for gauging memory use. */
export interface CompileStats {
  /** Dynamic ("readable") memory used — the Z-machine's hard ~64 KB limit. */
  readableMem?: number
  readableMax?: number
  /** Total Z-machine memory used / free. */
  zUsed?: number
  zFree?: number
}

/** The result of one compile run. */
export interface CompileResult {
  /** True only when there were no errors and a story file was produced. */
  ok: boolean
  storyFile?: Uint8Array
  storyExt: StoryExt
  diagnostics: Diagnostic[]
  /** Raw, unparsed compiler output, for the "show raw output" toggle. */
  rawStderr: string
  /** Wall-clock compile time in milliseconds. */
  ms: number
  byteLength: number
  stats?: CompileStats
}
