# Solutions — design

**Date:** 2026-11-05 · **Status:** the author asked for this feature and then opted out of questions ("skip questions and just write it"). Everything not quoted below is the builder's call, marked as such.

## What the author asked for (their words, condensed)

- A **"Solution" button in the right pane**: "a full walkthrough of each sample — not just directions, but also full text. So the walkthroughs might be big."
- For **the author's own games** (not samples): "the ability for the user to create a 'solution' file … a full retelling of the game with all directions, room descriptions, and actions. Maybe have the user have the ability to 'record' a solution — with a **green light showing it's recording, a red light showing it's stopped**."
- "The solution files should also be **editable in the left pane**, in case the user wants to remove mistakes."

## Intent

A solution is the whole game told as it plays: the opening text, then every command and the game's full reply, in order. For a sample it shows a learner how the game is meant to go. For an author's own game it's a record of a winning playthrough that they can tidy up, keep with the project and share.

## The key idea (builder's call)

Frotzsmith already replays a list of commands headlessly in milliseconds (the Transcript tab and Test Scripts use the replay worker). So **a solution's text is always produced by replaying commands from the start of the game.** Nothing captures the Play iframe's screen.

- **Samples:** each sample ships a short walkthrough (commands only, one per line). Its solution is generated on demand by compiling the sample and replaying that walkthrough. No large text files ship with the site, and the text is always correct for the compiler and interpreter the site runs.
- **Recording:** while recording, Play captures the commands typed (it already does: `usePlayTranscript`). When the author presses Stop, those commands are replayed from the start of the game and the full text becomes the solution. Recording therefore always starts the game afresh (see Recording).
- **The solution file** is plain text. Command lines begin with `> ` at the start of a line; everything else is the game's text. Editing it is free-form, and **Regenerate** rebuilds the text from its `> ` lines against the current build, so removing a mistaken command and regenerating gives a clean retelling.

## The Solution tab (right pane)

A new tab after **Map**: label "Solution", icon `i-lucide-book-open-check`.

