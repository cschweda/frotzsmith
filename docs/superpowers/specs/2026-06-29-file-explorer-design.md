# File Explorer — Design

**Date:** 2026-06-29
**Status:** Approved design, pre-implementation
**Topic:** A collapsible file explorer that lists the project's compilation bundle, with tabbed, multi-file editing.

## Problem

Frotzsmith today edits a single `.inf` source buffer. Extensions (`.h` files) exist but are only reachable through the Extensions modal, and the standard-library / PunyInform files that every compile depends on are invisible. As authors add extensions, "the project" becomes several files, but there is no place to see or open them.

We want an expandable, closable file explorer (à la Borogove's File Manager) that lists every file in the **compilation bundle** and lets the author open and edit each one in a tabbed editor.

## Scope: the explorer mirrors the compilation bundle

The file list is grounded in exactly what `useCompiler.compile()` mounts into the WASM filesystem (`app/composables/useCompiler.ts:48-57`):

1. The source → `/work/story.inf` (the game file)
2. The active library profile's `.h` files → `profile.files`
3. Each **enabled** extension → `<includePath>/<name>.h`

The explorer presents these as two groups:

- **Project**
  - `story.inf` — the editable source buffer. Always present; cannot be closed.
  - Each **enabled** extension `.h`. Uploaded extensions are **editable**; bundled extensions (e.g. `ordinals.h`) are **read-only**.
- **Library (n)** — the active profile's `.h` files (Standard Library = 8, PunyInform = 12). **Read-only.** Collapsible. The group rebuilds when the active library switches (Std Lib ↔ PunyInform).

A **disabled** extension is not part of the bundle, so it does not appear in the explorer. The Extensions modal remains the catalog for adding, enabling/disabling, and removing extensions. There is nothing else in the bundle today, so this list is complete; if the bundle gains other inputs later (e.g. ICL files), they slot into the Project group the same way.

### File naming

The main file is shown as **`story.inf`** — what the compiler actually builds, honest to the "compilation bundle" framing. The live game title continues to show in the existing `TitleStrip`. `Save As…` keeps its current behavior of suggesting a story-slug filename for the exported file. (Open micro-decision the author may override: `main.inf` or the story slug instead.)

## Architecture

### Editor strategy (approach B)

One `EditorView`, with a **per-file `EditorState`** kept in a `Map<fileId, EditorState>`. Switching the active file swaps state via `view.setState(states.get(id))`. This preserves each file's undo history and cursor position across tab switches.

Each state is built by a `makeState(file)` helper carrying the shared extensions:

- Inform 6 language mode + theme (theme in a `Compartment`, initialized to the current color mode).
- A `readOnly` `Compartment`: `EditorState.readOnly.of(!file.editable)`.
- Linting (`i6Lint`) **only for editable files** — skip it on read-only library/extension files to avoid spurious diagnostics.
- An `updateListener` that, on `docChanged`, writes back to **that file's** backing store (captured in the closure):
  - `story.inf` → `source.value`
  - uploaded extension → `updateUploaded(id, doc)`
  - read-only files → no write-back (and `readOnly` blocks edits anyway).
- The existing keymap, including `Mod-b` → `runCompile()` (compiling always builds the whole project regardless of which file is active).

External content changes (load sample, open file, new project, re-uploading an extension) must refresh the corresponding file's state with the new content (a fresh document/history is acceptable there, since the buffer was wholesale-replaced). Live in-editor edits propagate out through the per-state `updateListener`, so no echo handling is needed for typing.

Dark/light toggle reconfigures the theme compartment on the live view; because every state carries the theme compartment at construction, swapped-in states render in the correct mode.

### New / changed units

| Unit | Type | Responsibility |
|------|------|----------------|
| `app/composables/useProjectFiles.ts` | **new** | Single source of truth for the explorer. Derives the virtual file list from `source`, `useExtensions`, and the active `profile.files`. Tracks `activeId`, `openTabs[]`, `panelOpen`. Open/activate/close tab actions. Persists `{ open, activeId, openTabs }` and restores with stale-id validation. |
| `app/components/ide/FileExplorer.vue` | **new** | The collapsible left panel. Project + Library groups, active row highlighted, ✕ to close. A "+" affordance opens the existing Extensions modal (reuse, no duplicated upload UI). |
| `app/components/ide/EditorTabs.vue` | **new** | Tab strip above the editor. `story.inf` non-closable; others closeable. Reflects `openTabs`/`activeId`. |
| `app/components/ide/SourcePane.vue` | modify | Multi-file editor per the strategy above (per-file `EditorState`, read-only + lint compartments, routed write-back). |
| `app/composables/useExtensions.ts` | modify | Add `updateUploaded(id, content)` (persists). |
| `app/composables/useIde.ts` | modify | Expose project-files surface as needed; route `format()`/Prettify to the active **editable** file; ensure clicking a diagnostic activates `story.inf` before the cursor jump. |
| `app/components/ide/IdeLayout.vue` | modify | Add the explorer as a collapsible left column (desktop) / slide-over drawer (mobile), and the tab strip into the Source section. |
| `app/components/ide/IdeToolbar.vue` and/or `SourceToolbar.vue` | modify | A `PanelLeft` toggle to open/close the explorer. |
| `frotzsmith.config.ts` | modify | Add `storageKeys.explorer`. |

### File model

```ts
interface ProjectFile {
  id: string            // 'source' | ext.id | `lib:${name}`
  name: string          // 'story.inf', 'ordinals.h', 'Parser.h', …
  group: 'project' | 'library'
  editable: boolean     // source + uploaded exts = true; bundled exts + library = false
  read(): string        // current content from the backing store
  write?(text: string): void  // present iff editable
}
```

The Library group is built from the active profile's source files, **de-duplicated** against the case-alias entries in `profile.files` (those aliases — e.g. `parser.h` alongside `Parser.h` — exist only as a MEMFS case-sensitivity workaround and must not appear twice; show the canonical name the author would `Include`).

## Layout

- **Desktop (`lg+`):** the main row becomes a flex row — `FileExplorer` (`w-60`, `shrink-0`, collapsible to hidden) followed by the existing source|output two-pane grid in a `flex-1` container. The Source section order becomes `TitleStrip → SourceToolbar → EditorTabs → SourcePane`.
- **Mobile:** the explorer is a slide-over drawer toggled by a button; it does not consume layout width. The existing Source/Output pane switch is unchanged.
- **Toggle:** a `PanelLeft` button opens the explorer; the panel header's ✕ closes it (mirrors Borogove).

## Persistence

A new `storageKeys.explorer` stores `{ open: boolean, activeId: string, openTabs: string[] }`. On restore, every persisted id is validated against the current bundle; ids that no longer resolve are dropped, and `activeId` falls back to `story.inf`. Writes swallow `QuotaExceededError` like the existing stores.

## Edge cases

- **Library switch (Std ↔ Puny):** rebuild the Library group; close any open library tab whose file is absent from the new profile; if such a tab was active, fall back to `story.inf`.
- **Remove uploaded extension (modal):** close its tab if open; fall back to `story.inf` if it was active.
- **Disable extension (modal):** it leaves the Project group (no longer in the bundle); close its tab if open; fall back if active.
- **Enable / upload extension:** appears in the Project group; does not auto-open a tab (upload still auto-*enables*, preserving current behavior).
- **Click a diagnostic row:** activate `story.inf` first, then apply the existing cursor jump (diagnostics target the source).
- **Prettify on a read-only file:** disabled / no-op.

## Accessibility

This project holds a WCAG 2.1 AA bar with an axe-core zero-violation gate, so the explorer must keep that bar:

- The file list is a keyboard-navigable list of buttons; each row has an accessible name (filename + read-only state where applicable) and a visible focus ring. The active file is conveyed beyond color (e.g. `aria-current` + an icon/weight change).
- The tab strip uses proper tab semantics (`role="tablist"`/`tab`, arrow-key movement, the editor as the labelled `tabpanel`), or an equivalently accessible button group; close controls have `aria-label`s.
- The collapse/close and open toggles are real buttons with `aria-expanded` / `aria-label` and are reachable by keyboard.
- The mobile drawer traps focus while open, closes on `Esc`, and restores focus to the toggle.
- Read-only files surface their state non-visually (in the tab/row accessible name), not by color alone.

## Testing

- `useProjectFiles`: list composition for both profiles; enable/disable/remove and library-switch transitions close the right tabs and fall back correctly; persistence round-trips and drops stale ids.
- Library de-duplication: case aliases collapse to one canonical entry.
- Editor: read-only files block edits; editable files write back to the correct store; per-file undo survives a tab switch; external content replacement refreshes the right state.
- Accessibility: axe-core remains zero-violation with the panel open, a read-only tab active, and the mobile drawer open.

## Out of scope

- Creating/renaming/deleting files from the explorer (extensions are still added/removed via the modal).
- Editing bundled or library files (read-only by design).
- Drag-and-drop reordering, multi-select, or a real virtual filesystem beyond the compilation bundle.
- Per-file Save As (export remains whole-source `Save As…`).
