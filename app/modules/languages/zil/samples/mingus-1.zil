;"============================================================================
  MINGUS I: ELEVATED RETURNS  --  Frotzsmith sample (ZIL, zillib, target z5)
 ----------------------------------------------------------------------------
  The second longer sample. The Architect's Legacy showed how a big game is
  ORGANISED; this one keeps the same layout and adds a second lesson: how to
  make a timed, lethal mechanic FAIR. The finale is a three-turn budget that
  kills you if you overspend it -- and every rule of it is written down in
  one place (section 7), printed on screen as it happens, and impossible to
  trip over by accident.

  The same game exists in Inform 6 (the Inform 6 sample of the same name).
  Both versions share one walkthrough, so comparing them side by side is a
  good way to learn either language.

  THE STORY
    The Mingan Ascendancy, a gilded palace built on top of a mountain,
    crashed last night. Everyone has gone. You are the actual dev -- the one
    competent engineer Lady Esme Vaunt hired, for $SHRUG -- and your only
    ticket asks you to fetch her coat from the bottom of the mountain. The
    gondolas are stalled. The only way out is down.

  HOW THIS FILE IS ORGANISED  (search for the banner text to jump)
    1. SETUP ............ banner, scoring switch, ALL game state, tables
    2. GO ............... the entry point: intro text, first room
    3. LIBRARY .......... INSERT-FILE parser, the score table, the two
                          endings (PRINT-GAME-OVER, PRINT-RANK), topic words
    4. SHARED ROUTINES .. what Inform would call classes (features, people),
                          plus act banners, the shared TYPE verb's two
                          machines, the poke counter and the ending
    5. ACT ONE .......... The Abandoned Pavilion   (the summit, rooms 1-8)
    6. ACT TWO .......... The Blockchain Catacombs (inside the mountain, 9-16)
    7. FINALE ........... The Runout               (the valley floor, 17-20)
    8. GRAMMAR .......... the game's own SYNTAX lines and V- routines

  THE MAP  (20 rooms; [*] = optional, lore only)

    ACT ONE                                       The Observatory
                                                        | up/down
                     Vaunt's Study                      |
                          | n/s                         |
     Gas Station     Pavilion Terrace ---- e/w ---- Upside-Down Ballroom
         | n/s         | u/d       | s/n                | down (after P3)
     Wind-Scoured --e/w-- Whitepaper  Lady Vaunt's    Root Cellar ....... ACT TWO
     Mesa (start)         Switchbacks Wing                | down (after P4)
                                   Archive --- s/n --- The Mempool --e/w-- Validator Pit
                                      | n/s               | s/n
                              Cold Wallet Cavern      Break Room
                                      | e/w               | down
                               Windward Ledge        [*]Shared Shaft
                                      | down (cable car)
    FINALE  Bottom Gondola Station --e/w-- The Runout --e--> The River's Edge
                                                        --e--> Foot of the Gangplank

  THE PUZZLES  (10 puzzles x 5 points + 5 lore x 2 points = 60)
    P1  Whitepaper kiosk   translate three buzzwords   -> TYPE NOBODY, TYPE
                                                          MONEY, TYPE MOUNTAIN
    P2  The telescope      look down, not across       -> TURN TELESCOPE, LOOK
                                                          THROUGH TELESCOPE
    P3  Ballroom floor     the Survey's true order     -> PRESS FOYER / SHAFT /
                                                          STATION / OBSERVATORY /
                                                          SHOP TILE
    P4  KYC                address + CAPTCHA           -> PUT NOTICE IN SCANNER,
                                                          SELECT NONE
    P5  The contract       a punch card fixes the loop -> SEARCH TRANSACTIONS,
                                                          PUT CARD IN SLOT
    P6  The union          signed charter + collateral -> SIGN CHARTER, GIVE
                                                          CHARTER TO STEWARD
        (the consensus door wants P5's contract AND P6's endorsement)
    P7  The cold wallet    the Trust's plain words     -> TYPE THEY, NEVER,
                                                          LOOK, UP
    P8  The belted verdling oil, then a very small pin -> OIL BUCKLE, PRESS PAWL
                                                          WITH PIN  (the pike)
    P9  The coat           where the telescope showed  -> DIG BY GONDOLA, TAKE
                                                          COAT
    P10 The pike line      raise it, then walk         -> FEND VERDLINGS WITH
                                                          PIKE, EAST
    Lore: the Lost Expedition plaque, the busker, the Spite Terminal, Mrs.
    Thrumble, the Genesis Block.  Win: reach the Foot of the Gangplank.

  TECHNIQUES WORTH STEALING
    - A per-room turn counter that kills deterministically: the Runout's M-END
      handler (zillib calls a room's ACTION with M-END at the end of every
      turn you spend there) plus a RUNOUT-FRESH flag, set by M-ENTER, so the
      arrival turn never counts.
    - A held item with a state other actions change: the pike is raised or
      lowered, and the Runout's M-BEG lowers it for anything but looking,
      waiting, walking, examining, listening, fending and inventory.
    - Exit routines (PER) that move you somewhere ELSE: walking east without
      the pike up gets you escorted back to the gondola station.
    - One custom verb (TYPE) shared by two puzzles: V-TYPE reads the typed
      word straight from the parser's word buffer and hands it to whichever
      machine is in the room -- even when the word is UP or LOOK.
    - Singular/plural names: notice/notices just works, but telescope/
      telescopes does not -- z5 dictionary words keep only 9 letters -- so a
      GENERIC routine checks the length of the word actually typed.
    - An ending that plays out over several turns (bow, wait, part, walk), and
      a win and a death that end with different words: PRINT-GAME-OVER
      branches on the global MINGUS-WON.
    - A custom rank (PRINT-RANK), which also carries the closing teaser.

  Compiles cleanly with the bundled ZILF; targets z5.
 ============================================================================"


;"============================================================================
  1. SETUP  --  banner, scoring switch, and all game state
 ============================================================================"

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"Mingus I: Elevated Returns|
A Frotzsmith sample: a fall from great heights, in three acts.">

;"--- Scoring ----------------------------------------------------------------
  USE-SCORING? switches on zillib's scoring module (SCORE, FULL SCORE, the
  '[Your score has gone up]' notices, and the score at game end). It must be
  set BEFORE the parser is inserted. The fifteen achievements themselves are
  listed in section 3, right after the library."

<SETG USE-SCORING? T>
<CONSTANT MAX-SCORE 60>

;"--- Game state -------------------------------------------------------------
  Everything the game remembers about your progress lives here, named for
  the puzzle it belongs to. Ask 'what has the player done?' and the answer is
  on this screen. Objects still use flags (OPENBIT, TOUCHBIT) where the
  library already understands them. <> is ZIL's 'false'."

<GLOBAL CURRENT-ACT 0>          ;"which act banner has been shown"
<GLOBAL KIOSK-LINE 0>           ;"P1: buzzwords translated so far (0-3)"
<GLOBAL BONUS-READ <>>          ;"flavour: the bonus kiosk has shut itself off"
<GLOBAL TELESCOPE-DOWN <>>      ;"P2: the thirteenth telescope points down"
<GLOBAL TILE-PROGRESS 0>        ;"P3: tiles pressed in the right order (0-5)"
<GLOBAL FLOOR-OPEN <>>          ;"P3: the ballroom floor has gone down"
<GLOBAL KYC-ADDRESS <>>         ;"P4: proof of address scanned"
<GLOBAL KYC-CAPTCHA <>>         ;"P4: CAPTCHA passed"
<GLOBAL CARD-FOUND <>>          ;"P5: the punch card is out of the mempool"
<GLOBAL CONTRACT-FIXED <>>      ;"P5: the engine has compiled the patch"
<GLOBAL CHARTER-SIGNED <>>      ;"P6: the union charter carries your name"
<GLOBAL MNEMONIC-WORDS 0>       ;"P7: Trust words typed in order (0-4)"
<GLOBAL WALLET-OPEN <>>         ;"P7: the Trust's block has split"
<GLOBAL CAN-FULL <>>            ;"P8: the oil can holds the good stuff"
<GLOBAL BUCKLE-OILED <>>        ;"P8: the pawl is no longer rusted solid"
<GLOBAL BELT-FREED <>>          ;"P8: the verdling has his breath back"
<GLOBAL COAT-FOUND <>>          ;"P9: dug out from by the gondola car"
<GLOBAL BUSKER-SONGS 0>         ;"lore: how many songs you have heard"

;"The finale (section 7 explains every rule these drive)."
<GLOBAL POKES 0>                ;"pokes taken on this trip to the Runout (0-3)"
<GLOBAL PIKE-RAISED <>>         ;"is the pike up?"
<GLOBAL RUNOUT-FRESH <>>        ;"true only during the turn you arrive"
<GLOBAL EDGE-FRESH <>>          ;"the same, for the River's Edge"
<GLOBAL EDGE-TURNS 0>           ;"turns spent at the River's Edge"
<GLOBAL PART-NOW <>>            ;"an action that makes the crowd part"
<GLOBAL LANE-OPEN <>>           ;"the verdlings have parted"
<GLOBAL MINGUS-WON <>>          ;"set just before the winning JIGS-UP"

;"Lookup tables. GET counts from 0, so <GET ,ACT-TITLES 1> is Act One.
  A W?WORD constant is the dictionary entry for WORD; the parser hands
  those same values back from GETWORD?, so the keypad can compare them."
<CONSTANT ACT-TITLES
    <TABLE "" "Act One: The Abandoned Pavilion"
              "Act Two: The Blockchain Catacombs"
              "Finale: The Runout">>
<CONSTANT TRUST-WORDS <PTABLE W?THEY W?NEVER W?LOOK W?UP>>


;"============================================================================
  2. GO  --  the entry point
  ----------------------------------------------------------------------------
  GO may not have local variables; it sets up the world and hands over to
  MAIN-LOOP, which never returns.
 ============================================================================"

<ROUTINE GO ()
    <SETG MODE ,VERBOSE>          ;"full room descriptions on every visit"
    <SETG STANDARD-WAIT 1>        ;"WAIT is one turn (zillib's default is 4)"
    <CRLF> <CRLF>
    <TELL "The morning after the crash, the summit is empty. The investors
have gone, the influencers have gone, the gondola staff have gone, and Lord
Vaunt's helicopter has gone, on the third try. You are the actual dev: the one
competent engineer Lady Vaunt hired, for $SHRUG. The gondolas are stalled. The
only way out is down.|
|
There is one ticket left in your queue." CR CR>
    <INIT-STATUS-LINE>
    <V-VERSION>
    <SETG HERE ,MESA>
    <MOVE ,PLAYER ,HERE>
    <BEGIN-ACT 1>
    <V-LOOK>
    <MAIN-LOOP>>


;"============================================================================
  3. LIBRARY  --  zillib, the score table, and the two endings
 ============================================================================"

;"PRINT-GAME-OVER and PRINT-RANK are library routines we replace below;
  DELAY-DEFINITION tells the library not to define its own copies."
<DELAY-DEFINITION PRINT-GAME-OVER>
<DELAY-DEFINITION PRINT-RANK>

<INSERT-FILE "parser">

;"--- The score table ---------------------------------------------------------
  One line per achievement. AWARD-POINTS n ,ACH?NAME grants it exactly once
  (the library remembers), and FULL SCORE prints these descriptions.
                     P1-P10: 5 points each  |  lore: 2 points each"
<SCORING-ACHIEVEMENTS
    (KIOSK "translating the whitepaper")
    (TELESCOPE "looking down for once")
    (FLOOR "pressing the true map")
    (KYC "getting verified")
    (CONTRACT "optimizing the rug pull")
    (UNION "earning Local 404's endorsement")
    (WALLET "opening the Trust's cold wallet")
    (BELT "freeing the belted verdling")
    (COAT "digging out the coat")
    (PIKELINE "walking the pike line")
    (LORE-PLAQUE "reading the Lost Expedition plaque")
    (LORE-BUSKER "hearing the busker out")
    (LORE-SPITE "reading the Spite Terminal")
    (LORE-CLERK "filing lost property with Mrs. Thrumble")
    (LORE-GENESIS "reading the Genesis Block")>

;"--- The two endings ----------------------------------------------------------
  Both endings go through JIGS-UP, which prints its message, then
  PRINT-GAME-OVER, then the score line (V-SCORE), which calls PRINT-RANK.
  One global decides which banner you get: WALK-LANE (section 4) sets
  MINGUS-WON just before the winning JIGS-UP; the third poke leaves it false."
<REPLACE-DEFINITION PRINT-GAME-OVER
    <ROUTINE PRINT-GAME-OVER ()
        <COND (,MINGUS-WON
               <TELL "    *** You have reached the bottom of the Mingus ***" CR CR>)
              (ELSE
               <TELL "    *** You have died ***" CR CR>)>>>

;"The rank follows the score line, so the closing teaser lives here too: it
  is the very last thing a winner reads. A win is always Exit Liquidity,
  whatever the score (you can win without the lore points); mid-game SCORE
  and a death show the ladder."
