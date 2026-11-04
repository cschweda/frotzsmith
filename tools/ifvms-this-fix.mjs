// Vite/Rollup plugin: neutralise the one top-level `this` in ifvms.
//
// ifvms/src/zvm/opcodes.js builds its shared stack variable at module scope:
//
//     stack_var = new Variable( this.e, 0 ),
//
// Under real CommonJS (Node, the golden tests) top-level `this` is
// `module.exports`, so `this.e` is simply `undefined` — and the stack variable
// (#0) never reads its engine anyway. Rollup's CommonJS plugin, however,
// rewrites top-level `this` to the module's exports *variable*, which is only
// assigned at the END of the lazily-required wrapper — so in the production
// build `this.e` dereferences `undefined` and EVERY headless replay dies with
// "GlkOte error: TypeError: Cannot read properties of undefined (reading 'e')".
// (Vite dev uses esbuild's wrapper, which binds `this` correctly, so only
// `nuxt generate` output is affected.)
//
// Replacing it with the literal `undefined` is exactly the Node semantics. If
// an ifvms upgrade changes the line, the build fails rather than silently
// shipping a broken replay worker again.

export const OPCODES_RE = /ifvms[\\/]src[\\/]zvm[\\/]opcodes\.js(\?|$)/
const NEEDLE = /new Variable\(\s*this\.e\s*,\s*0\s*\)/

/** @returns {import('vite').Plugin} */
export function ifvmsThisFix() {
  return {
    name: 'frotzsmith:ifvms-this-fix',
    enforce: 'pre',
    /** @param {string} code @param {string} id */
    transform(code, id) {
      if (!OPCODES_RE.test(id)) return null
      if (!NEEDLE.test(code)) {
        throw new Error(
          '[ifvms-this-fix] ifvms/src/zvm/opcodes.js no longer contains `new Variable( this.e, 0 )` — '
          + 're-check the top-level `this` workaround (see tools/ifvms-this-fix.mjs) after the ifvms upgrade.',
        )
      }
      return { code: code.replace(NEEDLE, 'new Variable( undefined, 0 )'), map: null }
    },
  }
}
