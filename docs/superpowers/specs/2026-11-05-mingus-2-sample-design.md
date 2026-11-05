# Mingus II: Everything Rolls Downhill — bundled sample design

**Date:** 2026-11-05 · **Source lore (the author's, binding):** `docs/crypto_empire_design.md` (read "Mingus Empire" there as **the Mingan Ascendancy**, per the author's rename) · **Template:** `2026-11-05-mingus-1-sample-design.md` and the shipped Mingus I sources · **Status:** design only. Where the lore offers builder's options, the choice is made below. Every other concrete choice is the builder's call, kept faithful to the lore.

**Naming (binding):** the mountain-side empire is **the Mingan Ascendancy** ("the Ascendancy" for short). Its people are **Mingans**. The mountains are still **the Mingus** or the Mingus range, and the river's west bank is still **the Mingus bank**. The old side stays unnamed.

## Intent

This is the third **longer** bundled sample, and the sequel to Mingus I. It uses the same recipe. The game is written twice, natively: **Inform 6 (Standard Library, `.z5`)** and **ZIL (zillib, `.z5`, single file)**. Both versions are the **same game**: the same rooms, objects, puzzles, score, timings and walkthrough. Each is written in its own language's idiom, as readable, commented teaching source, sectioned by part, with a header that maps the whole game.

The Architect showed *how a big game is organised*. Mingus I showed *how to make a timed, deadly rule fair*. Mingus II adds two subjects:

1. **How to code an NPC.** This is the author's request, and the sample's showcase. Lucan Fairweather follows you, leads you, talks, reacts to what you give and show him, runs on a small state machine, and dies in a scripted event on a timer. A second NPC, the trickster Sandwich, runs to a fixed schedule. A third, Mrs. Thrumble, answers a bell. Together they cover three NPC patterns: a companion, an antagonist on a schedule, and a stationary service NPC.
2. **How to make a vehicle without moving rooms.** The funeral ship is four fixed rooms. Where the ship is lives in one state variable, which decides what you see over the rail, where OUT leads, and what the current does.

The source should teach these techniques (list them in both headers as "TECHNIQUES WORTH STEALING"):
- **one end-of-turn dispatcher** that runs the river, then Lucan, then Sandwich, in a fixed order, so both languages print the same things in the same order;
- **a vehicle as state**: four ship rooms, plus a `ship_at` variable for the outside;
- **a countdown with a window**: the current. A landing comes alongside, and you get exactly one turn to act. A miss either loops you round (the eddy) or kills you (the broken end);
- **NPC: a state machine** (`HIDDEN -> FOLLOWING -> GUIDING -> ARRIVED -> DEAD`);
- **NPC: following** (the companion walks after you) and **leading** (he goes first, waits a turn for you, and catches up if you get ahead);
- **NPC: conversation**: a topic table for ASK/TELL, a fallback line, and a greeting (`SAY HELLO`, `HELLO`, `GREET LUCAN`);
- **NPC: reacting to GIVE and SHOW**, item by item;
- **NPC: a scripted, timed event**: the death, two turns after arrival, whatever the player does;
- **NPC: consequences**: his effects stay where he fell, another NPC mentions him, and his book reaches you through her;
- **a scheduled antagonist** whose interference is deterministic and learnable (the front-run rule);
- **a gate that explains itself**: you can't leave a landing without the thing you'll need next, and the refusal says why;
- **a container that only takes some things and never gives back**: the custody chest, which works like a trophy case;
- **a warn-once global rule**: the river;
- a win and a death that end the game with different words, and a custom rank that carries the closing teaser (the Mingus I technique, kept).

Non-goals:
- no PunyInform version;
- no sound or graphics;
- no status line widget (the current is printed in the prose);
- **ZIL stays single-file** (`mingus-2.zil`), as Mingus I did.

**Originality rules (binding):**
- Nothing from Zork or any other existing game: no grue, white house, mailbox, leaflet, zorkmid, Flathead, GUE, Frobozz, wizard, thief or troll; none of their places, items, spells, text or puzzles.
- The "trilogy spirit" is captured only in **feel**: a terse, wry narrator; treasures stowed for points with a rank ladder; a capricious recurring trickster; a set-piece vehicle; a fair but deadly world; an ending that hands off to the next game.
- **Sandwich's interference is deliberately not theft-and-lair.** He never steals what you carry and never has a stash to raid. He *front-runs*: he gets to the thing first, then trades. Killing him is never possible or needed.
- **The old side is never named, never entered and never explained.** On its bank you see mine heads, grates, chimney vents and a half-buried hall from outside, plus a long grassy hill behind a fence. Every attempt to go in is refused ("You don't. It isn't that you can't."). Mrs. Thrumble is still its only voice.
- **The reservoir is not reached and not drained.** It is a glimpse at most: the hill from the road, from the lore's "From the road it is nothing". Looking over the rim is deferred to Mingus III.
- The lantern legend's question is **not answered**. Lucan sings it both ways.
- **Verdlings never cross the river and never go underground.** In this game they stand on the Mingus bank only, and they never enter the Sluice.

**Satire and tone rules:** the crypto satire continues, aimed at archetypes: front-running, "salvage", custody, $ALT, roadmaps. No real person, company, chain or product is named. The river is older and stranger than the Ascendancy, so **the dread lives at the water and is written straight**. This applies to the Drowned Road, the Broken End, the Old Fence and Lucan's death: no jokes in those passages. There is no profanity and no gore, so the game is safe for a public demo (lore design note 9).

**Text:** ASCII only, as in Mingus I. Write `--` for a dash and `[CURRENT: 2/3]` for the counter. The I6 build uses `-Cu`.

## Premise & voice

**You are the verdlings' reluctant chief.** This is the lore's "For Mingus II: the game opens on the gangplank". Mingus I ended at the foot of a funeral ship's gangplank, with thousands of verdlings bowed to the pike in your hand. Mingus II starts there, the next morning. Each game stands alone, so the opening text retells the situation in three sentences. You carry **the pike** and **Lady Vaunt's coat** (the real one; it casts a shadow).

Opening text (draft; the asserted phrase must stay):

> The verdlings are still bowed. They have been bowed all night. In the grey light the lane they made for you still runs to the water, and at the end of it the funeral ship rocks at the mouth of the Sluice, its gangplank down, its blank plaque polished on the mast. Nobody who has floated down the Verdance has ever come back. **Nobody here is going to stop you trying.**

**The goal** is not stated by a ticket this time. It is in the memorial line from Mingus I: there are names on a wall at the bottom station, and nobody knows how far those people got. On the way down you find **five names**, evidence of how far five of the lost got, and stow them in the ship's custody chest. The river decides how far *you* get.

**Voice:** the lore's design note 8: an exhausted, dry, slightly pitying narrator. It is warmer than in Mingus I, because the river is older than the joke.

## The three NPCs

### Lucan Fairweather, the Thursday tenor (the guide; the NPC showcase)

**Who he is.** He comes from the lore: "a tenor who plays the ballroom on Thursdays". He is a river poet who has sung about the old side for twenty years and never seen it. He is large and kind, with a velvet waistcoat and a hat, and he is magnificently theatrical. He stowed away under the $ALT medallions in the funeral ship's hold the night before. A Mingan on the valley floor would be poked, so he hid until the ship was under way.

**His reason to help.** He wants to see if the songs are true. The lore says that in Mingus II "the player finally sees parts of what the songs describe -- and finds out which songs were right". He is that line, made into a person. On the old-side bank he leads you by his favourite verse, "Where the green bank goes down to the water, there's a door that was never a door" (it is in the lore), to the one thing you will need to survive the end of the game: **the lifebelt**. The verse was right about the lifebelt. It was wrong about one other thing.

**Voice:** grand and generous, half-sung, with a self-mocking sense of drama. "Lucan Fairweather. Tenor. Thursdays."

**State machine** (one global `lucan_state`; the names are normative so both builders match):

| State | Where he is | What he does at end of turn (dispatcher step 2) |
|---|---|---|
| `HIDDEN` | nowhere; he is not in play | On passage 1, drift 1, it prints "From the hold, someone sneezes." On passage 1, drift 2, he moves to the **player's location** and prints his entrance (below), and the state becomes `FOLLOWING`. |
| `FOLLOWING` | with you | If he is not in your room, and your room is a ship room or a room of the landing the ship is at, he moves there and prints **"Lucan follows you, humming."** Otherwise he does nothing. |
| `GUIDING` | ahead of you on the old-side bank | Leads along the route Stone Pier -> Mine Heads -> Hollow Green. The exact rules are below. |
| `ARRIVED` | Hollow Green | `lucan_timer` +1 each turn. At timer 1 the verse; at timer 2 the death. |
| `DEAD` | removed from play | nothing |

