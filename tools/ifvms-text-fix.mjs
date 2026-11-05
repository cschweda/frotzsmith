// Vite/Rollup plugin: close the ZVM abbreviation-JIT injection (audit 2026-11-04, F2).
//
// ifvms/src/zvm/text.js `decode()` turns any string that uses an abbreviation
// into a function:
//
//     Function( 'return"' + result.replace(\\).replace(").replace(\r)
//                              .replace( //g, '"' ) + '"' )
//
// U+E000 marks where `+this.abbr(N)+` goes. But the text comes through the
// story's own Unicode table (init_text → make_unicode), which a story can set
// to anything. A table entry of U+E000 puts a bare `"` into the generated
// source and lets the story run JavaScript in our origin; U+000A (a raw line
// break inside a string literal) is a SyntaxError.
//
// Two changes, both needed:
//   1. make_unicode maps U+E000 and every C0 control except 13 (the newline
//      ifvms itself uses) to U+FFFD, so a table can't produce the placeholder.
//   2. The Function source also escapes \n, U+2028 and U+2029.
//
// The same fix is applied by hand to the vendored Play interpreter
// (public/play/web/zvm.js; see public/play/web/README.md and
// tools/vendored-zvm-patch.mjs). If an ifvms upgrade
// changes either line, the build FAILS rather than silently shipping the hole.

export const TEXT_RE = /ifvms[\\/]src[\\/]zvm[\\/]text\.js(\?|$)/

export const TABLE_NEEDLE = 'table[155 + i] = String.fromCharCode( data[i] );'
export const TABLE_FIX = 'table[155 + i] = String.fromCharCode( data[i] === 0xE000 || ( data[i] < 32 && data[i] !== 13 ) ? 0xFFFD : data[i] ); /* frotzsmith F2 */'

export const JIT_NEEDLE = ".replace( /\\r/g, '\\\\r' ).replace( /\\uE000/g, '\"' )"
export const JIT_FIX = ".replace( /\\r/g, '\\\\r' ).replace( /\\n/g, '\\\\n' ).replace( /\\u2028/g, '\\\\u2028' ).replace( /\\u2029/g, '\\\\u2029' ).replace( /\\uE000/g, '\"' ) /* frotzsmith F2 */"

/** Count non-overlapping occurrences of `needle` in `s`. */
function count(s, needle) {
  return s.split(needle).length - 1
}

/**
 * Apply the F2 fix to the source of ifvms/src/zvm/text.js. Throws unless each
 * pattern occurs exactly once.
 * @param {string} code
 */
export function patchIfvmsText(code) {
  for (const needle of [TABLE_NEEDLE, JIT_NEEDLE]) {
    if (count(code, needle) !== 1) {
      throw new Error(
        `[ifvms-text-fix] ifvms/src/zvm/text.js no longer contains exactly one \`${needle}\` — `
        + 're-check the abbreviation-JIT injection fix (see tools/ifvms-text-fix.mjs) after the ifvms upgrade.',
      )
    }
  }
  return code.replace(TABLE_NEEDLE, TABLE_FIX).replace(JIT_NEEDLE, JIT_FIX)
}

/** Any ifvms Z-machine module: when one is bundled, text.js must have been patched. */
export const ZVM_MODULE_RE = /ifvms[\\/]src[\\/]zvm[\\/]/

/**
 * Also fails a bundle that holds ifvms's Z-machine modules but never passed
 * text.js through this plugin (e.g. an upgrade moved or renamed it, or a
 * pre-bundler skipped the transform) — not only one whose lines changed.
 * The check runs per bundle (each worker is its own), and a bundle without
 * ifvms is fine. Works as a Vite/Rollup plugin and as a Rolldown plugin
 * (`optimizeDeps.rolldownOptions.plugins`, the `nuxt dev` pre-bundle).
 * @returns {import('vite').Plugin}
 */
export function ifvmsTextFix() {
  let seen = false
  return {
    name: 'frotzsmith:ifvms-text-fix',
    enforce: 'pre',
    buildStart() {
      seen = false
    },
    /** @param {string} code @param {string} id */
    transform(code, id) {
      if (!TEXT_RE.test(id)) return null
      seen = true
      return { code: patchIfvmsText(code), map: null }
    },
    /** @param {unknown} _options @param {Record<string, { type: string; moduleIds?: string[]; modules?: Record<string, unknown> }>} bundle */
    generateBundle(_options, bundle) {
      if (seen) return
      const ids = Object.values(bundle).flatMap(c =>
        c.type === 'chunk' ? (c.moduleIds ?? Object.keys(c.modules ?? {})) : [])
      if (ids.some(id => ZVM_MODULE_RE.test(id))) {
        throw new Error(
          '[ifvms-text-fix] this bundle contains ifvms but its src/zvm/text.js never passed through the F2 fix — '
          + 're-check tools/ifvms-text-fix.mjs (did an ifvms upgrade move text.js?).',
        )
      }
    },
  }
}
