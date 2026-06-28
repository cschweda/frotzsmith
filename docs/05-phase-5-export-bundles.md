# Frotzsmith — Phase 5: Export & Playable Bundles

**Document 05 of 13 · Phase 5**
**Deliverable:** Two export artifacts from a successful compile: (1) the **raw `.z5`/`.z8`** (or `.ulx`) story file, and (2) a **single-file, self-contained Parchment HTML bundle** that opens and plays offline with no server. Plus project export (source + options + scripts) for backup/sharing.

> **Testable exit criteria:** Compile a game → "Download story file" yields a working `.z8` playable in any IF interpreter. "Download playable bundle" yields one `.html` file that, opened by double-click on a machine with no IF tooling and no internet, runs the game in the browser. "Export project" yields a `.json` (or `.zip`) that re-imports to restore source, options, and all test scripts.

---

## 1. Raw story-file export

Trivial and already half-built (Phase 1 had a download link). The compile output `Uint8Array` is offered as a download with the correct extension and MIME (`application/octet-stream`), filename derived from the project name (sanitized — reuse the markdown editor's filename-sanitization util: path-traversal, invalid chars, length caps). This is the artifact the author keeps and submits to IF archives or runs in Frotz/Lectrote/etc.

## 2. Playable bundle (the shareable artifact)

A **single self-contained `.html`** with the story file embedded, using the same Parchment runtime the Play tab uses. Goal: a person with no IF knowledge double-clicks the file and plays — offline, no server, no install.

### 2.1 Construction

Parchment supports a "single-file release" shape. Frotzsmith builds it by:
1. Taking the Parchment runtime assets (interpreter + GlkOte display + minimal CSS) — bundled in-repo, pinned.
2. Embedding the story file as base64 (or a typed-array literal) inside the HTML so there's **no fetch** at runtime.
3. Inlining JS/CSS so the result is **one file** with zero external requests.
4. Adding a minimal title/credits header derived from project name.

Output: `mygame.html`, downloadable, fully offline-capable. This is "what you test is what you ship" — identical interpreter to the Play tab.

### 2.2 Honest constraints

- **File size:** base64 inflates the story ~33%; a large Glulx game makes a big HTML file, but still well within browser limits. Noted, not blocking.
- **Glulx bundles** are larger (Quixe/Glulxe runtime > ZVM). The bundle builder picks the runtime matching the story target.
- **Saves inside the bundle** use the interpreter's own localStorage-based save (per-file origin); documented for the recipient.

## 3. Project export/import (backup & sharing source)

Distinct from shipping a *game*, the author may want to move a *project* (editable source) between machines or back it up beyond localStorage.

```ts
interface ProjectExport {
  frotzsmithVersion: string;
  name: string;
  profileId: 'std' | 'puny';
  source: string;
  options: CompilerOptions;
  scripts: TestScript[];
}
```

- **Export:** serialize to `frotzsmith-project.json` (or a `.zip` if/when multi-file source lands — Doc 10). Download via the same sanitized-filename path.
- **Import:** file picker → validate `frotzsmithVersion` → restore project, options, scripts into localStorage → ready to compile.
- This complements (does not replace) the always-on localStorage autosave — it's explicit, portable backup, mirroring the markdown editor's "autosave + explicit download" duality.

## 4. Export menu UX

`app/components/ide/ExportMenu.vue` — a Nuxt UI dropdown in the toolbar:
- **Download story file** (`.z8` / `.ulx`) — enabled only after a clean compile.
- **Download playable bundle** (`.html`) — enabled only after a clean compile.
- **Export project** (`.json`) — always available.
- **Import project…** — file picker.

Disabled states are explained inline ("Compile first to export a story file"), in the interface's voice — never a dead, unexplained control.

## 5. Composables

```
app/composables/
  useExport.ts          # story-file + bundle builders, downloads (extends Phase 1 download)
  useProjectTransfer.ts # project export/import, validation
```

`useExport` reuses the markdown editor's `useExport` discipline: composable-scoped timers, cleanup on unmount, sanitized filenames, graceful failure messaging.

## 6. Security touchpoints (cross-ref Doc 06)

- Bundle builder embeds **only** the author's compiled story + pinned Parchment runtime — no remote includes, so the artifact is self-contained and side-effect-free.
- Project import validates structure before trusting it; never `eval`s imported content; treats imported source as text only.
- Filenames sanitized on every download.

## 7. Accessibility

Export menu is a labelled menu with keyboard operation; disabled items carry an accessible explanation; import file input is properly labelled. axe-core clean.

## 8. Phase 5 done =

From one clean compile the author gets (a) a raw story file for archives/interpreters, and (b) a single offline `.html` anyone can double-click and play — plus portable project export/import for source. v1 feature set complete.
