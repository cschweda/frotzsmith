# Bundled interpreter (Parchment)

These files are the **Parchment** web interpreter, used to play compiled
Z-machine story files in the browser. They are vendored here, not authored by
frotzsmith. frotzsmith hands Parchment a compiled story (as a blob URL) via the
`?story=` parameter on `../index.html`, and the pure-JS ZVM engine runs it.

| Component | Source | License |
| --- | --- | --- |
| Parchment | https://github.com/curiousdannii/parchment | MIT |
| ifvms / ZVM (pure-JS Z-machine) | https://github.com/curiousdannii/ifvms.js | MIT |
| jQuery | https://jquery.com | MIT |

See each upstream project for the full license text.

## Provenance and checksums

Each file's source and the sha256 of the committed bytes are recorded in
`tools/vendored-files.json`; `tools/vendored-files.test.ts` fails if any byte
changes without the manifest being updated on purpose. The exact Parchment
release was not recorded when these were vendored (2026-06-28, commit
c776d55). `jquery.min.js` is the official jQuery 3.5.1 minified file, less its
trailing newline.

## Local patch: `zvm.js` (audit 2026-11-04, F2)

`zvm.js` carries two small in-place edits, described in its header comment:
a story's Unicode-table entry of U+E000 (ZVM's abbreviation placeholder) or a
C0 control other than 13 becomes U+FFFD, and the abbreviation JIT also escapes
`\n`, U+2028 and U+2029. Without them a story could break out of ZVM's
generated `Function('return"…"')` source and run JavaScript. The replay
worker's copy of ifvms gets the same fix at build time
(`tools/ifvms-text-fix.mjs`). Regression test:
`app/modules/inform6/engine/zvm-text-jit.test.ts`. When updating Parchment,
re-apply the patch (that test fails until you do) and update the manifest.
