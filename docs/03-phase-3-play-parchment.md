# Frotzsmith — Phase 3: Play via Parchment & the StoryEngine Seam

**Document 03 of 13 · Phase 3**
**Deliverable:** A clean compile auto-focuses the **Play** tab, where the freshly compiled story file runs inline via Parchment. The Z-machine plays behind a single `StoryEngine` interface, with the engine chosen by the compiled file's target; Glulx is stubbed behind the same factory for a future drop-in.

> **Testable exit criteria:** Compile a standard-library Z-machine game → Play tab shows a working game window; typing commands advances it. Recompile after an edit → the Play tab reloads the new story file from a fresh start. Selecting the Glulx target shows a clean "not yet supported" notice (the seam exists; the engine is deferred — ADR-002).

---

## 1. The seam: one interface, one engine in v1

The decision (Doc 11, ADR-002): the Skein, the test runner, and the Play tab must never branch on VM type. They talk to one interface:

```ts
interface StoryEngine {
  boot(storyFile: Uint8Array): Promise<void>;   // load + start, ready for input
  send(command: string): Promise<string>;        // one turn in → normalized output out
  snapshot(): EngineState;                        // VM state capture (Skein fast-forward)
  restore(state: EngineState): void;              // rewind to a captured state
  reset(): Promise<void>;                          // boot fresh from the same story file
  readonly target: 'zmachine' | 'glulx';
}
```

Implementations:
- **`ZmachineEngine`** — wraps ZVM / ifvms. **The only engine built in v1.**
- **`GlulxEngine`** — a deferred stub; the author has never used Glulx (ADR-002). When it lands it wraps Quixe (or Glulxe-via-Emglken) behind this same interface, with no change downstream.

The interpreter is selected by the compiled story's target via one factory (`createEngine(target)`): `.z3/.z5/.z8 → ZmachineEngine`; `.ulx →` the stub throws "Glulx not yet supported." Nothing downstream knows or cares — which is exactly what lets Glulx drop in later without a refactor.

## 2. Two display modes, same engine

There are **two ways** Frotzsmith drives an engine, and this distinction is the spine of Phases 3–4:

1. **Interactive play (this phase).** The engine is wired to a visible Parchment/GlkOte display in the Play tab. The human types; output renders to screen.
2. **Headless replay (Phase 4 + Skein).** The engine is driven *programmatically* — `boot()` then a loop of `send(command)` capturing returned text — bypassing the visible window. No human, no rendering required; output is collected per command.

Both modes use the *same* `StoryEngine`. Interactive play is "a human calling `send` through a keyboard"; headless replay is "code calling `send` in a loop." Building the interface in Phase 3 with `send()` returning normalized text is what makes Phase 4 nearly free.

## 3. Parchment for interactive play

Parchment is the display+interpreter wrapper (GlkOte display layer over ZVM/Quixe). For the **Play tab**, Frotzsmith embeds Parchment configured to load the in-memory story file (a `Uint8Array`, not a URL fetch). On each successful compile:

1. Tear down any prior Parchment instance in the Play tab.
2. Instantiate Parchment with the new story bytes.
3. Auto-focus the Play tab (per the I7-IDE behavior: clean compile → Play).

This reuses Parchment's mature I/O and saves building a terminal UI. The *same* Parchment runtime is what Phase 5 embeds in the exported bundle — "what you test is what you ship."

## 4. Output normalization (VM-agnostic from the start)

v1 ships only the Z-machine, but the normalizer is specified **VM-agnostic now** so a future Glulx engine diffs cleanly against Z-machine output with no retrofit. Glulx talks I/O through **Glk** (windows, streams, input events) while the Z-machine uses its older model, and for **headless replay** (Phase 4) they expose the per-turn text stream differently — trailing prompts, status-line text, window boundaries. Locking normalization now means that when Glulx lands, blessed-output diffing won't see **false regressions** from comparing one VM's output shape against the other's.

Therefore: a single shared **output normalizer** `normalizeTurnOutput(raw, target)` is specified now and used by *both* engines' `send()`:
- strips/canonicalizes the trailing command prompt,
- excludes the status-line/banner window text from the diffable body **by default, with a per-script opt-in toggle to include it** (ADR-006 — status lines churn every turn and cause false regressions),
- normalizes whitespace/newlines,
- yields engine-agnostic text so a blessed transcript is portable across VMs.

This function is the contract that keeps the replay and Skein machinery VM-agnostic (D4, D12) — so a future Glulx engine yields diff-compatible transcripts with no rework.

## 5. Components & composables

```
app/
  components/ide/
    PlayPanel.vue          # hosts Parchment for the active story file
  modules/inform6/engine/
    StoryEngine.ts         # interface + createEngine factory
    ZmachineEngine.ts
    GlulxEngine.ts
    normalizeTurnOutput.ts # shared, VM-agnostic
  composables/
    usePlay.ts             # boot/teardown Parchment on compile success
```

`usePlay` listens for `CompileResult.ok`, builds the right engine via the factory, and (interactive mode) hands the story bytes to Parchment in `PlayPanel`. Client-only — interpreters and WASM never touch SSR.

## 6. Lifecycle & memory

- One live engine/Parchment instance per Play session; explicit teardown on recompile and on component unmount (the markdown editor's "cleanup timeouts/instances on unmount" discipline applies — no leaked interpreters).
- Re-compiling always boots a **fresh** game (no implicit save carryover); a future "restart vs resume" affordance is a Doc 10 note.

## 7. Accessibility

Parchment/GlkOte has its own a11y surface; Frotzsmith ensures the Play tab is keyboard-reachable, focus moves into the game input on tab activation, and the tab control announces state ("Play — game running"). axe-core covers the surrounding chrome (Parchment internals are third-party but the embedding must not introduce violations).

## 8. Phase 3 done =

Compile → play, inline, for the Z-machine, through the one `StoryEngine` interface (Glulx stubbed behind the same factory), with a shared output normalizer already in place so Phase 4's headless replay and the eventual Skein diffing are VM-agnostic from the start.
