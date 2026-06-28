# Frotzsmith — Use Cases

**Document 12 of 13 · Use Cases**

Concrete walkthroughs of real workflows, written from the author's side of the screen. These double as acceptance scenarios.

---

## UC-1 — "Compile this standard-library game and play it" (the spine)

1. Author opens Frotzsmith. A new project defaults to the **Standard Library** profile; the editor holds the std starter template (two rooms, a takeable object).
2. Author pastes/writes their `.inf`. Syntax highlights as they type. Autosave shows "saved 2s ago."
3. Author clicks **Compile** (or ⌘B). The WASM compiler loads (first time), runs, returns clean.
4. Right pane auto-focuses **Play**; Parchment boots the `.z8` inline. Author types `look`, `n`, `take lamp` — it plays.
5. Author edits, recompiles; Play reloads from a fresh start.

*This must feel effortless. Everything else is in service of this.*

## UC-2 — "I made a typo"

1. Author writes `Object rock "rock" with name 'rock' description "A plain rock"` — missing a comma.
2. Compile → right pane auto-focuses **Results**: a red row, `story.inf(42): Error: Expected ',' …`.
3. Author clicks the row → cursor jumps to line 42 in the left pane.
4. Author fixes it, recompiles, lands in Play.

## UC-3 — "Test the opening sequence after a change"

1. Author has a script named **"Opening"**: `n. examine portrait. open drawer. take key. unlock door with key. e.`
2. After editing the game, author clicks **Run** on "Opening."
3. Right pane auto-focuses **Transcript**; the five-command playthrough fills in, each command followed by the game's response.
4. Author eyeballs it — the drawer no longer opens. Bug spotted. They click **"Send to Play"** to take over manually from the drawer and poke at it.

## UC-4 — "Run the whole-game walkthrough"

1. Author keeps a **"Full walkthrough"** script — 180 commands, the complete solution.
2. Click **Run.** Replay executes headlessly (in a worker), transcript caps gracefully if huge; elapsed time shown.
3. Author scrolls to the end: does the game still end with the victory text? If a mid-game change broke a later puzzle, the transcript shows where it diverged.

*(When the Skein lands, this becomes: bless the walkthrough once, then every recompile diffs against it and flags the exact changed turn in red.)*

## UC-5 — "Switch this experiment to PunyInform"

1. Author wants a tiny, fast game for a constrained target. They open the profile selector and choose **PunyInform**.
2. Frotzsmith warns: PunyInform source isn't compatible with the standard library; it won't rewrite existing source. Author confirms (this is a fresh experiment).
3. The editor seeds the **PunyInform starter template** (correct pre-include config constants + `globals.h`/`puny.h`). Default Z-version flips to `.z5`. Highlighting now reflects PunyInform keywords.
4. Author writes their small game, compiles → a small `.z5`, plays inline.

## UC-6 — "Tune the compiler switches"

1. Author opens **Options**. Target is Z-machine; they bump Z-version to `.z8` for a large game, enable strict mode (`-S`), and in the free-text box add `$MAX_STATIC_DATA=200000`.
2. Recompile picks up the new switches. Options persist with the project across reloads.

## UC-7 — "Ship it to a friend who knows nothing about IF"

1. Clean compile in hand, author opens the **Export** menu → **Download playable bundle**.
2. They get `caverns.html` — one file.
3. They email it. The friend, offline, with no interpreter installed, double-clicks `caverns.html`; it opens in their browser and plays. Saves work via the browser.

## UC-8 — "Archive the story file"

1. Author chooses **Export → Download story file** → `caverns.z8`.
2. They run it in Lectrote/Frotz to confirm, then submit it to the IF Archive. (Same bytes Frotzsmith played.)

## UC-9 — "Move the project to my other machine"

1. **Export → Export project** → `caverns.frotzsmith.json` (source + options + scripts + pulled-in extensions).
2. On the other machine, **Import project…**, pick the file → source, switches, every test script, and the project's extensions restored. Compile and continue.

## UC-10 — "Back from the future: regression-test with the Skein" (Phase 6 preview)

1. Author opens the **Skein** (post-v1). The "Full walkthrough" script seeds a linear thread of nodes.
2. Author **blesses** the thread — current output captured as correct.
3. Weeks later, after a big refactor, they re-run. The Skein diffs each node: 174 green (match), 6 red (changed) — clustered around the lantern puzzle. Author clicks the first red node, sees the old vs new output side by side, and knows exactly what the refactor broke.

*This is the I7-grade payoff, delivered for Inform 6 (Z-machine now; Glulx once its engine lands) — and it's built on the same `replay()` the flat runner used in UC-3/4.*

## UC-11 — "Pull in a community extension"

1. The author needs a menu system. They open the **Extensions** panel, which lists the curated I6 extension catalog filtered to the active Standard Library profile.
2. They find a menu-system extension, read its one-line description, and click through to its source to check usage. They toggle **Add to project**.
3. Frotzsmith adds the extension's `.h` file(s) to the project's include set. The author writes `Include "AltMenu";` (or whatever the entry's include name is) in their source; the next compile resolves it with no path wrangling.
4. For a niche extension not in the catalog, they instead use **Import `.h` file**, pick a local file, and `Include` it the same way — entirely offline.
5. The pulled-in extensions persist with the project and travel in its `.json` export.