- **Spoiler guard (builder's call):** the text stays hidden until the author presses **Show solution**, in every case. A sample's solution is a complete spoiler.
- **When the editor holds a bundled sample** (loaded from the Samples dropdown and not since replaced by New, Open, a package or a share link):
  - **Show solution** compiles if needed, replays the sample's walkthrough, and shows the full text.
  - If the source has been edited since loading, a one-line note says the solution reflects the edited game.
  - **Make it my solution** copies the text into the game's own solution file, which can then be edited.
- **For any game (own or sample):** the game's own solution file, if one exists, is shown, with these actions:
  - **Record**: a status light that is green and reads "Recording" while recording, and red and reads "Stopped" otherwise.
  - **Edit**: opens `solution.txt` in the left pane.
  - **Regenerate**.
  - **Download** (`<story>-solution.txt`).
  - **Clear**, which asks first.
- **Rendering:** command lines are shown bold, like the Transcript tab, inside a scrollable, selectable block. Long solutions render fine; no virtualisation is needed for the expected sizes.

## Recording

The author's later message: "add a **pause** button — pause pauses the recording so an author can edit the solution, **record starts the recording from scratch**, and **stop is essentially a 'save'** — it saves the current solution. Give the ability to **load in a partial solution file and then record from the stopping point**. Essentially, I want this to be as intuitive as possible. It's not required — a solution file — but it's optional and bundled in a .frotzsmith file or **can be copied to the clipboard**."

**Three states, each shown as a coloured light plus a word:**
- **Recording**, green.
- **Paused**, amber.
- **Stopped**, red.

**The controls:**
- **Record** starts from scratch. If a solution already exists, it asks first ("Replace the solution for “<title>”?"). It then compiles if needed, **restarts Play from the beginning**, switches to the Play tab, and starts capturing.
- **Pause** saves what has been played so far as the solution. The full text is made by headless replay, so the author can see it and edit it in the left pane. Capture then stops, and the light turns amber.
- **Resume** continues a paused recording. It **brings Play back to where the solution ends**: it restarts Play and feeds it every `> ` command in the current solution text, through the existing `sendToPlay`. Any edits made while paused are therefore respected. Capture then continues, appending after those commands.
- **Stop** means "save". It saves the current solution, the same way Pause does, and ends the session. The light turns red.
- **Continue recording** is shown when Stopped and a solution exists. It picks up from where the solution ends, exactly like Resume. This also covers "load in a partial solution file and then record from the stopping point".
- **Load file…** opens a `.txt` solution. It must be under the 1 MiB cap and is read as text. It asks before replacing an existing solution. After loading, the author can press Continue recording to carry on from its end.
- **Copy** puts the solution text on the clipboard.
- The rest of the tab is unchanged: Show solution (the spoiler guard), Edit, Regenerate, Download, and Clear.

**The layout while recording.** The author: "if the game is being played in the right pane, then the left pane contains the solution."
- When a session starts (Record, Resume or Continue), the **right pane shows Play** and the **left pane opens `solution.txt`**, so the game and its solution sit side by side.
- While **Recording**, the left-pane solution is read-only and updates live. After each captured command, the solution text is regenerated by headless replay (debounced about 300 ms; replay costs milliseconds) and the view scrolls to the end.
- While **Paused** or **Stopped**, it is editable as usual.
- The light and its Pause/Resume and Stop controls sit at the top of the left-pane solution tab, as well as on the Play pane and the Solution tab.

**Where the controls appear:**
- The light and the Pause/Resume and Stop buttons also show as a small bar on the Play tab while a session is Recording or Paused.
- **Zero commands:** Stop or Pause with nothing captured, and no existing solution, saves nothing.

**Interruptions:**
- **The session pauses by itself** (amber, with a one-line reason) if the source is recompiled, so Resume replays into the new build.
- **It stops by itself** if a different game is loaded.
- **A page reload ends the session.** Whatever was captured since the last Pause is lost, and the author is told once. That's a reason Pause saves.

**Feeding a long solution into Play** uses the existing Send-to-Play path. Its known limit is that browsers throttle hidden tabs (see the project notes), so Resume switches to the Play tab before feeding.

**A solution is optional.** Nothing requires one. It rides along in a `.frotzsmith` package, or Copy puts it on the clipboard.
- **Random elements:** the replay uses the replay worker's fixed seed. If a game's text differs between Play and the replay because of randomness, the saved solution is the replay's text, and that's the deterministic one. This is noted in the tab's help line.

## The solution file

- **One per game,** keyed like test scripts and the Skein (language + story key), in localStorage `frotzsmith:<lang>:solutions` → `{ v: 1, buckets: { [storyKey]: { text } } }`. It uses a null-prototype object (see the 2026-11-04 audit, F7) and writes through `safeSetItem` + `notifyStorageFull`.
- **Caps (builder's call):** 1 MiB per solution and 4 MiB for the whole store (UTF-16 length). Recording or Regenerate that would exceed a cap is refused with one plain sentence.
- **Left pane:** when the game has a solution, the explorer lists **`solution.txt`** under the project files (both languages), with tab id `solution`. It is editable. Edits save through the same debounced autosave pattern ZIL extra files use, so memory updates at once and persistence is debounced.
- **Lifecycle:** follows the game. A new or loaded game uses its own bucket, so nothing is cleared across games. Clear asks first.

## `.frotzsmith` packages

- **Writer:** includes `solution.txt` at the package root when the game has a solution, and the manifest gets `"solution": "solution.txt"`.
- **Reader:** accepts a solution file that is UTF-8 text, at most 1 MiB and named by the manifest. Otherwise it applies the package's usual refuse-whole rules. Opening a package replaces the game's solution, which counts as work being replaced in the existing confirm.
- **Spec:** `docs/spec/frotzsmith-package.md` gains the field.

## Sample walkthroughs

Every bundled sample in both languages gets `app/modules/samples-shared/<sample>.walkthrough.txt`. The Architect's Legacy and Mingus I already have theirs. A walkthrough is the shortest command list that shows the sample off, winning where the sample can be won. Each is checked by one golden test per language:
- the sample compiles;
- the walkthrough replays without an engine error;
- it reaches the end where the sample has one.

## Non-goals

- Capturing Play's screen output.
- Branching solutions; the Skein covers branching.
- A solution "diff against expected"; Test Scripts and the Skein cover regression checks.
- A desktop folder file (M3 will map `solution.txt` into the project folder).

## Anti-goals

- Showing a sample's solution without the author asking.
- Silently replacing an existing solution.
- A recording that misses the game's opening, which is why recording restarts Play.