**His entrance** (passage 1, drift 2; normative phrase in bold): the medallions shift, and a large man in a velvet waistcoat climbs out of them, or up through the hatch if you are not in the hold, brushing off $ALT. **"Lucan Fairweather. Tenor. Thursdays."** He explains in one breath that he has sung about the old side for twenty years, and that this is his only chance.

**Leading (`GUIDING`) — exact rules.** `GUIDING` begins at the end of the turn the ship lands at the Stone Pier (P5). Lucan moves to the Stone Pier and prints "Lucan is over the rail and onto the pier before the ship has stopped moving." After that, at the end of each turn, the first matching rule applies:
- (a) **He waits for you, then goes on.** If you are in his room, and you were *also* there at the start of the turn (you did not arrive this turn), and he is not yet at the Hollow Green: he moves to the next route room and prints **"Lucan goes north, singing. \"This way!\""**. So when you arrive he waits one turn, and any action you take there, WAIT included, lets him go on ahead.
- (b) **He catches up.** If you are in a route room *further along* than his, he moves to yours and prints "Lucan hurries up behind you, out of breath. \"Wait for me!\"". You can't outrun the script.
- (c) **He calls you on.** If you are anywhere else on the old-side bank, or on the ship, he prints "Somewhere ahead, Lucan is singing, and calling for you to keep up."
- (d) **Arrival.** After (a) to (c): if you and he are both in the Hollow Green, the state becomes `ARRIVED` with `lucan_timer = 0`, and he prints **"\"There!\" Lucan points. \"A ring on a post, where the green bank goes down to the water. The song never said what for.\""**

"Arrived this turn" is detected the same way in both languages. The dispatcher saves `last_location` at the end of every run. On the next run, you arrived this turn exactly when `location != last_location`.

**`FOLLOW LUCAN`** (also `FOLLOW TENOR`, `FOLLOW HIM`):
- While he is `GUIDING` and in the route room next after yours, it moves you there, as the matching direction would. It takes a turn.
- If he is in your room: "He's right here, singing at you."
- Otherwise: "You can't see where he went."

**The death (scripted, timed, deterministic; not the player's fault).** It is signposted three ways before it happens:
- The Mine Heads description: "Here and there the grass is a brighter green, smooth as baize, each patch ringed with small white stones."
- `EXAMINE PATCHES` adds that warm air leaks around the stones.
- `ASK LUCAN ABOUT PATCHES`: "Like little stages! The song says the green is a floor."

Then, in the Hollow Green:
- **timer 1** (end of the turn after arrival): "Lucan sings the verse through once, softly, for the first time in the place it was written about. Then **he steps back to take it all in**, onto the bright green."
- **timer 2** (end of the next turn): "The bright turf gives under him without a sound, the way a stage trap opens. For a moment there is a hole in the grass, and warm air coming up out of it, and the last note of the verse. Then **Lucan is gone.**" It stays brief, quiet and bloodless.
  - If you are not in the Hollow Green at timer 2, print instead: "From somewhere behind you, the song stops in the middle of a line." The death still happens.

Nothing the player does changes timer 1 or timer 2. `WARN LUCAN`, `TELL LUCAN ABOUT PATCHES`, `PULL LUCAN` and `TAKE LUCAN` all get: "He waves you off mid-verse." So it can't be avoided by accident, and it can't be prevented on purpose either. That is the point of the scene: the songs were half right. It costs the player nothing. The lifebelt is already in reach, and the walkthrough takes it on timer 1's turn.

**Afterwards**
- **His effects remain.** In the Hollow Green: "a dark hole in the bright turf, ringed with white stones, breathing warm air", and **Lucan's hat** at its edge, as scenery. `EXAMINE HAT` gives "Velvet band. A Thursday hat." TAKE HAT is refused: "You leave it where he can find it." `ENTER HOLE`, `DOWN` and `STEP ON PATCH` are always refused after the death: **"You remember Lucan. You don't."** The player never dies on the patches; they learned from him. Before the death, `STEP ON PATCH` gives "Lucan is standing on the best one, singing."
- **His nest stays in the Hold**: a hollow in the medallions, and a sandwich wrapper. The Hold's description mentions it from then on: "where Lucan slept".
- **Another character references him.** Ring Mrs. Thrumble's bell after the death and she says: **"We had a gentleman come down the old drainage shaft just now. I'm afraid he was past a towel, dear."** She then hands over his songbook (below). `ASK THRUMBLE ABOUT LUCAN` repeats the line. Sandwich, at the Intake: "Where's your tenor?" Beat. "Oh." The ending text mentions him once.
- **What he carried passes on.** **Lucan's songbook** ("L. FAIRWEATHER -- THURSDAYS" inside the cover) is one of the five names (N3). The verse he led you by gave you the lifebelt (P6), the item you need to survive the wreck.

**Conversation** (ASK/TELL LUCAN ABOUT *topic*; one table that both verbs share). The first matching row wins:

| Topic words | Reply (opening words are normative where tests assert them) |
|---|---|
| OLD, SIDE, ACROSS, FAR, BANK | "Twenty years I've sung it. Lamplight and low ceilings in one song, a green field over a sleeping city in the next. **Tonight I find out which.**" |
| SONG, SONGS, VERSE, POETS | "\"Where the green bank goes down to the water, there's a door that was never a door.\" That one. It's always been that one." |
| SANDWICH, RUNNER, BOARDS, SCULL | "He's always first, that one, and he's never once arrived anywhere. **Reach for the gilt and he'll have it** -- he has never wanted anything plain in his life." *(This is the hint for P2.)* |
| VERDLINGS | "They bowed to you. To *you*. I'd have given my voice for that." |
| RIVER, VERDANCE, CURRENT, WATER | "No one comes back. That's the line everybody knows. Nobody knows the next line, because nobody came back to write it." |
| LANTERN | "Beckoning or warning. I sing it both ways, alternate Thursdays." |
| ASCENDANCY, MINGUS, MOUNTAIN, BALLROOM | "Thursdays in the ballroom, upside down, for $ALT. I don't miss it. I miss the acoustics." |
| LUCAN, TENOR, HIMSELF, YOU | "Lucan Fairweather. Tenor. Thursdays. Retired, as of last night." |
| PATCHES, PATCH, TURF, GREEN, STONES | "Like little stages! The song says the green is a floor." |
| SHIP, FUNERAL, PLAQUE | "It was built for the dead. I'm hiding in it. Draw your own conclusions; I have." |
| LIFEBELT, RING, BELT | "Everything that floats is a song waiting to happen." |
| *(anything else)* | **"Lucan considers this, then sings a line about something else entirely."** |

**Greeting:** `SAY HELLO`, `HELLO`, `HI`, `GREET LUCAN` and `SAY HELLO TO LUCAN`, when he is present, all give "Lucan sweeps a bow that nearly takes him over the rail. **\"Your servant, chief.\"**" With nobody present: "Nobody answers. The river doesn't."

**GIVE / SHOW reactions.** He never keeps anything; GIVE and SHOW give the same reply, and the item stays with you.

| Item | Reply |
|---|---|
| coat | "Esme's coat! I sang at her wedding. Both weddings. Same song." |
| pike | He steps back. "Not to me, chief. They'd never forgive either of us." |
| any of the five names | He reads one name aloud, quietly, and takes his hat off. "Somebody should sing them." |
| lifebelt | "Ha! The song was right about something." |
| medallion | "$ALT. I was paid in it, once. Once." |
| anything else | "Lucan admires it politely and gives it back." |

ATTACK, KISS and PUSH on Lucan get in-character refusals. Lucan can't be taken, and he never carries anything.

### Sandwich, the front-runner (the trickster)

**Who he is.** He is a thin, cheerful Mingan in a narrow gilded racing scull called *Slippage*. He wears sandwich boards: the front says **FIRST!** and the back says **THANKS FOR THE ALPHA**. He is usually eating a sandwich. "Everybody on the river calls him Sandwich, because he's always just in front of you and just behind you." He floated down the Verdance years ago and never went back: "Why would I? Everything rolls downhill. I just wait at the bottom." He salvages funeral ships, because a hard wallet plus the plaque of seed words bolted to its mast is money. He is the series' first trickster, and his arc ends ambiguously.

**The front-run rule** (exact; he says it aloud, so it is learnable): **"Whatever you reach for, chief, I'll have reached for it first. Nothing personal. It's latency."** He never takes what you already carry.

**His schedule** (deterministic; every appearance is listed):
1. **Foot of the Gangplank, before the launch.** His scull is offshore, as scenery. EXAMINE SANDWICH shows the boards and the sandwich.
2. **Main Deck.** The ship's hard wallets are already gone, and a **receipt** is pinned to the mast: "SALVAGE RECEIPT. Item: hard wallets, all. Fee: everything. Thank you for choosing BOTTOM LINE SALVAGE. -- S." He front-ran the dead.
3. **Passage 1, drift 1**: his scull shoots past downstream. "**FIRST!**"
4. **The Expedition Wreck (P2).** He is already there, salvaging. On your first entrance he speaks the front-run rule. The first time you TAKE any of the strongbox, the sweep, the grapnel or the nameboard, his boathook flicks past your hand and he has it first:
   - **The strongbox** (gilded, stencilled EXPEDITION TREASURY): "**FIRST!**" He tucks it under one arm, **rows away downstream**, and is gone from the Sandbar. **P2 scores.** You then take the rest freely.
   - **Anything else**: he holds it and smiles. "Yours for the coat." From then on:
     - `TAKE STRONGBOX`: "Better offer!" He drops what he held, takes the strongbox and rows away. **P2 scores.**
     - `GIVE COAT TO SANDWICH`: he hands the item over and rows away with the coat. **P2 never scores** (max 92); the narrator says "You paid the front-runner. Everyone does."
     - TAKE *item* FROM SANDWICH or ATTACK SANDWICH: "He's already out of reach, smiling. Latency."
   - If he leaves without the strongbox (the coat trade), the strongbox can be taken and opened. Inside is a note: FUNDS ARE SAFU.
5. **The Intake (Part Five).** His scull is pinned against the intake screen next to your ship. He has front-run the fifth name, a funeral plaque caught in the screen, and he is holding it. TAKE PLAQUE gives "Unpin me first, chief. Then we'll talk." When you stop the pump (P9), he tosses you the plaque: **"Fair's fair. You front-ran the front-runner."** Then he rows off downstream "to be first at the bottom". He also asks about Lucan (above).
6. **The Race, drift 2**: "Sandwich goes past you like a thrown knife, both oars up, shouting **\"FIRST ACROSS!\"**, and into the white water ahead." Then the scull breaks up on the rocks.
7. **The Old-Side Shore (ending)**: his front board lies face up in the reeds: FIRST! He is not seen.

**Topics:** ASK or TELL SANDWICH about anything gives "He taps his front board. FIRST!" GIVE *anything but the coat* gives "Floor price: zero. Pass." There is no greeting line beyond "He waves a sandwich at you."

### Mrs. Thrumble (the clerk; the stationary NPC)

She is the lore's Clerk of Lost Property. At the **Stone Pier** on the old-side bank there is an iron hatch with a barred window, a bell, and a card: LOST PROPERTY. RING ONCE. DOWNSTREAM COUNTER.

**The bell:**
- `RING BELL` brings her up a ladder to the window. She stays while you are on the pier. Leaving the pier sends her below: "The shutter closes."
- `RING BELL` while she is there: "She's already here, dear."
- **First ring after Lucan's death:** she gives you **Lucan's songbook** (N3), says the "past a towel" line, and adds "He'd want somebody to have it, I expect. Sign here."
- She does not acknowledge the Ascendancy, and she never looks up.

**Her topics** (ASK THRUMBLE ABOUT *topic*):

| Topic words | Reply |
|---|---|
| ASCENDANCY, MINGUS, EMPIRE | **"I'm sorry, I don't know what you're referring to."** |
| MOUNTAIN, ABOVE, SKY | "I wouldn't know, dear. I don't look up." |
| SHIP, FUNERAL | "Another one. They do keep coming." |
| LUCAN, TENOR | Before his death: "I don't know the gentleman." After: the "past a towel" line. |
| SANDWICH, BOARDS | "A gentleman in boards? He's never once rung. He shouts." |
| EXPLORERS, LOST, PEOPLE | The lore line: "People do turn up from time to time, soaked and blue with cold. We give them a towel and a cup of tea, and they generally decide to stay." |
| RIVER, VERDANCE | "It goes on, dear. They do." |
| *(anything else)* | "Is that all? I've a queue." |

`SHOW`/`GIVE` *anything*: "Is it lost? Then it isn't mine to take, dear."

## Map (20 rooms, five landings)

The Verdance runs **south**. The Mingus bank is **west**, and the old-side bank is **east**. The ship's four rooms are fixed. Where the ship is is the global `ship_at`, one of `SLUICE`, `SANDBAR`, `PIER`, `SPAN`, `INTAKE` or `ADRIFT`, plus `passage` (1 to 5) while adrift.

**The ship** (in every part)
1. **Main Deck**: the mast and its **blank plaque** ("Blank. Somebody has polished it, ready."), Sandwich's **receipt**, the empty bier, the **chock lever**, the hatch. The description ends with one sentence about the outside, chosen by `ship_at` (the builders' `OutsideView` / `OUTSIDE-VIEW` routine). N Prow, S Stern, D Hold. OUT leads to the landing room when moored. While adrift it gives "The Verdance. You know the line about the Verdance."
2. **The Prow**: the gilded figurehead with laser eyes (from the lore). The view downstream. At the Span, the **chain**. S Main Deck. U (or CLIMB CHAIN) leads to the Broken End when the ship is held at the Span.
3. **The Stern**: the **socket**, "worn smooth, as if something used to sit in it, long ago, before anyone decided the dead didn't need to steer." The **sweep** goes here. STEER happens here. N Main Deck.
4. **The Hold**: lit by daylight through the deck seams. A heap of **$ALT medallions** ("They're $ALT. Leave them for the dead." TAKE is refused). The **custody chest**, stencilled MOST SECURE CUSTODY SOLUTION -- NOTHING HAS EVER BEEN WITHDRAWN. U Main Deck.

