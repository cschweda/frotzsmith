import type { EngineTarget } from './StoryEngine'

/**
 * VM-agnostic per-turn normalizer (ADR-006). Canonicalizes the trailing command
 * prompt away, trims trailing whitespace, and collapses runs of blank lines, so
 * transcripts are stable and diff-ready. Status/grid text is handled separately
 * by the engine (kept in `TurnRecord.status`), so it never reaches here.
 */
export function normalizeTurnOutput(raw: string, _target: EngineTarget): string {
  return raw
    .replace(/[ \t]+$/gm, '')     // trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n')   // collapse runs of blank lines
    .trim()                       // drop leading/trailing blank lines FIRST
    .replace(/\n*>[ \t]*$/, '')   // now the trailing prompt is at the end
    .trim()
}
