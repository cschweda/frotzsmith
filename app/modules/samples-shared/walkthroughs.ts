/**
 * Sample walkthroughs: the commands, one per line, that a sample's solution
 * is made from (Solutions: compile the sample, replay these). Keyed by sample
 * id; a sample written in both languages shares one walkthrough file.
 */
import architectLegacy from './architect-legacy.walkthrough.txt?raw'

/** Null-prototype, so an id like "constructor" is never found by accident. */
const WALKTHROUGHS: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, {
  'std-architect-legacy': architectLegacy,
  'zil-architect-legacy': architectLegacy,
})

/** A walkthrough file's commands: each line trimmed, blank lines skipped. */
function walkthroughCommands(text: string): string[] {
  return text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length > 0)
}

/** The sample's walkthrough commands (a fresh copy), or null when it has none. */
export function sampleWalkthrough(sampleId: string): string[] | null {
  if (!Object.hasOwn(WALKTHROUGHS, sampleId)) return null
  return walkthroughCommands(WALKTHROUGHS[sampleId]!)
}
