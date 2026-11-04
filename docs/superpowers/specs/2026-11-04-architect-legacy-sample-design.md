# The Architect's Legacy — bundled sample design

**Date:** 2026-11-04 · **Source outline (the author's):** `docs/architect_legacy.md` · **Status:** author opted out of questions; every concrete choice below is the builder's call, faithful to the outline.

## Intent

**Purpose (the author's words): "the architect should just show how a big game looks — small samples don't always give good insight into longer games."** So the deliverable's real subject is the **source**: how a multi-chapter game is organized — a header that maps the whole game, chapter-by-chapter sections, shared classes/helpers instead of copy-paste, state flags and scoring in one place, daemons, NPC conversation, multi-step puzzles, and comments that explain the *structure* to a reader skimming a long file. Gameplay must be complete and winnable, but source clarity at scale is what's being taught.

A **longer** bundled sample — the first one that shows what a real, multi-chapter game looks like — written twice, natively: **Inform 6 (Standard Library, `.z5`)** and **ZIL (`.z5`)**. A user picks it from Samples, compiles, and plays it to a win. The two versions are the **same game**: same rooms, objects, puzzles, score and walkthrough, each in its language's idiom (they are teaching material — readable, commented, sectioned by chapter).

Non-goals: no PunyInform version (yet); no multi-file ZIL (milestone 2b — a single `.zil` file now); no sound/graphics.

**Originality rule:** nothing from Zork or other existing games — no white house, mailbox, grues, Flatheads, zorkmids, or their places. The outline's ending is replaced with an original revelation (below).

## Premise & voice

You are a building surveyor sent by the county to assess **Quillon House**, the Victorian home of the late architect **Ambrose Quill**, before demolition. Quill's project was "irregular": the house is a puzzle box, and beneath it lies an unfinished construction site and a prototype vault built on principles from a lost civilization. Voice per the outline: descriptive but precise, dry humour in EXAMINE texts, architectural/scientific jargon, growing wonder with depth; temperature, echo and light change as you descend.

## Map (18 rooms, three chapters)

**Chapter 1 — Surface Secrets (the house)**
1. **Overgrown Garden** (start) — geometric flower beds. N → Entrance Hall.
2. **Entrance Hall** — brass devices on the walls (decorative-looking). S Garden, W Library, E Drawing Room, N Study.
3. **Library** — architectural texts, a ladder. E Hall.
4. **Drawing Room** — three brass devices: a **bell**, a **chime**, a **horn**. W Hall. After the brass puzzle a **panel** opens: D → Cellar Stairs.
5. **Study** — desk with a **dial lock** drawer, wastebasket. S Hall.
6. **Cellar Stairs** — U Drawing Room, D → Lift Landing (Chapter 2).

Each Chapter-1 room (and the garden bed) has a small brass **plaque** giving its width in yards: Garden bed 1, Entrance Hall 1, Library 2, Drawing Room 3, Study 5. A library book's margin note: *"Every room is the sum of the two before it. The vault of the house is the next."*

**Chapter 2 — The Unfinished Dream (the construction site)**
7. **Lift Landing** — a hybrid steam/crystal **lift** with a **symbol dial** and a **lever**. U Cellar Stairs. After the lift works: D → Survey Chamber.
8. **Survey Chamber** — construction marks (the architect's symbols) cut into stone. U Lift Landing, E Great Hall, S Spring Gallery.
9. **Great Hall** — half-finished, perfect acoustics. **The Foreman** (NPC) works here. W Survey Chamber.
10. **Spring Gallery** — a **wheel** for the old waterway and a modern **pump**. N Survey Chamber, E Flooded Passage.
11. **Flooded Passage** — impassable while flooded ("the water is chest-deep and very cold"). W Spring Gallery, E Mirror Gallery (only when drained).
12. **Mirror Gallery** — a pivoting **mirror**, a dark **crystal** socket on the far wall; a shaft of light from above. W Flooded Passage. After the mirror is aimed: D → Vault Antechamber.
13. **Foreman's Hut** (optional, lore) — off the Great Hall, N. The **Inspector** (NPC, optional) is here, filling forms.

**Chapter 3 — Legacy of the Deep (the prototype vault)**
14. **Vault Antechamber** — walls of formulas "that seem to defy physics". U Mirror Gallery, N Shifting Room.
15. **Shifting Room** — a self-rearranging room: its door **rotates** each turn through four positions; a counter on the wall shows 1, 1, 2, 3, 5, 8 … and the north door aligns only when the counter shows **13**. S Vault Antechamber (always), N Resonance Chamber (only when aligned).
16. **Resonance Chamber** — a **pedestal** and a ring of stone. S Shifting Room. After the resonance: N → Final Chamber.
17. **Final Chamber** — the **master blueprint** on a lectern. The win happens here.
18. **Messenger's Alcove** (optional, lore) — E of the Antechamber; **the Messenger** leaves a coded note.

## Objects & puzzles (8 scored puzzles, 5 points each; 10 more points for lore → max **50**)

| # | Puzzle | Solution | Points |
|---|---|---|---|
| P1 | **Fibonacci lock** (Study desk drawer) | Read plaques + the library note → `SET DIAL TO 8` → drawer opens: **journal** and **brass key** | 5 |
| P2 | **Torn blueprint** | Half in a Library book (`TAKE BOOK`/`READ BOOK` drops it), half in the Study wastebasket → `PUT LEFT HALF ON RIGHT HALF` (or `JOIN HALVES`) → **blueprint**, which shows the lift symbol (a **spiral**) | 5 |
| P3 | **Brass devices** (Drawing Room) | The journal: *"Low, then high, then the voice between."* → `RING BELL`, `STRIKE CHIME`, `BLOW HORN` in order (wrong order resets with a discord) → panel opens D | 5 |
| P4 | **The lift** | Unlock the lift cage with the **brass key**; `SET DIAL TO SPIRAL`; `PULL LEVER` → steam hisses, crystals glow, the lift descends (DOWN works) | 5 |
| P5 | **The Foreman** | `SHOW JOURNAL TO FOREMAN` (or ASK about the architect) → he admits he was Quill's apprentice and gives a **tuning fork** and the hint "the old water wants to go back where it came from" | 5 |
| P6 | **The springs** | `TURN WHEEL` (ancient waterway) then `TURN ON PUMP` (modern) — either order — → Flooded Passage drains | 5 |
| P7 | **The mirror** | `TURN MIRROR` cycles N/E/S/W; at **EAST** the light hits the crystal socket → a **crystal** forms/ignites in the socket; `TAKE CRYSTAL` → stairs open D | 5 |
| P8 | **Resonance** | Shifting Room: `WAIT` until the counter shows 13, go N. In the Resonance Chamber: `PUT CRYSTAL ON PEDESTAL`, `STRIKE FORK` → resonance, N opens | 5 |
| — | Lore (optional, +2 each): read the journal, ask the Inspector about irregular building, read the Messenger's note, examine the formula wall, read the master blueprint before winning | | 10 |

The **win**: `READ BLUEPRINT` (master) in the Final Chamber → the original revelation, then the game ends with the score.

## The ending (original — replaces the outline's Zork tie-ins)

The master blueprint is not for this site. This vault was a **proof of concept**. Quill's true plan: **Low Meridian**, an underground city to be cut beneath the Saltmarsh Downs, forty miles east, at coordinates written in the margin. The blueprint shows its great dome, its waterways, its lift shafts — and, in the deepest level, a sealed gallery labelled in Quill's hand: *"For the Lanternless. Do not open until the light is ready."* Nobody knows what the Lanternless are. The last line: *"The architect's madness was a schedule."* — `*** The work continues ***`.

## Shared walkthrough (both versions MUST win with exactly these commands)

```
north
west
examine plaque
read book
take half
east
north
examine plaque
search wastebasket
take half
put left half on right half
set dial to 8
take journal
take key
read journal
south
east
ring bell
strike chime
blow horn
down
down
unlock cage with key
set dial to spiral
pull lever
down
east
show journal to foreman
west
south
turn wheel
turn on pump
east
east
turn mirror
turn mirror
take crystal
down
north
wait
… (as many WAITs as the counter needs; the design fixes it so that entering the Shifting Room and waiting exactly 4 turns aligns the door)
north
put crystal on pedestal
strike fork
north
read blueprint
```
Builders: fix the exact number of WAITs (the design says 4) and make the rotating door deterministic; set the mirror's starting position so two TURNs reach EAST; the walkthrough above is normative — if a parser idiom forces a different phrasing in one language, change **both** and this list.

## Engineering

- Files: `app/modules/inform6/samples/architect-legacy.inf` (I6 Standard Library, target z5) and `app/modules/languages/zil/samples/architect-legacy.zil` (target z5), registered in each samples list (I6: group `std`, name "The Architect's Legacy · longer game", description "A three-chapter game: 18 rooms, 8 puzzles, NPCs — what a bigger project looks like").
- A **walkthrough test file** per language using the existing headless replay engine (`replayCore`/golden-test infrastructure): compile the sample, replay the walkthrough, assert the final turn contains `The work continues` and a score of 40 (all puzzles, no optional lore) — plus a test that wrong brass order does **not** open the panel. ZIL compile tests follow the existing `ZIL_SAMPLE_GOLDEN` gating.
- Store the walkthrough once as `app/modules/samples-shared/architect-legacy.walkthrough.txt` (one command per line) and use it in both tests; it also becomes a ready-made Test Script example.
- Readable source: a header comment explaining the structure, chapter banners, and comments where a technique is worth teaching (daemons for the Shifting Room, NPC conversation, multi-step puzzles, scoring).
