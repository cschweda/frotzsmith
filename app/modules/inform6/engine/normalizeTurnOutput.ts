import type { EngineTarget } from './StoryEngine'

/** Minimal v1: trim trailing whitespace per line, collapse 3+ blank lines, trim
 *  outer whitespace. Prompt handling lands in Task 2. */
export function normalizeTurnOutput(raw: string, _target: EngineTarget): string {
  return raw
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
