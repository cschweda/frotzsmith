# Mingus I: Elevated Returns — bundled sample design

**Date:** 2026-11-05 · **Source lore (the author's, binding):** `docs/crypto_empire_design.md` · **Template:** `2026-11-04-architect-legacy-sample-design.md` · **Status:** where the lore doc offers "builder's options", the choice is made below. Every other concrete choice here is the builder's call, kept faithful to the lore.

## Intent

This is the second **longer** bundled sample, after The Architect's Legacy, and it uses the same recipe. The game is written twice, natively: **Inform 6 (Standard Library, `.z5`)** and **ZIL (`.z5`)**. Both versions are the **same game**, with the same rooms, objects, puzzles, score and walkthrough. Each is written in its own language's idiom: readable, commented teaching source, sectioned by act, with a header that maps the whole game.

The Architect showed *how a big game is organised*. Mingus adds a second subject: **how to make a timed, lethal mechanic fair**. The source should teach these techniques:
- a per-room turn counter that kills you deterministically (the three-poke rule);
- the state of a held item that other actions change (the pike is *raised* or *lowered*);
- an exit routine that moves the player somewhere else (the verdlings' escort uphill);
- one custom verb shared by two puzzles (`TYPE`);
- the singular/plural naming trick (`telescope`/`telescopes`, `notice`/`notices`);
- an ending that plays out over several turns (bow, wait, part, walk);
- a win and a death that end the game with different words (I6: `deadflag` 3 vs 1; ZIL: a branch in `PRINT-GAME-OVER`);
- a custom rank.

Non-goals:
- no PunyInform version;
- no sound or graphics;
- no status-line widget. Pokes are printed in the prose. A `DrawStatusLine` version is a possible later addition.
- **ZIL stays single-file** (`mingus-1.zil`), like the Architect's. Multi-file ZIL now exists (M2b). A later split into `mingus-1.zil` plus `act1.zil`, `act2.zil` and `finale.zil` would make a good multi-file demo, but it is out of scope here.

**Originality rules:**
- Nothing named from Zork or any other existing game: no grue, white house, mailbox, leaflet, zorkmid, Flathead, GUE, or any of their places or items.
- **The old side is never named**, never mapped and never visited. Mingans say "the old side" or "across there". Mrs. Thrumble is its only voice.
- The bowing borrows only the *shape* of a famous film ending (a people bowing to a stranger who didn't ask for it). It uses no lines, names or imagery from that film.
- The tagline "You are likely to be poked by a verdling — and then eaten, if you don't move." is the author's own. It echoes a genre line's shape and names nothing. Keep it.

**Satire rules:** the target is crypto culture and its archetypes, and the tone stays playful. No real person, company, chain or product is named. The doc's "ETH" becomes plain **gas**, and its "Discord" becomes "a chat server". Lord Vaunt stays a fictional archetype of the bombastic founder-heir: use only the author's lines for him, and add no real politician's catchphrases. Content note per the lore doc's design note 9: no profanity, so it is safe for a public demo.

**Text:** ASCII only in game text, as in the Architect's. Write `--` for a dash, `Form 77-Omega/b` for the form name, and `[POKES: *--]` for the poke counter (not ●○○). The I6 build uses `-Cu`, and characters outside ZSCII would warn.

## Premise & voice

**You are the actual dev.** You are the one competent engineer Lady Esmé Vaunt hired for $SHRUG, and you arrive on the summit the morning after the crash. Everyone else has gone. The gondolas are stalled, and the only way out is down. Your inventory holds one thing: **TICKET #1**, from Lady Vaunt.

> *TICKET #1. PRIORITY: WHATEVER. My coat. The real one. It rolled off my balcony during the divorce and it is at the bottom of the mountain now. Get it. There is something of mine in the pocket. Don't read it. -- E.V.  P.S. Nobody is going to pay you. Nobody is going to pay anybody.*

That gives the game a goal: reach the bottom with the coat. The ending is something no ticket asked for.

**Voice:** the parser voice is the lore doc's design note 8: exhausted, dry, slightly pitying. Every satirical beat can point downhill. The satire lives in Mingus and the dread lives at the water: the Runout and the river's edge are written straight, with no jokes in the bowing. The flavour text comes from the lore doc. Its sections THE RIVALRY, ACT I, ACT II, THE BELTED VERDLING and FINALE are the quarry for descriptions and NPC lines. Lines this spec quotes are **normative** where tests assert them.

## Map (20 rooms, three acts)

**Act I — The Abandoned Pavilion (the summit)**
1. **Wind-Scoured Mesa** (start). Description: the lore doc's Act I epigraph ("You are standing on a wind-scoured mesa west of a pavilion that has seen better days…"). Foreclosure notices blow past, the half-bridges are in view, and the far bank is green. Here stands the bronze **Lost Expedition plaque**, with a DONATE code where the names should be. N Gas Station, E Switchbacks.
2. **Whitepaper Switchbacks** — a zigzag cliff stair to the Pavilion, with a **kiosk** blocking the top landing, plus a **bonus kiosk** (flavour; it shuts itself off when read, per the lore doc). W Mesa. U Terrace (once P1 is solved).
3. **Pavilion Terrace** — 12-foot doorframes, a marble **doorbell** (RING it for Vaunt's recorded message, taken from the lore doc), the boarded main gate, flapping **notices** (scenery) and one **notice** caught on the doorbell (takeable). D Switchbacks, E Ballroom, N Study, S Wing.
4. **The Upside-Down Ballroom** — the lore doc's ballroom text. The floor is an inlaid map arranged to spell VAUNT, with five **tiles**; the far bank is labelled DAMP. There is a brass plaque ("BIGGER, by about a foot, if you measure diagonally"). W Terrace. U Observatory, by the poached spiral staircase ("it still goes down; it is now bolted to a cliff and goes up"). D Root Cellar (once P3 is solved).
5. **Vaunt's Private Study** — a glass-walled room of plans and the vision board. Here lies **the Mingus Survey, Annotated** (the true map). The oldest blueprint has THERE circled in gold, as flavour. S Terrace.
6. **Lady Vaunt's Wing** — reached by a cantilevered walkway. Its token gate is set to "Whatever", so it is open. Inside: the **coat closet**, where NFT coats are projected onto mannequins and none casts a shadow; the **Spite Terminal**, still logged in; and an airdrop tray holding a **$SHRUG coin**. N Terrace.
7. **The Observatory** — twelve **telescopes**, all aimed at the far bank, none of which has ever seen anything. A thirteenth, the **telescope** with a loose clamp, can be turned. D Ballroom.
8. **Gas Station** — on the gondola terrace. Pumps marked PREMIUM, REGULAR, MAINNET and OXYGEN. The MAINNET pump leaks "the good stuff", and BETTER is carved under its handle as flavour. There is an empty **oil can** on a hook, a stalled summit gondola, and the **busker** of Gondola Platform 4. S Mesa.

**Act II — The Blockchain Catacombs (inside the mountain)**

9. **Root Cellar** — the only part of the estate Vaunt secretly likes. It holds the service lift and its **KYC scanner** (Form 77-Omega/b). U Ballroom. D Mempool (once P4 is solved).
10. **The Mempool** — a cavern drifted with pending **transactions**, and a PENDING tray holding a blank **union charter**. The **consensus door** to the north has three slots marked CONTRACT, UNION and VALIDATOR KEY. The last is dusty: Krugg is gone. U Root Cellar, E Validator Pit, S Break Room, N Archive (needs 2 attestations).
11. **Validator Pit** — the **contract engine**, which throws the `rugPull()` infinite-loop error from the lore doc, with a punch-card **slot**. The banner reads DARKNESS IS A LEGACY TECHNOLOGY, with chalk underneath: "THEN WHY IS IT SO NICE." W Mempool.
12. **Break Room** (Murkling Miners' Local 404). Whiteboards read DAYS SINCE LAST RUG PULL: 0. Here are the **shop steward** murkling (Steward Nubbin), murklings in hard hats, an **ink pad** of murkling ink and a rack of **hard hats**. N Mempool, D Shared Shaft.
13. **The Shared Shaft** *(optional, lore)* — an iron grate, with RGB lighting on this side and old fitted stone, a ladder and a lamp on its hook on the far side. Warm air. **Mrs. Thrumble** is sorting fallen hard hats behind the bars. U Break Room.
14. **The Archive** — the ledger and the **Genesis Block**. S Mempool, N Cold Wallet Cavern (up an old ventilation bore).
15. **Cold Wallet Cavern** — an ice cave open to the wind on the north face. Twelve **pedestals**, twelve ice **blocks** with a word in each, and the Trust's block with a **keypad** and a hardware-wallet **box** frozen inside. S Archive, E Windward Ledge.
16. **Windward Ledge** — the lip of an unused gondola platform: open, windy, unswept. The **belted verdling** lives here, leaning on his **pike**. The emergency cable car has one working brake. W Cavern. D Bottom Station (the cable-car ride; its text condenses the doc's collapsing descent).

**Finale — The Runout (the valley floor)**

17. **Bottom Gondola Station** — the memorial of names, a recruiting poster ("VERDANCE FOUNDATION DIVERS -- vesting schedule TBD") and a faded **sign**: VERDLINGS RESPECT ONLY THE PIKE. U Ledge (by cable car), E Runout.
18. **The Runout** — the debris fan: an upturned **gondola car**, several thrones, a crate of $ALT **medallions** still shrink-wrapped, a grand piano, seed-phrase notebooks, and the **verdlings**. W Bottom Station. E River's Edge (only with the pike raised and the coat; see the finale).
19. **The River's Edge** — the Verdance at your back. The bowing and the parting happen here. E Foot of the Gangplank (only after the parting).
20. **Foot of the Gangplank** — arriving here ends the game.

```
ACT I  (summit)                                  The Observatory
                                                       | u/d
                 Vaunt's Study                         |
                       | n/s                           |
 Gas Station      Pavilion Terrace ------ e/w ---- Upside-Down Ballroom
     | n/s          | u/d       | s/n                  | d/u (after the floor)
 Wind-Scoured --e/w-- Whitepaper   Lady Vaunt's          Root Cellar ........ ACT II
 Mesa (start)         Switchbacks  Wing                    | d/u (lift, after KYC)
                                   Archive --- s/n --- The Mempool --e/w-- Validator Pit
                                      | n/s                | s/n
                              Cold Wallet Cavern       Break Room
                                      | e/w                | d/u
                               Windward Ledge        [*]Shared Shaft
                                      | d/u (cable car)
FINALE   Bottom Gondola Station --e/w-- The Runout --e--> The River's Edge --e--> Foot of the Gangplank
```

## Objects & puzzles (10 scored puzzles, 5 points each; 5 lore points, 2 points each; max **60**)

| # | Puzzle | Solution | Points |
|---|---|---|---|
| P1 | **Whitepaper kiosk** (Switchbacks) | `READ KIOSK` shows three buzzwords, one line lit at a time: "decentralized synergy", "trustless value-capture", "elevation-agnostic vertical". The kiosk says TRANSLATE TO PLAIN ENGLISH. ONE WORD WILL DO. `TYPE NOBODY`, `TYPE MONEY`, `TYPE MOUNTAIN`. Each word is checked against the current line. Synonyms: NOBODY/ANARCHY/NOONE; MONEY/THEFT/STEAL/STEALING; MOUNTAIN/HILL/ROCK. A wrong word leaves the line where it is ("NOT CLEAR ENOUGH"). Completion prints "NOBODY'S IN CHARGE, WE TAKE YOUR MONEY, ON A MOUNTAIN." and the doc's response (**"Somewhere, a VC weeps. The tears freeze."**). UP opens. | 5 |
| P2 | **The telescope** (Observatory) | `LOOK THROUGH TELESCOPE` first shows the far bank: grass, and chimney vents with a steady glow. `TURN TELESCOPE` swings it straight down. A second `LOOK THROUGH TELESCOPE` shows the foot of the range: a long coat **"by the upturned gondola car"**, and it casts a shadow. The points come on the look *after* the turn. The coat is not hard-gated on this knowledge. | 5 |
| P3 | **The ballroom floor** (Ballroom) | The Survey (Study) numbers the true landmarks: 1 Foyer of Unprecedented Arrival, 2 the Shared Shaft, 3 Pumping Station No. 2, 4 the Observatory, 5 the Gift Shop. `PRESS FOYER TILE`, `PRESS SHAFT TILE`, `PRESS STATION TILE`, `PRESS OBSERVATORY TILE`, `PRESS SHOP TILE`. A wrong tile resets the sequence ("rises with a disappointed click"). On success the floor descends, and the text includes **"to be left behind"**. Under the centre tile, HIGHER is etched (flavour). D opens. | 5 |
| P4 | **KYC** (Root Cellar) | It needs proof of address and a CAPTCHA, in either order. `PUT NOTICE IN SCANNER` (any foreclosure notice is an address). Then the CAPTCHA, "Select all squares containing murklings" (every square is pitch black): `SELECT NONE`. Both done gives a **Verified Wallet Badge** (soulbound, carried, can't be dropped) and **"Verification complete."** DOWN works from then on. The selfie-with-newspaper step is cut. | 5 |
| P5 | **The debugged contract** (Validator Pit) | `SEARCH TRANSACTIONS` (Mempool) finds a **punch card** reading `require(balance > 0, "ALREADY RUGGED")` and moves it to the player. `PUT CARD IN SLOT` makes the contract compile, and the card becomes the **debugged contract** (a printed receipt). Text: **"You have made the rug pull more efficient. This is called 'optimization.'"** | 5 |
| P6 | **The union** (Break Room) | `TAKE CHARTER` (Mempool tray); `SIGN CHARTER` (it needs the ink pad here: "solidarity"). `GIVE CHARTER TO STEWARD` while *carrying the $SHRUG coin*: he bites the coin, hands it back, and gives you the **union endorsement** (**"Local 404 endorses you"**). Without the coin he says: "Collateral. How do we know you're not one of his?" | 5 |
| — | *Consensus door* (Mempool → N) | This is a conditional exit, not a puzzle. Carrying the debugged contract **and** the endorsement, it says "TWO ATTESTATIONS. CONSENSUS REACHED." and lets you through. Otherwise it says "TWO ATTESTATIONS REQUIRED. YOU HAVE n." | — |
| P7 | **The cold wallet** (Cavern) | `EXAMINE BLOCKS` lists the 12 pedestals. Gold shimmer marks Vaunt's words, colours cycling mark Lady Vaunt's, and **plain** marks the Trust's: 1 HIGHER(g), 2 THEY(p), 3 WHATEVER(c), 4 BETTER(g), 5 NEVER(p), 6 DYOR(c), 7 THAN(g), 8 SPITE(c), 9 LOOK(p), 10 ELEVATED(g), 11 COAT(c), 12 UP(p). The keypad is labelled MINGUS CHARTER TRUST -- PLAIN WORDS ONLY. `TYPE THEY`, `TYPE NEVER`, `TYPE LOOK`, `TYPE UP`. A wrong word resets to zero ("INVALID MNEMONIC. 0 OF 4."). Success: **"MNEMONIC ACCEPTED"**. The block splits and the box opens: inside are a hardware wallet (balance 0) and a **SIM-eject pin** "which nobody has ever used for anything". `TAKE PIN`. | 5 |
| P8 | **The belted verdling** (Ledge) | `FILL CAN` at the Gas Station (only the MAINNET pump fills it; the can can be refilled). `EXAMINE BUCKLE`: the release pawl is rusted and too small for fingers. `OIL BUCKLE` needs a full can and empties it. `PRESS PAWL WITH PIN` releases the belt with a long exhale from the verdling. Pressing before oiling fails ("rusted solid"). Using the pike fails ("too big"), and so do fingers. Then he says **"Take it. I won't need it up here."** The pike moves to the player, and he says "They're not guarding the valley from you. They're guarding you from the river." `OIL` on anything else is refused, so the oil can't be wasted. If you meet him without oil, he tells you where the good stuff leaks. | 5 |
| P9 | **The coat** (Runout) | `DIG BY GONDOLA` uncovers the coat (into the room). `TAKE COAT` scores. EXAMINE COAT shows that it casts a shadow, a **pike-hole in the sleeve**, and in the pocket a slip in her hand: DOWN. Each of these is a Runout turn and costs a poke (see the rule). | 5 |
| P10 | **The pike line** (Runout → River's Edge) | `FEND VERDLINGS WITH PIKE` (or `RAISE PIKE`), then `EAST` with the coat. Points are awarded on arriving at the River's Edge. | 5 |
| L1 | Read the **Lost Expedition plaque** (Mesa) | `READ PLAQUE` | 2 |
| L2 | Hear the **busker** (Gas Station) | `LISTEN TO BUSKER`. One song in one turn. It carries both hints: "…and only a pike turns a pike aside…" and "the one who looked down and saw where it fell". Quote the doc's three river-poet verses in later LISTENs. | 2 |
| L3 | Read the **Spite Terminal** (Wing) | `READ TERMINAL` shows the pinned message ("stop comparing us to the old-siders. nobody on the old side is thinking about you, max.") and a dev-chat line saying the coat "is at the bottom somewhere. I'm not going down there. verdlings." | 2 |
| L4 | **Mrs. Thrumble** (Shared Shaft) | `TAKE HARD HAT` (Break Room), then `GIVE HARD HAT TO THRUMBLE`, passed through the bars. She logs it and hands you a **claim ticket** (THAN in copperplate on the back, as flavour). Her ASK topics come from the lore doc: MINGUS, VAUNT, SHAFT, LAMP, EXPLORERS, MOUNTAIN ("I wouldn't know, dear. I don't look up."). | 2 |
| L5 | Read the **Genesis Block** (Archive) | `READ GENESIS BLOCK`: the range was chartered to a public Trust, and the deepest shaft "appears to come out under the neighbors. Nobody tell him." | 2 |

The walkthrough takes every lore point, so it scores the maximum. Lore is optional for the *player*, not for the walkthrough.

**No dead ends.** Nothing the walkthrough needs can be lost:
- The service lift and cable car run both ways, and the walk back to the Gas Station is always open.
- Notices keep blowing: when one is taken, another catches on the doorbell.
- The coin is handed back.
- The can can be refilled.
- The pike can't be given away. `GIVE`, `THROW` and `PUT` it are refused, and `DROP` leaves it where it falls. On the Runout the verdlings will not touch it.
- The badge can't be dropped.

## The Runout: the three-poke rule (exact)

The Runout is **the only place the player can die**.

1. **Arrival turn** (the move into the Runout): set `pokes = 0` and `pike_raised = false`, and print the warning: a knee-high verdling "regards you with total contempt". No poke lands this turn. Print `[POKES: ---]`.
2. **At the end of every later turn spent on the Runout**: if `pike_raised`, no poke lands ("they stop short, stare at the pike, and give ground -- never far, never kindly"). Otherwise `pokes += 1`:
   - **1**: "…pokes you smartly in the shin with its pike. 'Up,' it says, pointing at the Mingus. 'Up up up.'" `[POKES: *--]`
   - **2**: "Several verdlings, several jabs, harder. 'UP.'" `[POKES: **-]`
   - **3**: **death**. "The verdlings stop poking. That is the last thing you notice: how quiet it gets when they stop. Verdlings, it turns out, **do not only poke**." Then: "Your remains will be poked back up the mountain in the morning, as a courtesy." The game ends with *** You have died ***.
3. **Which actions lower the pike.** `FEND VERDLINGS WITH PIKE` / `RAISE PIKE` sets `pike_raised`. It only works where verdlings are; elsewhere it says "There's nothing here to fend off." The raised pike stays up through LOOK, EXAMINE, WAIT, INVENTORY, LISTEN, FEND/RAISE and movement attempts. **Any other action lowers it first**, with the message "(You lower the pike to dig.)". So that turn's poke can land. I6 does this in the room's `before`; ZIL in `M-BEG`.
4. **Treasure is noticed.** `TAKE` on the medallions, a throne, the piano or the notebooks costs one **extra** poke straight away, and the item stays put ("a verdling pokes your hand"). The coat is not treasure ("It's a coat.").
5. **Leaving resets.** `WEST` back to the Bottom Station always works: `pokes = 0`, `pike_raised = false`.
6. **East without the pike raised: the escort.** You are moved to the Bottom Station and the counter is cleared. No poke lands and nobody dies.
   - Bare-handed, the text is **"They were never going to let you past with your bare hands. Down here, only a pike gets a verdling's respect."**
   - Carrying the pike lowered: "They see the pike, lowered at your side, and hesitate, then remember you are from the mountain." The text ends with the hint "A pike only matters raised."
7. **East with the pike raised but no coat:** "You came down for the coat. It is still in the pile, somewhere by the upturned gondola car." You stay, and the pike stays raised.
8. **East with the pike raised and the coat:** go to the River's Edge (P10).

Meta commands (SAVE, RESTORE, SCORE, UNDO; whatever each library treats as not passing time) cost nothing. LOOK, INVENTORY and EXAMINE are turns and do cost a poke. The walkthrough spends exactly **four turns** on the Runout: arrive (0), dig (1), take coat (2), fend (still 2). It leaves with 2 of 3 pokes and a margin of zero, which is deliberate. **Cut builder's options:** the after-dark one-poke budget, the throne trick ("look down on them"), hiding in the gondola car, the murkling night route, and sending items downhill.

## The ending (the lore doc's, made exact)

**Arrival at the River's Edge** (P10, `edge_turns = 0`): you turn around. Draft text (it may be polished, but the asserted phrase must stay):

> The verdlings have followed you: not the dozen you counted, but all of them, the whole valley floor from the Runout to the first of the half-bridges, thousands of small mud-coloured figures standing closer than they have ever stood to anyone from the mountain. The poking has stopped. Then the nearest one looks at the pike in your hand, and at you, and lowers its own; and the one beside it does the same; and then, all at once, like wind going through grass, thousands of them **lower their pikes and bow**. You did not ask for this. Nobody has explained it. The river is very loud behind you, and in front of you the valley is completely silent.

The pike was their chief's. That is never said in words.

**Each turn after arrival:**
- `BOW` prints "A ripple goes through the crowd, something very like approval. That is worse."
- `WAIT` lets the silence go on.
- LOOK and EXAMINE describe the scene.
- **Any movement before the parting** prints "The crowd closes softly in front of you, and bows again." You stay.
- **The parting** happens at the end of the turn where `edge_turns` reaches **2**, or at the end of any turn whose action is not BOW, WAIT, LOOK, EXAMINE or movement. The parting text includes "**A lane opens** through the bowed crowd": it runs to the water, where a ship like the funeral ships is moored at the mouth of the Sluice. It has the same high prow and hard wallets strung like lanterns that are not lit, and nobody is laid out on it. The gangplank is down.

**After the parting:**
- `EAST`, `DOWN`, `FOLLOW LANE`, `WALK LANE`, `BOARD SHIP` and `CLIMB GANGPLANK` all walk the lane to the **Foot of the Gangplank**. The player never boards.
- Every other direction gets the soft closing and the bow again.
- Nothing ever leads back west.

**The Foot of the Gangplank** prints "You walk the lane and stop at the foot of the gangplank, your hand on the rail, one step from going aboard." Then it prints the doc's closing text **exactly** (in ASCII):

> Thousands of small heads stay bowed. The lane they made for you runs straight to the water, and the ship at the end of it rocks on the Verdance -- the river nobody crosses and nobody comes back from. It was built to carry the dead. The gangplank is down. Nobody here is going to tell you to climb it, and nobody is going to let you go anywhere else.

Then:
- **`*** You have reached the bottom of the Mingus ***`**
- the score;
- the rank, **"Exit Liquidity"**;
- the teaser. The teaser trims the doc's FINAL PARSER MESSAGE and keeps its last line: "You have reached the end of MINGUS I: ELEVATED RETURNS. Somewhere, a whitepaper is being written. Somewhere, a chat server is pumping. Somewhere beneath the far bank of the Verdance it is still pitch black -- and that is the only honest thing left. / You are likely to be poked by a verdling -- and then eaten, if you don't move. / Coming next: **MINGUS II: EVERYTHING ROLLS DOWNHILL**. No one crosses the Verdance. Nobody said anything about following it."

The "out of a possible REDACTED" gag is cut, because the tests assert the real score line.

## Shared walkthrough (both versions MUST win with exactly these commands)

```
read ticket
read plaque
north
listen to busker
take can
fill can
south
east
read kiosk
type nobody
type money
type mountain
up
take notice
south
examine coats
read terminal
take coin
north
north
read survey
south
east
up
turn telescope
look through telescope
down
press foyer tile
press shaft tile
press station tile
press observatory tile
press shop tile
down
put notice in scanner
select none
down
search transactions
take charter
east
put card in slot
west
south
take hard hat
sign charter
give charter to steward
down
give hard hat to thrumble
up
north
north
read genesis block
north
examine blocks
type they
type never
type look
type up
take pin
east
oil buckle
press pawl with pin
down
east
dig by gondola
take coat
fend verdlings with pike
east
bow
wait
east
```

That is 70 commands, and the expected final score is **60 out of 60**: all ten puzzles and all five lore points. The list is exactly `app/modules/samples-shared/mingus-1.walkthrough.txt`. As with the Architect's, it is normative. If a parser idiom forces a different phrasing in one language, change **both** versions and this list.

**Phrasings to prove early.** Prototype these in both parsers before writing rooms:
- **`type up` / `type look` / `type nobody`**: a topic verb whose words are also a direction, a verb and a pronoun-like word. In ZIL, if the `TOPIC` token balks, have V-TYPE read the word straight from the lexer buffer.
- **`select none`**: in ZIL, use a particle syntax. If a bare particle won't parse, use the Architect's `JOIN HALVES OBJECT (FIND KLUDGEBIT)` pattern.
- **`look through telescope`**: I6 maps this to Search, ZIL needs a SYNTAX line.
- **`dig by gondola`**: needs an `Extend 'dig'` in I6 and a new SYNTAX in ZIL.

## Engineering

**Files**
- `app/modules/inform6/samples/mingus-1.inf` (I6 Standard Library, z5)
- `app/modules/languages/zil/samples/mingus-1.zil` (zillib, z5, single file)
- `app/modules/samples-shared/mingus-1.walkthrough.txt`
- `app/modules/inform6/mingus-1.golden.test.ts`
- `app/modules/zil/mingus-1.golden.test.ts` (gated by `ZIL_SAMPLE_GOLDEN`)

**Registration.** I6 (`app/modules/inform6/samples.ts`, right after the Architect's):

`{ id: 'std-mingus-1', group: 'std', name: 'Mingus I: Elevated Returns · longer game', description: 'A crypto satire in three acts: 20 rooms, 10 puzzles, a three-poke finale', target: 'z5', file: 'mingus-1.inf', format: false }`

ZIL (`app/modules/languages/zil/samples.ts`): `import mingus1Src from './samples/mingus-1.zil?raw'`, then `{ id: 'zil-mingus-1', name: 'Mingus I: Elevated Returns · longer game', description: <same>, target: 'z5', source: mingus1Src }`. Also add `mingus-1` to the file's "Hand-written samples" header comment, and say "the longer games target z5".

`format: false` makes the IDE load the I6 file byte-for-byte, because its hand layout is part of what it teaches.

**Existing tests to update**
- `app/modules/inform6/samples.test.ts`: the unformatted list, the explicit-target list, and the no-puny-counterpart exception all gain `std-mingus-1`.
- `app/modules/languages/zil/samples.test.ts`: the z5 condition becomes "the two longer games". Add a `zil-mingus-1` shape test next to the Architect's.

Add a CHANGELOG entry under Unreleased.

**Inform 6 notes**
- Use the Architect's layout: header map, numbered banners (SETUP, LIBRARY, CLASSES, HELPERS, ACT ONE, ACT TWO, FINALE, ENTRY POINTS, GRAMMAR), and every puzzle flag a Global in SETUP.
- Scoring: `TASKS_PROVIDED`, `NUMBER_TASKS 15`, `MAX_SCORE 60`, and `task_scores` set to ten 5s then five 2s, with `PrintTaskName` for FULL SCORE.
- Classes: `Room`, `Feature`, `Person` (as in the Architect's) plus `FloorTile`.
- The Runout:
  - The room's `each_turn` does the poking. It skips the arrival turn via a `runout_fresh` flag, which Bottom Station's E exit routine sets along with the resets.
  - The room's `before` lowers the pike.
  - Its `e_to` and `w_to` are routines that handle the escort, the coat check and the reset.
- Death: `deadflag = 1`, so the library prints *** You have died ***.
- Win: arriving at the Gangplank sets `deadflag = 3`, and `DeathMessage` prints "You have reached the bottom of the Mingus".
- `PrintRank`: when `deadflag == 3`, print ", earning you the rank of Exit Liquidity." and then the teaser (the std lib calls `PrintRank` right after the score line). Otherwise print a small rank ladder for mid-game SCORE: Bagholder, Community Manager, Early Adopter, Exit Liquidity.
- New verbs: `type` (topic), `select`, `sign`, `oil`/`grease`/`lubricate`, `fend`/`raise`, `bow`, plus `Extend 'dig'` with `by`/`near`/`beside`.
- Must compile with no warnings.

**ZIL notes**
- Use the Architect's ZIL layout. Scoring is `USE-SCORING?` plus `<SCORING-ACHIEVEMENTS>` with 15 entries.
- The Runout:
  - `M-ENTER` resets the counter.
  - `M-BEG` lowers the pike.
  - The poking runs from either `M-END` or an interrupt queued on entry. Use whichever reproduces the arrival-turn rule exactly; the Architect's Shifting Room solved the same "does the arrival turn tick?" question, so match its approach.
- The ending uses the Architect's `DELAY-DEFINITION`/`REPLACE-DEFINITION PRINT-GAME-OVER`, but **branched on a global** (`MINGUS-WON`):
  - Won: `    *** You have reached the bottom of the Mingus ***`, then the rank and the teaser.
  - Otherwise: `    *** You have died ***`.

  zillib prints the score *after* `PRINT-GAME-OVER`, so in ZIL the teaser comes before the score line. That is accepted: the tests assert presence, not order.
- Topic words go in `<VOC>` declarations: the kiosk and keypad words, and the ASK topics.
- Noun-noun names must work (`foyer tile`, `hard hat`, `genesis block`, `union charter`).
- Must compile with no diagnostics.

**Golden tests** (both languages; same shape as the Architect's)
1. The game compiles to z5, with no warnings or diagnostics.
2. The shared walkthrough wins:
   - the turn count equals walkthrough length + 1;
   - there are no parser failures;
   - the last command is `east`;
   - the last output contains `You have reached the bottom of the Mingus`, `Nobody here is going to tell you to climb it`, `EVERYTHING ROLLS DOWNHILL` and `Exit Liquidity`;
   - the score matches I6 `/scored 60 out of a possible 60/` or ZIL `/scored 60 points out of a possible 60/`.
3. Pivotal lines appear on their turns: `The tears freeze` (type mountain), `by the upturned gondola car` (the second telescope look), `to be left behind` (press shop tile), `Verification complete` (select none), `more efficient` (put card in slot), `MNEMONIC ACCEPTED` (type up), `I won't need it up here` (press pawl), `[POKES: *--]` and `[POKES: **-]` (dig, take coat), `lower their pikes and bow` (east to the River's Edge), and `A lane opens` (wait).
4. **The three pokes kill.** Run the walkthrough up to and including the first `east` after `down` from the Ledge, then `wait`, `wait`, `wait`. The third wait's output contains `do not only poke` and `You have died`.
5. **Leaving resets.** The same prefix, then `wait`, `wait`, `west`, `east`, `wait`, `wait`. There is no death, and the last output contains `[POKES: **-]`.
6. **The escort.**
   - Bare-handed: drop `press pawl with pin` from the prefix, then `east` gives `only a pike gets a verdling's respect`, with the player back at Bottom Gondola Station.
   - With the pike lowered: the full prefix, then `east` gives the "raised" hint.
7. **Coat first:** the prefix, then `fend verdlings with pike` and `east` gives `You came down for the coat`.
8. **The puzzles refuse wrong input:**
   - a wrong tile order leaves `down` from the Ballroom shut;
   - a wrong kiosk word doesn't advance the line;
   - a gold word at the keypad gives `INVALID MNEMONIC`;
   - the consensus door with one attestation gives `YOU HAVE 1`.
9. **Phrasings beyond the walkthrough** parse in both: `raise pike`, `grease buckle`, `push foyer tile`, `follow lane`, and `x telescopes` vs `x telescope` (no "Which do you mean").

## What was cut or condensed from the lore doc

- **Act III is cut entirely.** That means:
  - the three courts, the Litigation Demon, the Skimmer and the Mainframe;
  - the 51% attack and EMINENT DOUGHMAIN, REINSERT BUG and the BETTER THAN THEM cap;
  - Vaunt's escape scene, $NOTHING, and all four ending variants. The game has **one** ending, the lore doc's finale.
- **Acts II–III are condensed into one act**, the Catacombs. The Archive's "two of three tokens" keeps the contract and the union. Krugg and his Validator Key survive only as the dusty third slot on the door. Krugg's toll, the Mint, the Liquidity Pool and the rug-pull timer are cut. The Cold Wallet hypothermia timer is cut too: the cavern is cold, but cold is flavour.
- **The economy is cut.**
  - Gas, ETH and shillets as currencies, volatile prices and per-action fees are gone; gas fees survive only as jokes.
  - There is no faction choice. The $SHRUG coin is a single key item, and the $ALT/management path is cut.
  - NFT minting is cut. The NFT coats survive as the closet's shadowless projections.
- **The 12-word seed meta-puzzle is cut**, along with the Merkle Root and the tin lamp reward. The phrase's words appear as flavour: HIGHER under the tile, BETTER on the pump, THERE on the blueprint, THAN on the claim ticket, DOWN in the coat pocket. The Trust's four plain words, THEY NEVER LOOK UP, are the Cold Wallet puzzle. The KYC selfie and newspaper step is cut. So are the chandelier's liquidity, whale mode and dark tiles.
- **Places, people and mechanics.**
  - The Verdance Grate pier is cut, so Mrs. Thrumble appears once, at the Shared Shaft.
  - Most minor NPCs are cut: the attendant, the docent, the clerk, the tour guide, the dulcimer girl and the tenor. They survive as signage, recordings and the one busker.
  - Every death except the third poke is cut.
  - The achievements are cut.
  - So are the Runout's builder options: night, throne, hiding, the murkling route and sending items downhill.
  - The reservoir, headgate, lantern legend and river creatures stay as rumour or flavour at most. They belong to Mingus II/III.
