// The two hand edits that close audit F2 in the vendored Play interpreter
// (public/play/web/zvm.js), as [patched, original] pairs — the minified form
// of tools/ifvms-text-fix.mjs. Tests undo them to prove the bytes are upstream
// plus exactly these edits, and that the unpatched form really is vulnerable.

/** @type {ReadonlyArray<readonly [string, string]>} */
export const ZVM_F2_EDITS = Object.freeze([
  ['e[155+r]=String.fromCharCode(57344===i[r]||i[r]<32&&13!==i[r]?65533:i[r])', 'e[155+r]=String.fromCharCode(i[r])'],
  ['.replace(/\\n/g,"\\\\n").replace(/\\u2028/g,"\\\\u2028").replace(/\\u2029/g,"\\\\u2029")', ''],
])

/**
 * `zvm.js` source with the F2 edits undone. Throws unless each occurs exactly once.
 * @param {string} src
 */
export function unpatchVendoredZvm(src) {
  let s = src
  for (const [patched, orig] of ZVM_F2_EDITS) {
    if (s.split(patched).length !== 2) throw new Error(`[vendored-zvm-patch] expected exactly one ${patched}`)
    s = s.replace(patched, orig)
  }
  return s
}