**Part One — The Sluice (the Mingus bank)**

5. **Foot of the Gangplank** (start). The bowed verdlings, the lane, the ship at the Sluice mouth, Sandwich's scull offshore. U / IN / `BOARD SHIP` go to the Main Deck. W goes to the Sluice Mouth. Every other direction: "The crowd closes softly in front of you, and bows again." (This is the Mingus I line, kept.)
6. **The Sluice Mouth**: the covered chute's end, the slipway and the chock. The **launch drill** is painted on the arch. The verdlings keep well back. E Foot, W / IN Inside the Sluice.
7. **Inside the Sluice**: dim. Rollers run up into the mountain, and the chute is jammed far above: the dead are "piling up in cold storage at the summit", as the lore jokes. The **launch register** lies on a lectern (N1). Its last entry is "the *Floor Price*, for Councillor Amberline Sutt", the last ship before the jam. E / OUT Sluice Mouth.

**Part Two — The Sandbar (the river)**

8. **The Sandbar**: a long pale bar in mid-river, where the ship runs aground: "the way, by the look of it, they all do." Sandwich's scull is beached here until he leaves. IN to the Main Deck, E to the Expedition Wreck.
9. **The Expedition Wreck**: the *Step Three*, the boat of the lore's Verdance Expedition, whose roadmap ended at "Step 3: cross". It lies on its side. It holds the **sweep**, the **grapnel** (on a line), the **strongbox** and the **nameboard** (N2: five names scratched into the boat's thwart board). W to the Sandbar.

**Part Three — The old-side bank** *(the taboo is broken: you cross)*

10. **The Stone Pier**: old fitted stone, the Lost Property **hatch**, the **bell** and the card. The ship is made fast to an iron **ring**. IN to the Main Deck, N to the Mine Heads.
11. **The Mine Heads**: timber headframes over capped shafts; iron grates breathing warm air; low chimney vents with a steady glow that never flickers. The bright, stone-ringed **patches** (the signpost). S Pier, N Hollow Green, E Half-Buried Hall.
12. **Outside the Half-Buried Hall**: a roofline at the height of the grass, a row of windows at ground level with warm light in them, and a door half below the turf with steps going down. IN, DOWN, ENTER and OPEN DOOR all give **"You don't. It isn't that you can't."** W to the Mine Heads.
13. **The Hollow Green**: here the bank goes down to the water. There are more bright patches, and the **lifebelt** hangs on a post at the water's edge: "cork, painted white, older than anything on the Mingus side". After the death: the hole and the hat. S Mine Heads, N Old Fence.
14. **The Old Fence**: the reservoir glimpse, in the lore's words: "A long, low, grass-covered hill behind an old fence. A gate that hasn't opened in years. You could walk past it a hundred times." `CLIMB FENCE`, `OPEN GATE` and `CLIMB HILL` get: "Not today. Something about that hill makes your hands want to hold on to the fence." There is nothing to take, and nothing is explained. S Hollow Green.

**Part Four — The Gilded Span (the river)**

15. **The Broken End**: the end of Vaunt's gilded suspension span, with VAUNT on both towers behind you. This is the lore's shared nightmare, written straight: the planks tilt very slightly toward the water, and the last girder hangs out over the current "like a sentence nobody could finish".
    - The **diver's tag** (N4) hangs on the chain's top shackle: VERDANCE FOUNDATION DIVERS -- APPLICANT No. 1. It is the only applicant there ever was.
    - The **velvet box** sits on the last girder, out of reach. It is the ceremonial box for "Phase 2: Far Bank".
    - E, `GET ON GIRDER` and `WALK OUT` are subject to the river rule.
    - D (or CLIMB DOWN CHAIN) goes to the Prow. W goes to the Span Deck.
