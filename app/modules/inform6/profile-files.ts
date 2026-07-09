import type { ProfileId, VirtualFile } from './profiles'

/**
 * The HEAVY half of the library profiles: ~900 KB of Standard Library +
 * PunyInform `.h` source text, eagerly globbed so the compile path can mount
 * it into MEMFS in one go.
 *
 * IMPORT DISCIPLINE — this module must stay OFF the critical-path chunk:
 *   - the compile path (compile-main.ts) imports it statically — that module
 *     is itself only ever loaded via dynamic import or inside the compile
 *     Web Worker;
 *   - the file explorer loads it via dynamic import the first time a library
 *     tab's CONTENT is actually needed (useProjectFiles.ensureLibraryContent);
 *   - UI code that only needs names/labels/targets imports `profiles.ts`
 *     (metadata + the curated `libraryFileNames` manifest) instead.
 * A sync test (profile-files.test.ts) pins the manifest to these files.
 */

const stdRaw = import.meta.glob('./lib/std/*.h', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const punyRaw = import.meta.glob('./lib/puny/*.h', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Builds the virtual file list for a library directory, adding capitalized
 * aliases where the library's own includes are mixed-case (the WASM filesystem
 * is case-sensitive).
 */
function buildFiles(
  raw: Record<string, string>,
  includePath: string,
  aliases: Record<string, string> = {},
): VirtualFile[] {
  const byName: Record<string, string> = {}
  const files: VirtualFile[] = []
  for (const [path, content] of Object.entries(raw)) {
    const name = path.split('/').pop() as string
    byName[name] = content
    files.push({ path: `${includePath}/${name}`, content })
  }
  for (const [alias, real] of Object.entries(aliases)) {
    if (byName[real]) files.push({ path: `${includePath}/${alias}`, content: byName[real] })
  }
  return files
}

/** Library files (with any case aliases) ready to mount, per profile. */
export const PROFILE_FILES: Record<ProfileId, VirtualFile[]> = {
  std: buildFiles(stdRaw, '/lib/std', {
    'Parser.h': 'parser.h',
    'VerbLib.h': 'verblib.h',
    'Grammar.h': 'grammar.h',
    'English.h': 'english.h',
    'Exits.h': 'exits.h',
  }),
  puny: buildFiles(punyRaw, '/lib/puny'),
}
