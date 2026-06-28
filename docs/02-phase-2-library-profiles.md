# Frotzsmith — Phase 2: Library Profiles & Auto-Import

**Document 02 of 13 · Phase 2**
**Deliverable:** A project carries a **library profile** (Standard Library or PunyInform) that auto-imports the right `.h` files, sets sensible default Z-version and compiler switches, supplies the highlight keyword set, and provides a starter template. A compiler-options panel exposes those defaults with a free-text override. Projects can also pull optional **Inform 6 extensions** from a curated catalog into their include set.

> **Testable exit criteria:** Create a new project → defaults to Standard Library, `.z8`, std switches, std starter template, std keywords highlighted. Switch the project to PunyInform → includes change, default Z-version changes (e.g. `.z5`), PunyInform keywords highlight, the PunyInform starter compiles clean. Open the options panel, flip a switch (e.g. add `-S` strict), recompile, see it take effect. Override switches via free-text and confirm they reach the compiler.

---

## 1. The profile model (the key abstraction)

The IDE never thinks about "the library." It thinks about a **profile**:

```ts
interface LibraryProfile {
  id: 'std' | 'puny';
  label: string;                 // "Inform 6 Standard Library" | "PunyInform"
  includeFiles: VirtualFile[];   // .h files preloaded into MEMFS
  includePaths: string[];        // e.g. ['/lib/std'] or ['/lib/puny']
  defaultZVersion: 'z3'|'z5'|'z8';
  defaultSwitches: string[];     // baseline compiler switches
  keywords: string[];            // CM6 highlight keyword set
  starterTemplate: string;       // a minimal compiling .inf
  notes?: string;                // profile-specific gotchas surfaced in UI
}

interface VirtualFile { path: string; bytes: Uint8Array | string; }
```

Why this matters: **PunyInform is a replacement standard library, not a superset.** Its parser, world model, verb set, and initialization differ from the standard library. A source written for one will not compile against the other unmodified. The profile is what keeps the two worlds from contaminating each other — they never share an include set, a default Z-version, or a keyword list.

## 2. The two v1 profiles

### 2.1 Standard Library (`std`) — default

- **Includes:** the classic chain — `Parser`, `VerbLib`, `Grammar` (and `Grammar`/`English` definitions), pulled in via the usual `Include "Parser"; Include "VerbLib";` … or the `Include "Grammar";` tail. The profile preloads all standard library `.h` files into `/lib/std` and puts that on the include path so a plain author `Include` resolves.
- **Default Z-version:** `.z8` (largest classic ceiling; the no-surprises default).
- **Default switches:** standard baseline (e.g. strict-mode off by default, debug off; author can toggle).
- **Keywords:** full standard-library + I6-core keyword set for highlighting.
- **Starter template:** a minimal "two rooms and a takeable object" game that compiles and plays — proves the loop on a new project.

### 2.2 PunyInform (`puny`)

- **Includes:** PunyInform's chain (`globals.h`, then `puny.h`, with the project setting any `Constant` configuration *before* the includes as PunyInform expects). Preloaded into `/lib/puny`.
- **Default Z-version:** smaller — `.z5` default, with `.z3` reachable (PunyInform's reason for existing is small/fast games on constrained interpreters).
- **Default switches:** tuned for PunyInform (economy/size-oriented).
- **Keywords:** PunyInform's verb/property/library identifiers — *different from std* — so highlighting reflects the actual library in use.
- **Starter template:** PunyInform's minimal game skeleton (its initialization differs from std; the template encodes the correct boilerplate so the author isn't fighting setup).
- **Notes surfaced in UI:** "PunyInform source is not compatible with the standard library. Switching profiles will not rewrite your source."

> Honest scoping note: PunyInform expects certain `Constant` settings declared *before* its includes (configuration knobs). The profile's starter template encodes a correct baseline; the options panel does **not** try to manage these I6-source-level constants (they live in source, not switches). Doc 10 lists "PunyInform config-constant UI" as a stretch goal.

## 3. Auto-import mechanics

On compile, the active profile's `includeFiles` are written into MEMFS at their paths, and `includePaths` is passed to the compiler (`+include_path=…` or the appropriate `inform6` path switch). The author's `Include "Parser";` then resolves against preloaded files. Net effect: **a plain `.inf` compiles with no path management by the user** — the stated goal.

Library files themselves are **swappable bundles** (parallel to the swappable WASM decision): pinned in-repo for v1, versioned independently of the compiler, so the standard library or PunyInform can be bumped without touching `inform6.wasm`.

### 3.1 Inform 6 extension catalog (optional includes)

Beyond the profile's base library, the author can pull in community **Inform 6 extensions** — the `.h` contributions from the IF Archive and other authors (menu systems, parser add-ons, utility routines, etc.). The catalog is a **curated, pinned set bundled in-repo** (`app/modules/inform6/extensions/`), each entry carrying:

```ts
interface I6Extension {
  id: string;                   // 'altmenu', 'flags', 'utility', …
  name: string;                 // display name
  author: string;
  description: string;          // one-line summary
  sourceUrl: string;            // link out to the extension's home / IF Archive page
  includeFiles: VirtualFile[];  // the .h file(s), pinned
  includeName: string;          // what the user writes: Include "<includeName>";
  profiles: ('std'|'puny')[];   // which library profile(s) it targets
  notes?: string;               // ordering/config gotchas surfaced in the UI
}
```

**Link to, and pull in.** The Extensions panel lists the catalog with each entry's description and a **link out to its source** (`sourceUrl`), plus an "Add to project" toggle. Adding an extension appends its `id` to `Project.extensions`; at compile time its `includeFiles` are written into MEMFS alongside the profile's, on the same include path, so the author's `Include "flags";` just resolves — the *identical* mechanism to profile auto-import (§3). Removing it is the inverse. Selected extensions persist with the project and travel in the project `.json` export (Doc 05).

**Escape hatch (stays offline).** An "Import `.h` file" action lets the author add any extension not in the catalog from a local file (or paste) — written to the project's include set the same way, no network needed. This preserves the offline/static promise.

**Profile-aware.** Each entry declares the profile(s) it targets; the panel filters/marks by the active profile so std-only extensions aren't offered to a PunyInform project.

> Honest scope note: v1 ships a small curated catalog (the extensions the author actually uses) plus the local-import escape hatch. A **remote/auto-updating extension registry** (fetching from the IF Archive on demand) is a Doc 10 stretch — it would need a CSP `connect-src` relaxation, so it is deliberately *not* the v1 default; bundled + local-import keeps everything offline. Merging extension identifiers into the highlight keyword set is also a Doc 10 stretch.

## 4. Compiler-options panel

`app/components/ide/OptionsPanel.vue` — a Nuxt UI slideover/modal:

- **Target:** Z-machine (default) vs Glulx (`-G`). Selecting Glulx switches the default extension to `.ulx` and (Phase 3) routes play to `GlulxEngine`.
- **Z-version:** `z3 / z5 / z8` radio (pre-filled from profile default; only relevant when target = Z-machine).
- **Common toggles:** strict mode (`-S`), debug (`-D`), infix (`-X`) where applicable, warnings verbosity.
- **Free-text switch string:** the escape hatch — anything the UI doesn't model (e.g. `$MAX_STATIC_DATA=200000`, `$OMIT_UNUSED_ROUTINES=1`). Appended verbatim to the computed switch list.
- **Reset to profile defaults** button.

The effective switch list = `profile.defaultSwitches` ⊕ UI toggles ⊕ free-text, deduped with last-wins. Persisted to `localStorage` (`frotzsmith:options`) alongside source, per the autosave pattern.

## 5. Profile-aware highlighting

The CM6 mode from Phase 1 now takes its keyword set from `activeProfile.keywords`. Switching profiles reconfigures the editor's language extension (CM6 `Compartment` reconfiguration — no editor teardown). PunyInform source lights up with PunyInform keywords; std source with std keywords.

## 6. Project state

A "project" in v1 is lightweight — a single source buffer plus its settings:

```ts
interface Project {
  id: string;
  name: string;
  profileId: 'std' | 'puny';
  source: string;
  options: CompilerOptions;   // target, zVersion, toggles, freeText
  extensions: string[];       // ids of I6 extensions pulled in from the catalog (§3.1)
}
```

The working copy is persisted to `localStorage` for crash recovery; the **canonical source is the exported `.inf`** (ADR-010), while options/scripts use localStorage as their working store. v1 supports a single active project (multi-project is a Doc 10 stretch goal). New-project flow: pick profile → source seeded with that profile's starter template → ready to compile.

## 7. Composables added this phase

```
app/composables/
  useProfiles.ts        # registry of LibraryProfile, active profile
  useCompilerOptions.ts # options state, switch computation, persistence
  useProject.ts         # project record, new/switch-profile flow
  useExtensions.ts      # I6 extension catalog: add/remove/import into project (§3.1)
```

`useCompiler` (Phase 1) now reads `includePaths` + `includeFiles` + `switches` from the active profile and options rather than hard-coded values.

## 8. Accessibility

Options panel is a proper dialog (focus trap, labelled controls, `for`/`id` associations — the markdown editor already fixed exactly these in its modals). Profile selector is a labelled listbox. axe-core clean.

## 9. Phase 2 done =

New projects default to Standard Library and compile their starter template with one click; switching to PunyInform swaps includes, defaults, keywords, and template; the options panel drives real compiler switches with a free-text escape hatch; and the author can pull catalog (or locally-imported) Inform 6 extensions into a project's includes and `Include` them in a clean compile — all persisted across reloads.