16. **The Span Deck**: the tollbooth, the roadmap plaque (PHASE 1: BRIDGE. PHASE 2: FAR BANK.), and a Verdance Foundation Divers poster ("vesting schedule TBD"). The span back toward the Mingus bank is closed by a chained gate: BRIDGE CLOSED FOR PHASE 2. E to the Broken End.

**Part Five — The Intake (the Mingus bank)**

17. **The Intake Screen**: a catwalk along the vast gilded grating of PUMPING STATION No. 2 -- INTAKE. It pumps the Verdance up the mountain, "the one thing in the Ascendancy that goes uphill". There is the **stop switch** (EMERGENCY STOP -- VAUNT CIVIC KEY ONLY), Sandwich's pinned scull, and Sandwich holding the **plaque** (N5: AMBERLINE SUTT -- COUNCILLOR, with twelve seed words, the *Floor Price*'s plaque from the register). Far off along the Mingus bank, the verdlings stand in silent rows, watching. They keep away from the intake, because it is "a hole". IN to the Main Deck, W to the Divers' Shed, N to the Drowned Road.
18. **The Divers' Shed**: the Verdance Foundation Divers' recruiting shed, never used. A sign-up sheet with no names; a diving helmet, as scenery ("It has never been wet."). E to the Intake Screen.
19. **The Drowned Road**: the dream image from the author's design note, written straight, with no jokes. A road comes down out of the Ascendancy and runs straight into the Verdance. Its centre line goes on under the water, a little blurred, for as far as you can see into the green. At the top, a car stands with its engine ticking and its headlights on, pointed down the road. The driver's door is open. There is nobody in it and nobody near it, and the road is very clearly meant to be driven.
    - `ENTER CAR` and `DRIVE` get "You don't. You know exactly where it goes."
    - DOWN, E and `WALK DOWN ROAD` are subject to the river rule.
    - S to the Intake Screen.

**Finale**

20. **The Old-Side Shore**: reached only by the wreck. Arriving here ends the game.

```
                          (river flows south; Mingus bank west, old-side bank east)

PART ONE  Inside the Sluice -w/e- Sluice Mouth -w/e- Foot of the Gangplank (start)
                                                        | u/in/board
                    THE SHIP (fixed rooms)            Main Deck --n/s-- Prow
                                                        |  \--s/n-- Stern
                                                        | d/u
                                                       Hold [custody chest]
          OUT from the Main Deck / IN back, by ship_at:
            SANDBAR: The Sandbar -e/w- Expedition Wreck
            PIER:    Stone Pier -n/s- Mine Heads -n/s- Hollow Green -n/s- Old Fence
                                         | e/w
                                      Outside the Half-Buried Hall
            SPAN:    (Prow) -u/climb chain/d- Broken End -w/e- Span Deck
            INTAKE:  Intake Screen -w/e- Divers' Shed ;  Intake Screen -n/s- Drowned Road
FINALE    (the Race) --wreck--> The Old-Side Shore
```

**Voyage order:** Sluice (Mingus bank) -> **passage 1** -> Sandbar (river) -> **passage 2** -> Stone Pier (old side) -> **passage 3** -> Gilded Span (river) -> **passage 4** -> Intake (Mingus bank) -> **passage 5, the Race** -> wreck on the old-side bank. That is the lore's alternation: Mingus bank -> river -> old-side bank -> back, ending stranded on the far side for Mingus III.

## The current (the timed, deadly mechanic — exact)

This runs as dispatcher step 1, at the end of every turn that passes time (see the parity rules).

1. **Moored or adrift.** At a landing the ship is moored (`ship_at` is the landing). Leaving a landing (its cast-off action, below) sets `ship_at = ADRIFT`, `passage = next`, `drift = 0`.
2. **Drift.** At the end of the cast-off turn, and of every later turn while adrift, `drift += 1`. The passage's line for that drift is printed, followed by **`[CURRENT: n/3]`**. The cast-off turn itself ends at `[CURRENT: 1/3]`.
3. **At `drift = 3` the landing arrives.** What happens depends on the passage:

| Passage | Landing | At drift 3 | Your action | If you don't act |
|---|---|---|---|---|
| 1 | Sandbar | **automatic**: "The ship runs up onto a long pale sandbar and stops." Moored. | — | — |
| 2 | Stone Pier (old side) | Alongside: "The old-side bank is alongside: a stone pier, an iron ring. **If you are going to steer for it, steer east now.**" | The next turn (the **window**): `STEER EAST` at the Stern, with the sweep shipped. | **The eddy.** At the end of the window turn: "The pier slides past. Behind the point the river turns back on itself, and **the eddy brings you round** for another try." Then `drift = 1`, printing `[CURRENT: 1/3]`, and the passage repeats, with no limit and no death. |
| 3 | Gilded Span | Alongside: "The broken end is overhead, and the chain hangs from it, dead ahead and coming fast. **Throw now or not at all.**" | The window: `THROW GRAPNEL AT CHAIN` at the Prow. | **Death.** "The current takes the ship under the broken end, where everything that ever fell off the Gilded Span is waiting just under the surface. The hull opens like a letter." Then *** You have died ***. |
| 4 | Intake | **automatic**: the intake pulls the ship sideways, "gently, then not gently", against the grating. Pinned. | — | — |
| 5 | the Race | **automatic: the wreck** (see the ending) | You must be **wearing** the lifebelt by then. | Not worn: death (see the ending). |

4. **Acting early.** Before the window, `STEER EAST` gives "Not yet -- the bank is still too far." The turn passes. `THROW GRAPNEL AT CHAIN` before the window gives "The chain is still well ahead." The turn passes and the grapnel stays in your hands. STEER on any other passage, or STEER WEST, gives "The river has its own ideas about that." STEER anywhere but the Stern gives "You'd need to be at the stern, with something to steer with."
5. **The warnings are in the prose.** Passage 3 mentions the chain at drift 1 and drift 2, and the Prow description names it. Passage 5 warns at drift 1: "White water ahead. Every song about this stretch ends the same way: hold on to something that floats -- and it had better be on you." At drift 2, if the lifebelt is not worn, it adds: "If you are going to put that lifebelt on, now would be the time."

**Cast-off actions** (each is the "cast-off turn"):
- **Sluice:** P1's `PULL LEVER`.
- **Sandbar:** P4's `PULL LINE`.
- **Stone Pier:** `UNTIE ROPE`, from the Main Deck or the Pier. Also `UNTIE SHIP`, `CAST OFF` and `UNTIE LINE`.
- **Span:** `UNHOOK GRAPNEL` at the Prow. Also `FREE GRAPNEL`, `RELEASE GRAPNEL` and `PULL GRAPNEL`. The grapnel comes back to your hands.
- **Intake:** automatic. At the end of any turn in which the pump is stopped and you are in a ship room, the ship comes off the screen. Inside the dispatcher's step 1, this check runs *before* the drift step, so that turn ends at `[CURRENT: 1/3]`.

**Gates that explain themselves** (so the game is always winnable):

| Cast-off | Refused unless | Refusal |
|---|---|---|
| Sandbar (THROW GRAPNEL) | the sweep is shipped | "You'd be off the bar and into the river with no way to steer. Even a funeral ship deserves better." |
| Stone Pier (UNTIE ROPE) | Lucan is no longer alive (checked first) | "Lucan, from the bank: \"Not yet! Twenty years I've sung this bank!\"" |
| Stone Pier (UNTIE ROPE) | then: you carry or wear the lifebelt | "Not without something that floats. Every song about this river ends in white water." |
| Span (UNHOOK GRAPNEL) | you carry the civic key | "Up there on the girder, the velvet box says VAUNT CIVIC KEY -- OPENS ANYTHING VAUNT BUILT. Everything downstream was built by Vaunt. You're not leaving it." |