<REPLACE-DEFINITION PRINT-RANK
    <ROUTINE PRINT-RANK (DEAD?)
        <TELL "That earns you the rank of ">
        <COND (<OR ,MINGUS-WON <G=? ,SCORE 60>> <TELL "Exit Liquidity.">)
              (<G=? ,SCORE 40> <TELL "Early Adopter.">)
              (<G=? ,SCORE 20> <TELL "Community Manager.">)
              (ELSE <TELL "Bagholder.">)>
        <CRLF>
        <COND (<AND .DEAD? ,MINGUS-WON>
               <TELL CR "You have reached the end of MINGUS I: ELEVATED RETURNS.|
|
Somewhere, a whitepaper is being written. Somewhere, a chat server is pumping.
Somewhere beneath the far bank of the Verdance it is still pitch black -- and
that is the only honest thing left.|
|
You are likely to be poked by a verdling -- and then eaten, if you don't
move.|
|
Coming next: MINGUS II: EVERYTHING ROLLS DOWNHILL. No one crosses the
Verdance. Nobody said anything about following it." CR>)>>>

;"--- Topic words ---------------------------------------------------------------
  Words that only ever appear as TYPEd words or in ASK ... ABOUT topics. A
  word must be in the dictionary for the code to name it as ,W?WORD, and for
  the parser to accept it at all (an unknown word stops the command with
  'I don't know the word')."

;"P1: the kiosk's plain-English answers and their synonyms."
<VOC "NOBODY" NOUN>
<VOC "ANARCHY" NOUN>
<VOC "NOONE" NOUN>
<VOC "MONEY" NOUN>
<VOC "THEFT" NOUN>
<VOC "STEAL" NOUN>
<VOC "STEALING" NOUN>
<VOC "MOUNTAIN" NOUN>
<VOC "HILL" NOUN>
<VOC "ROCK" NOUN>
;"P7: all twelve words on the pedestals (LOOK and UP are already words)."
<VOC "HIGHER" NOUN>
<VOC "THEY" NOUN>
<VOC "WHATEVER" NOUN>
<VOC "BETTER" NOUN>
<VOC "NEVER" NOUN>
<VOC "DYOR" NOUN>
<VOC "THAN" NOUN>
<VOC "SPITE" NOUN>
<VOC "ELEVATED" NOUN>
;"ASK topics."
<VOC "SONG" NOUN>
<VOC "SONGS" NOUN>
<VOC "OLD" NOUN>
<VOC "SIDE" NOUN>
<VOC "FAR" NOUN>
<VOC "BANK" NOUN>
<VOC "ACROSS" NOUN>
<VOC "VAUNT" NOUN>
<VOC "MAXIMUS" NOUN>
<VOC "LORD" NOUN>
<VOC "LOCAL" NOUN>
<VOC "DEMANDS" NOUN>
<VOC "STRIKE" NOUN>
<VOC "LIGHTS" NOUN>
<VOC "LIGHT" NOUN>
<VOC "DARK" NOUN>
<VOC "DARKNESS" NOUN>
<VOC "MANAGEMENT" NOUN>
<VOC "MINGUS" NOUN>
<VOC "EMPIRE" NOUN>
<VOC "ASCENDANCY" NOUN>
<VOC "PAVILION" NOUN>
<VOC "PALACE" NOUN>
<VOC "DRAINAGE" NOUN>
<VOC "EXPLORERS" NOUN>
<VOC "EXPLORER" NOUN>
<VOC "EXPEDITION" NOUN>
<VOC "PEOPLE" NOUN>
<VOC "ABOVE" NOUN>
<VOC "SKY" NOUN>
<VOC "PANTS" NOUN>
<VOC "TROUSERS" NOUN>
<VOC "VALLEY" NOUN>
<VOC "HOME" NOUN>
<VOC "RIVER" NOUN>
<VOC "RUNOUT" NOUN>


;"============================================================================
  4. SHARED ROUTINES  --  write shared behaviour once
  ----------------------------------------------------------------------------
  An object's ACTION routine is called with PRSO (and PRSI) already set, so
  one routine can serve many objects: it asks 'which object is this?' with
  ,PRSO and reads the differences from the object's own properties.
 ============================================================================"

;"FEATURE-F: things a description mentions that you can examine but that
  should neither be carried off nor wrenched about. Give an object
  (ACTION FEATURE-F) and NDESCBIT and it behaves like Inform's scenery."
<ROUTINE FEATURE-F ()
    <COND (<VERB? TAKE PULL PUSH TURN>
           <TELL CT ,PRSO>
           <COND (<FSET? ,PRSO ,PLURALBIT> <TELL " are">)
                 (ELSE <TELL " is">)>
           <TELL " gilded, bolted down or simply too much trouble, and probably
all three." CR>)>>

;"PERSON-F: the in-character fallbacks for every character. Each person's
  own ACTION handles what it cares about and calls PERSON-F for everything
  else. SAY ... TO someone (section 8; the person is PRSI there) gets the
  same reply as an unknown ASK topic. NO-ANSWER and NO-INTEREST are
  per-person properties; KEEP (below) belongs to the two things you can
  never give away. ARG is M-WINNER when the player gives an order (STEWARD,
  DANCE)."
<ROUTINE PERSON-F ("OPT" ARG)
    <COND (<==? .ARG ,M-WINNER>
           <TELL CT ,WINNER " looks at you the way everyone in the Ascendancy looks
at an engineer with an idea." CR>)
          (<VERB? ASK-ABOUT TELL-ABOUT>
           <TELL <GETP ,PRSO ,P?NO-ANSWER> CR>)
          (<VERB? SAY-TO>
           <TELL <GETP ,PRSI ,P?NO-ANSWER> CR>)
          (<AND <VERB? SHOW GIVE> <GETP ,PRSO ,P?KEEP>>
           <TELL <GETP ,PRSO ,P?KEEP> CR>)
          (<AND <VERB? SHOW GIVE> <FSET? ,PRSI ,PERSONBIT>>
           <TELL <GETP ,PRSI ,P?NO-INTEREST> CR>)
          (<VERB? KISS>
           <TELL "Nobody on this mountain has been kissed since the crash." CR>)
          (<VERB? ATTACK>
           <TELL "You are a developer, not a validator." CR>)>>

;"KEEP-F: the badge and the pike must never be lost, so every action that
  could separate you from them is refused. Their KEEP property is the
  refusal; PERSON-F above reads the same property, because GIVE X TO PERSON
  reaches the person's ACTION before the object's."
<ROUTINE KEEP-F ()
    <COND (<AND <VERB? GIVE SHOW PUT-IN PUT-ON THROW-AT> <GETP ,PRSO ,P?KEEP>>
           <TELL <GETP ,PRSO ,P?KEEP> CR>)>>

;"BEGIN-ACT: print an act banner the first time the player crosses into act
  N. Called from each act's first room on M-ENTER, which zillib sends as the
  player arrives, just before the room is described."
<ROUTINE BEGIN-ACT (N)
    <COND (<L=? .N ,CURRENT-ACT> <RFALSE>)>
    <SETG CURRENT-ACT .N>
    <CRLF>
    <HLIGHT ,H-BOLD>
    <TELL "       " <GET ,ACT-TITLES .N>>
    <HLIGHT ,H-NORMAL>
    <CRLF> <CRLF>>

;"ABOUT?: true if any of the given words appears anywhere in the topic of
  the current ASK ... ABOUT. The parser leaves the topic's word numbers in
  P-TOPIC-START and P-TOPIC-END, so ASK THRUMBLE ABOUT THE MOUNTAIN matches
  ,W?MOUNTAIN. Unknown words read as 0, hence the .W check."
<ROUTINE ABOUT? (W1 "OPT" W2 W3 W4 W5 W6 "AUX" W)
    <DO (I ,P-TOPIC-START ,P-TOPIC-END)
        <SET W <GETWORD? .I>>
        <COND (<AND .W <EQUAL? .W .W1 .W2 .W3>> <RTRUE>)
              (<AND .W <EQUAL? .W .W4 .W5 .W6>> <RTRUE>)>>
    <RFALSE>>

;"--- TYPE: one verb, two machines ---------------------------------------------
  The grammar (section 8) gives TYPE a TOPIC slot, which accepts any words at
  all -- even LOOK, which is a verb elsewhere. UP is the one awkward word: the
  parser files it as a preposition before any TOPIC rule sees it, so a second
  SYNTAX line, TYPE UP OBJECT (FIND KLUDGEBIT), catches that sentence too.
  Either way V-TYPE ignores the slots and reads the word straight after the
  verb from the parser's word buffer: P-V-WORDN is the verb's position, and
  GETWORD? returns the dictionary word at a position."

<ROUTINE V-TYPE ("AUX" W)
    <SET W <GETWORD? <+ ,P-V-WORDN 1>>>
    <COND (<==? ,HERE ,SWITCHBACKS> <KIOSK-TYPED .W>)
          (<==? ,HERE ,COLD-CAVERN> <KEYPAD-TYPED .W>)
          (ELSE
           <TELL "There is nothing here to type on. For once, nobody wants your
input." CR>)>>

;"P1: the kiosk wants each buzzword in one plain word, in order."
<ROUTINE KIOSK-TYPED (W "AUX" OK)
    <COND (<G=? ,KIOSK-LINE 3>
           <TELL "The kiosk has nothing left to translate. It seems relieved." CR>
           <RTRUE>)>
    <COND (<==? ,KIOSK-LINE 0> <SET OK <EQUAL? .W ,W?NOBODY ,W?ANARCHY ,W?NOONE>>)
          (<==? ,KIOSK-LINE 1>
           <SET OK <EQUAL? .W ,W?MONEY ,W?THEFT ,W?STEAL ,W?STEALING>>)
          (ELSE <SET OK <EQUAL? .W ,W?MOUNTAIN ,W?HILL ,W?ROCK>>)>
    <COND (<NOT .OK>
           <TELL "You type it in. The kiosk thinks about it, and the lit line
stays lit: \"">
           <KIOSK-LINE-TEXT>
           <TELL "\"|
|
    NOT CLEAR ENOUGH." CR>
           <RTRUE>)>
    <SETG KIOSK-LINE <+ ,KIOSK-LINE 1>>
    <COND (<L? ,KIOSK-LINE 3>
           <TELL "The kiosk chimes. The line goes dark, translated, and the next
one lights up: \"">
           <KIOSK-LINE-TEXT>
           <TELL "\"" CR>
           <RTRUE>)>
    <AWARD-POINTS 5 ,ACH?KIOSK>
    <TELL "The last line goes dark. The screen clears and prints, in letters a
foot high:|
|
    NOBODY'S IN CHARGE, WE TAKE YOUR MONEY, ON A MOUNTAIN.|
|
The kiosk beeps approvingly. It has never heard its own whitepaper stated so
clearly. Somewhere, a VC weeps. The tears freeze.|
|
With a clank, the kiosk rolls aside. The way up to the Pavilion is open." CR>>

;"The buzzword the kiosk currently has lit (KIOSK-LINE 0, 1 or 2)."
<ROUTINE KIOSK-LINE-TEXT ()
    <COND (<==? ,KIOSK-LINE 0> <TELL "decentralized synergy">)
          (<==? ,KIOSK-LINE 1> <TELL "trustless value-capture">)
          (ELSE <TELL "elevation-agnostic vertical">)>>

;"P7: the Trust's keypad wants THEY NEVER LOOK UP, one word at a time; the
  table TRUST-WORDS (section 1) holds them in order. Any other word --
  Vaunt's gold, Lady Vaunt's colours -- starts it over."
<ROUTINE KEYPAD-TYPED (W)
    <COND (,WALLET-OPEN
           <TELL "The keypad is dark. The block has already given up its
secret." CR>
           <RTRUE>)
          (<N==? .W <GET ,TRUST-WORDS ,MNEMONIC-WORDS>>
           <SETG MNEMONIC-WORDS 0>
           <TELL "The keypad buzzes. Frost creeps across its little screen:|
|
    INVALID MNEMONIC. 0 OF 4." CR>
           <RTRUE>)>
    <SETG MNEMONIC-WORDS <+ ,MNEMONIC-WORDS 1>>
    <COND (<L? ,MNEMONIC-WORDS 4>
           <TELL "The keypad clicks. Its screen reads: WORD ACCEPTED. "
                 N ,MNEMONIC-WORDS " OF 4." CR>
           <RTRUE>)>
    <SETG WALLET-OPEN T>
    <FSET ,HARDWARE-BOX ,OPENBIT>
    <AWARD-POINTS 5 ,ACH?WALLET>
    <TELL "The keypad clicks a fourth time and its screen glows a plain, steady
white:|
|
    MNEMONIC ACCEPTED|
|
With a sound like a frozen lake changing its mind, the Trust's block splits
down the middle. The halves fall apart, and the box inside thaws open on its
own: inside are a hardware wallet and, in a tiny plastic cradle, a SIM-eject
pin." CR>>

;"--- P3: the ballroom floor --------------------------------------------------
  The true order, from the Survey: 1 FOYER, 2 SHAFT, 3 STATION,
  4 OBSERVATORY, 5 SHOP. Each tile's ORDER property is its place in that
  order. A wrong tile undoes the whole sequence."
<ROUTINE PRESS-TILE (TL)
    <COND (,FLOOR-OPEN
           <TELL "The floor has already gone down. It is not coming back up." CR>)
          (<==? <GETP .TL ,P?ORDER> <+ ,TILE-PROGRESS 1>>
           <SETG TILE-PROGRESS <+ ,TILE-PROGRESS 1>>
           <COND (<L? ,TILE-PROGRESS 5>
                  <TELL "The " <GETP .TL ,P?LABEL> " tile sinks with a heavy click
and stays down." CR>)
                 (ELSE
                  <SETG FLOOR-OPEN T>
                  <AWARD-POINTS 5 ,ACH?FLOOR>
                  <TELL "The SHOP tile sinks, and the whole floor answers. With a
long grinding rumble, the gilded map tilts and a section of it -- the part
Vaunt labelled DAMP -- descends into the dark below, folding itself into a
flight of stone steps. Under where the centre tile was, someone has etched a
single word: HIGHER.|
|
The ballroom fulfills its only remaining purpose: to be left behind. The way
down is open. Everyone in the Ascendancy eventually wants to go down." CR>)>)
          (ELSE
           <SETG TILE-PROGRESS 0>
           <TELL "The " <GETP .TL ,P?LABEL> " tile sinks, then rises with a
disappointed click. Every tile you had pressed rises with it." CR>)>>

;"--- P4: the KYC scanner ------------------------------------------------------
  Proof of address and the CAPTCHA, in either order. Called after each."
<ROUTINE KYC-CHECK ()
    <COND (<NOT <AND ,KYC-ADDRESS ,KYC-CAPTCHA>> <RFALSE>)>
    <MOVE ,WALLET-BADGE ,WINNER>
    <AWARD-POINTS 5 ,ACH?KYC>
    <TELL CR "The scanner prints something warm and hands it to you: a Verified
Wallet Badge, soulbound and non-transferable, revocable at any time for any
reason. \"Verification complete.\" A second line scrolls past: the form was
adapted from a much shorter one used on the old side, and improved by adding
pages and altitude.|
|
Behind you, the service lift's gate rattles open." CR>>

;"The consensus door counts what you carry."
<ROUTINE ATTESTATIONS ("AUX" (N 0))
    <COND (<IN? ,DEBUGGED-CONTRACT ,WINNER> <SET N <+ .N 1>>)>
    <COND (<IN? ,ENDORSEMENT ,WINNER> <SET N <+ .N 1>>)>
    .N>

;"--- The finale: the poke counter --------------------------------------------
  POKE-LINE prints the counter in plain ASCII; POKE adds one and says so. The
  third poke ends the game: JIGS-UP prints the death, then PRINT-GAME-OVER
  (section 3) sees MINGUS-WON still false and prints '*** You have died ***'.
  JIGS-UP never returns -- it waits for RESTART, RESTORE, UNDO or QUIT."
<ROUTINE POKE-LINE ()
    <TELL "[POKES: ">
    <COND (<==? ,POKES 0> <TELL "---">)
          (<==? ,POKES 1> <TELL "*--">)
          (<==? ,POKES 2> <TELL "**-">)
          (ELSE <TELL "***">)>
    <TELL "]">>

<ROUTINE POKE ()
    <SETG POKES <+ ,POKES 1>>
    <COND (<==? ,POKES 1>
           <TELL CR "A verdling the height of your knee pokes you smartly in the
shin with its pike. \"Up,\" it says, pointing at the Mingus. \"Up up up.\" ">
           <POKE-LINE>
           <CRLF>)
          (<==? ,POKES 2>
           <TELL CR "Several verdlings, several jabs, harder. \"UP.\" ">
           <POKE-LINE>
           <CRLF>)
          (ELSE
           <CRLF>
           <JIGS-UP "The verdlings stop poking. That is the last thing you
notice: how quiet it gets when they stop. Verdlings, it turns out, do not only
poke.|
|
Your remains will be poked back up the mountain in the morning, as a
courtesy.">)>>

;"--- The finale: the ending ----------------------------------------------------
  Parting: the bowed crowd makes way, and the ship appears."
<ROUTINE PARTING ()
    <SETG LANE-OPEN T>
    <MOVE ,LANE ,RIVER-EDGE>
    <MOVE ,FUNERAL-SHIP ,RIVER-EDGE>
    <TELL CR "Slowly -- not scattering, making way -- the verdlings part. A lane
opens through the bowed crowd, a shoulder's width, running straight down to the
water. At the end of it, moored at the mouth of the Sluice, is a ship like the
funeral ships: the same high prow, the same hard wallets strung along it like
lanterns that are not lit. Nobody is laid out on it. The gangplank is down." CR>>

;"WALK-LANE: EAST, DOWN, FOLLOW LANE, BOARD SHIP and the rest all end here.
  GOTO moves you and describes the last room; then MINGUS-WON chooses the
  winning banner, and JIGS-UP prints the closing text and ends the game."
<ROUTINE WALK-LANE ()
    <GOTO ,GANGPLANK-FOOT>
    <SETG MINGUS-WON T>
    <CRLF>
    <JIGS-UP "Thousands of small heads stay bowed. The lane they made for you
runs straight to the water, and the ship at the end of it rocks on the Verdance
-- the river nobody crosses and nobody comes back from. It was built to carry
the dead. The gangplank is down. Nobody here is going to tell you to climb it,
and nobody is going to let you go anywhere else.">>


;"============================================================================
  5. ACT ONE: THE ABANDONED PAVILION  --  the summit
 ----------------------------------------------------------------------------
  Rooms: Wind-Scoured Mesa, Gas Station, Whitepaper Switchbacks, Pavilion
  Terrace, Upside-Down Ballroom, Vaunt's Private Study, Lady Vaunt's Wing,
  The Observatory. Puzzles P1 (kiosk), P2 (telescope), P3 (floor), and the
  oil you will need in Act Two. Lore: the plaque, the busker, the terminal.
 ============================================================================"

;"--- The player's own belongings ---------------------------------------------
  TICKET #1 states the game's goal in the first thing you carry. TEXT is what
  both EXAMINE and READ print (READ needs READBIT). NARTICLEBIT stops the
  library calling it 'a TICKET #1'."

<OBJECT TICKET-ONE
    (DESC "TICKET #1")
    (SYNONYM TICKET ONE NUMBER)
    (ADJECTIVE PRIORITY)
    (IN PLAYER)
    (FLAGS TAKEBIT READBIT NARTICLEBIT)
    (TEXT "TICKET #1. PRIORITY: WHATEVER.|
|
\"My coat. The real one. It rolled off my balcony during the divorce and it is
at the bottom of the mountain now. Get it. There is something of mine in the
pocket. Don't read it. -- E.V.|
|
P.S. Nobody is going to pay you. Nobody is going to pay anybody.\"")>

;"--- 1. Wind-Scoured Mesa -------------------------------------------------------"

<ROOM MESA
    (DESC "Wind-Scoured Mesa")
    (IN ROOMS)
    (LDESC "You are standing on a wind-scoured mesa west of a pavilion that has
seen better days. Better days, tremendous days, the best days -- all behind it
now. Far below to the east, past the Verdance, the far bank is green and quiet.
It is not your concern. The wind would like to discuss your hat.|
|
Foreclosure notices blow past in ones and twos, heading downhill like
everything else here. Along the river the half-bridges march out over the water
and stop, one after another, in the middle. A bronze plaque stands at the edge
of the overlook. A gas station sits on the gondola terrace to the north, and
the switchback stair to the Pavilion starts east.")
    (SOUNDS "Wind. Under it, very far down, the river.")
    (NORTH TO GAS-STATION)
    (EAST TO SWITCHBACKS)
    (FLAGS LIGHTBIT)
    (ACTION MESA-F)>

;"Room ACTION routines get an argument saying why they were called. M-BEG
  runs before every action here; returning true stops the action. This one
  turns every exit except north and east into the same refusal. PRSO-DIR is
  true when PRSO is a direction rather than an object."
<ROUTINE MESA-F (RARG)
    <COND (<AND <==? .RARG ,M-BEG> <VERB? WALK> ,PRSO-DIR
                <NOT <EQUAL? ,PRSO ,P?NORTH ,P?EAST>>>
           <TELL "The mesa ends in air on that side. The Ascendancy is built to
be looked down from, not walked off." CR>)>>

;"LORE L1. Reading (or examining) the plaque awards the lore achievement.
  AWARD-POINTS only counts an achievement once, so it is safe to call every
  time the plaque is read -- no flag of our own is needed."
<OBJECT EXPEDITION-PLAQUE
    (DESC "Lost Expedition plaque")
    (SYNONYM PLAQUE CODE OVERLOOK)
    (ADJECTIVE BRONZE LOST EXPEDITION DONATE)
    (IN MESA)
    (FLAGS NDESCBIT READBIT)
    (ACTION EXPEDITION-PLAQUE-F)>

<ROUTINE EXPEDITION-PLAQUE-F ()
    <COND (<VERB? EXAMINE READ>
           <AWARD-POINTS 2 ,ACH?LORE-PLAQUE>
           <TELL "A handsome bronze plaque on a gilded post, leaning slightly
downhill:|
|
    THE LOST EXPEDITION|
    No one crosses the Verdance. Many have tried.|
    Their sacrifice is commemorated here.|
|
Where the names should be there is a DONATE code, and under it, smaller: \"Scan
to honor them. Minimum honor: one gas fee.\" Somebody always has a cousin who
made it across. Nobody has ever had a name for the plaque." CR>)
          (ELSE <FEATURE-F>)>>

;"The notices blowing past answer to NOTICES, and to NOTICE as well, since a
  player is bound to try TAKE NOTICE here. If the real notice is in reach
  too (held, or lying here), both match NOTICE; their shared GENERIC routine
  (NOTICE-GENERIC-F, with the terrace's notices below) then picks the real
  one, so the parser never asks 'which do you mean?'. Taking one is refused
  with a pointer to the notice that does hold still."
<OBJECT MESA-NOTICES
    (DESC "foreclosure notices")
    (SYNONYM NOTICES PAPERS NOTICE)
    (ADJECTIVE FORECLOSURE)
    (IN MESA)
    (FLAGS NDESCBIT PLURALBIT READBIT)
    (GENERIC NOTICE-GENERIC-F)
    (TEXT "They are addressed to VAUNT PAVILION, SUMMIT, MINGUS RANGE, and they
are all going the same way: down.")
    (ACTION MESA-NOTICES-F)>

;"TAKE prefers things on the ground, so TAKE NOTICE reaches these notices
  even while you hold the real one; answer for it then."
<ROUTINE MESA-NOTICES-F ()
    <COND (<AND <VERB? TAKE PULL> <IN? ,NOTICE ,WINNER>>
           <TELL "You already have one. The wind will keep bringing more." CR>)
          (<VERB? TAKE PULL>
           <TELL "They blow past faster than you can grab one, all going the
same way: down. Up at the Pavilion, one has caught on the doorbell; that one
will hold still long enough to take." CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT HALF-BRIDGES
    (DESC "half-bridges")
    (SYNONYM HALF-BRIDGES BRIDGES BRIDGE RIVER VERDANCE BANK VALLEY)
    (ADJECTIVE HALF FAR GREEN)
    (IN MESA)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Stone arches, steel trusses, a gilded suspension span with Vaunt's
name on both towers: each marches confidently out over the Verdance and then
simply stops, its last girder hanging over the current like a sentence nobody
could finish. Beyond them the far bank is real grass and real cottonwoods.
Every roadmap ended at \"Phase 2: Far Bank.\"")
    (ACTION FEATURE-F)>

;"--- 8. Gas Station ------------------------------------------------------------
  The Gas Station holds the oil for P8 (the belted verdling, Act Two) and the
  busker (lore L2), whose first song hints at both the pike and the
  telescope."

<ROOM GAS-STATION
    (DESC "Gas Station")
    (IN ROOMS)
    (LDESC "A literal gas station on the gondola terrace, under a canopy that
has lost most of its gold leaf to the wind. Four pumps stand in a row, marked
PREMIUM, REGULAR, MAINNET and, at this altitude, OXYGEN. The MAINNET pump leaks
steadily into a puddle. Beyond the pumps a summit gondola hangs stalled on its
cable, going nowhere. The mesa is back to the south.")
    (SOUNDS "The MAINNET pump, dripping. And, from the gondola platform, a
busker tuning up.")
    (SOUTH TO MESA)
    (FLAGS LIGHTBIT)>

<OBJECT PUMPS
    (DESC "pumps")
    (SYNONYM PUMP PUMPS HANDLE PUDDLE LEAK)
    (ADJECTIVE PREMIUM REGULAR MAINNET OXYGEN)
    (IN GAS-STATION)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "PREMIUM and REGULAR are bone dry. OXYGEN wants a coin you don't
have. MAINNET leaks the good stuff -- a thick, golden lubricant -- in a slow,
steady drip, and someone has carved a word under its handle: BETTER.")
    (ACTION PUMPS-F)>

;"The pumps are scenery; DRINK gets its own joke. FILL CAN FROM PUMP is
  handled by the oil can, not here."
<ROUTINE PUMPS-F ()
    <COND (<VERB? DRINK> <TELL "It is the good stuff, but not for drinking." CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT SUMMIT-GONDOLA
    (DESC "stalled gondola")
    (SYNONYM GONDOLA CABLE CANOPY)
    (ADJECTIVE STALLED SUMMIT)
    (IN GAS-STATION)
    (FLAGS NDESCBIT)
    (TEXT "It stopped halfway out of the station last night and has been
rocking there ever since, empty, with its doors open. The gondolas are not
coming back.")
    (ACTION FEATURE-F)>

;"P8, part one: the oil. FILL CAN works only here (FILL CAN FROM PUMP and
  FILL CAN WITH OIL too: section 8). CAN-FULL is the state: OIL BUCKLE
  empties it, and you can always come back and refill, so the oil can never
  become a dead end. Pouring the can out (EMPTY, or POUR from section 8) is
  a way of oiling: onto the buckle, or anywhere on the ledge, it PERFORMs
  OIL BUCKLE; anywhere else it is refused, so the good stuff is never
  wasted. FDESC is how the can is described until it is
  first picked up (the library sets TOUCHBIT then); VOWELBIT makes the
  library say 'an oil can'."
<OBJECT OIL-CAN
    (DESC "oil can")
    (SYNONYM CAN OILCAN SPOUT)
    (ADJECTIVE OIL EMPTY FULL TIN)
    (IN GAS-STATION)
    (FDESC "An empty oil can hangs on a hook by the pumps.")
    (FLAGS TAKEBIT VOWELBIT)
    (ACTION OIL-CAN-F)>

<ROUTINE OIL-CAN-F ()
    <COND (<AND <VERB? EXAMINE> <PRSO? ,OIL-CAN>>
           <COND (,CAN-FULL
                  <TELL "A small tin oil can with a long spout, full of the
MAINNET pump's good stuff." CR>)
                 (ELSE <TELL "A small tin oil can with a long spout. It is
empty." CR>)>)
          (<AND <VERB? FILL> <PRSO? ,OIL-CAN>>
           <COND (<N==? ,HERE ,GAS-STATION>
                  <TELL "There is nothing here to fill it with." CR>)
                 (,CAN-FULL <TELL "It is already full of the good stuff." CR>)
                 (ELSE
                  <SETG CAN-FULL T>
                  <COND (<NOT <IN? ,OIL-CAN ,WINNER>>
                         <MOVE ,OIL-CAN ,WINNER>
                         <FSET ,OIL-CAN ,TOUCHBIT>
                         <TELL "(first taking the oil can)" CR>)>
                  <TELL "PREMIUM and REGULAR are dry, and OXYGEN is
coin-operated, so you hold the can under the MAINNET pump's leak until it is
full of thick, golden lubricant. The pump does not mind. It has been giving
this away all night." CR>)>)
          (<AND <VERB? EMPTY> <PRSO? ,OIL-CAN>>
           <COND (<AND <==? ,HERE ,LEDGE> <NOT ,BELT-FREED>>
                  <PERFORM ,V?OIL ,BUCKLE>)
                 (ELSE <TELL "You'd only have to fill it again." CR>)>
           <RTRUE>)
          (<AND <VERB? EMPTY-ONTO> <PRSO? ,OIL-CAN>>
           <COND (<PRSI? ,BUCKLE ,BELT-PAWL ,BELTED-VERDLING>
                  <PERFORM ,V?OIL ,BUCKLE>)
                 (ELSE <TELL "You'd only have to fill it again." CR>)>
           <RTRUE>)>>

;"LORE L2. LISTEN TO BUSKER is the LISTEN-TO action with the busker as PRSO.
  The first song scores and carries both hints; later LISTENs cycle the
  three river poets' verses, using <MOD ,BUSKER-SONGS 3>. LDESC is how a
  person appears in the room; TEXT is what EXAMINE shows."
<OBJECT BUSKER
    (DESC "busker")
    (SYNONYM BUSKER SINGER POET GUITAR CASE)
    (ADJECTIVE RIVER GUITAR)
    (IN GAS-STATION)
    (FLAGS PERSONBIT)
    (LDESC "A busker sits on an upturned crate by the stalled gondola, playing
to nobody.")
    (TEXT "A river poet in three scarves and fingerless gloves, the busker of
Gondola Platform 4, playing to nobody with tremendous commitment. The guitar
case open at their feet holds two pebbles and a foreclosure notice.")
    (NO-ANSWER "\"I only know songs,\" says the busker. \"Ask me for one. Better
yet, just listen.\"")
    (NO-INTEREST "\"Keep it,\" says the busker. \"Nobody's paying anybody.\"")
    (ACTION BUSKER-F)>

<ROUTINE BUSKER-F ("OPT" ARG "AUX" N)
    <COND (.ARG <PERSON-F .ARG>)
          (<VERB? LISTEN-TO>
           <SETG BUSKER-SONGS <+ ,BUSKER-SONGS 1>>
           <SET N <MOD ,BUSKER-SONGS 3>>
           <COND (<1? ,BUSKER-SONGS>
                  <AWARD-POINTS 2 ,ACH?LORE-BUSKER>
                  <TELL "The busker nods, as if you had paid, and sings:|
|
    \"The notices roll and the gilding comes down,|
    and the Runout keeps all that we lose;|
    and only a pike turns a pike aside,|
    and a verdling will not take your news.|
    There's a coat in the rubble that casts a true shade,|
    and a word in its pocket, they tell --|
    but the one who will find it's the one who looked down,|
    the one who looked down and saw where it fell.\"|
|
The last chord blows away downhill." CR>)
                 (<==? .N 2>
                  <TELL "\"One of mine,\" says the busker, and sings:|
|
    \"Where the green bank goes down to the water,|
    there's a door that was never a door --|
    and the ones who went over the Verdance|
    sing it better than we did before.\"" CR>)
                 (<==? .N 0>
                  <TELL "\"The Thursday tenor's,\" says the busker, and sings:|
|
    \"Don't look for their lights from the ridgeline,|
    they don't burn them to show you the way;|
    they keep all their stars underneath them,|
    and they've never once wished it was day.\"" CR>)
                 (ELSE
                  <TELL "\"The girl with the dulcimer's. That's the whole song,\"
says the busker, and sings it twice:|
|
    \"I floated a letter to the old side.|
    It is floating there still, I suppose.\"" CR>)>)
          (<NOT <VERB? ASK-ABOUT>> <PERSON-F>)
          ;"ASK BUSKER ABOUT ...: test the topic against each subject."
          (<ABOUT? ,W?SONG ,W?SONGS ,W?PIKE ,W?COAT ,W?VERDLINGS ,W?VERDLING>
           <TELL "\"It's all in the song,\" says the busker. \"Songs are the only
honest thing that comes off this mountain. Listen.\"" CR>)
          (<ABOUT? ,W?OLD ,W?SIDE ,W?FAR ,W?BANK ,W?ACROSS>
           <TELL "\"Never been. None of us has. That's why the songs are so
good.\"" CR>)
          (<ABOUT? ,W?VAUNT ,W?MAXIMUS>
           <TELL "\"Tried to buy the catalogue. Nobody would sell.\"" CR>)
          (ELSE <PERSON-F>)>>

;"--- 2. Whitepaper Switchbacks ----------------------------------------------------
  P1 lives here. The up exit is a routine (PER): it returns the Terrace once
  the kiosk is solved (KIOSK-LINE is 3), and otherwise prints why not and
  returns false, which means 'you stay put'. The description changes with
  the puzzle, so it is printed by M-LOOK instead of a fixed LDESC."

<ROOM SWITCHBACKS
    (DESC "Whitepaper Switchbacks")
    (IN ROOMS)
    (SOUNDS "The kiosks hum. One of them is playing hold music to itself.")
    (WEST TO MESA)
    (UP PER SWITCHBACKS-UP-F)
    (FLAGS LIGHTBIT)
    (ACTION SWITCHBACKS-F)>

<ROUTINE SWITCHBACKS-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "A zigzag stair cut into the cliff, climbing toward the Pavilion
in switchbacks so tight you meet yourself coming the other way. Every landing
has a kiosk, and every kiosk displays a page of the $ALT whitepaper">
           <COND (<L? ,KIOSK-LINE 3>
                  <TELL ". The one on the top landing stands square across the
stair, blocking the way up. Its screen asks you to TRANSLATE TO PLAIN ENGLISH.
ONE WORD WILL DO.">)
                 (ELSE <TELL ". The kiosk that blocked the top landing has
rolled aside; the way up is open.">)>
           <TELL " A smaller bonus kiosk flickers on the landing below. The mesa
is back to the west." CR>)>>

;"P1: the Switchbacks' UP exit. The kiosk blocks the stair until all three
  whitepaper phrases are translated (KIOSK-LINE reaches 3); a PER routine
  returns the room to go to, or false (after saying why) to stay."
<ROUTINE SWITCHBACKS-UP-F ()
    <COND (<G=? ,KIOSK-LINE 3> ,TERRACE)
          (ELSE
           <TELL "The kiosk on the top landing blocks the stair. Its screen
pulses patiently: TRANSLATE TO PLAIN ENGLISH. ONE WORD WILL DO." CR>
           <RFALSE>)>>

;"Both kiosks answer to KIOSK. When the parser finds more than one match it
  asks each candidate's GENERIC routine to choose; this one always picks the
  main kiosk, so READ KIOSK never asks 'which do you mean?'. The bonus kiosk
  still answers to READ BONUS KIOSK, because BONUS is its word alone."
<ROUTINE KIOSK-GENERIC-F (TBL)
    ,SWITCH-KIOSK>

<OBJECT SWITCH-KIOSK
    (DESC "whitepaper kiosk")
    (SYNONYM KIOSK SCREEN BUZZWORDS KEYBOARD)
    (ADJECTIVE WHITEPAPER TOP MAIN)
    (IN SWITCHBACKS)
    (FLAGS NDESCBIT READBIT)
    (GENERIC KIOSK-GENERIC-F)
    (ACTION SWITCH-KIOSK-F)>

;"P1: READ KIOSK shows the whitepaper sentence with the phrase you are on
  lit (KIOSK-LINE picks it). TYPE <word> answers it (V-TYPE, section 4)."
<ROUTINE SWITCH-KIOSK-F ()
    <COND (<VERB? EXAMINE READ>
           <COND (<G=? ,KIOSK-LINE 3>
                  <TELL "The kiosk has rolled aside and now shows only a slowly
rotating $ALT logo: Vaunt's face, gilded, with laser eyes, rising over a
peak." CR>)
                 (ELSE
                  <TELL "The screen shows one sentence of the whitepaper:|
|
\"$ALT leverages decentralized synergy to create trustless value-capture
mechanisms across the elevation-agnostic vertical.\"|
|
One phrase at a time is lit. Right now it is \"">
                  <KIOSK-LINE-TEXT>
                  <TELL "\". Underneath: TRANSLATE TO PLAIN ENGLISH. ONE WORD WILL
DO. A keyboard waits for you to TYPE something." CR>)>)
          (<AND <VERB? PUSH PULL TAKE> <L? ,KIOSK-LINE 3>>
           <TELL "The kiosk is bolted to the landing. It will move when it hears
plain English." CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT BONUS-KIOSK
    (DESC "bonus kiosk")
    (SYNONYM KIOSK)
    (ADJECTIVE BONUS SMALL SMALLER OTHER SECOND LOWER)
    (IN SWITCHBACKS)
    (FLAGS NDESCBIT READBIT)
    (GENERIC KIOSK-GENERIC-F)
    (ACTION BONUS-KIOSK-F)>

;"The bonus kiosk: pure foreshadowing, read once (BONUS-READ), then dark."
<ROUTINE BONUS-KIOSK-F ()
    <COND (<VERB? EXAMINE READ>
           <COND (,BONUS-READ
                  <TELL "The bonus kiosk is switched off. It seems determined to
stay that way." CR>)
                 (ELSE
                  <SETG BONUS-READ T>
                  <TELL "\"Unlike legacy subterranean competitors,\" it reads,
\"$ALT is built for the future.\" The screen starts to translate this into plain
English -- THERE IS A PLACE UNDER THE FAR BANK AND IT IS -- and then the kiosk
shuts itself off rather than finish." CR>)>)
          (ELSE <FEATURE-F>)>>

;"--- 3. Pavilion Terrace ------------------------------------------------------------
  The hub of Act One: four exits and the foreclosure notice that P4 (the KYC
  scanner, Act Two) will accept as proof of address."

<ROOM TERRACE
    (DESC "Pavilion Terrace")
    (IN ROOMS)
    (LDESC "The front terrace of Vaunt Pavilion: doorframes twelve feet tall for
no reason, gilding peeling in the wind, and a main gate that someone has
boarded shut with planks and a note saying WHATEVER. Foreclosure notices flap
on every door. A marble doorbell is set into the gatepost. The ballroom is
east, Vaunt's study north, and a cantilevered walkway runs south to Lady
Vaunt's wing. The switchbacks go back down.")
    (SOUNDS "Paper flapping. The wind, finding every gap in the gilding.")
    (DOWN TO SWITCHBACKS)
    (EAST TO BALLROOM)
    (NORTH TO STUDY)
    (SOUTH TO WING)
    (FLAGS LIGHTBIT)>

<OBJECT TERRACE-FRAMES
    (DESC "doorframes")
    (SYNONYM DOORFRAME FRAMES DOOR DOORS GILDING GATE PLANKS BOARDS)
    (ADJECTIVE MAIN BOARDED)
    (IN TERRACE)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "The doorframes would admit a giraffe in a top hat. The main gate is
boarded shut; the note on the planks says WHATEVER in a confident hand.")
    (ACTION FEATURE-F)>

;"The singular/plural trick, part one. The scenery notices answer to NOTICES
  only, and the one you can take answers to NOTICE only, so TAKE NOTICE and
  EXAMINE NOTICES never ask 'which do you mean?'."
<OBJECT TERRACE-NOTICES
    (DESC "flapping notices")
    (SYNONYM NOTICES)
    (ADJECTIVE FLAPPING FORECLOSURE)
    (IN TERRACE)
    (FLAGS NDESCBIT PLURALBIT READBIT)
    (TEXT "FORECLOSURE, FORECLOSURE, FINAL NOTICE, FORECLOSURE. Every one that
blows off rolls downhill, along with every other liability the estate ever
had. More keep coming.")
    (ACTION FEATURE-F)>

;"RING is a verb the game adds (section 8); the doorbell answers both RING
  and PUSH/PRESS in its own ACTION. Pure flavour: Vaunt's one recorded line."
<OBJECT DOORBELL
    (DESC "marble doorbell")
    (SYNONYM DOORBELL BELL BUTTON GATEPOST)
    (ADJECTIVE MARBLE)
    (IN TERRACE)
    (FLAGS NDESCBIT)
    (TEXT "A doorbell carved from a single block of marble, which is the wrong
material for a doorbell in every way.")
    (ACTION DOORBELL-F)>

<ROUTINE DOORBELL-F ()
    <COND (<VERB? RING PUSH>
           <TELL "Somewhere inside, a chime the size of a church bell goes off,
and a recording of Lord Vaunt begins:|
|
\"People say to me, Maximus, is it true the old side is better? And I say:
which old side? I've never heard of them. I hear they're closing. I hear it was
never very good on the old side. Tremendous moisture problems. Up here we have
sunrise. Every single day. Who else can say that?\"|
|
The recording ends. Nobody comes to the door." CR>)
          (ELSE <FEATURE-F>)>>

;"Notices keep blowing: there is ALWAYS one caught on the doorbell. Two
  objects make that work. DOORBELL-NOTICE has no TAKEBIT and never leaves;
  TAKE on it hands you NOTICE, the one you carry, and the wind catches
  another on the doorbell at once. Its LDESC is printed in the room
  description every time (an FDESC would stop once it had been touched).
  When the scanner eats the notice (section 6), the doorbell still has one.

  Both answer to NOTICE. Whenever the real notice is in reach as well (held,
  or lying here), the parser finds two matches and asks their GENERIC
  routine to choose: NOTICE-GENERIC-F always picks the real one, so EXAMINE
  NOTICE or TAKE NOTICE never asks 'which do you mean?'. The mesa's notices
  use it too."
<ROUTINE NOTICE-GENERIC-F (TBL)
    ,NOTICE>

<OBJECT DOORBELL-NOTICE
    (DESC "foreclosure notice")
    (SYNONYM NOTICE PAPER)
    (ADJECTIVE FORECLOSURE FINAL CAUGHT SINGLE)
    (IN TERRACE)
    (LDESC "One foreclosure notice has caught on the doorbell and flaps there,
like it is ringing.")
    (FLAGS READBIT)
    (GENERIC NOTICE-GENERIC-F)
    (TEXT "FINAL NOTICE OF FORECLOSURE. VAUNT PAVILION, SUMMIT, MINGUS RANGE. It
is, among other things, an address.")
    (ACTION DOORBELL-NOTICE-F)>

;"zillib's TAKE prefers things on the ground to things you hold, so TAKE
  NOTICE comes here even while you carry the real one (no GENERIC choice is
  needed); hence the first test."
<ROUTINE DOORBELL-NOTICE-F ()
    <COND (<AND <VERB? TAKE PULL> <IN? ,NOTICE ,WINNER>>
           <TELL "You already have one. The wind will keep bringing more." CR>)
          (<VERB? TAKE PULL>
           <MOVE ,NOTICE ,WINNER>
           <FSET ,NOTICE ,TOUCHBIT>
           <TELL "You unhook the notice from the doorbell. Almost at once the
wind catches another one there, flapping like it is ringing." CR>)>>

;"The notice you carry. It starts off-stage (no IN, so it is in no room)
  until the doorbell's notice hands it over."
<OBJECT NOTICE
    (DESC "foreclosure notice")
    (SYNONYM NOTICE PAPER)
    (ADJECTIVE FORECLOSURE FINAL CAUGHT SINGLE)
    (FLAGS TAKEBIT READBIT)
    (GENERIC NOTICE-GENERIC-F)
    (TEXT "FINAL NOTICE OF FORECLOSURE. VAUNT PAVILION, SUMMIT, MINGUS RANGE. It
is, among other things, an address.")
    (ACTION NOTICE-F)>

<ROUTINE NOTICE-F ()
    <COND (<AND <VERB? TAKE> <IN? ,NOTICE ,WINNER>>
           <TELL "You already have one. The wind will keep bringing more." CR>)>>

;"--- 4. The Upside-Down Ballroom ---------------------------------------------------
  P3 lives here. The five tiles send every press to PRESS-TILE (section 4),
  which tracks TILE-PROGRESS. The down exit is conditional: it opens once
  FLOOR-OPEN is set. The up exit is a routine that prints the staircase joke
  and then returns the Observatory: a PER routine can talk AND move you."

<ROOM BALLROOM
    (DESC "The Upside-Down Ballroom")
    (IN ROOMS)
    (SOUNDS "The chandeliers, chiming against one another like someone else's
cutlery.")
    (WEST TO TERRACE)
    (UP PER BALLROOM-UP-F)
    (DOWN TO ROOT-CELLAR IF FLOOR-OPEN ELSE "The floor is solid gold leaf over
solid concrete. It is waiting for something.")
    (FLAGS LIGHTBIT)
    (ACTION BALLROOM-F)>

<ROUTINE BALLROOM-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "A ballroom the size of a cathedral, if cathedrals were designed
by someone who'd only heard of them secondhand. It is a replica of a great hall
in the old side, built upside down. Gilded stalagmites hang from the ceiling.
Gilded stalactites stand on the floor and trip you. The \"cave mouth\" is a
skylight, and the sky is leaking. A brass plaque is fixed to a column, and the
chandeliers -- acquired, provenance unclear, designed to hang in a cellar --
sway in a gale that very much should exist, because you are on a mountain.|
|
The dance floor is a map of the Ascendancy inlaid in gold, rearranged so that it
spells VAUNT when seen from the mezzanine. Five of its tiles are marked: FOYER,
SHAFT, STATION, OBSERVATORY and SHOP. The Verdance along its eastern edge is a
hairline crack, and the far bank is labelled simply DAMP.">
           <COND (,FLOOR-OPEN <TELL " Where DAMP was, stone steps lead down.">)>
           <TELL "|
|
A poached spiral staircase climbs to the observatory, and the terrace is back
to the west." CR>)>>

;"UP from the ballroom: a joke, then the Observatory. A PER routine can talk
  and then return the room to move to."
<ROUTINE BALLROOM-UP-F ()
    <TELL "You climb the spiral staircase. It still goes down; it is now bolted
to a cliff and goes up." CR CR>
    ,OBSERVATORY>

<OBJECT BALLROOM-PLAQUE
    (DESC "brass plaque")
    (SYNONYM PLAQUE COLUMN COLUMNS)
    (ADJECTIVE BRASS)
    (IN BALLROOM)
    (FLAGS NDESCBIT READBIT)
    (TEXT "THIS BALLROOM IS BIGGER, it insists, by \"about a foot, if you
measure diagonally.\"")
    (ACTION FEATURE-F)>

;"TILES (plural) is the floor's word; TILE (singular) belongs to the five
  tiles, which are told apart by their adjectives: PRESS FOYER TILE."
<OBJECT BALLROOM-FLOOR
    (DESC "inlaid map")
    (SYNONYM FLOOR MAP INLAY TILES CRACK)
    (ADJECTIVE DANCE INLAID GOLD)
    (IN BALLROOM)
    (FLAGS NDESCBIT VOWELBIT)
    (TEXT "From down here you can't read VAUNT, only the places: FOYER, SHAFT,
STATION, OBSERVATORY and SHOP, each on a tile that gives very slightly
underfoot. The geography is wrong -- the Observatory appears to sit in the
middle of the Verdance -- but the tiles look as though they would press in any
order you like. The real order would be on a real map.")
    (ACTION FEATURE-F)>

<OBJECT BALLROOM-DECOR
    (DESC "chandeliers")
    (SYNONYM CHANDELIER STALAGMITES STALACTITES SKYLIGHT MEZZANINE)
    (IN BALLROOM)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Gold on everything, and everything in the wrong place. The
chandeliers were made to hang in a cellar. They do not care for the wind.")
    (ACTION FEATURE-F)>

;"The five tiles share TILE-F. Only ORDER (their place in the TRUE order,
  from the Survey) and LABEL differ."
<ROUTINE TILE-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A gold-inlaid tile the size of a doormat, marked "
                 <GETP ,PRSO ,P?LABEL> ". ">
           <COND (,FLOOR-OPEN <TELL "It has gone down with the rest of the floor." CR>)
                 (ELSE <TELL "It gives very slightly underfoot, like a button
that wants to be pressed." CR>)>)
          (<VERB? PUSH ATTACK> <PRESS-TILE ,PRSO>)
          (<VERB? TAKE PULL TURN>
           <TELL "The tiles are inlaid in the floor, which is the one part of the
ballroom that is the right way up." CR>)>>

<OBJECT TILE-FOYER (DESC "FOYER tile") (SYNONYM TILE) (ADJECTIVE FOYER)
    (IN BALLROOM) (ORDER 1) (LABEL "FOYER") (FLAGS NDESCBIT) (ACTION TILE-F)>
<OBJECT TILE-SHAFT (DESC "SHAFT tile") (SYNONYM TILE) (ADJECTIVE SHAFT)
    (IN BALLROOM) (ORDER 2) (LABEL "SHAFT") (FLAGS NDESCBIT) (ACTION TILE-F)>
<OBJECT TILE-STATION (DESC "STATION tile") (SYNONYM TILE) (ADJECTIVE STATION)
    (IN BALLROOM) (ORDER 3) (LABEL "STATION") (FLAGS NDESCBIT) (ACTION TILE-F)>
<OBJECT TILE-OBSERVATORY (DESC "OBSERVATORY tile") (SYNONYM TILE) (ADJECTIVE OBSERVATORY)
    (IN BALLROOM) (ORDER 4) (LABEL "OBSERVATORY") (FLAGS NDESCBIT VOWELBIT) (ACTION TILE-F)>
<OBJECT TILE-SHOP (DESC "SHOP tile") (SYNONYM TILE) (ADJECTIVE SHOP)
    (IN BALLROOM) (ORDER 5) (LABEL "SHOP") (FLAGS NDESCBIT) (ACTION TILE-F)>

;"--- 5. Vaunt's Private Study -------------------------------------------------------"

<ROOM STUDY
    (DESC "Vaunt's Private Study")
    (IN ROOMS)
    (LDESC "A glass-walled room at the lip of the mesa, full of plans.
Blueprints of the Ascendancy cover every surface, overlaid with Vaunt's
\"improvements\": a gondola across the Verdance (HOSTILE ACQUISITION -- PHASE
2), a tunnel under it (IN CASE PHASE 2 IS RUDE), a space elevator (MOON SOON). A
vision board holds blurry long-lens photographs of the far bank. The terrace is
south.")
    (SOUNDS "The glass ticking as the sun heats it.")
    (SOUTH TO TERRACE)
    (FLAGS LIGHTBIT)>

<OBJECT STUDY-PLANS
    (DESC "blueprints")
    (SYNONYM BLUEPRINT PLANS SKETCHES DESK)
    (ADJECTIVE OLDEST)
    (IN STUDY)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "The oldest blueprint, curling at the corners, has one word circled on
it in gold marker: THERE. The arrow beside it points across the river.")
    (ACTION FEATURE-F)>

<OBJECT VISION-BOARD
    (DESC "vision board")
    (SYNONYM BOARD PHOTOS PHOTOGRAPH PICTURES)
    (ADJECTIVE VISION)
    (IN STUDY)
    (FLAGS NDESCBIT)
    (TEXT "The photographs show grass. Vaunt's face has been pasted over the
grass and retouched to look more gilded.")
    (ACTION FEATURE-F)>

;"The Survey is the KEY to P3: it lists the five landmarks in the true
  order. Nothing in the code checks that you read it -- the knowledge is the
  gate, not a flag."
<OBJECT SURVEY
    (DESC "Mingus Survey, Annotated")
    (SYNONYM SURVEY MAP)
    (ADJECTIVE MINGUS ANNOTATED TRUE FOLDED THICK)
    (IN STUDY)
    (FDESC "On the desk lies a thick folded map: the Mingus Survey,
Annotated.")
    (FLAGS TAKEBIT READBIT)
    (TEXT "THE MINGUS SURVEY. The true map of the range, in a surveyor's plain
hand, with five landmarks numbered in order down the mountain:|
|
    1. The Foyer of Unprecedented Arrival (the summit gondola station; formerly
a loading dock)|
    2. The Shared Shaft (the deepest shaft in the mountain)|
    3. Pumping Station No. 2 (there is no No. 1)|
    4. The Observatory|
    5. The Gift Shop (largest room in the Ascendancy by floor area)|
|
The margins are Vaunt's. THEY WERE HERE FIRST. SO WHAT. -- WHY IS IT WARM
THERE. -- ONE DAY THEY WILL LOOK UP. Every eastern measurement has been rounded
up, and every altitude has been rounded up twice. The Verdance is drawn to its
true width, and the far bank is left blank.")>

;"--- 6. Lady Vaunt's Wing --------------------------------------------------------------
  The $SHRUG coin (needed for P6's collateral), the Spite Terminal (lore L3)
  and the shadowless NFT coats (a hint: the real coat casts a shadow)."

<ROOM WING
    (DESC "Lady Vaunt's Wing")
    (IN ROOMS)
    (LDESC "A wing bolted onto the sheer cliff face, reached by a cantilevered
walkway that sways a little. The token gate is set to \"Whatever\", so it is
open. Inside is a coat closet where dozens of coats are projected onto
mannequins in various poses, and a laptop sits open on a stand, still logged
in, a sticker on its lid reading SPITE TERMINAL. The walkway leads north, back
to the terrace.")
    (SOUNDS "The walkway creaking. The projectors, humming.")
    (NORTH TO TERRACE)
    (FLAGS LIGHTBIT)>

<OBJECT TOKEN-GATE
    (DESC "token gate")
    (SYNONYM GATE WALKWAY DIAL)
    (ADJECTIVE TOKEN CANTILEVERED)
    (IN WING)
    (FLAGS NDESCBIT)
    (TEXT "A gate with a coin slot and a dial. The dial is set to WHATEVER.")
    (ACTION FEATURE-F)>

;"Singular/plural again: COATS is the projections; the one real coat is
  somewhere else entirely, and answers to COAT."
<OBJECT NFT-COATS
    (DESC "projected coats")
    (SYNONYM COATS NFTS MANNEQUIN PROJECTIONS CLOSET POSES)
    (ADJECTIVE NFT PROJECTED COAT)
    (IN WING)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Dozens of the same coat, projected onto mannequins in various poses:
the coat ascending, the coat at dusk, the coat with laser eyes. You look
closely, the way you would at a suspicious commit. None of them casts a shadow.
The real one, whatever it is, is not here.")
    (ACTION FEATURE-F)>

;"LORE L3: reading the terminal awards the achievement, as the plaque does."
<OBJECT SPITE-TERMINAL
    (DESC "Spite Terminal")
    (SYNONYM TERMINAL LAPTOP SCREEN CHAT STICKER STAND)
    (ADJECTIVE SPITE)
    (IN WING)
    (FLAGS NDESCBIT READBIT)
    (ACTION SPITE-TERMINAL-F)>

<ROUTINE SPITE-TERMINAL-F ()
    <COND (<VERB? EXAMINE READ>
           <AWARD-POINTS 2 ,ACH?LORE-SPITE>
           <TELL "Lady Vaunt's laptop, still logged in to the $SHRUG dev chat. The
pinned message is from Esme herself:|
|
    stop comparing us to the old-siders. nobody on the old side is thinking
about you, max.|
|
Further down, from the night of the crash:|
|
    re: the coat. it's at the bottom somewhere. I'm not going down there.
verdlings.|
|
The last message is a ticket assigned to you." CR>)
          (<VERB? TAKE>
           <TELL "It is chained to its stand. Even Lady Vaunt has some
standards." CR>)>>

;"The tray is a surface (SURFACEBIT plus CONTBIT). Because it has an LDESC
  and no NDESCBIT, the library prints that line and then lists what is on
  it: 'On the airdrop tray is a $SHRUG coin.'"
<OBJECT AIRDROP-TRAY
    (DESC "airdrop tray")
    (SYNONYM TRAY)
    (ADJECTIVE AIRDROP GILT)
    (IN WING)
    (LDESC "A gilt airdrop tray stands by the door, labelled AIRDROP. TAKE
ONE.")
    (CAPACITY 10)
    (FLAGS CONTBIT SURFACEBIT OPENBIT VOWELBIT)
    (TEXT "A gilt tray labelled AIRDROP. TAKE ONE.")
    (ACTION FEATURE-F)>

<OBJECT SHRUG-COIN
    (DESC "$SHRUG coin")
    (SYNONYM COIN TOKEN)
    (ADJECTIVE SHRUG)
    (IN AIRDROP-TRAY)
    (FLAGS TAKEBIT)
    (TEXT "A coin stamped with a coat silhouette that cycles through colourways
as you tilt it. On the back: WHATEVER. DYOR. It is, surprisingly, solvent.")>

;"--- 7. The Observatory ------------------------------------------------------------
  P2 lives here: TURN TELESCOPE flips TELESCOPE-DOWN (so do SWING, PUSH and
  MOVE, and POINT/AIM/TURN TELESCOPE DOWN only ever point it down); LOOK
  THROUGH TELESCOPE
  (a SYNTAX line of our own, section 8) scores only when it points down. The
  coat is not hard-gated on this: it is knowledge, plus five points for
  looking down."

<ROOM OBSERVATORY
    (DESC "The Observatory")
    (IN ROOMS)
    (LDESC "A dome at the top of the Pavilion with twelve telescopes in a ring,
every one aimed across the Verdance at the far bank. None of them has ever seen
anything. A thirteenth telescope, older and smaller, stands by itself at the
rail, its clamp loose. The spiral staircase goes back down.")
    (SOUNDS "The dome's motor, trying to turn and thinking better of it.")
    (DOWN TO BALLROOM)
    (FLAGS LIGHTBIT)>

;"The singular/plural trick, part two. In a z5 story the dictionary keeps
  only the first nine letters of a word, so TELESCOPE and TELESCOPES are the
  SAME dictionary word and SYNONYM alone can't tell them apart. Both
  telescopes answer to it, and their shared GENERIC routine settles the tie
  by looking at the word the player actually typed. LEXBUF holds 4 bytes
  per word, and byte 4*N is the typed length of word N."
<ROUTINE TELESCOPE-GENERIC-F (TBL)
    <DO (I 1 ,P-LEN)
        <COND (<==? <GETWORD? .I> ,W?TELESCOPE>
               <COND (<G? <GETB ,LEXBUF <* 4 .I>> 9> <RETURN ,TELESCOPES>)
                     (ELSE <RETURN ,TELESCOPE>)>)>>
    <RFALSE>>

<OBJECT TELESCOPES
    (DESC "twelve telescopes")
    (SYNONYM TELESCOPE)
    (ADJECTIVE TWELVE RING OTHER)
    (IN OBSERVATORY)
    (FLAGS NDESCBIT PLURALBIT)
    (GENERIC TELESCOPE-GENERIC-F)
    (TEXT "Twelve brass telescopes, all aimed across the river at the same patch
of grass. Their lens caps have never been taken off.")
    (ACTION TELESCOPES-F)>

;"The twelve welded telescopes: a red herring next to the thirteenth. Every
  way of using them is refused, so the loose one stands out."
<ROUTINE TELESCOPES-F ()
    <COND (<VERB? LOOK-THROUGH SEARCH TURN PUSH PULL POINT>
           <TELL "The twelve are welded in place, all looking across. It is the
Ascendancy's one unshakeable position." CR>)
          (<VERB? TAKE> <TELL "They are welded to the floor." CR>)>>

<OBJECT TELESCOPE
    (DESC "thirteenth telescope")
    (SYNONYM TELESCOPE CLAMP MOUNT)
    (ADJECTIVE THIRTEENTH OLD OLDER SMALL SMALLER LOOSE SWIVEL)
    (IN OBSERVATORY)
    (FLAGS NDESCBIT)
    (GENERIC TELESCOPE-GENERIC-F)
    (ACTION TELESCOPE-F)>

;"P2: the thirteenth telescope. Pointed across the river (the start) it shows
  the far bank; once TURN TELESCOPE (or POINT IT DOWN) sets TELESCOPE-DOWN,
  LOOK THROUGH it shows the gondola car at the foot of the range: the clue
  for digging on the Runout."
<ROUTINE TELESCOPE-F ()
    <COND (<VERB? EXAMINE>
           <TELL "An older, smaller telescope on a swivel mount, its clamp loose.
It is pointing ">
           <COND (,TELESCOPE-DOWN <TELL "straight down, at the foot of the range." CR>)
                 (ELSE <TELL "across the river, like the others." CR>)>)
          (<VERB? LOOK-THROUGH SEARCH>
           <COND (<NOT ,TELESCOPE-DOWN>
                  <TELL "You put your eye to the thirteenth telescope. The far
bank swims into focus: grass, real grass, and cottonwoods, and a few low
chimney vents in the green giving off a steady, warm, unremarkable glow. It
never flickers. You watch it for a while and it goes on not flickering." CR>)
                 (ELSE
                  <AWARD-POINTS 5 ,ACH?TELESCOPE>
                  <TELL "You put your eye to the telescope. Straight down, the
foot of the range swims into focus: the Runout, a fan of everything the Ascendancy
ever dropped, alive with small mud-coloured figures. And there, by the upturned
gondola car, lies a long coat. It casts a shadow. Nothing else down there does
anything so honest." CR>)>)
          ;"POINT is the game's own action (section 8): POINT TELESCOPE DOWN,
            AIM TELESCOPE DOWN, TURN TELESCOPE DOWN."
          (<VERB? POINT>
           <COND (,TELESCOPE-DOWN
                  <TELL "It is already pointing straight down, at the foot of
the range." CR>)
                 (ELSE
                  <SETG TELESCOPE-DOWN T>
                  <TELL "You loosen the clamp and swing the telescope away from
the far bank, straight down. It is the first time anything in this room has
looked down." CR>)>)
          (<VERB? TURN PUSH PULL>
           <SETG TELESCOPE-DOWN <NOT ,TELESCOPE-DOWN>>
           <COND (,TELESCOPE-DOWN
                  <TELL "You loosen the clamp and swing the telescope away from
the far bank, straight down. It is the first time anything in this room has
looked down." CR>)
                 (ELSE <TELL "You swing the telescope back across the river,
like the others." CR>)>)
          (<VERB? TAKE>
           <TELL "It is bolted to its mount by the one bolt in the room that
isn't loose." CR>)>>


;"============================================================================
  6. ACT TWO: THE BLOCKCHAIN CATACOMBS  --  inside the mountain
 ----------------------------------------------------------------------------
  Rooms: Root Cellar, The Mempool, Validator Pit, Break Room, the Shared
  Shaft (optional), The Archive, Cold Wallet Cavern, Windward Ledge.
  Puzzles P4 (KYC), P5 (contract), P6 (union), P7 (cold wallet), P8 (the
  belted verdling). Lore: Mrs. Thrumble, the Genesis Block. The act banner
  is printed by the Root Cellar's M-ENTER.
 ============================================================================"

;"--- 9. Root Cellar ----------------------------------------------------------------
  P4 lives here. Two flags, KYC-ADDRESS and KYC-CAPTCHA, can be set in either
  order; KYC-CHECK (section 4) runs after each and hands over the badge once
  both are true. The down exit (the service lift) checks for the badge, so
  'has the player passed KYC?' is just 'is the badge carried?'."

<ROOM ROOT-CELLAR
    (DESC "Root Cellar")
    (IN ROOMS)
    (SOUNDS "Nothing at all, which on this mountain is a luxury.")
    (UP TO BALLROOM)
    (DOWN PER CELLAR-DOWN-F)
    (FLAGS LIGHTBIT)
    (ACTION ROOT-CELLAR-F)>

<ROUTINE ROOT-CELLAR-F (RARG)
    <COND (<==? .RARG ,M-ENTER> <BEGIN-ACT 2>)
          (<==? .RARG ,M-LOOK>
           <TELL "A low stone cellar under the ballroom, cool and quiet, with
shelves of onions and a single bare bulb. It is the only part of the estate
Vaunt never shows guests, and the only part he secretly likes. A service lift
waits in the far wall, its gate guarded by a KYC scanner. The steps lead back up
to the ballroom">
           <COND (<IN? ,WALLET-BADGE ,WINNER> <TELL ". The lift's gate stands open." CR>)
                 (ELSE <TELL "." CR>)>)>>

;"P4: the Root Cellar's DOWN exit, the service lift. It only runs once you
  hold the wallet badge (the KYC scanner's reward); then it carries you down
  to the Mempool."
<ROUTINE CELLAR-DOWN-F ()
    <COND (<NOT <IN? ,WALLET-BADGE ,WINNER>>
           <TELL "The service lift's gate stays shut. The scanner's screen reads:
VERIFIED WALLET BADGE REQUIRED. FORM 77-Omega/b (SCHEDULE: WHATEVER)." CR>
           <RFALSE>)>
    <TELL "The service lift scans your badge, sighs, and drops into the rock.
The bulb above the cellar shrinks to a star and goes out. The mine is dark. The
mine is cold. The mine is \"decentralized\", which means nobody fixes the
lights." CR CR>
    ,MEMPOOL>

<OBJECT CELLAR-SHELVES
    (DESC "shelves of onions")
    (SYNONYM SHELVES SHELF ONIONS ONION BULB)
    (IN ROOT-CELLAR)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Onions, in rows. It is the most honest room in the Pavilion.")
    (ACTION FEATURE-F)>

<OBJECT SERVICE-LIFT
    (DESC "service lift")
    (SYNONYM LIFT GATE ELEVATOR)
    (ADJECTIVE SERVICE STEEL)
    (IN ROOT-CELLAR)
    (FLAGS NDESCBIT)
    (TEXT "A steel lift with a gate. A sticker reads: ALL RIDERS MUST BE
VERIFIED.")
    (ACTION SERVICE-LIFT-F)>

;"DO-WALK runs a full movement action, exactly as if DOWN had been typed."
<ROUTINE SERVICE-LIFT-F ()
    <COND (<VERB? ENTER> <DO-WALK ,P?DOWN>)
          (ELSE <FEATURE-F>)>>

;"P4. The scanner is a container. In PUT NOTICE IN SCANNER (or ON SCANNER)
  the scanner is PRSI, and zillib calls PRSI's ACTION before PRSO's, so the
  scanner decides what it accepts before the library tries to put anything
  in it. Things you may never part with (the badge, the pike: anything with
  a KEEP property) are left alone here, so their own refusal answers."
<OBJECT KYC-SCANNER
    (DESC "KYC scanner")
    (SYNONYM SCANNER SCREEN CAPTCHA GRID SQUARES FORM)
    (ADJECTIVE KYC)
    (IN ROOT-CELLAR)
    (CAPACITY 5)
    (FLAGS NDESCBIT CONTBIT OPENBIT READBIT)
    (ACTION KYC-SCANNER-F)>

<ROUTINE KYC-SCANNER-F ()
    <COND (<VERB? EXAMINE READ>
           <TELL "FORM 77-Omega/b (SCHEDULE: WHATEVER). The scanner wants two
things.|
|
    PROOF OF ADDRESS: ">
           <COND (,KYC-ADDRESS <TELL "RECEIVED">) (ELSE <TELL "INSERT DOCUMENT">)>
           <TELL "|
    CAPTCHA: ">
           <COND (,KYC-CAPTCHA <TELL "PASSED" CR>)
                 (ELSE
                  <TELL "Select all squares containing murklings.|
|
The CAPTCHA is a grid of nine photographs, all taken inside the mine shafts.
Every one is pitch black. Any of them might contain murklings. You can SELECT
whatever you like." CR>)>)
          (<AND <VERB? PUT-IN PUT-ON> <PRSI? ,KYC-SCANNER>
                <NOT <GETP ,PRSO ,P?KEEP>>>
           <COND (<NOT <PRSO? ,NOTICE>>
                  <TELL "The scanner reads it, beeps sadly, and spits it out. NOT
AN ADDRESS." CR>)
                 (,KYC-ADDRESS <TELL "Your address is already on file. Forever." CR>)
                 (ELSE
                  <SETG KYC-ADDRESS T>
                  ;"The notice is eaten (REMOVE takes it out of the world).
                    The doorbell always has another, so this can never
                    become a dead end."
                  <REMOVE ,NOTICE>
                  <TELL "The scanner swallows the foreclosure notice, reads the
address, and approves it with a little fanfare. PROOF OF ADDRESS: RECEIVED.
(Far above, the wind delivers another notice to the doorbell.)" CR>
                  <KYC-CHECK>)>
           <RTRUE>)
          (ELSE <FEATURE-F>)>>

;"The badge is the lift's key, so it must never be lost: KEEP-F (section 4)
  refuses every action that could separate you from it, and DROP is refused
  here too."
<OBJECT WALLET-BADGE
    (DESC "Verified Wallet Badge")
    (SYNONYM BADGE)
    (ADJECTIVE VERIFIED WALLET SOULBOUND KYC)
    (FLAGS TAKEBIT)
    (KEEP "It's soulbound. It will not leave you. It has said so in writing.")
    (TEXT "A Verified Wallet Badge: soulbound, non-transferable, revocable at any
time for any reason. It has your face on it. You don't remember it taking a
picture.")
    (ACTION WALLET-BADGE-F)>

<ROUTINE WALLET-BADGE-F ()
    <COND (<AND <VERB? DROP> <PRSO? ,WALLET-BADGE>>
           <TELL <GETP ,WALLET-BADGE ,P?KEEP> CR>)
          (<PRSO? ,WALLET-BADGE> <KEEP-F>)>>

;"--- 10. The Mempool -------------------------------------------------------------
  The Act Two hub. SEARCH TRANSACTIONS gives the punch card (P5), the
  PENDING tray holds the charter (P6), and the north exit is the consensus
  door: a PER routine that counts attestations with ATTESTATIONS and opens
  at two."

<ROOM MEMPOOL
    (DESC "The Mempool")
    (IN ROOMS)
    (LDESC "A cavern drifted knee-deep with pending transactions: paper slips,
millions of them, each waiting to be confirmed by somebody who has gone home.
Fluorescent lights flicker in patterns that might be Morse code but are just
electrical failure. To the north is a heavy door with three slots, marked
CONTRACT, UNION and VALIDATOR KEY. The Validator Pit is east, a break room
south, and the lift goes back up.")
    (SOUNDS "Paper settling. Somewhere, a transaction gives up.")
    (UP PER MEMPOOL-UP-F)
    (EAST TO VALIDATOR-PIT)
    (SOUTH TO BREAK-ROOM)
    (NORTH PER CONSENSUS-F)
    (FLAGS LIGHTBIT)>

;"UP from the Mempool: the lift back to the cellar."
<ROUTINE MEMPOOL-UP-F ()
    <TELL "The lift hauls you back up into the cellar's onion-scented quiet." CR CR>
    ,ROOT-CELLAR>

;"P5: the Mempool's NORTH exit is the consensus door. The AUX local N is
  set as the routine starts, from ATTESTATIONS (what you carry that counts).
  Two or more and the door opens onto the Archive; fewer and it says how
  many you have."
<ROUTINE CONSENSUS-F ("AUX" (N <ATTESTATIONS>))
    <COND (<G=? .N 2>
           <TELL "The door reads what you carry -- the debugged contract, the
union's endorsement -- and its slots light up one after another. TWO
ATTESTATIONS. CONSENSUS REACHED. It swings open, and you climb through." CR CR>
           ,ARCHIVE)
          (ELSE
           <TELL "The door's slots stay dark. A panel above them reads: TWO
ATTESTATIONS REQUIRED. YOU HAVE " N .N "." CR>
           <RFALSE>)>>

;"P5, part one: SEARCH (or LOOK IN) the drift. CARD-FOUND makes it a
  one-time find. TRANSACTION also matches TRANSACTIONS: both keep the same
  first nine letters."
<OBJECT TRANSACTIONS
    (DESC "pending transactions")
    (SYNONYM TRANSACTION SLIPS SLIP DRIFTS DRIFT)
    (ADJECTIVE PENDING PAPER)
    (IN MEMPOOL)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Millions of unconfirmed transactions. Most of them are Vaunt paying
himself.")
    (ACTION TRANSACTIONS-F)>

<ROUTINE TRANSACTIONS-F ()
    <COND (<VERB? SEARCH LOOK-THROUGH DIG>
           <COND (,CARD-FOUND
                  <TELL "More of the same: pending, pending, pending." CR>)
                 (ELSE
                  <SETG CARD-FOUND T>
                  <MOVE ,PUNCH-CARD ,WINNER>
                  <TELL "You dig through the drift. Pending, pending, pending --
and then something stiffer: a punch card, the old-fashioned kind, punched in
neat rows. Somebody's patch, never submitted. You pocket it." CR>)>)
          (<VERB? TAKE>
           <TELL "You'd need a much bigger pocket, and a much smaller
blockchain." CR>)>>

<OBJECT CONSENSUS-DOOR
    (DESC "consensus door")
    (SYNONYM DOOR SLOTS)
    (ADJECTIVE CONSENSUS HEAVY STEEL)
    (IN MEMPOOL)
    (FLAGS NDESCBIT)
    (ACTION CONSENSUS-DOOR-F)>

;"The door as an object: EXAMINE shows the live count, and OPEN or ENTER
  means walking north (CONSENSUS-F decides)."
<ROUTINE CONSENSUS-DOOR-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A heavy door of riveted steel with three slots, marked CONTRACT,
UNION and VALIDATOR KEY. The last slot is dusty: whoever held that key is long
gone. A panel reads TWO ATTESTATIONS REQUIRED. YOU HAVE " N <ATTESTATIONS>
                 "." CR>)
          (<VERB? OPEN ENTER> <DO-WALK ,P?NORTH>)
          (ELSE <FEATURE-F>)>>

;"Like the airdrop tray: an LDESC, and the library lists what lies on it."
<OBJECT PENDING-TRAY
    (DESC "PENDING tray")
    (SYNONYM TRAY)
    (ADJECTIVE PENDING WIRE)
    (IN MEMPOOL)
    (LDESC "A wire tray marked PENDING stands by the lift.")
    (CAPACITY 10)
    (FLAGS CONTBIT SURFACEBIT OPENBIT)
    (TEXT "A wire tray marked PENDING. It has been pending for a while.")
    (ACTION FEATURE-F)>

;"P6. SIGN CHARTER is caught in the charter's own ACTION and only works where
  the ink pad is (the Break Room). A ZIL object's DESC is fixed, so the
  charter's state shows in its description instead of its name."
<OBJECT UNION-CHARTER
    (DESC "union charter")
    (SYNONYM CHARTER)
    (ADJECTIVE BLANK SIGNED UNION)
    (IN PENDING-TRAY)
    (FLAGS TAKEBIT READBIT)
    (ACTION UNION-CHARTER-F)>

<ROUTINE UNION-CHARTER-F ()
    <COND (<VERB? EXAMINE READ>
           <TELL "MURKLING MINERS' LOCAL 404. A CHARTER OF ENDORSEMENT. The demands
are listed in fine print: darkness preservation, dental, hazard pay for
rockfalls, and parity with \"certain other workforces in the area, who work in
the dark at a constant fifty-five degrees.\"">
           <COND (,CHARTER-SIGNED <TELL " It bears your name, in murkling ink." CR>)
                 (ELSE <TELL " The line for a signature is blank." CR>)>)
          (<VERB? SIGN>
           <COND (,CHARTER-SIGNED <TELL "You've already signed it." CR>)
                 (<NOT <IN? ,INK-PAD ,HERE>>
                  <TELL "You have nothing to sign it with. The murklings sign
everything in their own ink." CR>)
                 (ELSE
                  <SETG CHARTER-SIGNED T>
                  <TELL "You press your thumb to the murkling ink pad and sign the
charter. The nearest murklings bang their hard hats together in approval.
\"Solidarity,\" one of them says." CR>)>)>>

<OBJECT PUNCH-CARD
    (DESC "punch card")
    (SYNONYM CARD PATCH)
    (ADJECTIVE PUNCH PUNCHED)
    (FLAGS TAKEBIT READBIT)
    (TEXT "A punch card, punched in neat rows. Holding it up to the light, you
can read the patch:|
|
    require(balance > 0, \"ALREADY RUGGED\");")>

;"--- 11. Validator Pit --------------------------------------------------------------
  P5, part two. PUT CARD IN SLOT reaches the slot's ACTION first (the slot is
  PRSI), and the slot does the swap: the card is removed and the debugged
  contract appears."

<ROOM VALIDATOR-PIT
    (DESC "Validator Pit")
    (IN ROOMS)
    (LDESC "A pit of humming servers around a great brass contract engine, its
screen frozen on an error. A punch-card slot gapes in its side. A motivational
banner across the pit reads: DARKNESS IS A LEGACY TECHNOLOGY. A murkling has
added, in chalk underneath: \"THEN WHY IS IT SO NICE.\" The mempool is back to
the west.")
    (SOUNDS "Fans. Thousands of them, all running, none of them helping.")
    (WEST TO MEMPOOL)
    (FLAGS LIGHTBIT)>

<OBJECT PIT-BANNER
    (DESC "banner")
    (SYNONYM BANNER CHALK SERVERS FANS)
    (ADJECTIVE MOTIVATIONAL)
    (IN VALIDATOR-PIT)
    (FLAGS NDESCBIT READBIT)
    (TEXT "DARKNESS IS A LEGACY TECHNOLOGY. Underneath, in chalk: \"THEN WHY IS IT
SO NICE.\"")
    (ACTION FEATURE-F)>

<OBJECT CONTRACT-ENGINE
    (DESC "contract engine")
    (SYNONYM ENGINE ERROR CODE)
    (ADJECTIVE BRASS CONTRACT GREAT)
    (IN VALIDATOR-PIT)
    (FLAGS NDESCBIT READBIT)
    (ACTION CONTRACT-ENGINE-F)>

;"P5: reading the contract engine shows the infinite loop the debugged
  contract will fix."
<ROUTINE CONTRACT-ENGINE-F ()
    <COND (<VERB? EXAMINE READ>
           <TELL "The screen shows a smart contract, frozen mid-run:|
|
    function rugPull() public {|
        require(msg.sender == vaunt, \"UNAUTHORIZED\");|
        for (uint i = 0; i < holders.length; i++) {|
            // TODO: add exit condition|
            drain(holders[i]);|
        }|
    }|
    // ERROR: INFINITE LOOP DETECTED. ALL HOLDERS DRAINED FOREVER.|
|
">
           <COND (,CONTRACT-FIXED <TELL "It has since been fixed." CR>)
                 (ELSE <TELL "A punch-card slot in the engine's side is waiting
for a patch." CR>)>)
          (ELSE <FEATURE-F>)>>

<OBJECT CARD-SLOT
    (DESC "punch-card slot")
    (SYNONYM SLOT)
    (ADJECTIVE PUNCH-CARD CARD)
    (IN VALIDATOR-PIT)
    (CAPACITY 5)
    (FLAGS NDESCBIT CONTBIT OPENBIT)
    (TEXT "A slot the width of a punch card.")
    (ACTION CARD-SLOT-F)>

;"As at the scanner, anything with a KEEP property is left to refuse for
  itself."
<ROUTINE CARD-SLOT-F ()
    <COND (<AND <VERB? PUT-IN> <PRSI? ,CARD-SLOT> <NOT <GETP ,PRSO ,P?KEEP>>>
           <COND (<NOT <PRSO? ,PUNCH-CARD>>
                  <TELL "It is a punch-card slot. That is not a punch card." CR>)
                 (ELSE
                  <REMOVE ,PUNCH-CARD>
                  <MOVE ,DEBUGGED-CONTRACT ,WINNER>
                  <SETG CONTRACT-FIXED T>
                  <AWARD-POINTS 5 ,ACH?CONTRACT>
                  <TELL "The engine swallows the card with a clatter. The frozen
screen scrolls, recompiles and settles on a new line:|
|
    require(balance > 0, \"ALREADY RUGGED\");|
|
COMPILED. The engine prints you a receipt: the debugged contract. You have made
the rug pull more efficient. This is called \"optimization.\"" CR>)>)
          (ELSE <FEATURE-F>)>>

<OBJECT DEBUGGED-CONTRACT
    (DESC "debugged contract")
    (SYNONYM CONTRACT RECEIPT)
    (ADJECTIVE DEBUGGED PRINTED)
    (FLAGS TAKEBIT READBIT)
    (TEXT "A printed receipt: CONTRACT rugPull() COMPILED. EXIT CONDITION:
ALREADY RUGGED. It counts as an attestation, somehow.")>

;"--- 12. Break Room ------------------------------------------------------------------
  P6 lives here (sign, then give to the steward) and so does the hard hat for
  lore L4 (Mrs. Thrumble, one floor down)."

<ROOM BREAK-ROOM
    (DESC "Break Room")
    (IN ROOMS)
    (LDESC "The headquarters of Murkling Miners' Local 404: folding chairs, a
kettle, and two whiteboards. One reads DAYS SINCE LAST RUG PULL: 0. The other
reads DAYS SINCE MANAGEMENT INSTALLED MORE LIGHTS: 0. Murklings in hard hats sit
around drinking something hot in the half-dark. There is an ink pad on the
table and a rack of hard hats by the door. The mempool is north, and a shaft
goes down.")
    (SOUNDS "Murklings, muttering about the lights.")
    (NORTH TO MEMPOOL)
    (DOWN TO SHARED-SHAFT)
    (FLAGS LIGHTBIT)>

<OBJECT WHITEBOARDS
    (DESC "whiteboards")
    (SYNONYM WHITEBOARD BOARDS CHAIRS KETTLE TABLE)
    (IN BREAK-ROOM)
    (FLAGS NDESCBIT PLURALBIT READBIT)
    (TEXT "DAYS SINCE LAST RUG PULL: 0. DAYS SINCE MANAGEMENT INSTALLED MORE
LIGHTS: 0.")
    (ACTION FEATURE-F)>

<OBJECT MURKLINGS
    (DESC "murklings")
    (SYNONYM MURKLINGS MURKLING MINERS WORKERS)
    (IN BREAK-ROOM)
    (FLAGS NDESCBIT PLURALBIT PERSONBIT)
    (TEXT "Small, pale, big-eyed creatures in hard hats and safety vests, which
is ironic, given the darkness. They were born in these shafts and have spent
their whole lives missing a dark they never had.")
    (ACTION MURKLINGS-F)>

;"The murklings send all talk to the steward. ARG is set when zillib calls
  a person's ACTION because they are being given an order (MURKLINGS, JUMP),
  so an order gets the same answer as ASK and TELL."
<ROUTINE MURKLINGS-F ("OPT" ARG)
    <COND (<OR .ARG <VERB? ASK-ABOUT TELL-ABOUT>>
           <TELL "\"Talk to the steward,\" they say, all at once." CR>)
          (<VERB? EXAMINE> <RFALSE>)
          (ELSE <TELL "They look at the steward." CR>)>>

<OBJECT INK-PAD
    (DESC "ink pad")
    (SYNONYM PAD INKPAD INK)
    (ADJECTIVE INK MURKLING)
    (IN BREAK-ROOM)
    (FLAGS NDESCBIT VOWELBIT)
    (TEXT "A pad of murkling ink, dark as the inside of a mine. Any murkling
will let you use it. Solidarity.")
    (ACTION INK-PAD-F)>

;"P6: the ink pad stays put; you sign the charter with it where it is."
<ROUTINE INK-PAD-F ()
    <COND (<VERB? TAKE> <TELL "\"That stays here,\" says the steward. \"You sign
here.\"" CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT HAT-RACK
    (DESC "rack of hard hats")
    (SYNONYM RACK HATS HELMETS HOOKS)
    (IN BREAK-ROOM)
    (FLAGS NDESCBIT)
    (TEXT "A rack of hard hats with one spare left on the end.")
    (ACTION FEATURE-F)>

<OBJECT SPARE-HAT
    (DESC "hard hat")
    (SYNONYM HAT HELMET)
    (ADJECTIVE SPARE HARD YELLOW DENTED)
    (IN BREAK-ROOM)
    (FDESC "One spare hard hat hangs on the end of the rack.")
    (FLAGS TAKEBIT WEARBIT)
    (TEXT "A dented yellow hard hat. Its inside is stencilled VAUNT MINING CO. --
PROPERTY OF.")>

;"P6, part two. GIVE CHARTER TO STEWARD reaches his ACTION with PRSO = the
  charter and PRSI = the steward. He checks, in order: is it signed? are you
  carrying the $SHRUG coin? Only then does he swap the charter for the
  endorsement. The coin is handed straight back, so it is never used up.
  Anything that is not the charter falls through to PERSON-F."
<OBJECT STEWARD
    (DESC "Steward Nubbin")
    (SYNONYM STEWARD NUBBIN LEADER)
    (ADJECTIVE SHOP UNION)
    (IN BREAK-ROOM)
    (FLAGS PERSONBIT NARTICLEBIT)
    (LDESC "Steward Nubbin, shop steward of Local 404, sits at the head of the
table with his arms folded.")
    (TEXT "Steward Nubbin of Local 404: a murkling of great dignity and a hard hat
with a little gold star on it, which he insists is not a light.")
    (NO-ANSWER "\"That's not on the agenda,\" says Steward Nubbin.")
    (NO-INTEREST "\"That's not an endorsement matter,\" says Steward Nubbin.")
    (ACTION STEWARD-F)>

<ROUTINE STEWARD-F ("OPT" ARG)
    <COND (.ARG <PERSON-F .ARG>)
          (<AND <VERB? GIVE SHOW> <PRSI? ,STEWARD> <PRSO? ,UNION-CHARTER>>
           <COND (<NOT ,CHARTER-SIGNED>
                  <TELL "\"It's blank,\" says the steward. \"A charter means
nothing until somebody signs it. Ink's on the table.\"" CR>)
                 (<NOT <IN? ,SHRUG-COIN ,WINNER>>
                  <TELL "Steward Nubbin looks from the charter to you.
\"Collateral. How do we know you're not one of his?\"" CR>)
                 (ELSE
                  <REMOVE ,UNION-CHARTER>
                  <MOVE ,ENDORSEMENT ,WINNER>
                  <AWARD-POINTS 5 ,ACH?UNION>
                  <TELL "Steward Nubbin takes the charter and reads every word of
it, twice. Then he holds out a hand. \"Collateral.\" You give him the $SHRUG
coin. He bites it, considers, and hands it back. \"Hers,\" he says. \"Not his.
Good.\"|
|
He stamps the charter, files it, and gives you a card in return: a union
endorsement. \"Local 404 endorses you,\" he says. Around the table, the
murklings bang their hard hats together." CR>)>)
          (<NOT <VERB? ASK-ABOUT>> <PERSON-F>)
          (<ABOUT? ,W?UNION ,W?LOCAL ,W?DEMANDS ,W?CHARTER ,W?STRIKE>
           <TELL "\"Darkness preservation. Dental. Hazard pay. Parity with certain
other workforces in the area.\" He will not say which. Everyone knows which." CR>)
          (<ABOUT? ,W?LIGHTS ,W?LIGHT ,W?DARK ,W?DARKNESS>
           <TELL "\"Light is an asset, they say. Light is not a safety
standard.\"" CR>)
          (<ABOUT? ,W?VAUNT ,W?MAXIMUS ,W?MANAGEMENT>
           <TELL "\"Management has left the building. The building has not
noticed.\"" CR>)
          (<ABOUT? ,W?THRUMBLE ,W?SHAFT>
           <TELL "\"Down the shaft. Warm air. Don't talk to her.\" He pauses.
\"She's nice, though.\"" CR>)
          (ELSE <PERSON-F>)>>

<OBJECT ENDORSEMENT
    (DESC "union endorsement")
    (SYNONYM ENDORSEMENT STAMP)
    (ADJECTIVE UNION)
    (FLAGS TAKEBIT READBIT)
    (TEXT "A card stamped with the seal of Murkling Miners' Local 404: LOCAL 404
ENDORSES THE BEARER. It counts as an attestation.")>

;"--- 13. The Shared Shaft (optional: Mrs. Thrumble) --------------------------------
  Optional (lore L4). The old side's only voice, behind bars. Nothing here is
  needed to win."

<ROOM SHARED-SHAFT
    (DESC "The Shared Shaft")
    (IN ROOMS)
    (LDESC "The deepest shaft in the Mingus range ends here, below the valley
floor and below the Verdance, at an iron grate. The near side is wired with RGB
lighting and a sign: VAUNT DEEP-CORE SHAFT -- EST. LAST YEAR. On the far side is
a tunnel of old fitted stone, a ladder, and a lamp on a hook that has clearly
hung there for a very long time. The air coming through the grate is warm. The
break room is back up.")
    (SOUNDS "The warm air, sighing through the bars. A murkling behind you
whispers: \"Don't talk to her. She doesn't even know we're here.\" A beat. \"She
does know. She's pretending. That's worse.\" Another beat. \"It's so warm,
though.\"")
    (UP TO BREAK-ROOM)
    (FLAGS LIGHTBIT)>

<OBJECT GRATE
    (DESC "iron grate")
    (SYNONYM GRATE BARS LIGHTING SIGN STONE TUNNEL LADDER)
    (ADJECTIVE IRON RGB FAR)
    (IN SHARED-SHAFT)
    (FLAGS NDESCBIT VOWELBIT)
    (TEXT "The grate is old iron, fitted into older stone. Your side of it is
purple, then green, then purple. Her side is lit by the lamp, and stays the same
colour.")
    (ACTION GRATE-F)>

;"The grate between the shafts never opens: the far side is Mrs. Thrumble's."
<ROUTINE GRATE-F ()
    <COND (<VERB? ENTER CLIMB OPEN>
           <TELL "The grate does not open from this side. It is not that kind of
grate." CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT SHAFT-LAMP
    (DESC "lamp on its hook")
    (SYNONYM LAMP HOOK)
    (ADJECTIVE PLAIN)
    (IN SHARED-SHAFT)
    (FLAGS NDESCBIT)
    (TEXT "A plain lamp on a hook, burning steadily on the far side of the
grate. It has been there a very long time.")
    (ACTION SHAFT-LAMP-F)>

;"The lamp beyond the grate is out of reach, so TAKE gets a reason."
<ROUTINE SHAFT-LAMP-F ()
    <COND (<VERB? TAKE>
           <TELL "It's on the far side of the grate, and anyway, it's on its
hook." CR>)
          (ELSE <FEATURE-F>)>>

;"LORE L4: GIVE HARD HAT TO THRUMBLE swaps the hat for the claim ticket. ABOUT?
  (section 4) matches a word anywhere in the topic, so ASK THRUMBLE ABOUT THE
  MOUNTAIN works too."
<OBJECT THRUMBLE
    (DESC "Mrs. Thrumble")
    (SYNONYM THRUMBLE CLERK WOMAN LADY CRATE)
    (ADJECTIVE MRS)
    (IN SHARED-SHAFT)
    (FLAGS PERSONBIT FEMALEBIT NARTICLEBIT)
    (LDESC "Mrs. Thrumble, Clerk of Lost Property, is behind the bars, sorting a
crate of fallen hard hats.")
    (TEXT "A neat woman in a cardigan, on the far side of the bars, sorting a
crate of fallen hard hats with a ledger at her elbow. She is polite, efficient
and kind. She has never once looked up.")
    (NO-ANSWER "\"I'm afraid I couldn't say, dear.\" She goes back to her
ledger.")
    (NO-INTEREST "\"That isn't lost, dear,\" says Mrs. Thrumble. \"You're
holding it.\"")
    (ACTION THRUMBLE-F)>

<ROUTINE THRUMBLE-F ("OPT" ARG)
    <COND (.ARG <PERSON-F .ARG>)
          (<AND <VERB? GIVE> <PRSI? ,THRUMBLE> <PRSO? ,SPARE-HAT>>
           <REMOVE ,SPARE-HAT>
           <MOVE ,CLAIM-TICKET ,WINNER>
           <AWARD-POINTS 2 ,ACH?LORE-CLERK>
           <TELL "You pass the hard hat through the bars. Mrs. Thrumble turns it
over, notes the dent, and logs it in her ledger without a word about where it
came from. Then she tears off a claim ticket and hands it back through the
grate. \"Lost property. Signed for. Thank you, dear.\"" CR>)
          (<AND <VERB? GIVE> <PRSI? ,THRUMBLE> <PRSO? ,SHRUG-COIN>>
           <TELL "\"That appears to be a washer. Would you like to file it as
lost?\"" CR>)
          (<NOT <VERB? ASK-ABOUT>> <PERSON-F>)
          (<ABOUT? ,W?MINGUS ,W?EMPIRE ,W?ASCENDANCY ,W?PAVILION ,W?PALACE>
           <TELL "\"I'm sorry, I don't know what you're referring to.\"" CR>)
          (<ABOUT? ,W?VAUNT ,W?MAXIMUS ,W?LORD>
           <TELL "\"We had a gentleman of that name in a ticket queue once. He was
asked to leave. Is that all?\"" CR>)
          (<ABOUT? ,W?SHAFT ,W?TUNNEL ,W?HATS ,W?HAT ,W?DRAINAGE>
           <TELL "\"It's our old drainage tunnel. Something keeps dropping things
down it from above. Hard hats, mostly. Some gold paint. I don't look up.\"" CR>)
          (<ABOUT? ,W?LAMP ,W?LIGHT ,W?HOOK>
           <TELL "\"That's not lost, dear. That's on its hook.\"" CR>)
          (<ABOUT? ,W?EXPLORERS ,W?EXPLORER ,W?EXPEDITION ,W?PEOPLE>
           <TELL "\"People do turn up from time to time, soaked and blue with cold.
We give them a towel and a cup of tea, and they generally decide to stay. It's
warm, you see. I couldn't say where they came from.\"" CR>)
          (<ABOUT? ,W?MOUNTAIN ,W?UP ,W?ABOVE ,W?SKY>
           <TELL "\"I wouldn't know, dear. I don't look up.\"" CR>)
          (ELSE <PERSON-F>)>>

<OBJECT CLAIM-TICKET
    (DESC "claim ticket")
    (SYNONYM TICKET COPPERPLATE)
    (ADJECTIVE CLAIM)
    (FLAGS TAKEBIT READBIT)
    (TEXT "A small, crisp claim ticket for one hard hat, dated today, stamped,
perfectly dry. On the back, in neat copperplate, is a single word: THAN.")>

;"--- 14. The Archive -----------------------------------------------------------------
  Reached only through the consensus door. Lore L5 (the Genesis Block) is
  scored when it is read, like the plaque."

<ROOM ARCHIVE
    (DESC "The Archive")
    (IN ROOMS)
    (LDESC "A long vault of humming drives and printed ledgers: every
transaction in Mingus history, all eighteen months of it, immutable, in COBOL.
On a plinth in the middle sits the Genesis Block, a slab of glass with text
inside it. The consensus door is south, and an old ventilation bore climbs
north, toward the cold.")
    (SOUNDS "The drives, humming the whole history of the Ascendancy to themselves.
It's a short song.")
    (SOUTH TO MEMPOOL)
    (NORTH TO COLD-CAVERN)
    (UP TO COLD-CAVERN)
    (FLAGS LIGHTBIT)>

<OBJECT LEDGERS
    (DESC "ledgers")
    (SYNONYM LEDGER LEDGERS DRIVES COBOL VAULT PLINTH BORE)
    (ADJECTIVE PRINTED VENTILATION)
    (IN ARCHIVE)
    (FLAGS NDESCBIT PLURALBIT READBIT)
    (TEXT "Eighteen months of transactions, from the founding to the pump to the
dump. The truth is here, if you can read COBOL.")
    (ACTION FEATURE-F)>

<OBJECT GENESIS-BLOCK
    (DESC "Genesis Block")
    (SYNONYM BLOCK SLAB GLASS FOOTNOTE)
    (ADJECTIVE GENESIS)
    (IN ARCHIVE)
    (FLAGS NDESCBIT READBIT)
    (ACTION GENESIS-BLOCK-F)>

;"Lore (2 points): the Genesis Block, the range's real charter: the Trust
  whose name is on the keypad in the Cold Wallet Cavern."
<ROUTINE GENESIS-BLOCK-F ()
    <COND (<VERB? EXAMINE READ>
           <AWARD-POINTS 2 ,ACH?LORE-GENESIS>
           <TELL "The Genesis Block holds the original Mingus charter. It is very
clear. The range was chartered to a public Trust: the Mingus Charter Trust.
Vaunt merely renamed a defunct ski resort and declared himself founder. A
footnote observes that the deepest shaft \"appears to come out under the
neighbors. Nobody tell him.\"" CR>)
          (ELSE <FEATURE-F>)>>

;"--- 15. Cold Wallet Cavern --------------------------------------------------------
  P7 lives here. TYPE <word> goes to KEYPAD-TYPED (section 4), which compares
  the word with the next entry of TRUST-WORDS. EXAMINE BLOCKS is the clue:
  the four PLAIN words, in pedestal order, are the Trust's."

<ROOM COLD-CAVERN
    (DESC "Cold Wallet Cavern")
    (IN ROOMS)
    (SOUNDS "Wind, and ice ticking.")
    (SOUTH TO ARCHIVE)
    (DOWN TO ARCHIVE)
    (EAST TO LEDGE)
    (FLAGS LIGHTBIT)
    (ACTION COLD-CAVERN-F)>

<ROUTINE COLD-CAVERN-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "An ice cave open to the wind on the north face, where seed
phrases go to die. Twelve pedestals stand in a crescent, each with an ice block
on it and a word frozen inside. One block, the Trust's, is larger than the rest,
with a keypad set into its base">
           <COND (,WALLET-OPEN <TELL "; it has split in two">)>
           <TELL ". The ventilation bore leads south, back to the archive, and the
wind comes in from a ledge to the east." CR>)>>

;"EXAMINE BLOCKS lists all twelve; EXAMINE BLOCK is the Trust's block. BLOCKS
  and BLOCK are different dictionary words, so SYNONYM alone keeps them
  apart."
<OBJECT ICE-BLOCKS
    (DESC "ice blocks")
    (SYNONYM BLOCKS PEDESTALS PEDESTAL WORDS)
    (ADJECTIVE ICE TWELVE)
    (IN COLD-CAVERN)
    (FLAGS NDESCBIT PLURALBIT READBIT VOWELBIT)
    (TEXT "Each word has a faint watermark. Vaunt's shimmer gold. Lady Vaunt's
cycle through colours. The Trust's are plain, unadorned and honest. In order
along the crescent:|
|
    1  HIGHER    (gold shimmer)|
    2  THEY      (plain)|
    3  WHATEVER  (colours cycling)|
    4  BETTER    (gold shimmer)|
    5  NEVER     (plain)|
    6  DYOR      (colours cycling)|
    7  THAN      (gold shimmer)|
    8  SPITE     (colours cycling)|
    9  LOOK      (plain)|
    10 ELEVATED  (gold shimmer)|
    11 COAT      (colours cycling)|
    12 UP        (plain)")
    (ACTION ICE-BLOCKS-F)>

<ROUTINE ICE-BLOCKS-F ()
    <COND (<VERB? TAKE ATTACK PUSH PULL>
           <TELL "They are frozen to their pedestals." CR>)>>

<OBJECT TRUST-BLOCK
    (DESC "Trust's block")
    (SYNONYM BLOCK HALVES)
    (ADJECTIVE TRUST LARGE LARGER LARGEST SPLIT)
    (IN COLD-CAVERN)
    (FLAGS NDESCBIT)
    (ACTION TRUST-BLOCK-F)>

;"P7: the Trust's frozen block. Its description follows WALLET-OPEN, which
  KEYPAD-TYPED sets when the mnemonic is accepted."
<ROUTINE TRUST-BLOCK-F ()
    <COND (<VERB? EXAMINE>
           <COND (,WALLET-OPEN
                  <TELL "The Trust's block lies split in two halves on its
pedestal, and the box that was frozen inside it has thawed open." CR>)
                 (ELSE
                  <TELL "The largest block, frozen around a small box. Its
pedestal's keypad is labelled MINGUS CHARTER TRUST -- PLAIN WORDS ONLY." CR>)>)
          (<VERB? TAKE ATTACK PUSH PULL>
           <TELL "It is frozen solid to its pedestal." CR>)>>

<OBJECT KEYPAD
    (DESC "keypad")
    (SYNONYM KEYPAD KEYS LABEL)
    (IN COLD-CAVERN)
    (FLAGS NDESCBIT READBIT)
    (ACTION KEYPAD-F)>

;"P7: READ KEYPAD shows how far the mnemonic has got (MNEMONIC-WORDS of 4).
  The typing itself is KEYPAD-TYPED, reached through TYPE."
<ROUTINE KEYPAD-F ()
    <COND (<VERB? EXAMINE READ>
           <TELL "MINGUS CHARTER TRUST -- PLAIN WORDS ONLY. You can TYPE a word on
it. Its little screen reads: ">
           <COND (,WALLET-OPEN <TELL "MNEMONIC ACCEPTED." CR>)
                 (ELSE <TELL N ,MNEMONIC-WORDS " OF 4." CR>)>)
          (ELSE <FEATURE-F>)>>

;"The box is OPENABLEBIT but refuses OPEN while frozen; KEYPAD-TYPED gives it
  OPENBIT when the mnemonic is accepted, which puts the pin in reach (the
  parser can see into an open container)."
<OBJECT HARDWARE-BOX
    (DESC "box")
    (SYNONYM BOX)
    (ADJECTIVE SMALL HARDWARE)
    (IN COLD-CAVERN)
    (CAPACITY 5)
    (FLAGS NDESCBIT CONTBIT OPENABLEBIT)
    (ACTION HARDWARE-BOX-F)>

<ROUTINE HARDWARE-BOX-F ()
    <COND (<VERB? EXAMINE>
           <COND (<FSET? ,HARDWARE-BOX ,OPENBIT>
                  <TELL "A thawed little box, open." CR>
                  <DESCRIBE-CONTENTS ,HARDWARE-BOX>
                  <RTRUE>)
                 (ELSE <TELL "A small box, frozen inside the Trust's block." CR>)>)
          (<AND <VERB? OPEN> <NOT <FSET? ,HARDWARE-BOX ,OPENBIT>>>
           <TELL "It is frozen inside a block of ice." CR>)
          (<VERB? TAKE> <TELL "It is frozen to the halves of the block." CR>)>>

<OBJECT HARDWARE-WALLET
    (DESC "hardware wallet")
    (SYNONYM WALLET BALANCE)
    (ADJECTIVE HARDWARE)
    (IN HARDWARE-BOX)
    (FLAGS TAKEBIT)
    (TEXT "A hardware wallet. Its screen says BALANCE: 0. It is the most secure
thing you have ever seen protecting nothing.")>

<OBJECT SIM-PIN
    (DESC "SIM-eject pin")
    (SYNONYM PIN SIM-EJECT)
    (ADJECTIVE SIM EJECT TINY)
    (IN HARDWARE-BOX)
    (FLAGS TAKEBIT)
    (TEXT "The tiny SIM-eject pin that comes in the box with every hardware
wallet, which nobody has ever used for anything. It is thin and very stiff.")>

;"--- 16. Windward Ledge ---------------------------------------------------------------
  P8 lives here. The cable car (the down exit) runs both ways, so the valley
  can always be left and re-entered."

<ROOM LEDGE
    (DESC "Windward Ledge")
    (IN ROOMS)
    (LDESC "The lip of an unused gondola platform on the north face: open,
windy, unswept since the crash. An emergency cable car hangs at the edge, with
one working brake and a sign that says so. The ice cave is back to the west.
The cable car goes down.")
    (SOUNDS "Wind, and the cable car's one working brake, creaking.")
    (WEST TO COLD-CAVERN)
    (DOWN PER LEDGE-DOWN-F)
    (FLAGS LIGHTBIT)>

;"DOWN from the Windward Ledge: the emergency cable car to the Bottom
  Gondola Station, and the start of the finale (act 3)."
<ROUTINE LEDGE-DOWN-F ()
    <TELL "You climb into the emergency cable car and release its one working
brake. The car drops off the ledge and down the face, and the Ascendancy comes apart
past the windows in reverse order of how it was built: the Mint's shed, the gas
station's canopy, and, through the ballroom's skylight, an upside-down
chandelier finally falling the right way up. The brake shrieks the whole way.
Then the slope flattens, the wind drops, and the car bumps to a stop." CR CR>
    ,BOTTOM-STATION>

<OBJECT CABLE-CAR
    (DESC "emergency cable car")
    (SYNONYM CAR BRAKE SIGN)
    (ADJECTIVE EMERGENCY CABLE)
    (IN LEDGE)
    (FLAGS NDESCBIT VOWELBIT READBIT)
    (TEXT "ONE WORKING BRAKE, says the sign. It is very specific about the
number.")
    (ACTION CABLE-CAR-F)>

;"ENTER CAR is the same as going down."
<ROUTINE CABLE-CAR-F ()
    <COND (<VERB? ENTER> <DO-WALK ,P?DOWN>)
          (ELSE <FEATURE-F>)>>

;"The belted verdling (P8). His pike is inside him. CONTBIT plus TRANSBIT
  make him a 'transparent container', so you can see (and examine) what he
  holds, and the library treats what a person holds as theirs: TAKE PIKE is
  refused politely ('That seems to belong to...') until he hands it over.
  His appearance changes with the puzzle, so instead of a fixed LDESC he has
  a DESCFCN: the library asks it M-OBJDESC? ('will you describe yourself?')
  and then calls it with M-OBJDESC to print the description."
<OBJECT BELTED-VERDLING
    (DESC "belted verdling")
    (SYNONYM VERDLING ELF)
    (ADJECTIVE BELTED)
    (IN LEDGE)
    (FLAGS PERSONBIT CONTBIT TRANSBIT)
    (DESCFCN BELTED-VERDLING-DESC)
    (NO-ANSWER "\"I'd rather not say,\" says the verdling, looking at the
valley.")
    (NO-INTEREST "The verdling regards it politely. \"Not unless it undoes a
belt.\"")
    (ACTION BELTED-VERDLING-F)>

<ROUTINE BELTED-VERDLING-DESC (ARG)
    <COND (<==? .ARG ,M-OBJDESC?> <RTRUE>)
          (,BELT-FREED
           <TELL "The verdling stands at the edge of the ledge, looking down at
the valley he can't go back to." CR>)
          (ELSE
           <TELL "A belted verdling leans on his pike at the edge of the ledge,
breathing shallowly. He shifts his weight, winces, and gestures at the buckle
with exquisite dignity. \"You'll notice,\" he says, \"that I am not cutting
them.\"">
           <COND (<NOT <OR ,CAN-FULL ,BUCKLE-OILED>>
                  <TELL "|
|
\"If you're thinking of helping,\" he adds, \"the MAINNET pump at the gas
station leaks the good stuff. The release is rusted.\"">)>
           <CRLF>)>>

<ROUTINE BELTED-VERDLING-F ("OPT" ARG)
    <COND (.ARG <PERSON-F .ARG>)
          (<VERB? EXAMINE>
           <COND (,BELT-FREED
                  <TELL "A verdling at peace: knee-high, mud-coloured, standing up
straight for the first time in years, the finest pants a verdling can buy
hanging comfortably at last." CR>)
                 (ELSE
                  <TELL "A verdling, knee-high and mud-coloured, high on the
mountain where no verdling should ever be. He wears the finest pants a verdling
can buy -- they cost, he will tell you at length, a literal fortune -- held up
by a metal click belt ratcheted far too tight. He leans on his pike with
exquisite dignity." CR>)>)
          (<NOT <VERB? ASK-ABOUT>> <PERSON-F>)
          (<ABOUT? ,W?PANTS ,W?BELT ,W?BUCKLE ,W?PAWL ,W?TROUSERS>
           <TELL "\"The finest pants a verdling can buy. The release pawl is
rusted shut, and it's too small for fingers. Something to free it, and something
thin and stiff to press it.\"" CR>)
          (<ABOUT? ,W?PIKE>
           <TELL "\"A verdling's pike. Down there it is the only thing anyone
respects.\"" CR>)
          (<ABOUT? ,W?VALLEY ,W?VERDLINGS ,W?HOME ,W?RIVER ,W?RUNOUT>
           <TELL "He looks down at the valley for a long time and says
nothing." CR>)
          (ELSE <PERSON-F>)>>

;"The pike can never be lost for good: it can't be given away, put anywhere or
  thrown (KEEP-F); DROP leaves it where it falls, lowered. WAVE and POINT get
  an in-character reply here; on the Runout they never reach this far,
  because the Runout's M-BEG turns them into FEND. The pike's ACTION also
  runs when it is PRSI (FEND VERDLINGS WITH PIKE), so every branch checks
  that the pike is PRSO first."
<OBJECT PIKE
    (DESC "pike")
    (SYNONYM PIKE STAFF SPEAR POLE)
    (ADJECTIVE VERDLING RIVER)
    (IN BELTED-VERDLING)
    (FLAGS TAKEBIT)
    (KEEP "You keep hold of the pike. Down there, it is the only thing anyone
respects.")
    (ACTION PIKE-F)>

<ROUTINE PIKE-F ()
    <COND (<NOT <PRSO? ,PIKE>> <RFALSE>)
          (<VERB? EXAMINE>
           <TELL "A verdling's pike: a long pole of river wood, its point worn
bright. Every verdling recognises one. ">
           <COND (<NOT <IN? ,PIKE ,WINNER>> <TELL "He leans on it." CR>)
                 (,PIKE-RAISED <TELL "You are holding it raised." CR>)
                 (ELSE <TELL "You are holding it lowered, at your side." CR>)>)
          (<VERB? DROP>
           <SETG PIKE-RAISED <>>
           <RFALSE>)
          (<VERB? WAVE POINT>
           <COND (<==? ,HERE ,RIVER-EDGE>
                  <TELL "The pike sweeps over thousands of bowed heads. Not one
of them looks up." CR>)
                 (ELSE
                  <TELL "You wave the pike about. Without verdlings to see it,
it is just a long stick." CR>)>)
          (ELSE <KEEP-F>)>>

;"P8, part two: OIL BUCKLE (OIL, GREASE, LUBRICATE; section 8) needs a full
  can and empties it, setting BUCKLE-OILED. Other ways of fiddling with the
  buckle are redirected to the pawl with PERFORM, which runs a whole new
  action (here PUSH PAWL) as if the player had typed it. Using a TOOL on the
  buckle (OPEN BUCKLE WITH PIN, which section 8 maps to zillib's UNLOCK, or
  PRESS BUCKLE WITH PIN) goes to the pawl as PRESS-WITH, the action that can
  free it.

  In PUT ... IN/ON the buckle (and the pawl, below) the buckle is PRSI, so
  its ACTION runs first: the oil can means 'oil it', anything else means
  'press the pawl with it'. Things you may never part with (the pike, the
  badge: they have a KEEP property) are left alone, so their own refusal
  answers."
<OBJECT BUCKLE
    (DESC "click belt")
    (SYNONYM BELT BUCKLE RATCHET)
    (ADJECTIVE CLICK METAL)
    (IN LEDGE)
    (FLAGS NDESCBIT)
    (ACTION BUCKLE-F)>

<ROUTINE BUCKLE-F ()
    <COND (<VERB? EXAMINE>
           <COND (,BELT-FREED <TELL "The belt hangs loose at last." CR>)
                 (ELSE
                  <TELL "A metal click belt: pull it tight and it ratchets,
click, click, click. The release pawl is jammed. ">
                  <COND (,BUCKLE-OILED
                         <TELL "It glistens with oil now, loose enough to move,
but much too small for fingers." CR>)
                        (ELSE <TELL "It is rusted solid, and much too small for
fingers." CR>)>)>)
          (<VERB? OIL>
           <COND (,BELT-FREED <TELL "It doesn't need oiling any more." CR>)
                 (,BUCKLE-OILED <TELL "You've already oiled it. The pawl
glistens." CR>)
                 (<NOT <AND <IN? ,OIL-CAN ,WINNER> ,CAN-FULL>>
                  <TELL "You have nothing to oil it with. (\"The MAINNET pump,\"
says the verdling, \"at the gas station. The good stuff.\")" CR>)
                 (ELSE
                  <SETG BUCKLE-OILED T>
                  <SETG CAN-FULL <>>
                  <TELL "You work the spout of the oil can into the buckle and
squeeze out every drop of the good stuff. The rust drinks it. Somewhere inside,
the pawl gives a tiny, hopeful creak." CR>)>)
          (<AND <VERB? PUT-IN PUT-ON> <PRSI? ,BUCKLE> <NOT <GETP ,PRSO ,P?KEEP>>>
           <COND (<PRSO? ,OIL-CAN> <PERFORM ,V?OIL ,BUCKLE>)
                 (ELSE <PERFORM ,V?PRESS-WITH ,BELT-PAWL ,PRSO>)>
           <RTRUE>)
          (<AND <VERB? UNLOCK PRESS-WITH> <PRSO? ,BUCKLE>>
           <PERFORM ,V?PRESS-WITH ,BELT-PAWL ,PRSI>
           <RTRUE>)
          (<AND <VERB? OPEN PULL TAKE TURN PUSH> <PRSO? ,BUCKLE>>
           <PERFORM ,V?PUSH ,BELT-PAWL>
           <RTRUE>)>>

;"P8, part three: PRESS PAWL WITH PIN (the PRESS-WITH action, section 8). The
  checks, in order: is it already done? the pike (too big)? anything but the
  pin? oiled yet? Only the pin on an oiled pawl frees the belt -- and the
  pike moves to you. Other phrasings end up here too: OPEN/UNLOCK PAWL WITH
  PIN and PUT PIN IN PAWL by the redirects below, PUSH PIN INTO PAWL by a
  SYNTAX line in section 8."
<OBJECT BELT-PAWL
    (DESC "release pawl")
    (SYNONYM PAWL CATCH)
    (ADJECTIVE RELEASE)
    (IN LEDGE)
    (FLAGS NDESCBIT)
    (ACTION BELT-PAWL-F)>

<ROUTINE BELT-PAWL-F ()
    <COND (<VERB? EXAMINE>
           <COND (,BELT-FREED <TELL "The pawl has done its job." CR>)
                 (,BUCKLE-OILED <TELL "Freed by the oil, but far too small for
fingers. It needs something thin and stiff." CR>)
                 (ELSE <TELL "Rusted solid, and far too small for fingers." CR>)>)
          (<VERB? OIL> <PERFORM ,V?OIL ,BUCKLE> <RTRUE>)
          (<AND <VERB? PUT-IN PUT-ON> <PRSI? ,BELT-PAWL> <NOT <GETP ,PRSO ,P?KEEP>>>
           <COND (<PRSO? ,OIL-CAN> <PERFORM ,V?OIL ,BUCKLE>)
                 (ELSE <PERFORM ,V?PRESS-WITH ,BELT-PAWL ,PRSO>)>
           <RTRUE>)
          (<AND <VERB? UNLOCK> <PRSO? ,BELT-PAWL>>
           <PERFORM ,V?PRESS-WITH ,BELT-PAWL ,PRSI>
           <RTRUE>)
          (<VERB? PUSH PULL TURN RUB>
           <COND (,BELT-FREED <TELL "The pawl has done its job." CR>)
                 (ELSE <TELL "You try with your fingers. The pawl is far too small
for them." CR>)>)
          (<VERB? PRESS-WITH>
           <COND (,BELT-FREED <TELL "The pawl has done its job." CR>)
                 (<PRSI? ,PIKE> <TELL "The pike is far too big for a pawl that
small." CR>)
                 (<NOT <PRSI? ,SIM-PIN>> <TELL CT ,PRSI " won't fit." CR>)
                 (<NOT ,BUCKLE-OILED>
                  <TELL "You press the pin against the pawl. It is rusted solid.
Nothing moves." CR>)
                 (ELSE
                  <SETG BELT-FREED T>
                  <MOVE ,PIKE ,WINNER>
                  <FSET ,PIKE ,TOUCHBIT>
                  <AWARD-POINTS 5 ,ACH?BELT>
                  <TELL "You set the tip of the SIM-eject pin against the oiled
pawl and press. There is a tiny click -- and the belt lets go with one long,
glorious exhale, from the verdling, not the belt.|
|
For a while he just breathes. Then he holds out his pike to you. \"Take it,\" he
says. \"I won't need it up here.\"|
|
He looks down at the valley he can't go back to. \"They're not guarding the
valley from you,\" he says quietly. \"They're guarding you from the river.\"" CR>)>)>>


;"============================================================================
  7. FINALE: THE RUNOUT  --  the valley floor
 ----------------------------------------------------------------------------
  Rooms: Bottom Gondola Station, The Runout, The River's Edge, Foot of the
  Gangplank. Puzzles P9 (coat) and P10 (the pike line), then the ending.

  THE THREE-POKE RULE -- the whole timed mechanic, in one place:
    1. Arriving on the Runout (its M-ENTER) sets POKES to 0, lowers the pike,
       and sets RUNOUT-FRESH, so the arrival turn costs nothing.
    2. At the end of every later turn spent there, the Runout's M-END lands
       a poke -- unless the pike is raised. The third poke kills.
    3. FEND VERDLINGS WITH PIKE (or RAISE PIKE, WAVE PIKE, POINT PIKE AT
       VERDLINGS) raises it. It stays up through looking, examining,
       waiting, inventory, listening and walking; the Runout's M-BEG lowers
       it for anything else, so that turn's poke can land. Every one of
       those is a turn: LOOK, EXAMINE and INVENTORY cost a poke like
       anything else.
    4. Taking treasure from the pile costs one extra poke on the spot.
    5. Leaving west resets everything.
    6. Walking east with the pike down gets you escorted back to the station
       -- no poke, no death, and a hint.
    7./8. East with the pike up: without the coat you stop; with it you reach
       the River's Edge.

  Why M-END and not an interrupt (QUEUE)? zillib calls the current room's
  ACTION with M-END at the end of every turn that passes time -- so the
  handler switches itself on and off with your location, which is exactly
  the rule's scope, and there is nothing to QUEUE or DEQUEUE.

  The catch is zillib's list of 'game verbs' (the GAME-VERB? macro): the
  main loop skips M-END and the CLOCKER for them, so they pass no time. Most
  are true meta commands (SCORE, SAVE, UNDO) and rightly cost nothing. Two
  are not:
    - WAIT is a game verb, but zillib's V-WAIT runs M-END and the CLOCKER
      itself, so waiting does cost a poke.
    - INVENTORY is a game verb too, but here it must be a turn, exactly as
      in the Inform version (where only meta commands are free). So the
      Runout's and the River's Edge's M-BEG print the inventory and then
      run M-END and the CLOCKER themselves, the way V-WAIT does.
 ============================================================================"

;"--- 17. Bottom Gondola Station ------------------------------------------------------
  The finale's start and its safe place: the escort and the west exit both
  bring you back here. The sign is the last of the three pike signposts (the
  busker's song and the belted verdling are the others)."

<ROOM BOTTOM-STATION
    (DESC "Bottom Gondola Station")
    (IN ROOMS)
    (LDESC "The bottom station of the gondola line: a concrete platform, a
ticket booth with its shutter down, and a long wall of names -- the memorial to
those who floated down the Verdance and never came back. Nobody knows how far
they got. A recruiting poster flaps beside it, and a faded sign is screwed to
the booth. East, the ground opens out onto the Runout. The emergency cable car
waits to go back up.")
    (SOUNDS "From the east, a small, steady sound, like a great many people
tapping sticks.")
    (UP PER STATION-UP-F)
    (EAST TO RUNOUT)
    (FLAGS LIGHTBIT)
    (ACTION BOTTOM-STATION-F)>

<ROUTINE BOTTOM-STATION-F (RARG)
    <COND (<==? .RARG ,M-ENTER> <BEGIN-ACT 3>)>>

;"UP from the Bottom Gondola Station: the cable car back to the ledge."
<ROUTINE STATION-UP-F ()
    <TELL "The cable car hauls you back up the face, its one brake complaining
the whole way." CR CR>
    ,LEDGE>

<OBJECT MEMORIAL
    (DESC "memorial of names")
    (SYNONYM MEMORIAL WALL NAMES NAME)
    (IN BOTTOM-STATION)
    (FLAGS NDESCBIT READBIT)
    (TEXT "Names, hundreds of them, cut into the concrete. A few are fresh.
Nobody knows how far any of them got.")
    (ACTION FEATURE-F)>

<OBJECT POSTER
    (DESC "recruiting poster")
    (SYNONYM POSTER DIVERS)
    (ADJECTIVE RECRUITING)
    (IN BOTTOM-STATION)
    (FLAGS NDESCBIT READBIT)
    (TEXT "VERDANCE FOUNDATION DIVERS -- generous token allocation, vesting
schedule TBD. There have been no applicants.")
    (ACTION FEATURE-F)>

<OBJECT FADED-SIGN
    (DESC "faded sign")
    (SYNONYM SIGN WARNING BOOTH SHUTTER)
    (ADJECTIVE FADED TICKET)
    (IN BOTTOM-STATION)
    (FLAGS NDESCBIT READBIT)
    (TEXT "Faded almost to nothing: VERDLINGS RESPECT ONLY THE PIKE.")
    (ACTION FEATURE-F)>

;"--- 18. The Runout -------------------------------------------------------------------
  The Runout: the only place you can die. Its description always ends with
  the poke counter; on the arrival turn (RUNOUT-FRESH) it adds the warning.
  One ACTION routine handles all four of the room's moments: M-ENTER (rule
  1), M-LOOK (the description), M-BEG (rules 3 and 4, before every action)
  and M-END (rule 2, after every turn)."

<ROOM RUNOUT
    (DESC "The Runout")
    (IN ROOMS)
    (SOUNDS "Small feet shifting on gold. Nobody says anything. That is
worse.")
    (WEST PER RUNOUT-WEST-F)
    (EAST PER RUNOUT-EAST-F)
    (FLAGS LIGHTBIT)
    (ACTION RUNOUT-F)>

<ROUTINE RUNOUT-F (RARG)
    <COND ;"Rule 1: the arrival. GOTO sends M-ENTER before the description."
          (<==? .RARG ,M-ENTER>
           <SETG POKES 0>
           <SETG PIKE-RAISED <>>
           <SETG RUNOUT-FRESH T>
           <RFALSE>)
          (<==? .RARG ,M-LOOK>
           <TELL "Everything in the Mingan Ascendancy rolls downhill eventually. This
is where it stops.|
|
The debris fan spreads out at the foot of the range: eighteen months of
everything the Ascendancy ever dropped, knocked over or let go of in a strong wind.
Hard-wallet keychains. An upturned gondola car. Several thrones. A crate of
commemorative $ALT medallions, still shrink-wrapped. Seed-phrase notebooks. A
grand piano that got as far as the first switchback and then made its own
decisions. And everywhere, standing on all of it, verdlings: knee-high,
mud-coloured, every one with a pike. The river's edge is east, past the last of
the pile. The gondola station is back to the west.|
|
">
           <COND (,RUNOUT-FRESH
                  <TELL "A verdling the height of your knee regards you with
total contempt. ">)>
           <POKE-LINE>
           <CRLF>)
          ;"Rules 3 and 4, before every action. Three steps, in order.
            First, WAVE PIKE and POINT PIKE AT ... mean 'raise it' down here:
            PERFORM runs a whole FEND action instead (this M-BEG sees it
            again, and FEND keeps the pike up).
            Second, lower a raised pike -- except for zillib's game verbs
            (GAME-VERB?: WAIT, INVENTORY, SCORE, SAVE and the like) and
            LOOK, EXAMINE, LISTEN, FEND and WALK. Note that leaving a pike up
            is not the same as passing no time: WAIT and INVENTORY still cost
            a turn (see the banner above).
            Third, the treasure, invalid directions and INVENTORY."
          (<==? .RARG ,M-BEG>
           <COND (<AND <VERB? WAVE POINT> <PRSO? ,PIKE> <IN? ,PIKE ,WINNER>>
                  <PERFORM ,V?FEND ,PIKE>
                  <RTRUE>)>
           <COND (<AND ,PIKE-RAISED
                       <IN? ,PIKE ,WINNER>
                       <NOT <GAME-VERB?>>
                       <NOT <VERB? LOOK EXAMINE LISTEN LISTEN-TO FEND WALK>>>
                  <SETG PIKE-RAISED <>>
                  <COND (<VERB? DIG> <TELL "(You lower the pike to dig.)" CR>)
                        (ELSE <TELL "(You lower the pike.)" CR>)>)>
           <COND (<AND <VERB? TAKE> <PRSO? ,THRONES ,MEDALLIONS ,PIANO ,NOTEBOOKS>>
                  <TELL "A verdling pokes your hand, hard, before your fingers
close. Treasure is noticed down here, and it stays where it is." CR>
                  <POKE>
                  <RTRUE>)
                 (<AND <VERB? WALK> ,PRSO-DIR <NOT <EQUAL? ,PRSO ,P?EAST ,P?WEST>>>
                  <TELL "The only way off the Runout is back west, to the
gondola station -- or east, if they let you." CR>)
                 ;"INVENTORY is a game verb, so the main loop would not end
                   the turn: print it, then run M-END and the CLOCKER
                   ourselves (rule 2 can land a poke), as V-WAIT does."
                 (<VERB? INVENTORY>
                  <V-INVENTORY>
                  <RUNOUT-F ,M-END>
                  <CLOCKER>
                  <RTRUE>)>)
          ;"Rule 2: the poke at the end of each turn. Never on the arrival
            turn: RUNOUT-FRESH is cleared instead."
          (<==? .RARG ,M-END>
           <COND (,RUNOUT-FRESH <SETG RUNOUT-FRESH <>> <RFALSE>)
                 (,PIKE-RAISED
                  <TELL CR "The verdlings stop short, stare at the pike, and give
ground -- never far, never kindly. ">
                  <POKE-LINE>
                  <CRLF>)
                 (ELSE <POKE>)>
           <RFALSE>)>>

;"Rule 5: leaving resets."
<ROUTINE RUNOUT-WEST-F ()
    <SETG POKES 0>
    <SETG PIKE-RAISED <>>
    <TELL "You back off the Runout. The verdlings watch you go, and do not
follow." CR CR>
    ,BOTTOM-STATION>

;"Rules 6, 7 and 8: east is the verdlings' decision, not yours. A worn coat
  is still IN the player (WORNBIT only marks it worn), so wearing it does not
  break the check."
<ROUTINE RUNOUT-EAST-F ()
    <COND (<NOT ,PIKE-RAISED>
           <SETG POKES 0>
           <COND (<IN? ,PIKE ,WINNER>
                  <TELL "They see the pike, lowered at your side, and hesitate --
then remember you are from the mountain. A dozen small hands turn you round and
walk you back, briskly, to the gondola station, where they leave you without a
word. A pike only matters raised." CR CR>)
                 (ELSE
                  <TELL "You take one step toward the water and the verdlings
close in, a forest of pikes at shin height. They turn you round and walk you
back, briskly, to the gondola station. They were never going to let you past
with your bare hands. Down here, only a pike gets a verdling's respect." CR CR>)>
           ,BOTTOM-STATION)
          (<NOT <IN? ,COAT ,WINNER>>
           <TELL "You came down for the coat. It is still in the pile, somewhere
by the upturned gondola car." CR>
           <RFALSE>)
          (ELSE
           <AWARD-POINTS 5 ,ACH?PIKELINE>
           <TELL "You walk east with the pike raised and the coat over your arm.
The verdlings give ground in front of you, step by step, never far, never
kindly, all the way to the water." CR CR>
           ,RIVER-EDGE)>>

;"P9, part one: DIG BY GONDOLA (a SYNTAX line in section 8), SEARCH the car
  or LOOK UNDER it (its description says something rolled under it) moves
  the coat into the room. COAT-FOUND makes it once-only."
<OBJECT GONDOLA-CAR
    (DESC "upturned gondola car")
    (SYNONYM CAR GONDOLA RUBBLE PILE)
    (ADJECTIVE UPTURNED GONDOLA SUMMIT)
    (IN RUNOUT)
    (FLAGS NDESCBIT VOWELBIT)
    (ACTION GONDOLA-CAR-F)>

<ROUTINE GONDOLA-CAR-F ()
    <COND (<VERB? EXAMINE>
           <COND (,COAT-FOUND
                  <TELL "The gondola car lies on its roof, and the hole you dug
beside it is already filling with small stones." CR>)
                 (ELSE
                  <TELL "A summit gondola car, lying on its roof where it came to
rest. The rubble piled against its side looks disturbed, as though something
long had rolled in under it." CR>)>)
          (<VERB? DIG SEARCH LOOK-UNDER>
           <COND (,COAT-FOUND
                  <TELL "You've already dug there. The rest is rubble." CR>)
                 (ELSE
                  <SETG COAT-FOUND T>
                  <MOVE ,COAT ,RUNOUT>
                  <TELL "You dig into the rubble by the gondola car with your
hands. Keychains, a commemorative scarf, a great deal of gravel -- and then
cloth. You drag it out: a long coat." CR>)>)
          (<VERB? ENTER> <TELL "The car's doors are buried in the pile." CR>)
          (<VERB? TAKE PUSH PULL TURN>
           <TELL "It weighs as much as a small house." CR>)>>

;"The four treasures have no ACTION of their own: the Runout's M-BEG (rule
  4) catches TAKE on any of them before the library could refuse it."
<OBJECT THRONES
    (DESC "thrones")
    (SYNONYM THRONE THRONES CHAIR CHAIRS)
    (ADJECTIVE GILDED)
    (IN RUNOUT)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Several gilded thrones, each one a little higher than the last. None
of them is the right way up.")>

<OBJECT MEDALLIONS
    (DESC "$ALT medallions")
    (SYNONYM MEDALLION CRATE)
    (ADJECTIVE ALT COMMEMORATIVE SHRINK-WRAPPED)
    (IN RUNOUT)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "A crate of commemorative $ALT medallions, still shrink-wrapped. The
face on them has laser eyes.")>

<OBJECT PIANO
    (DESC "grand piano")
    (SYNONYM PIANO KEYS)
    (ADJECTIVE GRAND)
    (IN RUNOUT)
    (FLAGS NDESCBIT)
    (TEXT "A grand piano with most of its legs. It got as far as the first
switchback and then made its own decisions.")>

<OBJECT NOTEBOOKS
    (DESC "seed-phrase notebooks")
    (SYNONYM NOTEBOOKS NOTEBOOK KEYCHAINS KEYCHAIN)
    (ADJECTIVE SEED PHRASE SEED-PHRASE)
    (IN RUNOUT)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Notebooks of seed phrases, half of them still legible. Somewhere in
the pile, almost certainly, a fortune.")>

<OBJECT RUNOUT-VERDLINGS
    (DESC "verdlings")
    (SYNONYM VERDLINGS VERDLING CROWD ELVES PIKES)
    (IN RUNOUT)
    (FLAGS NDESCBIT PLURALBIT PERSONBIT)
    (TEXT "Knee-high, mud-coloured and patient, with a mean streak. Every one
carries a pike. They do not want your treasure; they want you gone, back up the
mountain, where Mingus people belong. There are always more of them than you
counted.")
    (ACTION RUNOUT-VERDLINGS-F)>

;"The Runout's verdlings: orders (ARG set) and most actions get the same
  answer. EXAMINE, FEND and BOW are left to their own routines (RFALSE).
  ATTACK gets the warning that there are always more of them."
<ROUTINE RUNOUT-VERDLINGS-F ("OPT" ARG)
    <COND (.ARG <TELL "They do not argue, negotiate or accept tokens. They
poke." CR>)
          (<VERB? EXAMINE FEND BOW> <RFALSE>)
          (<VERB? ATTACK> <TELL "There are always more of them than you counted." CR>)
          (<AND <VERB? GIVE SHOW> <PRSI? ,RUNOUT-VERDLINGS>>
           <TELL "The nearest verdling pokes it, then looks at you." CR>)
          (ELSE <TELL "They do not argue, negotiate or accept tokens. They
poke." CR>)>>

;"P9, part two: taking the coat scores. TRY-TAKE does the library's normal
  checks and moves it; the T argument keeps it quiet so that we can print
  our own message instead. WEARBIT lets you WEAR it."
<OBJECT COAT
    (DESC "coat")
    (SYNONYM COAT POCKET SLEEVE SLIP)
    (ADJECTIVE LONG REAL LADY)
    (FDESC "Lady Vaunt's coat lies by the upturned gondola car, where you dug it
out.")
    (FLAGS TAKEBIT WEARBIT)
    (TEXT "Lady Vaunt's coat. The real one: it casts a shadow. There is a
verdling pike-hole in the sleeve. In the pocket is a slip of paper in her hand,
with one word on it: DOWN.")
    (ACTION COAT-F)>

<ROUTINE COAT-F ()
    <COND (<AND <VERB? TAKE> <NOT <IN? ,COAT ,WINNER>>>
           <COND (<TRY-TAKE ,COAT T>
                  <AWARD-POINTS 5 ,ACH?COAT>
                  <TELL "Taken. No verdling reacts. It's a coat." CR>)>
           <RTRUE>)>>

;"--- 19. The River's Edge (the ending, over several turns) ---------------------------
  Arriving: the bowing. Each later turn: BOW, WAIT, LOOK, EXAMINE and movement
  let the silence go on; anything else (INVENTORY included) makes the crowd
  part at the end of the turn, and so does the second turn here regardless.
  Then EAST, DOWN, FOLLOW LANE, BOARD SHIP or CLIMB GANGPLANK walks the
  lane."

<ROOM RIVER-EDGE
    (DESC "The River's Edge")
    (IN ROOMS)
    (SOUNDS "The river, very loud. The valley, completely silent.")
    (FLAGS LIGHTBIT)
    (ACTION RIVER-EDGE-F)>

<ROUTINE RIVER-EDGE-F (RARG)
    <COND ;"The same arrival pattern as the Runout: M-ENTER sets EDGE-FRESH,
            so the arrival turn is free and the bowing is described once."
          (<==? .RARG ,M-ENTER>
           <SETG EDGE-FRESH T>
           <SETG EDGE-TURNS 0>
           <RFALSE>)
          (<==? .RARG ,M-LOOK>
           <COND (,EDGE-FRESH
                  <TELL "The Verdance is at your back, very broad, very green and
very fast. You turn around.|
|
The verdlings have followed you: not the dozen you counted, but all of them,
the whole valley floor from the Runout to the first of the half-bridges,
thousands of small mud-coloured figures standing closer than they have ever
stood to anyone from the mountain. The poking has stopped. Then the nearest one
looks at the pike in your hand, and at you, and lowers its own; and the one
beside it does the same; and then, all at once, like wind going through grass,
thousands of them lower their pikes and bow. You did not ask for this. Nobody
has explained it. The river is very loud behind you, and in front of you the
valley is completely silent." CR>)
                 (ELSE
                  <TELL "The Verdance runs broad and fast at your back. In front
of you, thousands of verdlings stand with their heads bowed and their pikes
lowered, all the way back to the mountain">
                  <COND (,LANE-OPEN
                         <TELL ". A lane runs through them, straight down to the
water, where the ship waits at the mouth of the Sluice with its gangplank
down." CR>)
                        (ELSE <TELL ". Nobody moves." CR>)>)>)
          ;"M-BEG sorts every action into one of three kinds. Movement never
            gets anywhere until the lane is open (and afterwards only east or
            down walk it). WAIT, BOW, LOOK and EXAMINE let the silence go on.
            Anything else records PART-NOW, and M-END opens the lane at the
            end of that turn."
          (<==? .RARG ,M-BEG>
           <COND (<AND <VERB? WALK> ,PRSO-DIR>
                  <COND (<AND ,LANE-OPEN <EQUAL? ,PRSO ,P?EAST ,P?DOWN>>
                         <WALK-LANE>)
                        (ELSE
                         <TELL "The crowd closes softly in front of you, and bows
again." CR>)>)
                 ;"WAIT is a 'game verb': V-WAIT runs the end of the turn
                   itself, and the main loop does not. So when we replace
                   WAIT's message here we must run M-END and the CLOCKER
                   ourselves, or the turn would never end."
                 (<VERB? WAIT>
                  <TELL "You wait. The silence goes on." CR>
                  <RIVER-EDGE-F ,M-END>
                  <CLOCKER>
                  <RTRUE>)
                 ;"INVENTORY is a game verb as well, and here it is 'anything
                   else': record PART-NOW, print it, then end the turn
                   ourselves, the same way."
                 (<VERB? INVENTORY>
                  <COND (<NOT ,LANE-OPEN> <SETG PART-NOW T>)>
                  <V-INVENTORY>
                  <RIVER-EDGE-F ,M-END>
                  <CLOCKER>
                  <RTRUE>)
                 (<AND <NOT ,LANE-OPEN>
                       <NOT <GAME-VERB?>>
                       <NOT <VERB? BOW LOOK EXAMINE>>>
                  <SETG PART-NOW T>
                  ;"SWIM and JUMP are 'anything else' too -- they still part
                    the crowd -- but they get the river's own answer.
                    Returning true stops the action; the turn still ends
                    normally."
                  <COND (<VERB? SWIM JUMP JUMP-IN>
                         <TELL "No one crosses the Verdance." CR>
                         <RTRUE>)>
                  <RFALSE>)
                 (<VERB? SWIM JUMP JUMP-IN>
                  <TELL "No one crosses the Verdance." CR>)>)
          ;"The parting comes at the end of turn 2, or sooner if M-BEG saw an
            action that is not part of the ceremony. The arrival turn is free;
            PART-NOW is cleared then too, so nothing recorded while you were
            arriving counts against turn 1."
          (<==? .RARG ,M-END>
           <COND (,LANE-OPEN <RFALSE>)
                 (,EDGE-FRESH
                  <SETG EDGE-FRESH <>>
                  <SETG PART-NOW <>>
                  <RFALSE>)>
           <SETG EDGE-TURNS <+ ,EDGE-TURNS 1>>
           <COND (<OR <G=? ,EDGE-TURNS 2> ,PART-NOW> <PARTING>)>
           <RFALSE>)>>

<OBJECT EDGE-CROWD
    (DESC "bowed verdlings")
    (SYNONYM VERDLINGS VERDLING CROWD HEADS PIKES THOUSANDS)
    (ADJECTIVE BOWED)
    (IN RIVER-EDGE)
    (FLAGS NDESCBIT PLURALBIT PERSONBIT)
    (TEXT "Thousands of small heads, bowed. Not one of them is looking at you,
and all of them are waiting.")
    (ACTION EDGE-CROWD-F)>

;"EXAMINE, FEND and BOW fall through to their usual handling; every other
  action on the crowd gets the same answer."
<ROUTINE EDGE-CROWD-F ("OPT" ARG)
    <COND (<OR .ARG <NOT <VERB? EXAMINE FEND BOW>>>
           <TELL "Thousands of small heads stay bowed." CR>)>>

<OBJECT VERDANCE
    (DESC "Verdance")
    (SYNONYM VERDANCE RIVER WATER CURRENT)
    (IN RIVER-EDGE)
    (FLAGS NDESCBIT NARTICLEBIT)
    (TEXT "The river nobody crosses and nobody comes back from. Under its calm
green skin it runs like a great continental river, broad and fast.")
    (ACTION VERDANCE-F)>

;"The river: entering, drinking or swimming in it is always refused. The
  way across is the ship, once the crowd parts."
<ROUTINE VERDANCE-F ()
    <COND (<VERB? ENTER DRINK SWIM> <TELL "No one crosses the Verdance." CR>)
          (ELSE <FEATURE-F>)>>

;"The lane and the ship are off-stage (in no room at all) until PARTING moves
  them into the River's Edge. ENTER, FOLLOW, WALK and CLIMB on either of
  them walk to the gangplank; BOARD is zillib's synonym for ENTER."
<ROUTINE LANE-F ()
    <COND (<VERB? ENTER FOLLOW WALK CLIMB> <WALK-LANE>)
          (ELSE <FEATURE-F>)>>

<OBJECT LANE
    (DESC "lane")
    (SYNONYM LANE PATH WAY GAP)
    (FLAGS NDESCBIT)
    (TEXT "A shoulder's width between bowed heads, running straight down to the
water.")
    (ACTION LANE-F)>

<OBJECT FUNERAL-SHIP
    (DESC "ship")
    (SYNONYM SHIP PROW GANGPLANK WALLETS RAIL BOAT)
    (ADJECTIVE FUNERAL HIGH)
    (FLAGS NDESCBIT)
    (TEXT "A ship like the funeral ships: the same high prow, the same hard
wallets strung along it like lanterns that are not lit. Nobody is laid out on
it. The gangplank is down.")
    (ACTION LANE-F)>

;"--- 20. Foot of the Gangplank (the end) ---------------------------------------------
  The last room. WALK-LANE moves you here, then ends the game with JIGS-UP;
  the closing text is JIGS-UP's message."

<ROOM GANGPLANK-FOOT
    (DESC "Foot of the Gangplank")
    (IN ROOMS)
    (LDESC "You walk the lane and stop at the foot of the gangplank, your hand on
the rail, one step from going aboard.")
    (FLAGS LIGHTBIT)>


;"============================================================================
  8. GRAMMAR  --  the game's own verbs
  ----------------------------------------------------------------------------
  zillib supplies the standard verbs (in its verbs.zil). A SYNTAX line maps
  a sentence pattern to an action routine (V-...). OBJECT is a noun phrase;
  (FIND flag) tells the parser what to guess when the player leaves the
  object out; TOPIC accepts any words at all. A word that appears in a
  SYNTAX line between the verb and an OBJECT becomes a preposition. Object
  ACTION routines see the action first and can override any of these.
 ============================================================================"

;"TYPE <word>: the kiosk (P1) and the keypad (P7). V-TYPE is in section 4.
  TYPE UP needs its own line: UP is already a preposition (PICK UP), so the
  parser reads TYPE UP as 'TYPE, preposition UP' and the TOPIC line no
  longer fits. KLUDGEBIT is zillib's trick for a slot that must be filled
  but means nothing: the parser fills it with a dummy object by itself."
<SYNTAX TYPE TOPIC = V-TYPE>
<SYNTAX TYPE UP OBJECT (FIND KLUDGEBIT) = V-TYPE>

;"SAY NOBODY / ANSWER NOBODY at the kiosk or the keypad means TYPE NOBODY:
  V-SAY hands it to V-TYPE, which reads the word after the verb whatever the
  verb was. UP needs its own line again, for SAY UP.

  Anywhere else, SAY MONEY TO BUSKER is the SAY-TO action, with the busker
  as PRSI (the topic fills the first slot), and PERSON-F gives that person's
  reply to an unknown topic. A bare SAY MONEY talks to the person here, the
  way Inform's parser fills in '(to the busker)': V-SAY finds them and
  PERFORMs SAY-TO itself, with no first object."
<SYNTAX SAY TOPIC = V-SAY>
<SYNTAX SAY UP OBJECT (FIND KLUDGEBIT) = V-SAY>
<SYNTAX SAY TOPIC TO OBJECT (FIND PERSONBIT) = V-SAY-TO>
<VERB-SYNONYM SAY ANSWER SHOUT SPEAK>

<ROUTINE V-SAY ("AUX" P)
    <COND (<EQUAL? ,HERE ,SWITCHBACKS ,COLD-CAVERN> <V-TYPE> <RTRUE>)>
    ;"Who is listening? The first person here -- or, if there are several,
      the one who is not part of the scenery (NDESCBIT): in the break room,
      the steward rather than the murklings."
    <MAP-CONTENTS (I ,HERE)
        <COND (<AND <FSET? .I ,PERSONBIT> <N==? .I ,WINNER>
                    <OR <NOT .P>
                        <AND <FSET? .P ,NDESCBIT> <NOT <FSET? .I ,NDESCBIT>>>>>
               <SET P .I>)>>
    <COND (<NOT .P> <TELL "There is no reply." CR>)
          (ELSE
           <TELL "(to " T .P ")" CR>
           <PERFORM ,V?SAY-TO <> .P>)>
    <RTRUE>>

<ROUTINE V-SAY-TO ()
    <TELL "There is no reply." CR>>

;"SELECT NONE: the KYC CAPTCHA (P4). NONE and NOTHING become prepositions
  here, with the same KLUDGEBIT slot as TYPE UP."
<SYNTAX SELECT NONE OBJECT (FIND KLUDGEBIT) = V-SELECT-NONE>
<SYNTAX SELECT NOTHING OBJECT (FIND KLUDGEBIT) = V-SELECT-NONE>
<SYNTAX SELECT OBJECT = V-SELECT>
<VERB-SYNONYM SELECT CHOOSE>

<ROUTINE V-SELECT-NONE ()
    <COND (<N==? ,HERE ,ROOT-CELLAR> <TELL "There is nothing here to select." CR>)
          (,KYC-CAPTCHA <TELL "The CAPTCHA has already been passed." CR>)
          (ELSE
           <SETG KYC-CAPTCHA T>
           <TELL "You select none of the squares. You cannot prove murklings are in
any of them; absence of evidence is evidence of absence, legally speaking. The
scanner thinks about this for a long time. CAPTCHA: PASSED." CR>
           <KYC-CHECK>)>>

<ROUTINE V-SELECT ()
    <COND (<N==? ,HERE ,ROOT-CELLAR> <TELL "There is nothing here to select." CR>)
          (ELSE <TELL "You study the squares. Every one is pitch black. Any of
them might contain murklings -- or none of them." CR>)>>

;"SIGN: the union charter (P6) handles SIGN in its own ACTION."
<SYNTAX SIGN OBJECT = V-SIGN>
<SYNTAX SIGN OBJECT WITH OBJECT = V-SIGN>
<VERB-SYNONYM SIGN AUTOGRAPH>

<ROUTINE V-SIGN ()
    <TELL "You'd need something that wants your signature." CR>>

;"OIL: only the buckle wants it (P8). Everywhere else OIL is refused, so the
  good stuff can't be wasted."
<SYNTAX OIL OBJECT = V-OIL>
<SYNTAX OIL OBJECT WITH OBJECT = V-OIL>
<VERB-SYNONYM OIL GREASE LUBRICATE>

<ROUTINE V-OIL ()
    <COND (<NOT <AND <IN? ,OIL-CAN ,WINNER> ,CAN-FULL>>
           <TELL "You have nothing to oil it with." CR>)
          (ELSE <TELL "That doesn't need oiling, and the good stuff is too good
to waste." CR>)>>

;"FILL CAN FROM PUMP and FILL CAN WITH OIL (zillib has only FILL OBJECT).
  The can's own ACTION handles FILL whatever the second object is."
<SYNTAX FILL OBJECT FROM OBJECT = V-FILL>
<SYNTAX FILL OBJECT WITH OBJECT = V-FILL>

;"POUR OIL, POUR OIL ON BUCKLE, EMPTY CAN ONTO BUCKLE. zillib has only EMPTY
  OBJECT; the two-object form is our own EMPTY-ONTO action, which the oil
  can (section 5) turns into oiling. For anything else it falls back to a
  plain EMPTY."
<SYNTAX EMPTY OBJECT ON OBJECT = V-EMPTY-ONTO>
<SYNTAX EMPTY OBJECT ONTO OBJECT = V-EMPTY-ONTO>
<SYNTAX EMPTY OBJECT INTO OBJECT = V-EMPTY-ONTO>
<SYNTAX EMPTY OBJECT IN OBJECT = V-EMPTY-ONTO>
<SYNTAX EMPTY OBJECT OVER OBJECT = V-EMPTY-ONTO>
<SYNTAX EMPTY OBJECT TO OBJECT = V-EMPTY-ONTO>
<SYNTAX POUR OBJECT = V-EMPTY>
<SYNTAX POUR OBJECT OUT OBJECT (FIND KLUDGEBIT) = V-EMPTY>
<SYNTAX POUR OBJECT ON OBJECT = V-EMPTY-ONTO>
<SYNTAX POUR OBJECT ONTO OBJECT = V-EMPTY-ONTO>
<SYNTAX POUR OBJECT INTO OBJECT = V-EMPTY-ONTO>
<SYNTAX POUR OBJECT IN OBJECT = V-EMPTY-ONTO>
<SYNTAX POUR OBJECT OVER OBJECT = V-EMPTY-ONTO>
<SYNTAX POUR OBJECT TO OBJECT = V-EMPTY-ONTO>

<ROUTINE V-EMPTY-ONTO ()
    <PERFORM ,V?EMPTY ,PRSO>
    <RTRUE>>

;"OPEN BUCKLE WITH PIN: zillib's OPEN takes one object, so this line sends
  the two-object form to zillib's own UNLOCK action (as Inform's grammar
  does). The buckle and the pawl handle UNLOCK themselves."
<SYNTAX OPEN OBJECT WITH OBJECT = V-UNLOCK>

;"PRESS: a VERB-SYNONYM of zillib's PUSH, so PRESS FOYER TILE is the PUSH
  action. PRESS PAWL WITH PIN has two objects, so it matches only this
  two-object line and becomes PRESS-WITH. A one-object PRESS FOYER TILE
  matches zillib's own PUSH OBJECT line exactly; this line has no (FIND ...)
  for its second object, so the parser has nothing to guess with and never
  turns a plain press into PRESS ... WITH something you are holding."
<VERB-SYNONYM PUSH PRESS MOVE>
<SYNTAX PUSH OBJECT WITH OBJECT = V-PRESS-WITH>

<ROUTINE V-PRESS-WITH ()
    <TELL "Pressing " T ,PRSO " with " T ,PRSI " achieves nothing." CR>>

;"PUSH PIN INTO PAWL says PRESS PAWL WITH PIN the other way round. A SYNTAX
  line cannot swap its objects, so PUSH-INTO is a tiny action of its own that
  PERFORMs PRESS-WITH with them swapped. (MOVE is a PUSH synonym above, as it
  is in Inform: MOVE TELESCOPE.)"
<SYNTAX PUSH OBJECT INTO OBJECT = V-PUSH-INTO>
<SYNTAX PUSH OBJECT IN OBJECT = V-PUSH-INTO>
<SYNTAX PUSH OBJECT AGAINST OBJECT = V-PUSH-INTO>

<ROUTINE V-PUSH-INTO ()
    <PERFORM ,V?PRESS-WITH ,PRSI ,PRSO>
    <RTRUE>>

;"FEND VERDLINGS WITH PIKE / RAISE PIKE: the pike line (P10)."
<SYNTAX FEND OBJECT = V-FEND>
<SYNTAX FEND OFF OBJECT = V-FEND>
<SYNTAX FEND OBJECT WITH OBJECT = V-FEND>
<SYNTAX FEND OFF OBJECT WITH OBJECT = V-FEND>
<VERB-SYNONYM FEND WARD>
<SYNTAX RAISE OBJECT = V-FEND>
<SYNTAX RAISE OBJECT AT OBJECT = V-FEND>
<VERB-SYNONYM RAISE BRANDISH LEVEL>

<ROUTINE V-FEND ()
    <COND (<NOT <EQUAL? ,HERE ,RUNOUT ,RIVER-EDGE>>
           <TELL "There's nothing here to fend off." CR>)
          (<NOT <IN? ,PIKE ,WINNER>>
           <TELL "You have nothing to fend them off with. Bare hands do not
impress a verdling." CR>)
          (<==? ,HERE ,RIVER-EDGE>
           <TELL "There is nothing to fend off. They are bowing." CR>)
          (,PIKE-RAISED <TELL "The pike is already raised." CR>)
          (ELSE
           <SETG PIKE-RAISED T>
           <TELL "You raise the pike and level it at the crowd." CR>)>>

;"BOW: the ending's one ceremony."
<SYNTAX BOW = V-BOW>
<SYNTAX BOW TO OBJECT = V-BOW>
<VERB-SYNONYM BOW KNEEL CURTSEY CURTSY>

<ROUTINE V-BOW ()
    <COND (<==? ,HERE ,RIVER-EDGE>
           <TELL "A ripple goes through the crowd, something very like approval.
That is worse." CR>)
          (<==? ,HERE ,RUNOUT>
           <TELL "The verdlings watch you bow with total contempt. It is not what
they want from you. They want you gone." CR>)
          (ELSE <TELL "You bow to nobody in particular. The wind does not bow
back." CR>)>>

;"RING: the marble doorbell. Objects that ring handle RING themselves."
<SYNTAX RING OBJECT = V-RING>
<VERB-SYNONYM RING BUZZ>

<ROUTINE V-RING ()
    <TELL "Nothing rings." CR>>

;"DIG BY GONDOLA (P9). BY, NEAR, BESIDE and AROUND become prepositions; DIG
  IN/INTO/THROUGH the mempool's drift works too. There is deliberately no
  line for a bare DIG: with only object lines, the parser asks 'What do you
  want to dig?', which costs no turn -- that matters on the Runout, where
  every turn is counted."
<SYNTAX DIG OBJECT = V-DIG>
<SYNTAX DIG BY OBJECT = V-DIG>
<SYNTAX DIG NEAR OBJECT = V-DIG>
<SYNTAX DIG BESIDE OBJECT = V-DIG>
<SYNTAX DIG AROUND OBJECT = V-DIG>
<SYNTAX DIG UNDER OBJECT = V-DIG>
<SYNTAX DIG IN OBJECT = V-DIG>
<SYNTAX DIG INTO OBJECT = V-DIG>
<SYNTAX DIG THROUGH OBJECT = V-DIG>

<ROUTINE V-DIG ()
    <TELL "Digging would achieve nothing here." CR>>

;"LOOK THROUGH TELESCOPE (P2). zillib already has LOOK, LOOK AT, LOOK IN and
  LOOK UNDER; this adds one more pattern to the same verb."
<SYNTAX LOOK THROUGH OBJECT = V-LOOK-THROUGH>

<ROUTINE V-LOOK-THROUGH ()
    <TELL "You see nothing special through " T ,PRSO "." CR>>

;"TURN on its own (zillib only has TURN ON and TURN OFF)."
<SYNTAX TURN OBJECT = V-TURN>
<VERB-SYNONYM TURN ROTATE SWING>

<ROUTINE V-TURN ()
    <TELL "Nothing obvious happens." CR>>

;"POINT/AIM: POINT TELESCOPE DOWN (P2) and, on the Runout, POINT PIKE AT
  VERDLINGS (the Runout's M-BEG turns that into FEND). DOWN is already a
  preposition (PUT DOWN), and a trailing preposition needs an object slot
  after it, so these lines use the KLUDGEBIT trick from TYPE UP. TURN (and
  SWING) TELESCOPE DOWN is the same action."
<SYNTAX POINT OBJECT = V-POINT>
<SYNTAX POINT OBJECT DOWN OBJECT (FIND KLUDGEBIT) = V-POINT>
<SYNTAX POINT OBJECT AT OBJECT = V-POINT>
<SYNTAX POINT OBJECT TOWARD OBJECT = V-POINT>
<SYNTAX POINT OBJECT TOWARDS OBJECT = V-POINT>
<VERB-SYNONYM POINT AIM>
<SYNTAX TURN OBJECT DOWN OBJECT (FIND KLUDGEBIT) = V-POINT>

<ROUTINE V-POINT ()
    <TELL "You point " T ,PRSO ". Nothing comes of it." CR>>

;"JUMP IN RIVER (zillib has only a bare JUMP). At the River's Edge it gets
  the river's answer in RIVER-EDGE-F."
<SYNTAX JUMP IN OBJECT = V-JUMP-IN>
<SYNTAX JUMP INTO OBJECT = V-JUMP-IN>

<ROUTINE V-JUMP-IN ()
    <TELL "Jumping in " T ,PRSO " would achieve nothing here." CR>>

;"FOLLOW LANE: walks the lane at the end (LANE-F)."
<SYNTAX FOLLOW OBJECT = V-FOLLOW>

<ROUTINE V-FOLLOW ()
    <TELL "You'd rather not." CR>>

;"Conversation. SHOW mirrors zillib's GIVE (including SHOW STEWARD CHARTER);
  ASK ... ABOUT uses a TOPIC slot, read back with ABOUT? (section 4)."
<SYNTAX SHOW OBJECT (HAVE HELD CARRIED) TO OBJECT (FIND PERSONBIT) = V-SHOW>
<SYNTAX SHOW OBJECT (FIND PERSONBIT) OBJECT (HAVE HELD CARRIED) = V-SSHOW>
<VERB-SYNONYM SHOW DISPLAY>

<ROUTINE V-SHOW ()
    <COND (<FSET? ,PRSI ,PERSONBIT>
           <TELL CT ,PRSI " glances at " T ,PRSO " without interest." CR>)
          (ELSE <TELL "Nobody here is interested." CR>)>>

<ROUTINE V-SSHOW ()
    <PERFORM ,V?SHOW ,PRSI ,PRSO>
    <RTRUE>>

<SYNTAX ASK OBJECT (FIND PERSONBIT) ABOUT TOPIC = V-ASK-ABOUT>
<VERB-SYNONYM ASK QUESTION QUIZ>

<ROUTINE V-ASK-ABOUT ()
    <COND (<FSET? ,PRSO ,PERSONBIT> <TELL "There is no answer." CR>)
          (ELSE <TELL "Talking to " A ,PRSO ", huh?" CR>)>>

<SYNTAX KISS OBJECT = V-KISS>
<VERB-SYNONYM KISS HUG EMBRACE>

<ROUTINE V-KISS ()
    <TELL "Not here, not now." CR>>

;"LISTEN: a room's SOUNDS property. LISTEN TO BUSKER is the busker's own."
<SYNTAX LISTEN = V-LISTEN>
<SYNTAX LISTEN TO OBJECT = V-LISTEN-TO>
<VERB-SYNONYM LISTEN HEAR>

<ROUTINE V-LISTEN ("AUX" S)
    <COND (<SET S <GETP ,HERE ,P?SOUNDS>> <TELL .S CR>)
          (ELSE <TELL "You hear nothing unexpected." CR>)>>

<ROUTINE V-LISTEN-TO ()
    <COND (<FSET? ,PRSO ,PERSONBIT>
           <TELL CT ,PRSO " has nothing to say just now." CR>)
          (ELSE <V-LISTEN>)>>
