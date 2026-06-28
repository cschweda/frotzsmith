# Bundled interpreter (Parchment)

These files are the **Parchment** web interpreter, used to play compiled
Z-machine story files in the browser. They are vendored here, not authored by
Frotzsmith. Frotzsmith hands Parchment a compiled story (as a blob URL) via the
`?story=` parameter on `../index.html`, and the pure-JS ZVM engine runs it.

| Component | Source | License |
| --- | --- | --- |
| Parchment | https://github.com/curiousdannii/parchment | MIT |
| ifvms / ZVM (pure-JS Z-machine) | https://github.com/curiousdannii/ifvms.js | MIT |
| jQuery | https://jquery.com | MIT |

See each upstream project for the full license text.