The five names are optional. Leaving a landing without its name only costs points. When you cast off from a landing whose name has not been taken, print "The river does not go back." *(The Sandbar's name, the nameboard, is taken in the walkthrough.)*

## The river rule (warn-once, global — exact)

These are **river attempts**:
- `SWIM`, `DIVE`, `JUMP` and `JUMP OVERBOARD` in any ship room or riverside room. The riverside rooms are the Foot of the Gangplank, the Sandbar, the Wreck, the Stone Pier, the Hollow Green, the Broken End, the Intake Screen, the Drowned Road and the Sluice Mouth.
- `ENTER RIVER` / `ENTER WATER`.
- At the Broken End: E, `GET ON GIRDER` and `WALK OUT`.
- At the Drowned Road: DOWN, E and `WALK DOWN ROAD`.

**The first river attempt in the whole game** is refused, sets `river_warned`, and prints the place's own line followed by **"[The Verdance warns you once. It has never warned anyone twice.]"** For example, at the girder: "The planks tilt under your first step, very slightly, toward the water. You step back." **Any later river attempt, anywhere, kills.** The death text is: "The Verdance takes you, quick and quiet, the way it has taken everyone. Nobody comes back." Then *** You have died ***.

## Objects & puzzles (10 scored puzzles, 8 points each; 5 names, 4 points each; max **100**)

| # | Puzzle | Solution | Points |
|---|---|---|---|
| P1 | **The launch** (Main Deck) | The drill on the Sluice arch reads: "LAUNCH ORDER -- 1. THE PASSENGER ABOARD. 2. THE CHIEF BOWS; THE VERDLINGS LET GO. 3. THE CHOCK LEVER." On the Main Deck, `BOW` (or `BOW TO VERDLINGS`) gives "A thousand small hands **let go of the lines** at once." Then `PULL LEVER`: the chock knocks out and the ship slides down the slip onto the Verdance. That is the cast-off turn of passage 1. Pulling the lever before bowing: "The ship strains against a thousand small hands on its lines, and does not move." BOW ashore: "The verdlings bow back, lower. The drill wants the passenger aboard." | 8 |
| P2 | **The feint** (Expedition Wreck) | `TAKE STRONGBOX` makes Sandwich front-run the decoy, and he rows away with it. It also scores if he is holding another item when you reach for the strongbox. The coat trade never scores. | 8 |
| P3 | **Ship the sweep** (Stern) | `TAKE SWEEP` at the Wreck, then `PUT SWEEP IN SOCKET` at the Stern: "It drops in as if it had been waiting." | 8 |
| P4 | **Kedge off the bar** (Stern) | `THROW GRAPNEL` at the Stern while aground (the bar holds the bow; the deep water is astern): "It bites into the riverbed astern." Then `PULL LINE`: you haul, the ship comes off the bar, and you bring the grapnel in. That is the cast-off turn of passage 2. The sweep-shipped gate applies. `DROP GRAPNEL` and `THROW GRAPNEL INTO RIVER` at the Stern while aground do the same as THROW GRAPNEL; elsewhere they are a river-safe refusal: "You'd lose it." | 8 |
| P5 | **The crossing** (Stern, passage 2's window) | `STEER EAST`: "No one crosses the Verdance. You lean on the sweep, and the ship turns its high prow toward the old side, and crosses." You make fast to the ring, and the ship is moored at the Pier. The verdlings, far behind on the Mingus bank, have turned their backs. | 8 |
| P6 | **The lifebelt** (Hollow Green) | Follow Lucan's lead, then `TAKE LIFEBELT`. The points come on taking it. It is wearable: `WEAR LIFEBELT`. It can be taken before Lucan arrives, and the script is unaffected (leading rule b). | 8 |
| P7 | **The chain** (Prow, passage 3's window) | `THROW GRAPNEL AT CHAIN`: "The grapnel goes up, over, and **bites**. The line snaps taut, the ship swings, and hangs, shuddering, under the broken end." Also `HOOK CHAIN WITH GRAPNEL`. The ship is held (`ship_at = SPAN`). | 8 |
| P8 | **The civic key** (Broken End) | `PULL BOX WITH PIKE` (also `HOOK BOX WITH PIKE`, `GET BOX WITH PIKE`): "You reach the pike out over the girder, catch the box by its ribbon, and ease it home." It falls open: on the velvet lies a gilded key, **VAUNT CIVIC KEY**, which moves to you. TAKE BOX: "Out on the girder. The planks between you tilt." That is not a river attempt, just a refusal. | 8 |
| P9 | **Stop the pump** (Intake Screen) | `PUT KEY IN SWITCH` (also `UNLOCK SWITCH WITH KEY`, `TURN SWITCH WITH KEY`): "The pump runs down with a sound like the mountain exhaling. For the first time in its life, the Ascendancy stops drinking the river." The key stays in the switch. Sandwich's toss line, and the plaque moves to you. | 8 |
| P10 | **The Race** (passage 5) | Be **wearing** the lifebelt when the ship breaks. The points come on arrival at the Old-Side Shore. | 8 |
| N1 | **The launch register** (Inside the Sluice) | TAKE, then `PUT REGISTER IN CHEST` | 4 |
| N2 | **The Expedition's nameboard** (Wreck) | TAKE, then PUT IN CHEST | 4 |
| N3 | **Lucan's songbook** (from Mrs. Thrumble) | `RING BELL` after the death, then PUT IN CHEST | 4 |
| N4 | **The diver's tag** (Broken End) | `TAKE TAG`, then PUT IN CHEST | 4 |
| N5 | **Councillor Sutt's plaque** (from Sandwich, P9) | PUT IN CHEST | 4 |

**The custody chest** (the trophy case):
- It is fixed and open.
- **A name scores 4 the first time it goes in**: "The chest accepts it. NOTHING HAS EVER BEEN WITHDRAWN, says the lid."
- Anything that is not one of the five names is refused: "The chest is for names."
- `TAKE X FROM CHEST`: "NOTHING HAS EVER BEEN WITHDRAWN. The lid is very clear about this."
- No double scoring is possible.

**Starting items.**
- **The pike**: Mingus I's rules carry over. It can't be given, thrown or put in the chest, and DROP leaves it where it falls. It is used for P8.
- **The coat**: it casts a shadow, and Sandwich's only price is the coat. Nothing requires it.

**Hard-wallet and medallion jokes are scenery.** The lore's "gold nobody can spend" stays a theme, not a puzzle.

## The ending (exact)

**Passage 5, the Race.** The cast-off is automatic at the Intake.
- drift 1: the white-water warning.
- drift 2: Sandwich's "FIRST ACROSS!", plus the lifebelt nudge if it is not worn.
- drift 3: **the wreck**: "The river narrows to a throat of white water, and the old-side bank comes at you sideways, all rock. The high prow goes first. Then everything does."
  - **Wearing the lifebelt:** award P10. The player is moved to the Old-Side Shore, and the game ends with the win.
  - **Not wearing it:** the river-rule death text, then *** You have died ***.

**The Old-Side Shore** (printed on arrival, then the game ends). Draft text; the bold phrases are asserted:

> You come up in the shallows with the cork ring under your arms, and the river lets go of you, the way it has never let go of anyone. You are on the old-side bank. Behind you, what is left of the funeral ship is breaking up on the rocks, and the current is taking the pieces south, quick and quiet. The custody chest has washed up beside you, lid shut, still saying NOTHING HAS EVER BEEN WITHDRAWN. In the reeds a painted board lies face up: FIRST! Of the man who wore it there is no sign. Across the water, very small, the lights of the Ascendancy are flickering, the way they always do. Behind you the bank is green and warm, and a few low chimney vents give off a steady light that never flickers. Somewhere up there, a long way upstream, is home. **You have gone further down the Verdance than anyone. Nobody has ever come back.** Somebody has to be first.

Then:
- **`*** You have gone further than anyone ***`**
- the score line;
- the rank, which is **always "Furthest Downstream" on a win**, whatever the score;
- the teaser:

> You have reached the end of MINGUS II: EVERYTHING ROLLS DOWNHILL. Five names are in the chest; one of them used to sing on Thursdays. Somewhere downstream, a man in sandwich boards is telling nobody that he got there first.
>
> Coming next: **MINGUS III**. Nobody has ever come back. Somebody has to be first.

*(The lore says Mingus III's title is TBD, so the teaser names no subtitle. When the author picks one, it is a one-line change in both versions and in the tests. It never mentions a house or its colour.)*

**Rank ladder** (mid-game SCORE, and deaths):

| Score | Rank |
|---|---|
| 0-24 | Ballast |
| 25-49 | Liquidity Provider |
| 50-74 | Downstream Validator |
| 75-99 | Front-Runner |
| a win, any score | Furthest Downstream |

I6 prints ", earning you the rank of X." and ZIL prints "That earns you the rank of X." That is fine, because the tests assert only the rank text.

## Parity rules (binding for both builders; read these before writing a line)

Mingus I's review found three kinds of drift: INVENTORY timing, rank text and synonyms. These rules exist so they don't happen again.

1. **What passes a turn.** Every command passes exactly one turn, and so runs the dispatcher once, **except**:
   - the meta commands: SCORE, FULL SCORE, SAVE, RESTORE, RESTART, QUIT, UNDO, VERSION, VERIFY, SCRIPT/UNSCRIPT (TRANSCRIPT/NOSCRIPT), BRIEF/VERBOSE/SUPERBRIEF/NORMAL, NOTIFY and PRONOUNS;
   - the debugging verbs;
   - commands the parser rejects or asks about ("What do you want to throw?", unknown words, "You can't see any such thing").
   
   **LOOK, EXAMINE, INVENTORY, WAIT, ASK, TELL, SAY, HELLO and refused actions** ("You can't go that way", gate refusals, "Not yet") **all pass a turn**. AGAIN passes whatever the repeated command passes.
2. **WAIT is exactly one turn** in both. (In zillib, V-WAIT runs the clock itself once. Keep it that way.)
3. **ZIL's GAME-VERB? trap.** zillib skips M-END and the CLOCKER for "game verbs", and INVENTORY is one. The fix is global, not per-room as in Mingus I. Map INVENTORY (`INVENTORY`, `I`, `INV`) to a **game-specific action** (`V-TURN-INVENTORY`, which calls the library's inventory printer). It is not in GAME-VERB?'s list, so the main loop runs the clock. **Probe this first** (risky parse #1). If it won't work, fall back to Mingus I's pattern, applied in the dispatcher's context: every room's M-BEG (via one shared routine) prints the inventory and runs the dispatcher itself. Check every other zillib game verb against rule 1, and give the same treatment to any that should be a turn.
4. **One dispatcher, fixed order.**
   - I6: one daemon object, `world_clock`, started in `Initialise`, whose `daemon` calls `RiverTick()`, `LucanTick()` and `SandwichTick()` in that order and then sets `last_location = location`.
   - ZIL: one interrupt, `I-WORLD`, queued with `-1` in `GO`, calling `RIVER-TICK`, `LUCAN-TICK` and `SANDWICH-TICK` in that order, then `<SETG LAST-LOC ,HERE>`.
   - **No other daemons, timers, `each_turn` or M-END handlers may print**, so output order is identical. Room descriptions and action replies come first, then the dispatcher's lines.
5. **Turn 1.** The dispatcher runs from the end of the first command, not on the opening text. `last_location` starts as the Foot of the Gangplank.
6. **Score and rank text.** The points and ranks are as tabled. A win is always "Furthest Downstream" (Mingus I's sub-max rank bug must not come back). Score lines: I6 `scored N out of a possible 100`; ZIL `scored N points out of a possible 100`.
7. **One synonym table for both.** Every synonym named anywhere in this spec must parse in both languages and give the same outcome. That includes STEER FOR PIER, BOARD SHIP, the cast-off synonyms, the P4/P8/P9 alternatives, the greeting forms, FOLLOW HIM, the topic words and SAY HELLO TO LUCAN. A synonym added later goes into both versions and into the parity golden test, or into neither.
8. **Singular/plural.** `patch`/`patches`, `medallion`/`medallions` and `name`/`names` must not ask "Which do you mean". z5 keeps 9 letters: *medallion* and *medallions* collide, so use Mingus I's typed-word-length trick in ZIL and `parse_name` or plural handling in I6 as needed. *ascendancy* truncates to *ascendanc*, which is harmless.
9. **Same refusal, same consequence.** Where the libraries' stock messages differ, the wording may differ. **The state change and the turn count may not.**

## Shared walkthrough (both versions MUST win with exactly these commands)

The comments after `#` are for this spec only. The file `mingus-2.walkthrough.txt` holds just the commands, one per line, with no comments.

```
west                        # 1  Sluice Mouth
read drill                  # 2
west                        # 3  Inside the Sluice
take register               # 4
east                        # 5
east                        # 6  Foot of the Gangplank
up                          # 7  Main Deck
read receipt                # 8  Sandwich front-ran the dead
bow                         # 9  the verdlings let go
pull lever                  # 10 P1 launch; [CURRENT: 1/3]; someone sneezes
down                        # 11 Hold; drift 2: Lucan climbs out of the medallions
put register in chest       # 12 N1; drift 3: aground on the Sandbar
say hello                   # 13 greeting
ask lucan about sandwich    # 14 the feint hint
up                          # 15 Lucan follows you
out                         # 16 The Sandbar (Lucan follows)
east                        # 17 Expedition Wreck: the front-run rule
take strongbox              # 18 P2: FIRST! he rows away with the decoy
take sweep                  # 19
take grapnel                # 20
take nameboard              # 21
west                        # 22
in                          # 23 Main Deck
down                        # 24
put nameboard in chest      # 25 N2
up                          # 26
south                       # 27 Stern
put sweep in socket         # 28 P3
throw grapnel               # 29 bites astern
pull line                   # 30 P4; [CURRENT: 1/3]
ask lucan about old side    # 31 [CURRENT: 2/3]
ask lucan about songs       # 32 [CURRENT: 3/3]: steer east now
steer east                  # 33 P5 the crossing; Lucan goes ashore first
north                       # 34 Main Deck (Lucan calls you on)
out                         # 35 Stone Pier (Lucan waits a turn)
ring bell                   # 36 Mrs. Thrumble; Lucan goes north
ask thrumble about ascendancy  # 37 "I'm sorry, I don't know what you're referring to."
north                       # 38 Mine Heads (signpost: the bright patches)
examine patches             # 39 Lucan goes north
north                       # 40 Hollow Green: "There!" (ARRIVED)
take lifebelt               # 41 P6; timer 1: he steps back
wear lifebelt               # 42 timer 2: Lucan is gone
south                       # 43
south                       # 44 Stone Pier
ring bell                   # 45 "past a towel"; the songbook
in                          # 46 Main Deck
down                        # 47
put songbook in chest       # 48 N3
up                          # 49
untie rope                  # 50 cast off; [CURRENT: 1/3]
north                       # 51 Prow; [CURRENT: 2/3]
examine chain               # 52 [CURRENT: 3/3]: throw now
throw grapnel at chain      # 53 P7 held under the Span
climb chain                 # 54 The Broken End
take tag                    # 55
pull box with pike          # 56 P8 the civic key
west                        # 57 Span Deck (the roadmap)
east                        # 58
down                        # 59 Prow
south                       # 60
down                        # 61
put tag in chest            # 62 N4
up                          # 63
north                       # 64 Prow
unhook grapnel              # 65 cast off; [CURRENT: 1/3]
south                       # 66 [CURRENT: 2/3]
wait                        # 67 [CURRENT: 3/3]: pinned at the Intake
out                         # 68 Intake Screen: Sandwich holds the plaque
put key in switch           # 69 P9; "Fair's fair."; the plaque
north                       # 70 The Drowned Road
south                       # 71
in                          # 72 Main Deck; off the screen: [CURRENT: 1/3]
down                        # 73 [CURRENT: 2/3]: FIRST ACROSS!
put plaque in chest         # 74 N5; [CURRENT: 3/3]: the wreck -> the Old-Side Shore
```

That is **74 commands**, and the expected final score is **100 out of 100**. The last command is `put plaque in chest`: the fifth name goes in as the ship breaks. The command list is exactly `app/modules/samples-shared/mingus-2.walkthrough.txt`, and it is normative. If a parser idiom forces a different phrasing in one language, change **both** versions, this list and the tests.

**Turn audit (builders: verify these first).**
- Passage 1: drift 1 on #10, 2 on #11, 3 on #12.
- Passage 2: #30, #31, #32; the window is #33.
- Passage 3: #50, #51, #52; the window is #53.
- Passage 4: #65, #66, #67.
- Passage 5: #72, #73, #74.
- Lucan:
  - goes ashore at the end of #33;
  - calls on #34;
  - waits on #35 (you arrived);
  - leads on #36;
  - calls on #37;
  - waits on #38;
  - leads on #39;
  - `ARRIVED` on #40;
  - timer 1 on #41;
  - dies on #42.

## Golden tests (both languages; same cases)

**Files**
- `app/modules/inform6/mingus-2.golden.test.ts`
- `app/modules/zil/mingus-2.golden.test.ts`, gated by `ZIL_SAMPLE_GOLDEN`, like Mingus I.

Both read the shared walkthrough. They use Mingus I's helpers (`until`, `play`, `expectNoParserFailures`) and the same parser-failure list.

1. **Compiles** to z5 with zero errors and zero warnings (I6), or zero diagnostics (ZIL).
2. **The walkthrough** has 74 commands, and its last is `put plaque in chest`.
3. **It wins:** turns = 75, with no parser failures. The last output contains:
   - `You have gone further down the Verdance than anyone`
   - `*** You have gone further than anyone ***`
   - `Furthest Downstream`
   - `MINGUS III`
   - `Nobody has ever come back`
   - the score matches I6 `/scored 100 out of a possible 100/` or ZIL `/scored 100 points out of a possible 100/`.
4. **Pivotal lines on their turns:**

| Command | Output contains |
|---|---|
| `read receipt` | `BOTTOM LINE SALVAGE` |
| `bow` | `let go of the lines` |
| `pull lever` | `[CURRENT: 1/3]` and `someone sneezes` |
| `down` (#11) | `Lucan Fairweather. Tenor. Thursdays.` |
| `put register in chest` | `NOTHING HAS EVER BEEN WITHDRAWN` and `sandbar` |
| `east` (#17) | `It's latency` |
| `take strongbox` | `FIRST!` and `rows away` |
| `put sweep in socket` | `as if it had been waiting` |
| `pull line` | `[CURRENT: 1/3]` |
| `ask lucan about songs` | `steer east now` |
| `steer east` | `No one crosses the Verdance` |
| `take lifebelt` | `steps back to take it all in` |
| `wear lifebelt` | `Lucan is gone` |
| `ring bell` (2nd) | `past a towel` |
| `examine chain` | `Throw now or not at all` |
| `throw grapnel at chain` | `bites` |
| `pull box with pike` | `VAUNT CIVIC KEY` |
| `wait` | `PUMPING STATION No. 2` |
| `put key in switch` | `Fair's fair` |
| `north` (#70) | `meant to be driven` |
| `down` (#73) | `FIRST ACROSS` |

5. **The NPC (Lucan).** Use `turns.filter(t => t.command === 'X')[n]` where a command repeats.

| Command | Output contains / does not contain |
|---|---|
| `up` (#15) | contains `Lucan follows you, humming.` |
| `out` (#16) | contains `Lucan follows you, humming.` |
| `ask lucan about sandwich` | contains `Reach for the gilt` |
| `ask lucan about old side` | contains `Tonight I find out which` (ASK works for two topics, plus the fallback below) |
| `say hello` | contains `Your servant, chief` |
| `out` (#35) | does **not** contain `This way!` (he waits) |
| `ring bell` (1st) | contains `This way!` |
| `examine patches` | contains `This way!` |
| `north` (#40) | contains `A ring on a post` |
| `take lifebelt` | does **not** contain `Lucan is gone` |
| `wear lifebelt` | contains `Lucan is gone` (**the death is on turn 42**) |

   - **The fallback:** after #14, `ask lucan about weather` gives `sings a line about something else entirely`.
   - **TELL shares the table:** after #14, `tell lucan about verdlings` gives `They bowed to you`.
   - **GIVE and SHOW react:** after #14, `show coat to lucan` gives `Both weddings`, and `give pike to lucan` gives `Not to me, chief`.
   - **Following:** the walkthrough to #36, then `wait`, then `follow lucan` gives the Mine Heads description.
   - **Catch-up:** the walkthrough to #35, then `north`, `north` gives `Wait for me!` and `A ring on a post`, and two turns later `Lucan is gone`.
   - **Effects remain:** the walkthrough to #42, then `examine hat` gives `A Thursday hat`, and `step on patch` gives `You remember Lucan. You don't.`
   - **Not preventable:** the walkthrough to #41, then `warn lucan` gives `mid-verse` and `Lucan is gone` on that same turn.
   - **Another NPC references him:** after #68, the output contains `Where's your tenor?`
6. **The current.**
   - **The eddy:** the walkthrough to #32, then `wait` gives `the eddy brings you round` and `[CURRENT: 1/3]`, not `Stone Pier`. Then `wait`, `wait`, `steer east` lands (`No one crosses the Verdance`).
   - **Too early:** the walkthrough to #30, then `steer east` gives `Not yet`.
   - **The Span kills:** the walkthrough to #52, then `wait` gives `The hull opens like a letter` and `*** You have died ***`.
   - **The Race without the lifebelt:** the walkthrough without `wear lifebelt`. Turns = 74, because the game ends on the last command. The last output contains `If you are going to put that lifebelt on` (on #73) and `*** You have died ***`, and does not contain `Furthest Downstream`.
7. **The river warns once.** `swim` gives `warns you once`; `swim`, `swim` gives `Nobody comes back` and `*** You have died ***`. `swim` then `north`, `down` at the Drowned Road also kills, because the warning is global. Use a Drowned Road prefix: the walkthrough to #70, then `swim`, `down`.
8. **The gates.**

| Prefix | Command(s) | Output contains |
|---|---|---|
| to #8 | `pull lever` | `does not move` |
| to #27 | `throw grapnel` | `no way to steer` |
| to #33 | `untie rope` (from the Stern side: `north`, `untie rope`) | `Twenty years` |
| to #64 | (unhook, with the key) | the normal walkthrough |
| a variant without #56 | `down`, `south`, `down`, `put tag in chest`, `up`, `north`, `unhook grapnel` | `You're not leaving it` |

9. **Sandwich.**
   - **The coat trade:** at #18, use `take sweep`, then `give coat to sandwich` (`Everyone does`), then the rest with `take sweep` dropped. It wins at `scored 92`, still `Furthest Downstream`.
   - **The swap:** at #18, `take nameboard` (`Yours for the coat`), then `take strongbox` (`Better offer!`).
   - **The plaque before the pump:** after #68, `take plaque` gives `Unpin me first`.
10. **Timing parity.**
    - After #10, `inventory` ends at `[CURRENT: 2/3]` (INVENTORY is a turn).
    - After #10, `score` does **not** contain `[CURRENT:`, and the following `wait` gives `[CURRENT: 2/3]`.
    - After #10, `look` gives `[CURRENT: 2/3]`.
    - After #10, `score` gives `Ballast`.
    - Mid-game rank: after #33 (score 48), `score` gives `Liquidity Provider`.
11. **Phrasings beyond the walkthrough** (no parser failures; outcome as noted):
    - `board ship` at the start: Main Deck.
    - `hello`, `greet lucan`, `say hello to lucan`: `Your servant, chief`.
    - `steer for pier` in the window: lands.
    - `cast off` at the Pier: as UNTIE.
    - `hook chain with grapnel` in the window: P7.
    - `hook box with pike`: P8.
    - `unlock switch with key`: P9.
    - `follow him`: as FOLLOW LUCAN.
    - `x medallions` / `x medallion`: no "Which do you mean".
    - `ask thrumble about mountain`: `I don't look up`.
    - `climb fence`: `hold on to the fence`.
    - `enter car`: `You know exactly where it goes`.
    - At the Hall, `down`: `It isn't that you can't`.

**The sample-walkthrough goldens** also gain entries:
- `app/modules/inform6/sample-walkthroughs.golden.test.ts`: `'std-mingus-2': { text: 'You have gone further than anyone', ended: true }`.
- `app/modules/zil/sample-walkthroughs.golden.test.ts`: `'zil-mingus-2': { text: '*** You have gone further than anyone ***', ended: true }`.

## Riskiest parses (probe these first, in both languages, before writing rooms)

| # | Phrase | Risk | Probe / fallback |
|---|---|---|---|
| 1 | `inventory` as a turn (ZIL) | zillib's GAME-VERB? skips the clock | Remap to a game action that is not in GAME-VERB?, as in parity rule 3. Fallback: the Mingus I M-BEG pattern via one shared routine. |
| 2 | `steer east` | ZIL: a direction word after a verb. zillib files directions specially, as Mingus I found with `TYPE UP`. | First try `<SYNTAX STEER TOPIC = V-STEER>`, reading the word from the lexer buffer (`GETWORD? <+ ,P-V-WORDN 1>`), as V-TYPE does. If EAST is eaten as a direction, add `STEER EAST OBJECT (FIND KLUDGEBIT)`, as with `TYPE UP`. I6: `Verb 'steer' * noun=ADirection -> Steer * 'for'/'to'/'toward' noun -> Steer`. **Fallback (both):** change the walkthrough to `steer for pier` (a scenery `pier` in scope from the Stern during passage 2), and keep `steer east` as a synonym only if both parse it. |
| 3 | `throw grapnel` (no target) | I6's stock `throw held` is **Drop**; ZIL may want an object | I6: the grapnel's `before` intercepts Drop/ThrowAt while aground at the Stern. ZIL: add `<SYNTAX THROW OBJECT = V-THROW-PLAIN>`, or check zillib's existing line. **Fallback:** `throw grapnel astern`, with a scenery `astern`/`water` target. |
| 4 | `say hello` / `hello` / `greet lucan` | I6: `say` is `* topic 'to' creature -> Answer`, and bare `say hello` has no addressee. ZIL: SAY with no TO. | I6: add `Verb 'hello' 'hi' 'greet'`, and extend `say` with a topic-only line routed to the person present, as Mingus I's grammar-token routine did for SAY NOBODY. ZIL: `<SYNTAX SAY TOPIC = V-SAY-ALOUD>`, which checks for HELLO and finds the person present. Fallback walkthrough word: `greet lucan`. |
| 5 | `ask lucan about old side` / `ask thrumble about ascendancy` | Two-word topics; a 10-letter word | I6: a `life` Ask switch on `second`, with topic-dictionary handling via `consult_from`/`consult_words`, or a word scan. ZIL: Mingus I's `ABOUT?` scan over `P-TOPIC-START..END`, with `<VOC>` for every topic word. Probe ASCENDANCY's truncation. |
| 6 | `climb chain`, `untie rope`, `unhook grapnel`, `ring bell` | Verbs missing from one library or the other | Add grammar in both. Check zillib's CLIMB (`CLIMB OBJECT`, `CLIMB UP OBJECT`) and whether UNTIE exists. In I6 the std lib has no `untie`/`ring`/`unhook`; add them. |
| 7 | `pull box with pike` | New three-part syntax on a stock verb | I6: `Extend 'pull' * noun 'with' held -> PullWith`. ZIL: `<SYNTAX PULL OBJECT WITH OBJECT = V-PULL-WITH>`. This is Mingus I's PRESS PAWL WITH PIN, solved. |
| 8 | `put key in switch` | I6 Insert into a non-container | The switch's `before [; Receive: ...]` (or Insert on the key) runs before the container check. Probe. Fallback: `unlock switch with key` is native in both. |
| 9 | `out` / `in` on the ship | Direction routines that depend on `ship_at` | I6: `out_to`/`in_to` routines; ZIL: `(OUT PER SHIP-OUT)`. Make sure ZIL's `<DIRECTIONS ...>` includes IN and OUT. |
| 10 | `follow lucan` / `follow him` | No stock FOLLOW in I6 std; pronoun HIM | Add the verb; in ZIL make sure `HIM` resolves to Lucan after he speaks. |

## Engineering

**Files**
- `app/modules/inform6/samples/mingus-2.inf` (I6 Standard Library, z5)
- `app/modules/languages/zil/samples/mingus-2.zil` (zillib, z5, single file)
- `app/modules/samples-shared/mingus-2.walkthrough.txt` (the 74 commands, no comments)
- `app/modules/inform6/mingus-2.golden.test.ts`
- `app/modules/zil/mingus-2.golden.test.ts` (gated by `ZIL_SAMPLE_GOLDEN`)

**Registration**
- **I6** (`app/modules/inform6/samples.ts`, right after `std-mingus-1`):

  `{ id: 'std-mingus-2', group: 'std', name: 'Mingus II: Everything Rolls Downhill · longer game', description: 'A river voyage in five landings: 20 rooms, 10 puzzles, a guide and a trickster', target: 'z5', file: 'mingus-2.inf', format: false }`

  `format: false` loads the file byte-for-byte, because its hand layout is part of what it teaches.
- **ZIL** (`app/modules/languages/zil/samples.ts`): `import mingus2Src from './samples/mingus-2.zil?raw'`, then `{ id: 'zil-mingus-2', name: 'Mingus II: Everything Rolls Downhill · longer game', description: <same>, target: 'z5', source: mingus2Src }`. Add `mingus-2` to the "Hand-written samples" header comment.
- **Solutions** (`app/modules/samples-shared/walkthroughs.ts`): `import mingus2 from './mingus-2.walkthrough.txt?raw'` under "The longer games", plus `'std-mingus-2': mingus2` and `'zil-mingus-2': mingus2`. This is what powers the sample's solution in the Solution tab.

**Existing tests to update**
- `app/modules/samples-shared/walkthroughs.test.ts`: "Mingus II shares one walkthrough between its I6 and ZIL ids", with the last command `put plaque in chest`.
- `app/modules/inform6/samples.test.ts`: `LONGER_GAMES` gains `std-mingus-2`, as do the unformatted list, the explicit-target list and the no-puny-counterpart exception.
- `app/modules/languages/zil/samples.test.ts`: `LONGER_GAMES` gains `zil-mingus-2`. Add a `zil-mingus-2` shape test next to Mingus I's.
- The two `sample-walkthroughs.golden.test.ts` FINALE maps (above).
- The `.github/workflows/ci.yml` ZIL sample count comment.
- A CHANGELOG entry under Unreleased.

**Inform 6 notes**
- Use Mingus I's layout:
  - the header map, story, puzzle list and TECHNIQUES;
  - numbered banners: SETUP, LIBRARY, CLASSES, HELPERS, THE SHIP, PART ONE to PART FIVE, THE DISPATCHER, NPCS, FINALE, ENTRY POINTS, GRAMMAR;
  - every piece of state a Global in SETUP: `ship_at`, `passage`, `drift`, `lucan_state`, `lucan_timer`, `last_location`, `sandwich_state`, `river_warned`, `pump_stopped`.
- Scoring: `TASKS_PROVIDED`, `NUMBER_TASKS 15`, `MAX_SCORE 100`, and `task_scores` set to ten 8s then five 4s, with `PrintTaskName`.
- Classes: `Room`, `ShipRoom` (shared `OutsideView` and OUT logic), `Feature`, `Person`, and a `Name` class for the five names (the chest accepts only `ofclass Name`).
- NPCs: Lucan, Sandwich and Thrumble are `Person` objects with `life` routines (Ask, Tell, Answer, Give, Show, Kiss, Attack). The topic table is one routine shared by Ask and Tell. Their tick routines live in the NPCS section and are called by `world_clock`.
- Win: `deadflag = 3`, and `DeathMessage` prints "You have gone further than anyone". Deaths: `deadflag = 1`.
- `PrintRank` prints the ladder, the win rank and the teaser, as in Mingus I.

**ZIL notes**
- Use Mingus I's layout and the same banners. Scoring is `USE-SCORING?` with `<SCORING-ACHIEVEMENTS>` (15 entries).
- `PRINT-GAME-OVER` branches on `MINGUS-WON`: `    *** You have gone further than anyone ***` or `    *** You have died ***`. `PRINT-RANK` is replaced and carries the teaser. As in Mingus I, the teaser may come before the score line in ZIL; the tests assert presence, not order.
- NPCs are `PERSONBIT` objects with ACTION routines that handle ASK-ABOUT, TELL-ABOUT, GIVE, SHOW and the greeting. The topic scan is Mingus I's `ABOUT?`, and every topic word is declared with `<VOC ... NOUN>`.
- The one interrupt `I-WORLD`. No M-END printing anywhere (parity rule 4).
- Must compile with no diagnostics.

**Both:** commented for a newcomer at Mingus I's density. Every NPC routine opens with a comment naming the lesson it teaches ("LESSON: following -- ...").

## What from the lore was used, deferred or invented

**Used**
- The great river, its taboo and its no-return rule.
- The funeral ships: launched through the Sluice, a gilded figurehead with laser eyes, hard wallets, $ALT medallions, the seed-phrase plaque at the mast.
- The Sluice: verdlings won't go near it; the cold-storage jam joke.
- The verdlings never crossing and never going underground.
- The half-bridges: Vaunt's gilded span with his name on both towers, "Phase 2: Far Bank", the broken end, the shared nightmare of the tilt.
- The current: "quick and quiet"; it speeds up at broken ends.
- The Verdance Foundation Divers poster ("vesting schedule TBD"), and the fact that there were no applicants (here, exactly one).
- The Verdance Expedition and its roadmap's "Step 3: cross".
- Pumping Station No. 2.
- The river poets (the Thursday tenor and his verse).
- The lantern legend, sung both ways and unanswered.
- Mrs. Thrumble: her window, "I don't look up", the towel and tea line.
- The old-side bank's mines and half-buried buildings, seen from outside.
- The chimney vents' steady, unflickering glow.
- The reservoir's "From the road it is nothing", as a glimpse only.
- The memorial of names.
- Mingus I's start (the gangplank and the reluctant chief) and its pike rules.
- The alternating-banks structure.
- Ending wrecked on the old-side bank.

**Deferred to Mingus III**
- Looking over the reservoir's rim, and everything about the headgate and the draining (the trilogy's climax).
- Any answer to the lantern question.
- Entering anything on the old side.
- What became of Sandwich.
- Whether the lost really "decide to stay".
- The walk home through the forest, and the house in the clearing. It is not mentioned in II at all, not even in the teaser.
- The river creatures stay unseen. Only the debris "waiting just under the surface" and the unused diver gear imply them.

**Invented here** (all original)
- Lucan Fairweather, his stowaway, his verse-led guiding and his death.
- Sandwich the front-runner: the scull *Slippage*, the sandwich boards, BOTTOM LINE SALVAGE, the front-run rule.
- The five names, the custody chest and the launch drill.
- The Sandbar and the *Step Three*.
- The Drowned Road (the author's dream, made a place).
- The Lost Property window's downstream counter.
- The Hollow Green's bright patches.
- The lifebelt, "older than anything on the Mingus side".
- The Vaunt civic key and the intake's stop switch.
- Councillor Amberline Sutt and the *Floor Price*.
- The current's three-turn passages, the window, the eddy, and the warn-once river rule.
- The rank ladder and the "Furthest Downstream" win rank.

**Cut from the lore for this game:** gas fees as a mechanic; the seed-phrase meta-puzzle (seed words appear only on Sutt's plaque, as flavour); the faction coins; night launches; the pylon-less-bridge schemes (mentioned on the Span Deck's roadmap at most).
