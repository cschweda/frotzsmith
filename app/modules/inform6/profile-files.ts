/**
 * The HEAVY half of the library profiles: ~900 KB of Standard Library +
 * PunyInform `.h` source text, now shipped by @frotzinc/inform6-wasm.
 *
 * IMPORT DISCIPLINE — this module must stay OFF the critical-path chunk:
 *   - the compile path (compile-main.ts → @frotzinc/inform6-wasm) carries it
 *     — that module is itself only ever loaded via dynamic import or inside
 *     the compile Web Worker;
 *   - the file explorer loads it via dynamic import the first time a library
 *     tab's CONTENT is actually needed (useProjectFiles.ensureLibraryContent);
 *   - UI code that only needs names/labels/targets imports `profiles.ts`
 *     (metadata + the curated `libraryFileNames` manifest) instead.
 * A sync test (profile-files.test.ts) pins the manifest to these files.
 */
export { LIBRARY_FILES as PROFILE_FILES } from '@frotzinc/inform6-wasm/library'
