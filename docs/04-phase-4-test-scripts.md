# Frotzsmith — Phase 4: Test Scripts & Headless Replay

**Document 04 of 13 · Phase 4**
**Deliverable:** A power-user testing surface. Save arbitrarily long command scripts (`n. examine rock. lift rock. s. open door.`), run them through the headless replay primitive, and read the resulting transcript in the **Transcript** tab. This is the author's real daily need *and* the linear spine of the future Skein.

> **Testable exit criteria:** Write a 40-command script targeting a known game, click Run → Transcript tab fills with the per-command playthrough. Edit the game, recompile, re-run the same script → transcript reflects the new behavior. Save multiple named scripts per project; they persist across reloads. A script can target "the whole game" or just a section (the author decides the command list).

---

## 1. The core primitive (everything testing-related calls this)

```ts
interface ReplayResult {
  turns: TurnRecord[];
  finalState: EngineState;
  ms: number;
}
interface TurnRecord {
  command: string;        // the input ('' for the initial boot banner)
  output: string;         // normalized output AFTER this command
}

async function replay(
  storyFile: Uint8Array,
  target: 'zmachine' | 'glulx',
  commands: string[]
): Promise<ReplayResult>;
```

Implementation: `createEngine(target)` → `boot(storyFile)` (capture the banner/intro as turn 0) → for each command, `await send(cmd)` and record the normalized output → collect `snapshot()` as `finalState`. **This is the single mechanism** behind: the flat script runner (this phase), and later every Skein operation (run a node = `replay` along the path from root).

Because `send()` returns text already run through `normalizeTurnOutput` (Phase 3), transcripts are VM-agnostic and diff-ready.

## 2. Test scripts (what the author actually wanted)

A **script** is just a named command list:

```ts
interface TestScript {
  id: string;
  name: string;          // "Opening sequence", "Full walkthrough", "Cave puzzle"
  commands: string[];    // parsed from the author's text
  blessed?: string;      // Phase-6 stretch: blessed transcript for diffing
}
```

### 2.1 Authoring format (lenient on purpose)

The author types commands; the parser is forgiving about separators so a long test reads naturally:
- Newline-separated **or** period-separated **or** both: `n. examine rock\nlift rock\ns` all work.
- `!` line → comment (mirrors I6's own comment char; ignored in replay, kept in the editor).
- Blank lines ignored.
- A leading `> ` is stripped (so pasting a transcript back in works).

So the author's example — `"N, Examine Rock, Lift Rock, etc."` — parses to `['n','examine rock','lift rock', …]`. Length is unbounded; a script can be three commands or the entire game's walkthrough.

### 2.2 Section vs whole-game

Nothing special is needed: a "section" test is just a shorter command list that walks to and through the relevant part. The author controls scope by what they put in the list. (A future Skein makes "start from a saved mid-game state" possible — Doc 10 — but v1's flat model already covers section testing by replaying from the start.)

## 3. The Transcript tab

`app/components/ide/TranscriptPanel.vue`:

- Renders `TurnRecord[]` as a scrollable transcript: each turn shows the command (styled like a `>` prompt) then its output.
- Running a script auto-focuses the Transcript tab (per the I7-IDE stateful right pane).
- A "run" indicator + elapsed ms; cancel control for long scripts.
- "Send to Play" — load the script's `finalState` into the interactive Play tab so the author can take over manually from where the script left off (uses `restore()`).
- (Phase-6 stretch) a "Bless this transcript" action and a diff view vs. the blessed copy — specified in Doc 10, not built in v1.

## 4. Script management UI

- A scripts list per project (Nuxt UI list), add/rename/delete.
- A script editor — a small CodeMirror instance (plain text, light highlighting of `!` comments) so long scripts are pleasant to edit.
- Persisted to `localStorage` (`frotzsmith:scripts:<projectId>`), and included in the exportable project (Doc 05 / Doc 09).

## 5. Composables

```
app/composables/
  useReplay.ts        # the replay() primitive over StoryEngine
  useTestScripts.ts   # CRUD + persistence of TestScript[]
  useTranscript.ts    # current transcript state, run/cancel, send-to-play
```

`useReplay` is deliberately thin and VM-agnostic — it's the contract the Skein will inherit unchanged. Keeping it minimal now is what prevents the Phase-6 Skein from becoming a refactor.

## 6. Performance

Headless replay has no rendering cost, so even a several-hundred-command walkthrough runs fast. For very long scripts, run in a Web Worker (the engine can live off the main thread) to keep the UI responsive — specified as the default if the single-threaded interpreter cooperates; otherwise chunk the loop with yields. (No `SharedArrayBuffer` needed; this is message-passing, not shared memory — COOP/COEP-free promise from Doc 11 holds.)

## 7. Accessibility

Transcript is a readable, scrollable region with proper headings/landmarks; run/cancel are labelled buttons with live-region status ("Running 12 of 40 commands…", "Done — 40 turns"). Script editor inherits the editor a11y work. axe-core clean.

## 8. Phase 4 done =

The author pastes a long command list, hits Run, and reads the whole playthrough as a transcript — the feature they asked for — built on a `replay()` primitive that the branching Skein (Doc 10 / future phase) will reuse without modification. Flat runner first, by design.
