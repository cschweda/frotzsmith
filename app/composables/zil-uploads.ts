import { quotedPath } from '~/project-package/errors'

/** What the explorer's "Add .zil files" batch needs from the project. */
export interface ZilUploadDeps {
  /** The stored path of an extra file with this name, ignoring case (by pathKey), or null. */
  findZilFile(path: string): string | null
  /** Add a file, or replace the one `findZilFile` matched (taking the new spelling). */
  addZilFile(path: string, text: string): { ok: true } | { ok: false; message: string }
  /** Ask before `path` replaces the stored `existing`; resolves true to replace. */
  ask(path: string, existing: string): Promise<boolean>
}

/** How many refusals the note names before "and N more". */
const SHOWN_REFUSALS = 3

/**
 * Add the chosen files one by one. A refused or unreadable file doesn't stop
 * the batch; the returned note (one sentence, names display-safe) says how
 * many were added and names up to 3 that couldn't be. Empty when nothing
 * happened (every replace declined).
 */
export async function addZilUploads(
  list: readonly { name: string; text(): Promise<string> }[],
  deps: ZilUploadDeps,
): Promise<string> {
  let added = 0
  const refused: string[] = []
  for (const file of list) {
    const path = file.name
    const existing = deps.findZilFile(path)
    if (existing !== null && !(await deps.ask(path, existing))) continue
    let text: string
    try {
      text = await file.text()
    } catch {
      refused.push(`${quotedPath(path)} couldn’t be read, so it wasn’t added.`)
      continue
    }
    const res = deps.addZilFile(path, text)
    if (res.ok) added++
    else refused.push(res.message)
  }

  const addedPart = `Added ${added} ZIL file${added === 1 ? '' : 's'}`
  if (refused.length === 0) {
    return added === 0 ? '' : `${addedPart}. Use <INSERT-FILE "name"> in the main file to compile ${added === 1 ? 'it' : 'them'}.`
  }
  if (added === 0 && refused.length === 1) return refused[0]!
  const reasons = refused.slice(0, SHOWN_REFUSALS).map(m => m.replace(/\.$/, ''))
  const more = refused.length > SHOWN_REFUSALS ? `; and ${refused.length - SHOWN_REFUSALS} more` : ''
  const lead = added === 0 ? 'Couldn’t add' : `${addedPart}; couldn’t add`
  return `${lead} ${refused.length}: ${reasons.join('; ')}${more}.`
}
