;"============================================================================
  MINGUS II: EVERYTHING ROLLS DOWNHILL  --  Frotzsmith sample (ZIL, zillib, z5)
 ----------------------------------------------------------------------------
  The third longer sample, and the sequel to Mingus I. The Architect's
  Legacy showed how a big game is ORGANISED; Mingus I showed how to make a
  timed, deadly rule FAIR. This one keeps that layout and adds two lessons:

    1. HOW TO CODE AN NPC. Lucan Fairweather, the Thursday tenor, follows
       you, leads you, talks, reacts to what you give and show him, runs on
       a small state machine, and dies in a scripted event on a timer. His
       code is section 11, and every routine there opens with the LESSON it
       teaches. Two more NPCs show two more patterns: Sandwich, a trickster
       on a fixed schedule, and Mrs. Thrumble, who answers a bell.
    2. HOW TO MAKE A VEHICLE WITHOUT MOVING ROOMS. The funeral ship is four
       fixed rooms. Where the ship IS lives in one global, SHIP-AT, which
       decides what you see over the rail, where OUT leads, and what the
       current does.

  The same game exists in Inform 6 (the Inform 6 sample of the same name).
  Both versions share one walkthrough and print the same things on the same
  turns, so comparing them side by side is a good way to learn either
  language.

  THE STORY
    Mingus I ended at the foot of a funeral ship's gangplank, with thousands
    of verdlings bowed to the pike in your hand. Mingus II starts there, the
    next morning. Nobody who has floated down the Verdance has ever come
    back. On the way down you find five names -- evidence of how far five of
    the lost got -- and stow them in the ship's custody chest. The river
    decides how far YOU get.

  HOW THIS FILE IS ORGANISED  (search for the banner text to jump)
     1. SETUP ............ banner, scoring switch, ALL game state
     2. GO ............... the entry point: intro text, first room
     3. LIBRARY .......... INSERT-FILE parser, the score table, the two
                           endings (PRINT-GAME-OVER, PRINT-RANK), topic words
     4. SHARED ROUTINES .. what Inform would call classes (features, the
                           room routine every room shares), the ship's
                           position, casting off, the river rule
     5. THE SHIP ......... Main Deck, Prow, Stern, Hold  (rooms 1-4)
     6. PART ONE ......... The Sluice          (the Mingus bank, rooms 5-7)
     7. PART TWO ......... The Sandbar         (mid-river, rooms 8-9)
     8. PART THREE ....... The old-side bank   (rooms 10-14)
     9. PART FOUR ........ The Gilded Span     (mid-river, rooms 15-16)
    10. PART FIVE ........ The Intake          (the Mingus bank, rooms 17-19)
    11. NPCS ............. Lucan (the showcase), Sandwich, Mrs. Thrumble
    12. THE DISPATCHER ... the one end-of-turn interrupt: river, Lucan,
                           Sandwich
    13. FINALE ........... The Old-Side Shore  (room 20)
    14. GRAMMAR .......... the game's own SYNTAX lines and V- routines

  THE MAP  (20 rooms; the river runs SOUTH, the Mingus bank is west, the
            old-side bank east)

    PART ONE  Inside the Sluice -w/e- Sluice Mouth -w/e- Foot of the Gangplank
                                                            | up/in/board
    THE SHIP (four fixed rooms)                         Main Deck --n/s-- Prow
                                                            |  \--s/n-- Stern
                                                            | down/up
                                                           Hold [custody chest]

    OUT from the Main Deck (and IN back) depends on SHIP-AT:
      SANDBAR  The Sandbar -e/w- Expedition Wreck
      PIER     Stone Pier -n/s- Mine Heads -n/s- Hollow Green -n/s- Old Fence
                                    | e/w
                              Outside the Half-Buried Hall
      SPAN     (Prow) -up/climb chain/down- Broken End -w/e- Span Deck
      INTAKE   Intake Screen -w/e- Divers' Shed ; Intake Screen -n/s- Drowned
                                                                      Road
    FINALE    (the Race) --wreck--> The Old-Side Shore

    The voyage: Sluice -> passage 1 -> Sandbar -> passage 2 -> Stone Pier ->
    passage 3 -> Gilded Span -> passage 4 -> Intake -> passage 5, the Race
    -> wrecked on the old-side bank.

  THE PUZZLES  (10 puzzles x 8 points + 5 names x 4 points = 100)
    P1  The launch       bow first, then the lever  -> BOW, PULL LEVER
    P2  The feint        reach for the gilt         -> TAKE STRONGBOX
    P3  Ship the sweep   a steering oar             -> PUT SWEEP IN SOCKET
    P4  Kedge off        grapnel astern, haul       -> THROW GRAPNEL, PULL LINE
    P5  The crossing     the one-turn window        -> STEER EAST
    P6  The lifebelt     where Lucan leads you      -> TAKE LIFEBELT
    P7  The chain        the one-turn window        -> THROW GRAPNEL AT CHAIN
    P8  The civic key    a long reach               -> PULL BOX WITH PIKE
    P9  Stop the pump    Vaunt's key, Vaunt's pump  -> PUT KEY IN SWITCH
    P10 The Race         wear what floats           -> WEAR LIFEBELT
    N1-N5 The five names, each PUT IN CHEST: the launch register, the
    Expedition's nameboard, Lucan's songbook, the diver's tag, and
    Councillor Sutt's plaque.

  TECHNIQUES WORTH STEALING
    - ONE end-of-turn dispatcher (I-WORLD, section 12): a single interrupt,
      QUEUEd with -1 in GO so it runs after every turn, that calls the
      river, then Lucan, then Sandwich, in a fixed order. No room has an
      M-END handler and nothing else is QUEUEd, so every turn's text always
      comes out in the same order.
    - A vehicle as state: four ship rooms that never move, plus SHIP-AT,
      PASSAGE and DRIFT for 'where is the ship?' (section 4). FLOAT-OBJECTS
      moves the few things that come and go with the ship (the chain, the
      mooring rope, the river itself) into whichever room you are in.
    - A countdown with a window: the current. A landing comes alongside
      and you get exactly one turn to act. A miss loops you round (the
      eddy) or kills you (the broken end).
    - NPC: a state machine (HIDDEN -> FOLLOWING -> GUIDING -> ARRIVED ->
      DEAD), and each state's behaviour in one place (LUCAN-TICK).
    - NPC: following (he walks after you) and leading (he goes first, waits
      a turn for you, and catches up if you get ahead).
    - NPC: conversation: one topic table shared by ASK and TELL, a fallback
      line, and a greeting (HELLO, SAY HELLO, GREET LUCAN).
    - NPC: reacting to GIVE and SHOW, item by item.
    - NPC: a scripted, timed event (his death, two turns after arrival,
      whatever you do), and its consequences: his effects stay where he
      fell, another NPC mentions him, and his book reaches you through her.
    - A scheduled antagonist whose interference is deterministic and
      learnable (Sandwich's front-run rule).
    - Gates that explain themselves: you can't leave a landing without the
      thing you'll need next, and the refusal says why.
    - A container that only takes some things and never gives back (the
      custody chest, which works like a trophy case).
    - A warn-once global rule (the river).
    - INVENTORY as a real turn: zillib counts it as a 'game verb' that
      passes no time, so this game maps it to its own action instead
      (V-TURN-INVENTORY, section 14).
    - A win and a death that end with different words (PRINT-GAME-OVER
      branches on MINGUS-WON), and a custom rank (PRINT-RANK) that carries
      the closing teaser.

  Compiles cleanly with the bundled ZILF; targets z5.
 ============================================================================"


;"============================================================================
  1. SETUP  --  banner, scoring switch, and all game state
 ============================================================================"

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"Mingus II: Everything Rolls Downhill|
A Frotzsmith sample: a river voyage in five landings.">

;"--- Scoring ----------------------------------------------------------------
  USE-SCORING? switches on zillib's scoring module (SCORE, FULL SCORE, the
  '[Your score has gone up]' notices, and the score at game end). It must be
  set BEFORE the parser is inserted. The fifteen achievements themselves are
  listed in section 3, right after the library."

<SETG USE-SCORING? T>
<CONSTANT MAX-SCORE 100>

;"--- Where the ship is -------------------------------------------------------
  SHIP-AT is one of these. The landings are numbered from 1 so that 0 can
  mean 'this room is not part of any landing' (a room's LANDING property,
  section 4)."
<CONSTANT SLUICE 1>             ;"moored at the Sluice        (Part One)"
<CONSTANT SANDBAR 2>            ;"aground on the Sandbar      (Part Two)"
<CONSTANT PIER 3>               ;"made fast at the Stone Pier (Part Three)"
<CONSTANT SPAN 4>               ;"hanging from the Span's chain (Part Four)"
<CONSTANT INTAKE 5>             ;"pinned to the intake screen (Part Five)"
<CONSTANT ADRIFT 6>             ;"on the current, between landings"

;"--- Lucan's states (section 11 explains each one) ---------------------------"
<CONSTANT HIDDEN 0>             ;"stowed away; not in play yet"
<CONSTANT FOLLOWING 1>          ;"walks after you"
<CONSTANT GUIDING 2>            ;"goes ahead of you on the old-side bank"
<CONSTANT ARRIVED 3>            ;"at the Hollow Green; the timer is running"
<CONSTANT DEAD 4>               ;"gone; only his effects remain"

;"--- Sandwich's schedule (section 11) ----------------------------------------"
<CONSTANT SW-UPSTREAM 0>        ;"offshore at the Foot of the Gangplank"
<CONSTANT SW-AHEAD 1>           ;"shot past you; waiting at the Wreck"
<CONSTANT SW-WAITING 2>         ;"has told you the front-run rule"
<CONSTANT SW-HOLDING 3>         ;"holds a decoy: 'Yours for the coat.'"
<CONSTANT SW-INTAKE 4>          ;"pinned at the intake, holding the plaque"
<CONSTANT SW-RACING 5>          ;"rowed off downstream ahead of you"
<CONSTANT SW-GONE 6>            ;"broke up in the white water"

;"--- Game state -------------------------------------------------------------
  Everything the game remembers lives here. Ask 'what has the player done?'
  and the answer is on this screen. <> is ZIL's 'false'."

<GLOBAL SHIP-AT 1>              ;"where the ship is (starts at SLUICE)"
<GLOBAL PASSAGE 0>              ;"which passage, 1-5, while ADRIFT"
<GLOBAL DRIFT 0>                ;"turns into this passage (0-3)"
<GLOBAL LUCAN-STATE 0>          ;"Lucan's state machine (starts HIDDEN)"
<GLOBAL LUCAN-TIMER 0>          ;"turns since he ARRIVED at the Hollow Green"
<GLOBAL LAST-LOC <>>            ;"where you were when the last turn ended"
<GLOBAL SANDWICH-STATE 0>       ;"Sandwich's schedule (starts SW-UPSTREAM)"
<GLOBAL SANDWICH-ASKED <>>      ;"he has asked after Lucan at the intake"
<GLOBAL RIVER-WARNED <>>        ;"the Verdance has used up its one warning"
<GLOBAL PUMP-STOPPED <>>        ;"P9 done: the intake has let go"
<GLOBAL LINES-LET-GO <>>        ;"P1: the verdlings have let go the lines"
<GLOBAL SWEEP-SHIPPED <>>       ;"P3: the sweep is in the stern socket"
<GLOBAL KEDGE-SET <>>           ;"P4: the grapnel is biting astern"
<GLOBAL GRAPNEL-HOOKED <>>      ;"P7: the grapnel holds the chain"
<GLOBAL SONGBOOK-GIVEN <>>      ;"Mrs. Thrumble has handed over the songbook"
<GLOBAL MINGUS-WON <>>          ;"set just before the winning JIGS-UP"


;"============================================================================
  2. GO  --  the entry point
  ----------------------------------------------------------------------------
  GO may not have local variables; it sets up the world and hands over to
  MAIN-LOOP, which never returns. QUEUE with -1 makes I-WORLD (section 12)
  run at the end of EVERY turn from now on; its first run is at the end of
  your first command, never on the opening text.
 ============================================================================"

<ROUTINE GO ()
    <SETG MODE ,VERBOSE>          ;"full room descriptions on every visit"
    <SETG STANDARD-WAIT 1>        ;"WAIT is one turn (zillib's default is 4)"
    <CRLF> <CRLF>
    <TELL "Last night you came down the Mingus with Lady Vaunt's coat and a
verdling's pike, and the verdlings of the valley floor bowed to you. They made
you a lane to the water. At the end of it was a funeral ship.|
|
The verdlings are still bowed. They have been bowed all night. In the grey
light the lane they made for you still runs to the water, and at the end of it
the funeral ship rocks at the mouth of the Sluice, its gangplank down, its
blank plaque polished on the mast. Nobody who has floated down the Verdance has
ever come back. Nobody here is going to stop you trying." CR CR>
    <INIT-STATUS-LINE>
    <V-VERSION>
    <SETG HERE ,GANGPLANK-FOOT>
    <SETG LAST-LOC ,GANGPLANK-FOOT>
    <MOVE ,PLAYER ,HERE>
    <IN-INFORM-ORDER>
    <FLOAT-OBJECTS>
    <QUEUE ,I-WORLD -1>
    <V-LOOK>
    <MAIN-LOOP>>


;"IN-INFORM-ORDER: MOVE puts an object FIRST among its new neighbours, so
  moving these in reverse makes the library list them in the same order as
  the Inform version does (the coat above the pike; the sweep, the grapnel,
  the strongbox and then the nameboard at the Wreck). It changes nothing
  else."
<ROUTINE IN-INFORM-ORDER ()
    <MOVE ,PIKE ,PLAYER>
    <MOVE ,COAT ,PLAYER>
    <MOVE ,NAMEBOARD ,WRECK>
    <MOVE ,STRONGBOX ,WRECK>
    <MOVE ,GRAPNEL ,WRECK>
    <MOVE ,SWEEP ,WRECK>>


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
  (the library remembers), so it is always safe to call it again, and FULL
  SCORE prints these descriptions.
                  P1-P10: 8 points each  |  the five names: 4 points each"
<SCORING-ACHIEVEMENTS
    (LAUNCH "launching the funeral ship")
    (FEINT "front-running the front-runner")
    (SWEEP "shipping the sweep")
    (KEDGE "kedging off the Sandbar")
    (CROSSING "crossing the Verdance")
    (LIFEBELT "finding what the song was right about")
    (CHAIN "catching the chain")
    (KEY "fishing up the civic key")
    (PUMP "stopping the pump")
    (RACE "surviving the Race")
    (REGISTER "keeping the launch register")
    (NAMEBOARD "keeping the Expedition's names")
    (SONGBOOK "keeping Lucan's songbook")
    (TAG "keeping the diver's tag")
    (PLAQUE "keeping Councillor Sutt's plaque")>

;"--- The two endings ----------------------------------------------------------
  Both endings go through JIGS-UP, which prints its message, then
  PRINT-GAME-OVER, then the score line (V-SCORE), which calls PRINT-RANK.
  One global decides which banner you get: THE-WRECK (section 13) sets
  MINGUS-WON just before the winning JIGS-UP; every death leaves it false."
<REPLACE-DEFINITION PRINT-GAME-OVER
    <ROUTINE PRINT-GAME-OVER ()
        <COND (,MINGUS-WON
               <TELL "    *** You have gone further than anyone ***" CR CR>)
              (ELSE
               <TELL "    *** You have died ***" CR CR>)>>>

;"The rank follows the score line, so the closing teaser lives here too: it
  is the very last thing a winner reads. A win is always Furthest
  Downstream, whatever the score (you can win without every name, or after
  paying Sandwich); a mid-game SCORE and a death show the ladder. The teaser
  counts the names that made it into the chest."
<REPLACE-DEFINITION PRINT-RANK
    <ROUTINE PRINT-RANK (DEAD? "AUX" N)
        <TELL "That earns you the rank of ">
        <COND (,MINGUS-WON <TELL "Furthest Downstream.">)
              (<G=? ,SCORE 75> <TELL "Front-Runner.">)
              (<G=? ,SCORE 50> <TELL "Downstream Validator.">)
              (<G=? ,SCORE 25> <TELL "Liquidity Provider.">)
              (ELSE <TELL "Ballast.">)>
        <CRLF>
        <COND (<AND .DEAD? ,MINGUS-WON>
               <SET N <NAMES-IN-CHEST>>
               <TELL CR "You have reached the end of MINGUS II: EVERYTHING ROLLS
DOWNHILL. ">
               <COND (<==? .N 0> <TELL "No names are in the chest">)
                     (<==? .N 1> <TELL "One name is in the chest">)
                     (<==? .N 2> <TELL "Two names are in the chest">)
                     (<==? .N 3> <TELL "Three names are in the chest">)
                     (<==? .N 4> <TELL "Four names are in the chest">)
                     (ELSE <TELL "Five names are in the chest">)>
               <COND (<IN? ,SONGBOOK ,CUSTODY-CHEST>
                      <TELL "; one of them used to sing on Thursdays">)>
               <TELL ". Somewhere downstream, a man in sandwich boards is telling
nobody that he got there first.|
|
Coming next: MINGUS III: THE OLD SIDE. Nobody has ever come back. Somebody has
to be first." CR>)>>>

;"--- Topic words ---------------------------------------------------------------
  Words that only ever appear in ASK/TELL ... ABOUT topics, STEER FOR ...,
  or SAY .... A word must be in the dictionary for the code to name it as
  ,W?WORD, and for the parser to accept it at all (an unknown word stops the
  command with 'I don't know the word'). Words that are already the name of
  some object (SANDWICH, RIVER, SHIP...) are in the dictionary anyway."
<VOC "OLD" NOUN>
<VOC "SIDE" NOUN>
<VOC "ACROSS" NOUN>
<VOC "FAR" NOUN>
<VOC "BANK" NOUN>
<VOC "SONG" NOUN>
<VOC "SONGS" NOUN>
<VOC "VERSE" NOUN>
<VOC "POETS" NOUN>
<VOC "RUNNER" NOUN>
<VOC "LANTERN" NOUN>
<VOC "ASCENDANCY" NOUN>
<VOC "MINGUS" NOUN>
<VOC "MOUNTAIN" NOUN>
<VOC "BALLROOM" NOUN>
<VOC "HIMSELF" NOUN>
<VOC "YOU" NOUN>
<VOC "EMPIRE" NOUN>
<VOC "ABOVE" NOUN>
<VOC "SKY" NOUN>
<VOC "EXPLORERS" NOUN>
<VOC "LOST" NOUN>
<VOC "PEOPLE" NOUN>
<VOC "PIER" NOUN>
<VOC "SHORE" NOUN>
<VOC "WEATHER" NOUN>
<VOC "HELLO" NOUN>
<VOC "HI" NOUN>


;"============================================================================
  4. SHARED ROUTINES  --  write shared behaviour once
  ----------------------------------------------------------------------------
  An object's ACTION routine is called with PRSO (and PRSI) already set, so
  one routine can serve many objects: it asks 'which object is this?' with
  ,PRSO and reads the differences from the object's own properties. These
  are what Inform would call classes.

  A word on ORDER. For each command zillib's PERFORM asks, in this order:
  the room (its ACTION with M-BEG), the action's PRE- routine, the second
  object (PRSI) and then the first (PRSO); the first one to return true has
  handled it, and only if nobody does is the V- routine called. So in GIVE
  COAT TO LUCAN, Lucan (PRSI) hears about it before the coat does.

  The flags this game adds (a flag is created just by using it):
    SHIPBIT       one of the four ship rooms
    RIVERSIDEBIT  the Verdance is right there: SWIM, DIVE and JUMP here
                  are RIVER ATTEMPTS (below)
    NAMEBIT       one of the five names; the only things the chest takes
  And the properties:
    LANDING       which landing a room belongs to (SLUICE ... INTAKE)
    RIVER-LINE    the room's own line for the first river attempt
 ============================================================================"

;"--- Features: scenery you can look at --------------------------------------
  FEATURE-F: things a description mentions that you can examine but that
  should not be carried off or wrenched about. Give an object NDESCBIT (so
  the library never lists it) and (ACTION FEATURE-F) and it behaves like
  Inform's scenery. CT prints 'The' plus the object's DESC."
<ROUTINE FEATURE-F ()
    <COND (<VERB? TAKE PULL PUSH TURN>
           <TELL CT ,PRSO>
           <COND (<FSET? ,PRSO ,PLURALBIT> <TELL " are">)
                 (ELSE <TELL " is">)>
           <TELL " not coming with you." CR>)>>

;"--- The room routine every room shares ---------------------------------------
  zillib calls a room's ACTION with an argument (RARG) saying why:
    M-ENTER  you are arriving (GOTO sends it just before the description)
    M-LOOK   print the room's description (return true if you did)
    M-BEG    before every action here (return true to stop the action)
    M-END    after every turn here -- NOT USED in this game: all end-of-turn
             text comes from the one dispatcher (section 12)
  ROOM-F is the default ACTION. Its one job is M-ENTER: move the floating
  objects (below) into the room you are walking into. Rooms with more to do
  have their own routine, which hands everything else back to ROOM-F."
<ROUTINE ROOM-F (RARG)
    <COND (<==? .RARG ,M-ENTER> <FLOAT-OBJECTS>)>
    <RFALSE>>

;"--- The ship's position --------------------------------------------------------
  A few objects are in different places depending on where you are and
  where the ship is: the river (in every riverside room), the ship seen
  from outside, the verdlings on the Mingus bank, the mooring rope (only
  while the ship is made fast at the pier), the chain (at the Broken End,
  and at the Prow while it matters) and the kedge line. Inform calls these
  floating objects and asks each one 'are you here?' (found_in). In ZIL we
  do the same job in one routine: FLOAT-OBJECTS puts each one in HERE or
  takes it out of play (REMOVE). It runs whenever you enter a room
  (ROOM-F's M-ENTER) and whenever the ship moves (SHIP-TO), so the room you
  are standing in is always right, even when you didn't go anywhere."
<ROUTINE FLOAT-OBJECTS ()
    <FLOAT-ONE ,VERDANCE <FSET? ,HERE ,RIVERSIDEBIT>>
    <FLOAT-ONE ,FUNERAL-SHIP
           <EQUAL? ,HERE ,GANGPLANK-FOOT ,THE-SANDBAR ,STONE-PIER ,INTAKE-SCREEN>>
    <FLOAT-ONE ,VERDLINGS
           <OR <EQUAL? ,HERE ,GANGPLANK-FOOT ,SLUICE-MOUTH ,INTAKE-SCREEN>
               <AND <==? ,HERE ,MAIN-DECK> <==? ,SHIP-AT ,SLUICE>>>>
    <FLOAT-ONE ,MOORING-ROPE
           <AND <==? ,SHIP-AT ,PIER> <EQUAL? ,HERE ,MAIN-DECK ,STONE-PIER>>>
    <FLOAT-ONE ,CHAIN
           <OR <==? ,HERE ,BROKEN-END>
               <AND <==? ,HERE ,PROW>
                    <OR <==? ,SHIP-AT ,SPAN>
                        <AND <==? ,SHIP-AT ,ADRIFT> <==? ,PASSAGE 3>>>>>>
    <FLOAT-ONE ,KEDGE-LINE <AND ,KEDGE-SET <==? ,HERE ,STERN>>>>

;"FLOAT-ONE: one floating object, here or nowhere."
<ROUTINE FLOAT-ONE (OBJ HERE?)
    <COND (.HERE? <MOVE .OBJ ,HERE>)
          (ELSE <REMOVE .OBJ>)>>

;"SHIP-TO: the one place SHIP-AT changes. Then the floating objects are
  asked again, right now, because the view from the room you are standing
  in has just changed."
<ROUTINE SHIP-TO (WHERE)
    <SETG SHIP-AT .WHERE>
    <FLOAT-OBJECTS>>

;"OUTSIDE-VIEW: one sentence about the outside, chosen by SHIP-AT. The Main
  Deck ends its description with it -- the whole 'vehicle' is this COND."
<ROUTINE OUTSIDE-VIEW ()
    <COND (<==? ,SHIP-AT ,SLUICE>
           <TELL "Over the rail, the slipway runs down into the Verdance, and
the bowed verdlings line the Mingus bank, holding the ship's lines.">)
          (<==? ,SHIP-AT ,SANDBAR>
           <TELL "Over the rail, the ship sits aground on a long pale sandbar in
mid-river. You could go out onto it.">)
          (<==? ,SHIP-AT ,PIER>
           <TELL "Over the rail, the ship is made fast to an iron ring on an old
stone pier. That is the old side. You could go out onto it.">)
          (<==? ,SHIP-AT ,SPAN>
           <TELL "Overhead hangs the broken end of the gilded span, and the ship
hangs from its chain by the grapnel line, shuddering. The way up is the chain,
from the prow.">)
          (<==? ,SHIP-AT ,INTAKE>
           <TELL "Over the rail, the gilded grating of the intake holds the ship
pinned against the Mingus bank. You could go out onto its catwalk.">)
          (ELSE <TELL "Over the rail, the Verdance goes by, quick and quiet.">)>>

;"SHIP-OUT: OUT from any ship room (their OUT exit is PER SHIP-OUT). It goes
  ashore only from the Main Deck, and only at a landing that has a shore. A
  PER routine returns the room to go to, or prints why not and returns
  false, which means 'you stay put'."
<ROUTINE SHIP-OUT ()
    <COND (<N==? ,HERE ,MAIN-DECK>
           <TELL "The way off the ship is from the main deck." CR>
           <RFALSE>)
          (<==? ,SHIP-AT ,SLUICE> ,GANGPLANK-FOOT)
          (<==? ,SHIP-AT ,SANDBAR> ,THE-SANDBAR)
          (<==? ,SHIP-AT ,PIER> ,STONE-PIER)
          (<==? ,SHIP-AT ,INTAKE> ,INTAKE-SCREEN)
          (<==? ,SHIP-AT ,SPAN>
           <TELL "The only way off is up the chain, from the prow." CR>
           <RFALSE>)
          (ELSE
           <TELL "The Verdance. You know the line about the Verdance." CR>
           <RFALSE>)>>

;"--- Casting off ------------------------------------------------------------------
  CAST-OFF: leave the landing and start passage N. Each landing's cast-off
  action (PULL LEVER, PULL LINE, UNTIE ROPE, UNHOOK GRAPNEL, and the intake
  letting go) prints its own text and then calls this. The current itself
  moves at the end of the turn (RIVER-TICK, section 12), which is why the
  cast-off turn always ends at [CURRENT: 1/3].

  The five names are optional. Leaving a landing without its name only
  costs points, and the river says so once."
<ROUTINE CAST-OFF (N "AUX" LEFT)
    <COND (<==? ,SHIP-AT ,SLUICE> <SET LEFT ,LAUNCH-REGISTER>)
          (<==? ,SHIP-AT ,SANDBAR> <SET LEFT ,NAMEBOARD>)
          (<==? ,SHIP-AT ,PIER> <SET LEFT ,SONGBOOK>)
          (<==? ,SHIP-AT ,SPAN> <SET LEFT ,DIVER-TAG>)
          (<==? ,SHIP-AT ,INTAKE> <SET LEFT ,SUTT-PLAQUE>)>
    <COND (<AND .LEFT <NOT <ABOARD? .LEFT>>>
           <TELL CR "The river does not go back." CR>)>
    <SETG PASSAGE .N>
    <SETG DRIFT 0>
    <SHIP-TO ,ADRIFT>>

;"ABOARD?: is OBJ with you or on the ship? Climb the object tree from OBJ to
  the room it is in; if the player was on the way, you carry it."
<ROUTINE ABOARD? (OBJ)
    <REPEAT ()
        <COND (<NOT .OBJ> <RFALSE>)
              (<==? .OBJ ,WINNER> <RTRUE>)
              (<IN? .OBJ ,ROOMS> <RETURN <FSET? .OBJ ,SHIPBIT>>)>
        <SET OBJ <LOC .OBJ>>>>

;"PRINT-CURRENT: the counter, in plain ASCII, on a line of its own."
<ROUTINE PRINT-CURRENT ()
    <TELL "[CURRENT: " N ,DRIFT "/3]" CR>>

;"--- The river rule (warn once, globally) --------------------------------------
  A RIVER ATTEMPT is SWIM, DIVE or JUMP in a riverside room, ENTER RIVER, and
  a few places' own ways in (the girder at the Broken End, the road at the
  Drowned Road). The very first one in the whole game is refused, with the
  place's own line; every later one, anywhere, kills. One global,
  RIVER-WARNED, is the whole memory of the rule.

  RIVER-ATTEMPT returns only if you survive (JIGS-UP never returns: it waits
  for RESTART, RESTORE, UNDO or QUIT), and it returns false, so an exit's
  PER routine can simply end with it: false means 'stay put'."
<ROUTINE RIVER-ATTEMPT (LINE)
    <COND (<NOT ,RIVER-WARNED>
           <SETG RIVER-WARNED T>
           <TELL .LINE CR CR "[The Verdance warns you once. It has never warned
anyone twice.]" CR>
           <RFALSE>)>
    ;"This death happens during your action, before the CLOCKER has counted
      the turn, so count it here: the final score line then gives the same
      number of turns as Inform's."
    <SETG MOVES <+ ,MOVES 1>>
    <RIVER-DEATH>>

;"The death text, shared by the river rule and the Race without a lifebelt.
  MINGUS-WON is still false, so PRINT-GAME-OVER says '*** You have died ***'."
<ROUTINE RIVER-DEATH ()
    <JIGS-UP "The Verdance takes you, quick and quiet, the way it has taken
everyone. Nobody comes back.">>

;"The room's own line for the warning: its RIVER-LINE property if it has
  one, or else the line for a ship's rail or for a bank."
<ROUTINE RIVER-LINE-HERE ("AUX" L)
    <COND (<SET L <GETP ,HERE ,P?RIVER-LINE>> .L)
          (<FSET? ,HERE ,SHIPBIT>
           "You put a leg over the rail, and the current pulls at your boot like
a hand. You climb back.")
          (ELSE
           "You stand at the edge, and the Verdance goes by, quick and quiet,
close enough to touch. You step back.")>>

;"--- The pike: never lost ---------------------------------------------------------
  KEEP-PIKE?: the pike can't be given away (except to Lucan, who refuses it
  in character), put in anything or thrown at anything. In Inform the pike
  hears about GIVE and PUT IN first; in ZIL the person or container (PRSI)
  hears first, so every PRSI handler that could receive the pike asks this
  before anything else."
<ROUTINE KEEP-PIKE? ()
    <COND (<AND <PRSO? ,PIKE>
                <OR <VERB? PUT-IN PUT-ON THROW-AT THROW-AWAY>
                    <AND <VERB? GIVE> <NOT <PRSI? ,LUCAN>>>>>
           <TELL "You keep hold of the pike. Down here, it is the only thing
anyone respects." CR>
           <RTRUE>)>
    <RFALSE>>

;"ABOUT?: true if any of the given words appears anywhere in the topic of
  the current ASK/TELL ... ABOUT (or STEER FOR ..., or SAY ... TO). The
  parser leaves the topic's word numbers in P-TOPIC-START and P-TOPIC-END,
  so ASK LUCAN ABOUT THE OLD SIDE matches ,W?OLD. Unknown words read as 0,
  hence the .W check."
<ROUTINE ABOUT? (W1 "OPT" W2 W3 W4 W5 W6 "AUX" W)
    <DO (I ,P-TOPIC-START ,P-TOPIC-END)
        <SET W <GETWORD? .I>>
        <COND (<AND .W <EQUAL? .W .W1 .W2 .W3>> <RTRUE>)
              (<AND .W <EQUAL? .W .W4 .W5 .W6>> <RTRUE>)>>
    <RFALSE>>


;"============================================================================
  5. THE SHIP  --  four fixed rooms (1-4)
 ----------------------------------------------------------------------------
  The ship never moves in the object tree. SHIP-AT (section 4) says where it
  is; OUTSIDE-VIEW and SHIP-OUT turn that into what you see and where OUT
  goes. All four rooms have SHIPBIT and RIVERSIDEBIT: the river is always
  over the rail.
 ============================================================================"

;"--- The player's own belongings --------------------------------------------
  The pike: Mingus I's rules carry over. It can't be given away, put in
  anything or thrown (KEEP-PIKE?, section 4), so it can never be lost for
  good; DROP leaves it where it falls. The pike's ACTION also runs when it is
  PRSI (PULL BOX WITH PIKE), so it checks that it is PRSO first."
<OBJECT PIKE
    (DESC "pike")
    (SYNONYM PIKE STAFF SPEAR POLE)
    (ADJECTIVE VERDLING)
    (IN PLAYER)
    (FLAGS TAKEBIT)
    (TEXT "A verdling's pike: a long pole of river wood, its point worn bright.
Thousands of verdlings bowed to it. It is a very long reach.")
    (ACTION PIKE-F)>

<ROUTINE PIKE-F ()
    <COND (<NOT <PRSO? ,PIKE>> <RFALSE>)
          (ELSE <KEEP-PIKE?>)>>

;"Lady Vaunt's coat, the real one. Nothing needs it; Sandwich will take it as
  a price (section 11), and Lucan knows it. WEARBIT lets you WEAR it;
  NARTICLEBIT stops the library calling it 'a Lady Vaunt's coat'."
<OBJECT COAT
    (DESC "Lady Vaunt's coat")
    (SYNONYM COAT SHADOW)
    (ADJECTIVE LONG REAL LADY VAUNT ESME)
    (IN PLAYER)
    (FLAGS TAKEBIT WEARBIT NARTICLEBIT)
    (TEXT "Lady Vaunt's coat. The real one: it casts a shadow, which is more than
most things from the Ascendancy do.")>

;"--- 1. Main Deck -------------------------------------------------------------
  The description is printed by M-LOOK because its last sentence is
  OUTSIDE-VIEW (section 4). OUT is SHIP-OUT, the same in all four rooms."

<ROOM MAIN-DECK
    (DESC "Main Deck")
    (IN ROOMS)
    (NORTH TO PROW)
    (SOUTH TO STERN)
    (DOWN TO HOLD)
    (OUT PER SHIP-OUT)
    (FLAGS LIGHTBIT SHIPBIT RIVERSIDEBIT)
    (ACTION MAIN-DECK-F)>

<ROUTINE MAIN-DECK-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "The main deck of a funeral ship: broad, gilded, and built for
one passenger, who is meant to be lying down. An empty bier stands amidships
under the mast, where a blank plaque is bolted ready for somebody's seed words.
A receipt is pinned to the mast. Along the rail, the hooks where the hard
wallets hung are all bare. A chock lever stands by the rail. The prow is north,
the stern south, and a hatch leads down into the hold.|
|
">
           <OUTSIDE-VIEW>
           <CRLF>)
          (ELSE <ROOM-F .RARG>)>>

<OBJECT BLANK-PLAQUE
    (DESC "blank plaque")
    (SYNONYM PLAQUE MAST WORDS)
    (ADJECTIVE BLANK SEED)
    (IN MAIN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "Blank. Somebody has polished it, ready.")
    (ACTION FEATURE-F)>

;"Sandwich's first appearance is on paper: he got here before the dead did."
<OBJECT RECEIPT
    (DESC "receipt")
    (SYNONYM RECEIPT PAPER NOTE)
    (ADJECTIVE SALVAGE)
    (IN MAIN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "SALVAGE RECEIPT. Item: hard wallets, all. Fee: everything. Thank you
for choosing BOTTOM LINE SALVAGE. -- S.")
    (ACTION RECEIPT-F)>

<ROUTINE RECEIPT-F ()
    <COND (<VERB? TAKE PULL>
           <TELL "It's pinned to the mast with a gilt nail. Sandwich wanted it
found." CR>)>>

<OBJECT BIER
    (DESC "empty bier")
    (SYNONYM BIER HOOKS WALLETS RAIL)
    (ADJECTIVE EMPTY HARD)
    (IN MAIN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "The bier is empty, and so are the hooks along the rail. The hard
wallets are gone. Somebody got here first.")
    (ACTION FEATURE-F)>

<OBJECT DECK-HATCH
    (DESC "hatch")
    (SYNONYM HATCH HATCHWAY)
    (IN MAIN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "A square hatch with a ladder, down into the hold.")
    (ACTION DECK-HATCH-F)>

;"DO-WALK runs a whole movement action, exactly as if DOWN had been typed."
<ROUTINE DECK-HATCH-F ()
    <COND (<VERB? ENTER> <DO-WALK ,P?DOWN> <RTRUE>)
          (<VERB? OPEN CLOSE>
           <TELL "It stays open. The dead don't mind a draught." CR>)
          (ELSE <FEATURE-F>)>>

;"P1, part two: the chock lever. PULL (or PUSH, TURN) does nothing until the
  verdlings have let go of the lines (V-BOW, section 14). Then it launches
  the ship: the cast-off action for passage 1."
<OBJECT CHOCK-LEVER
    (DESC "chock lever")
    (SYNONYM LEVER HANDLE)
    (ADJECTIVE CHOCK)
    (IN MAIN-DECK)
    (FLAGS NDESCBIT)
    (ACTION CHOCK-LEVER-F)>

<ROUTINE CHOCK-LEVER-F ()
    <COND (<VERB? EXAMINE>
           <COND (<==? ,SHIP-AT ,SLUICE>
                  <TELL "A long iron lever. Below the rail it runs down to the
chock that holds the ship on the slip." CR>)
                 (ELSE <TELL "A long iron lever. Its chock is somewhere up the
Verdance now." CR>)>)
          (<VERB? PULL PUSH TURN>
           <COND (<N==? ,SHIP-AT ,SLUICE>
                  <TELL "The lever swings loose. Its chock is somewhere up the
Verdance now, with everything else." CR>)
                 (<NOT ,LINES-LET-GO>
                  <TELL "The ship strains against a thousand small hands on its
lines, and does not move." CR>)
                 (ELSE
                  <AWARD-POINTS 8 ,ACH?LAUNCH>
                  <TELL "You pull the lever. Somewhere under the hull the chock
knocks out, and the ship slides down the slip, gathering itself, and onto the
Verdance. Behind you the verdlings stay bowed, and grow small." CR>
                  <CAST-OFF 1>)>
           <RTRUE>)>>

;"--- 2. The Prow ----------------------------------------------------------------
  The chain (Part Four) is part of the view while it matters: it is named in
  the description during passage 3 and while the ship hangs from it. UP
  climbs it, but only when the ship is held at the Span."

<ROOM PROW
    (DESC "The Prow")
    (IN ROOMS)
    (SOUTH TO MAIN-DECK)
    (UP PER PROW-UP-F)
    (OUT PER SHIP-OUT)
    (FLAGS LIGHTBIT SHIPBIT RIVERSIDEBIT)
    (ACTION PROW-F)>

<ROUTINE PROW-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "The ship's high prow, where a gilded figurehead leans out over
the water: Lord Vaunt, chin up, with laser eyes that stopped working some time
ago. From here you see downstream: the Verdance, broad and green and going
somewhere.">
           <COND (<==? ,SHIP-AT ,SPAN>
                  <TELL " Overhead is the broken end of the span, and from it
hangs the chain, with your grapnel bitten into it and the line bar-taut.">)
                 (<AND <==? ,SHIP-AT ,ADRIFT> <==? ,PASSAGE 3>>
                  <TELL " Ahead, the gilded span reaches out from the Mingus bank
and stops, and a chain hangs from its broken end toward the water.">)>
           <TELL "|
|
The main deck is back to the south." CR>)
          (ELSE <ROOM-F .RARG>)>>

<ROUTINE PROW-UP-F ()
    <COND (<==? ,SHIP-AT ,SPAN> ,BROKEN-END)
          (ELSE
           <TELL "Only the figurehead goes any higher, and it has never come
down." CR>
           <RFALSE>)>>

<OBJECT FIGUREHEAD
    (DESC "figurehead")
    (SYNONYM FIGUREHEAD EYES HEAD)
    (ADJECTIVE GILDED LASER)
    (IN PROW)
    (FLAGS NDESCBIT)
    (TEXT "Lord Vaunt in gilt, leaning into the wind. The laser eyes are dark. He
is looking downstream, which is more than he ever did in life.")
    (ACTION FEATURE-F)>

;"--- 3. The Stern ------------------------------------------------------------
  P3 lives here: the socket takes the sweep. STEER (section 14) works only
  here, and only with the sweep shipped. The kedge (P4) is thrown from here
  too, because the bar holds the bow and the deep water is astern."

<ROOM STERN
    (DESC "The Stern")
    (IN ROOMS)
    (NORTH TO MAIN-DECK)
    (OUT PER SHIP-OUT)
    (FLAGS LIGHTBIT SHIPBIT RIVERSIDEBIT)
    (ACTION STERN-F)>

<ROUTINE STERN-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "The ship's stern, low and broad. In the deck is a socket, worn
smooth, as if something used to sit in it, long ago, before anyone decided the
dead didn't need to steer.">
           <COND (,SWEEP-SHIPPED <TELL " The sweep sits in it now, long and
ready.">)>
           <COND (,KEDGE-SET <TELL " A line runs from the rail out into the water
astern, where the grapnel is biting the riverbed.">)>
           <TELL "|
|
The main deck is north." CR>)
          (ELSE <ROOM-F .RARG>)>>

;"The socket takes one thing: the sweep. In PUT SWEEP IN SOCKET the socket is
  PRSI, so its ACTION hears the PUT-IN before the library's own V-PUT-IN can
  say that the socket isn't a container."
<OBJECT SOCKET
    (DESC "socket")
    (SYNONYM SOCKET HOLE)
    (ADJECTIVE WORN)
    (IN STERN)
    (FLAGS NDESCBIT)
    (ACTION SOCKET-F)>

<ROUTINE SOCKET-F ()
    <COND (<KEEP-PIKE?> <RTRUE>)
          (<AND <VERB? EXAMINE> <PRSO? ,SOCKET>>
           <COND (,SWEEP-SHIPPED
                  <TELL "The sweep sits in it as if it had never left." CR>)
                 (ELSE <TELL "A round socket in the stern deck, worn smooth.
Something long used to sit in it." CR>)>)
          (<AND <VERB? PUT-IN PUT-ON> <PRSI? ,SOCKET>>
           <COND (<NOT <PRSO? ,SWEEP>>
                  <TELL "It was made for one thing, and that isn't it." CR>)
                 (ELSE
                  <MOVE ,SWEEP ,STERN>
                  <FSET ,SWEEP ,NDESCBIT>   ;"the Stern's description says so"
                  <SETG SWEEP-SHIPPED T>
                  <AWARD-POINTS 8 ,ACH?SWEEP>
                  <TELL "You set the sweep in the socket. It drops in as if it
had been waiting." CR>)>)
          (<AND <VERB? TAKE> <PRSO? ,SOCKET>>
           <TELL "It's part of the deck." CR>)>>

;"The kedge line exists only while the grapnel is biting astern: it is a
  floating object (FLOAT-OBJECTS, section 4)."
<OBJECT KEDGE-LINE
    (DESC "kedge line")
    (SYNONYM LINE ROPE)
    (ADJECTIVE KEDGE)
    (FLAGS NDESCBIT)
    (TEXT "The grapnel's line, running from the rail into the deep water astern.
It is taut.")
    (ACTION KEDGE-LINE-F)>

<ROUTINE KEDGE-LINE-F ()
    <COND (<VERB? PULL TAKE TURN> <PULL-KEDGE>)>>

;"--- 4. The Hold ------------------------------------------------------------
  Lucan's hiding place, and the custody chest."

<ROOM HOLD
    (DESC "The Hold")
    (IN ROOMS)
    (UP TO MAIN-DECK)
    (OUT PER SHIP-OUT)
    (FLAGS LIGHTBIT SHIPBIT RIVERSIDEBIT)
    (ACTION HOLD-F)>

<ROUTINE HOLD-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "The hold, lit by daylight through the deck seams. Most of it is
a heap of $ALT medallions, the ship's cargo of the dead's own money">
           <COND (<N==? ,LUCAN-STATE ,HIDDEN>
                  <TELL ", with a hollow in it where Lucan slept, and a sandwich
wrapper">)>
           <TELL ". Against the bulkhead stands the custody chest, stencilled
MOST SECURE CUSTODY SOLUTION -- NOTHING HAS EVER BEEN WITHDRAWN. Its lid stands
open. A ladder goes up to the main deck." CR>
           ;"The chest has NDESCBIT, so the library won't list what is in it;
             the Hold says so itself, as Inform's room description does."
           <COND (<FIRST? ,CUSTODY-CHEST>
                  <TELL CR "In the custody chest ">
                  <COND (<NEXT? <FIRST? ,CUSTODY-CHEST>> <TELL "are ">)
                        (ELSE <TELL "is ">)>
                  <LIST-CHEST>
                  <TELL "." CR>)>
           <RTRUE>)
          (ELSE <ROOM-F .RARG>)>>

;"MEDALLION and MEDALLIONS: in a z5 story a dictionary word keeps only its
  first nine letters, so these two are the SAME word -- name both and ZILF
  warns that they collide. Here that is fine: there is only one heap, so the
  one word MEDALLIONS answers to both spellings, and neither ever asks
  'which do you mean?'."
<OBJECT MEDALLIONS
    (DESC "$ALT medallions")
    (SYNONYM MEDALLIONS HEAP CARGO MONEY COINS)
    (ADJECTIVE ALT)
    (IN HOLD)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Thousands of them, stamped with Vaunt's face and the word $ALT. They
were the dead's own money. They are worth exactly what everything else from the
Ascendancy is worth.")
    (ACTION MEDALLIONS-F)>

<ROUTINE MEDALLIONS-F ()
    <COND (<VERB? TAKE PULL PUSH SEARCH>
           <TELL "They're $ALT. Leave them for the dead." CR>)>>

;"The custody chest: the game's trophy case. It is an open container
  (CONTBIT OPENBIT), but it decides everything first:
    as PRSI (PUT X IN CHEST, PUT X ON CHEST) -- only a NAMEBIT object goes
      in, and the first time it does, it scores;
    as the CONTFCN of what is inside (TAKE X, TAKE X FROM CHEST) -- never.
  A CONTFCN is a container's say over actions on the things IN it: PERFORM
  calls it before the object's own ACTION. Because nothing ever comes out, a
  name can only go in once: no flag is needed to stop double scoring."
<OBJECT CUSTODY-CHEST
    (DESC "custody chest")
    (SYNONYM CHEST LID STENCIL SOLUTION)
    (ADJECTIVE CUSTODY)
    (IN HOLD)
    (FLAGS NDESCBIT CONTBIT OPENBIT)
    (CAPACITY 100)
    (CONTFCN CHEST-CONT-F)
    (ACTION CUSTODY-CHEST-F)>

<ROUTINE CUSTODY-CHEST-F ()
    <COND (<KEEP-PIKE?> <RTRUE>)
          (<AND <VERB? PUT-IN PUT-ON> <PRSI? ,CUSTODY-CHEST>>
           <COND (<NOT <FSET? ,PRSO ,NAMEBIT>>
                  <TELL "The chest is for names." CR>)
                 (ELSE
                  <MOVE ,PRSO ,CUSTODY-CHEST>
                  <AWARD-POINTS 4 <NAME-ACH ,PRSO>>
                  <TELL "The chest accepts it. NOTHING HAS EVER BEEN WITHDRAWN,
says the lid." CR>)>)
          (<NOT <PRSO? ,CUSTODY-CHEST>> <RFALSE>)
          (<VERB? EXAMINE SEARCH>
           <TELL "MOST SECURE CUSTODY SOLUTION -- NOTHING HAS EVER BEEN
WITHDRAWN, says the stencil. The lid stands open.">
           <COND (<FIRST? ,CUSTODY-CHEST>
                  <TELL " Inside: ">
                  <LIST-CHEST>
                  <TELL ".">)>
           <CRLF>)
          (<VERB? CLOSE>
           <TELL "The lid doesn't close. It has nothing to hide, it says." CR>)
          (ELSE <FEATURE-F>)>>

;"LIST-CHEST: 'a nameboard and a launch register' -- commas between, 'and'
  before the last."
<ROUTINE LIST-CHEST ("AUX" (N 0))
    <MAP-CONTENTS (I ,CUSTODY-CHEST)
        <SET N <+ .N 1>>
        <COND (<G? .N 1>
               <COND (<NEXT? .I> <TELL ", ">)
                     (ELSE <TELL " and ">)>)>
        <TELL A .I>>>

<ROUTINE CHEST-CONT-F ("OPT" ARG)
    <COND (<AND <NOT .ARG> <VERB? TAKE>>
           <TELL "NOTHING HAS EVER BEEN WITHDRAWN. The lid is very clear about
this." CR>)>>

;"Which achievement each of the five names scores."
<ROUTINE NAME-ACH (O)
    <COND (<==? .O ,LAUNCH-REGISTER> ,ACH?REGISTER)
          (<==? .O ,NAMEBOARD> ,ACH?NAMEBOARD)
          (<==? .O ,SONGBOOK> ,ACH?SONGBOOK)
          (<==? .O ,DIVER-TAG> ,ACH?TAG)
          (ELSE ,ACH?PLAQUE)>>

;"Lucan's nest: off-stage until he has climbed out of it (LUCAN-STOWAWAY,
  section 11 moves it into the Hold)."
<OBJECT LUCAN-NEST
    (DESC "Lucan's nest")
    (SYNONYM NEST HOLLOW WRAPPER SANDWICH)
    (FLAGS NDESCBIT NARTICLEBIT)
    (TEXT "A hollow in the medallions the shape of a large man, and a sandwich
wrapper. Lucan travelled with what he could carry.")
    (ACTION LUCAN-NEST-F)>

<ROUTINE LUCAN-NEST-F ()
    <COND (<VERB? TAKE SEARCH> <TELL "You leave it as it is." CR>)>>


;"============================================================================
  6. PART ONE: THE SLUICE  --  the Mingus bank (rooms 5-7)
 ----------------------------------------------------------------------------
  The start. The launch drill (read at the Sluice Mouth) tells you the order
  of P1: aboard, bow, lever. N1, the launch register, is inside the Sluice.
 ============================================================================"

;"--- 5. Foot of the Gangplank (start) -----------------------------------------
  Every direction without an exit gets the same refusal: the crowd is the
  wall here, as it was at the end of Mingus I. M-BEG sees the WALK before
  the library does; GETPT is non-zero exactly when the room has an exit that
  way, so real exits are let through (returning false)."

<ROOM GANGPLANK-FOOT
    (DESC "Foot of the Gangplank")
    (IN ROOMS)
    (LDESC "The foot of the gangplank, where Mingus I left you. The verdlings are
still bowed, thousands of them, all the way back to the mountain, and the lane
they made for you still runs to the water. At the end of it the funeral ship
rocks at the mouth of the Sluice, its gangplank down, its blank plaque polished
on the mast. The covered chute of the Sluice comes down out of the mountain to
the west. Up the gangplank is the ship.")
    (UP TO MAIN-DECK)
    (IN TO MAIN-DECK)
    (WEST TO SLUICE-MOUTH)
    (LANDING ,SLUICE)
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION GANGPLANK-FOOT-F)>

<ROUTINE GANGPLANK-FOOT-F (RARG)
    <COND (<AND <==? .RARG ,M-BEG> <VERB? WALK> ,PRSO-DIR
                <NOT <GETPT ,HERE ,PRSO>>>
           <TELL "The crowd closes softly in front of you, and bows again." CR>)
          (ELSE <ROOM-F .RARG>)>>

<OBJECT LANE
    (DESC "lane")
    (SYNONYM LANE PATH GAP)
    (IN GANGPLANK-FOOT)
    (FLAGS NDESCBIT)
    (TEXT "A shoulder's width between bowed heads, running straight to the
gangplank.")
    (ACTION FEATURE-F)>

;"The ship seen from outside, at each landing it can be boarded from (a
  floating object). ENTER SHIP and BOARD SHIP (BOARD is zillib's synonym for
  ENTER) walk aboard. UNTIE SHIP at the Pier means the mooring rope; on the
  Main Deck the rope answers to SHIP itself, and SHIP-GENERIC-F settles the
  tie on the pier, where both are in sight."
<OBJECT FUNERAL-SHIP
    (DESC "funeral ship")
    (SYNONYM SHIP GANGPLANK HULL BOAT)
    (ADJECTIVE FUNERAL)
    (FLAGS NDESCBIT)
    (GENERIC SHIP-GENERIC-F)
    (TEXT "A funeral ship: a high gilded prow, a mast with a blank plaque, and a
hold for the dead's money. It was built to carry one passenger, lying down.")
    (ACTION FUNERAL-SHIP-F)>

<ROUTINE FUNERAL-SHIP-F ()
    <COND (<VERB? ENTER CLIMB> <DO-WALK ,P?IN> <RTRUE>)
          (<AND <VERB? UNTIE> <==? ,HERE ,STONE-PIER>>
           <PERFORM ,V?UNTIE ,MOORING-ROPE>
           <RTRUE>)>>

<ROUTINE SHIP-GENERIC-F (TBL)
    ,FUNERAL-SHIP>

;"The verdlings are on the Mingus bank only (they never cross the river and
  never go underground). They are a floating object, in scope wherever you
  can see them -- including the Main Deck before the launch, so BOW TO
  VERDLINGS works there. PERSONBIT makes them people (ASK, GIVE, SHOW...);
  their ACTION answers all of that with one line. ARG is set (M-WINNER)
  when the player gives them an order: VERDLINGS, LET GO."
<OBJECT VERDLINGS
    (DESC "verdlings")
    (SYNONYM VERDLINGS VERDLING CROWD HEADS THOUSANDS PIKES)
    (FLAGS NDESCBIT PLURALBIT PERSONBIT)
    (ACTION VERDLINGS-F)>

<ROUTINE VERDLINGS-F ("OPT" ARG)
    <COND (<AND <NOT .ARG> <VERB? EXAMINE>>
           <COND (<==? ,HERE ,INTAKE-SCREEN>
                  <TELL "Far off along the Mingus bank, the verdlings stand in
silent rows, watching. They keep well away from the intake. It is a hole." CR>)
                 (<==? ,HERE ,SLUICE-MOUTH>
                  <TELL "They keep well back from the Sluice. Nobody has told them
why. Nobody had to." CR>)
                 (ELSE <TELL "Thousands of small mud-coloured heads, bowed. Down by
the water, a few hundred small hands hold the ship's lines." CR>)>)
          (<KEEP-PIKE?> <RTRUE>)
          (<OR .ARG
               <VERB? ASK-ABOUT TELL-ABOUT KISS ATTACK WAKE WARN>
               <AND <VERB? GIVE SHOW THROW-AT> <PRSI? ,VERDLINGS>>>
           <TELL "Thousands of small heads stay bowed." CR>)>>

;"--- 6. The Sluice Mouth ------------------------------------------------------"

<ROOM SLUICE-MOUTH
    (DESC "The Sluice Mouth")
    (IN ROOMS)
    (LDESC "The end of the covered chute, where the Sluice comes out of the
mountain onto a stone slipway and the slipway runs down into the river. Funeral
ships come down the chute on rollers and wait here on the chock for their last
push. Painted on the arch above the chute is the launch drill. The verdlings
keep well back. Inside the Sluice is west; the gangplank is east.")
    (EAST TO GANGPLANK-FOOT)
    (WEST TO INSIDE-SLUICE)
    (IN TO INSIDE-SLUICE)
    (LANDING ,SLUICE)
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION ROOM-F)>

;"The drill: READ is EXAMINE in this game (as in Inform), so a TEXT is all a
  readable thing needs. It states P1's order outright."
<OBJECT LAUNCH-DRILL
    (DESC "launch drill")
    (SYNONYM DRILL ARCH PAINT ORDER)
    (ADJECTIVE LAUNCH PAINTED)
    (IN SLUICE-MOUTH)
    (FLAGS NDESCBIT)
    (TEXT "LAUNCH ORDER -- 1. THE PASSENGER ABOARD. 2. THE CHIEF BOWS; THE
VERDLINGS LET GO. 3. THE CHOCK LEVER.")
    (ACTION FEATURE-F)>

<OBJECT SLIPWAY
    (DESC "slipway")
    (SYNONYM SLIPWAY SLIP CHOCK ROLLERS STONE)
    (IN SLUICE-MOUTH)
    (FLAGS NDESCBIT)
    (TEXT "Worn stone, greased for a thousand launches. The chock that holds the
ship is down under its hull, worked from the deck by a lever.")
    (ACTION FEATURE-F)>

;"--- 7. Inside the Sluice ------------------------------------------------------"

<ROOM INSIDE-SLUICE
    (DESC "Inside the Sluice")
    (IN ROOMS)
    (LDESC "Dim. Rollers run up into the mountain as far as you can see, and far
above, the chute is jammed: the dead are piling up in cold storage at the
summit, waiting for somebody to fix it. Somebody is not coming. A lectern stands
by the rollers. The way out is east.")
    (EAST TO SLUICE-MOUTH)
    (OUT TO SLUICE-MOUTH)
    (FLAGS LIGHTBIT)
    (ACTION ROOM-F)>

<OBJECT ROLLERS
    (DESC "rollers")
    (SYNONYM ROLLERS ROLLER CHUTE JAM SUMMIT STORAGE)
    (IN INSIDE-SLUICE)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "They run up into the dark. A long way up, something gilded is wedged
across them.")
    (ACTION FEATURE-F)>

<OBJECT LECTERN
    (DESC "lectern")
    (SYNONYM LECTERN STAND)
    (IN INSIDE-SLUICE)
    (FLAGS NDESCBIT)
    (TEXT "A plain wooden lectern, for the register.")
    (ACTION FEATURE-F)>

;"N1. Its last entry names Councillor Sutt and the Floor Price: you will meet
  her plaque at the intake, in Part Five. FDESC is how it is described until
  it is first picked up (the library sets TOUCHBIT then). NAMEBIT makes it
  one of the five names; READING is the name Lucan reads aloud if you show
  it to him."
<OBJECT LAUNCH-REGISTER
    (DESC "launch register")
    (SYNONYM REGISTER LEDGER ENTRIES ENTRY)
    (ADJECTIVE LAUNCH)
    (IN INSIDE-SLUICE)
    (FLAGS TAKEBIT NAMEBIT)
    (FDESC "The launch register lies open on the lectern.")
    (READING "Councillor Amberline Sutt")
    (TEXT "THE LAUNCH REGISTER OF THE SLUICE. Ship after ship, name after name,
all in the same hand. The last entry reads: \"the Floor Price, for Councillor
Amberline Sutt.\" After it, nothing: that was the last ship before the jam.")>


;"============================================================================
  7. PART TWO: THE SANDBAR  --  mid-river (rooms 8-9)
 ----------------------------------------------------------------------------
  The ship runs aground on its own. Sandwich is at the Wreck first, and his
  front-run rule decides P2. The sweep (P3) and the grapnel (P4) are here,
  and so is N2, the Expedition's nameboard.
 ============================================================================"

;"--- 8. The Sandbar -------------------------------------------------------------"

<ROOM THE-SANDBAR
    (DESC "The Sandbar")
    (IN ROOMS)
    (LDESC "A long pale bar in mid-river, where the funeral ship has run aground:
the way, by the look of it, they all do. The Verdance goes by on both sides. To
the east, a wrecked boat lies on its side at the end of the bar. The ship is
back in.")
    (IN TO MAIN-DECK)
    (EAST TO WRECK)
    (LANDING ,SANDBAR)
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION ROOM-F)>

;"Sandwich's scull, beached here until he leaves (section 11). An LDESC is
  the line the room description prints for it."
<OBJECT BEACHED-SCULL
    (DESC "gilded scull")
    (SYNONYM SCULL SLIPPAGE OARS)
    (ADJECTIVE GILDED RACING)
    (IN THE-SANDBAR)
    (LDESC "A narrow gilded racing scull is pulled up on the sand.")
    (TEXT "A narrow gilded racing scull, pulled up on the sand. Its name is
painted on the bow: SLIPPAGE.")
    (ACTION BEACHED-SCULL-F)>

<ROUTINE BEACHED-SCULL-F ()
    <COND (<VERB? TAKE PUSH PULL ENTER>
           <TELL "It's Sandwich's. He'd be there first." CR>)>>

;"--- 9. The Expedition Wreck ------------------------------------------------------
  The room's M-BEG is where the front-run rule lives: a room hears about an
  action before any object does, so the Wreck can step in on the first TAKE
  of any of the four salvage items while Sandwich is here. SANDWICH-GRAB is
  in section 11; it returns false to let the take go on as normal. (TAKE X
  FROM SANDWICH comes here too: zillib's PRE-TAKE-FROM turns it into TAKE X.)"

<ROOM WRECK
    (DESC "The Expedition Wreck")
    (IN ROOMS)
    (LDESC "The Step Three lies on her side at the end of the bar, her planks gone
grey. She was the Verdance Expedition's boat, and painted along her side is the
Expedition's roadmap: STEP 1: BOAT. STEP 2: RIVER. STEP 3: CROSS. Her thwart
board has come loose and lies in the sand. The bar runs back west.")
    (WEST TO THE-SANDBAR)
    (LANDING ,SANDBAR)
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION WRECK-F)>

<ROUTINE WRECK-F (RARG)
    <COND (<AND <==? .RARG ,M-BEG> <VERB? TAKE> <IN? ,SANDWICH ,WRECK>>
           <SANDWICH-GRAB ,PRSO>)
          (ELSE <ROOM-F .RARG>)>>

<OBJECT STEP-THREE
    (DESC "Step Three")
    (SYNONYM THREE WRECK BOAT ROADMAP PLANKS)
    (ADJECTIVE STEP WRECKED)
    (IN WRECK)
    (FLAGS NDESCBIT NARTICLEBIT)
    (TEXT "Her roadmap ended at STEP 3: CROSS. She got as far as a sandbar.")
    (ACTION FEATURE-F)>

;"The sweep: the long steering oar for the stern socket (P3). Once shipped,
  the Stern's description mentions it (SOCKET-F gives it NDESCBIT)."
<OBJECT SWEEP
    (DESC "sweep")
    (SYNONYM SWEEP OAR)
    (ADJECTIVE STEERING LONG)
    (IN WRECK)
    (FLAGS TAKEBIT)
    (FDESC "A long steering sweep lies along the wreck's thwarts.")
    (TEXT "A long steering oar. Its foot is worn round, to sit in a socket.")
    (ACTION SWEEP-F)>

<ROUTINE SWEEP-F ()
    <COND (<AND <VERB? TAKE> ,SWEEP-SHIPPED>
           <TELL "It's shipped in the socket. Leave it there." CR>)>>

;"The grapnel: thrown astern it kedges you off the bar (P4); thrown at the
  chain in passage 3's window it saves the ship (P7). Every way of throwing
  or dropping it goes to one routine, GRAPNEL-THROWN (section 9). A DESCFCN
  lets an object describe itself in the room: the library asks it first
  with M-OBJDESC? ('will you?') and then with M-OBJDESC ('go on'). This one
  only speaks up while the grapnel holds the ship; the rest of the time the
  library uses its FDESC or lists it."
<OBJECT GRAPNEL
    (DESC "grapnel")
    (SYNONYM GRAPNEL GRAPPLE HOOK ANCHOR TINES)
    (IN WRECK)
    (FLAGS TAKEBIT)
    (FDESC "A grapnel on a coil of line lies half buried in the sand.")
    (DESCFCN GRAPNEL-DESC)
    (ACTION GRAPNEL-F)>

<ROUTINE GRAPNEL-DESC (ARG)
    <COND (<==? .ARG ,M-OBJDESC?> ,GRAPNEL-HOOKED)
          (ELSE
           <TELL "The grapnel line runs up from the rail to the chain overhead,
bar-taut." CR>)>>

<ROUTINE GRAPNEL-F ()
    <COND (<NOT <PRSO? ,GRAPNEL>> <RFALSE>)
          (<VERB? EXAMINE>
           <COND (,GRAPNEL-HOOKED
                  <TELL "Bitten into the chain overhead. The whole ship hangs from
it." CR>)
                 (ELSE <TELL "A four-tined iron grapnel on a long coil of line."
CR>)>)
          (<VERB? DROP THROW-AWAY> <GRAPNEL-THROWN <>>)
          (<VERB? THROW-AT> <GRAPNEL-THROWN ,PRSI>)
          (<AND <VERB? TAKE> ,GRAPNEL-HOOKED>
           <TELL "It's holding the whole ship. UNHOOK it when you're ready to
go." CR>)
          (<AND <VERB? PULL UNHOOK> ,GRAPNEL-HOOKED> <UNHOOK-GRAPNEL>)>>

;"The strongbox: gilt, so Sandwich always wants it. If he leaves without it
  (the coat route), you can take it and open it."
<OBJECT STRONGBOX
    (DESC "strongbox")
    (SYNONYM STRONGBOX TREASURY GILT)
    (ADJECTIVE GILDED STENCILLED)
    (IN WRECK)
    (FLAGS TAKEBIT CONTBIT OPENABLEBIT)
    (FDESC "A gilded strongbox, stencilled EXPEDITION TREASURY, sits in the
wreck's bilge.")
    (TEXT "A gilded strongbox stencilled EXPEDITION TREASURY.")>

<OBJECT SAFU-NOTE
    (DESC "note")
    (SYNONYM NOTE SAFU FUNDS)
    (IN STRONGBOX)
    (FLAGS TAKEBIT)
    (TEXT "FUNDS ARE SAFU.")>

;"N2: five names scratched into the thwart board. Only this object answers
  to NAME and NAMES, so EXAMINE NAMES never asks 'which do you mean?'."
<OBJECT NAMEBOARD
    (DESC "nameboard")
    (SYNONYM NAMEBOARD BOARD NAMES NAME)
    (ADJECTIVE THWART SCRATCHED)
    (IN WRECK)
    (FLAGS TAKEBIT NAMEBIT)
    (READING "Nonie Pask")
    (TEXT "The Step Three's thwart board. Five names are scratched into it with a
knife point, one under another: DELL ARKWRIGHT, NONIE PASK, TOMAS VERE, ILSA
GRUND, BEN OKORO. Under them, in the same hand: GOT THIS FAR.")>


;"============================================================================
  8. PART THREE: THE OLD-SIDE BANK  --  the taboo is broken (rooms 10-14)
 ----------------------------------------------------------------------------
  Lucan leads you up the bank by his favourite verse, to the lifebelt (P6).
  The old side is seen only from outside, and never explained. Mrs.
  Thrumble answers the bell at the pier. N3, Lucan's songbook, reaches you
  through her.
 ============================================================================"

;"--- 10. The Stone Pier -------------------------------------------------------
  Leaving the pier sends Mrs. Thrumble below. M-BEG catches every WALK; GETPT
  is non-zero exactly when there is an exit that way, so she only leaves if
  you really do. Returning false lets the walk go on: the shutter line comes
  first, then the next room."

<ROOM STONE-PIER
    (DESC "The Stone Pier")
    (IN ROOMS)
    (LDESC "Old fitted stone, the joints so tight a knife wouldn't go in, older
than anything on the Mingus side. The funeral ship is made fast to an iron ring
set in the pier. Set into the bank at the pier's head is an iron hatch with a
barred window, a bell on a bracket, and a card. The ship is back in; the bank
rises to the north.")
    (IN TO MAIN-DECK)
    (NORTH TO MINE-HEADS)
    (LANDING ,PIER)
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION STONE-PIER-F)>

<ROUTINE STONE-PIER-F (RARG)
    <COND (<AND <==? .RARG ,M-BEG> <VERB? WALK> ,PRSO-DIR
                <GETPT ,HERE ,PRSO> <IN? ,THRUMBLE ,STONE-PIER>>
           <REMOVE ,THRUMBLE>
           <TELL "The shutter closes." CR CR>
           <RFALSE>)
          (ELSE <ROOM-F .RARG>)>>

;"RING is a word for three things: the iron ring here, the lifebelt (Lucan
  calls it 'a ring on a post') and the patches' rings of stones. When more
  than one is in sight, the parser asks each candidate's GENERIC routine to
  choose; this one picks the iron ring on the pier, and the lifebelt
  everywhere else, so RING never asks 'which do you mean?'."
<ROUTINE RING-GENERIC-F (TBL)
    <COND (<==? ,HERE ,STONE-PIER> ,IRON-RING)
          (ELSE ,LIFEBELT)>>

<OBJECT IRON-RING
    (DESC "iron ring")
    (SYNONYM RING)
    (ADJECTIVE IRON)
    (IN STONE-PIER)
    (FLAGS NDESCBIT)
    (GENERIC RING-GENERIC-F)
    (TEXT "A plain iron ring, worn bright on the inside by ropes. The ship's
mooring rope is made fast to it.")
    (ACTION FEATURE-F)>

<OBJECT LOST-HATCH
    (DESC "iron hatch")
    (SYNONYM HATCH WINDOW BARS SHUTTER COUNTER)
    (ADJECTIVE IRON BARRED)
    (IN STONE-PIER)
    (FLAGS NDESCBIT)
    (ACTION LOST-HATCH-F)>

<ROUTINE LOST-HATCH-F ()
    <COND (<VERB? EXAMINE>
           <COND (<IN? ,THRUMBLE ,STONE-PIER>
                  <TELL "Behind the bars, Mrs. Thrumble is writing in a ledger. She
does not look up." CR>)
                 (ELSE <TELL "An iron hatch in the bank, with a barred window and a
shutter behind the bars. The shutter is down." CR>)>)
          (<VERB? OPEN ENTER>
           <TELL "It isn't that kind of hatch. There's a bell." CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT LOST-CARD
    (DESC "card")
    (SYNONYM CARD SIGN)
    (IN STONE-PIER)
    (FLAGS NDESCBIT)
    (TEXT "LOST PROPERTY. RING ONCE. DOWNSTREAM COUNTER.")
    (ACTION FEATURE-F)>

;"RING BELL brings Mrs. Thrumble (THRUMBLE-RING, section 11)."
<OBJECT BELL
    (DESC "bell")
    (SYNONYM BELL BRACKET)
    (IN STONE-PIER)
    (FLAGS NDESCBIT)
    (TEXT "A small brass bell on a bracket by the hatch.")
    (ACTION BELL-F)>

<ROUTINE BELL-F ()
    <COND (<VERB? RING PUSH PULL> <THRUMBLE-RING>)>>

;"The mooring rope: a floating object, on deck and on the pier while the
  ship is made fast here. UNTIE it to cast off (passage 3). It answers to
  SHIP as well, so UNTIE SHIP works on the Main Deck, where the ship itself
  is not an object you can see."
<OBJECT MOORING-ROPE
    (DESC "mooring rope")
    (SYNONYM ROPE LINE PAINTER SHIP)
    (ADJECTIVE MOORING)
    (FLAGS NDESCBIT)
    (GENERIC SHIP-GENERIC-F)
    (TEXT "The ship's mooring rope, made fast to the iron ring on the pier.")
    (ACTION MOORING-ROPE-F)>

<ROUTINE MOORING-ROPE-F ()
    <COND (<VERB? UNTIE TAKE PULL> <CAST-OFF-PIER>)>>

;"The cast-off for the Stone Pier, with its two gates, in order. Each
  refusal says what is missing. A refused cast-off still passes a turn.
  From the pier you step aboard as you cast off: MOVE puts you on the Main
  Deck without describing it, and FLOAT-OBJECTS catches the room up."
<ROUTINE CAST-OFF-PIER ()
    <COND (<N==? ,LUCAN-STATE ,DEAD>
           <TELL "Lucan, from the bank: \"Not yet! Twenty years I've sung this
bank!\"" CR>
           <RTRUE>)
          (<NOT <HELD? ,LIFEBELT ,WINNER>>
           <TELL "Not without something that floats. Every song about this river
ends in white water." CR>
           <RTRUE>)>
    <COND (<==? ,HERE ,STONE-PIER>
           <COND (<IN? ,THRUMBLE ,STONE-PIER>
                  <REMOVE ,THRUMBLE>
                  <TELL "The shutter closes." CR CR>)>
           <MOVE ,WINNER ,MAIN-DECK>
           <SETG HERE ,MAIN-DECK>
           <FLOAT-OBJECTS>
           <TELL "You slip the rope off the iron ring and step aboard as the
current takes the ship.">)
          (ELSE
           <TELL "You cast off. The rope runs out through the iron ring and falls
in the water.">)>
    <TELL " The old side slides away behind you, green and warm and quiet." CR>
    <CAST-OFF 3>
    <RTRUE>>

;"--- 11. The Mine Heads -----------------------------------------------------------
  The signpost for Lucan's death is here, before it happens: the bright,
  stone-ringed patches, and (EXAMINE PATCHES) the warm air leaking round the
  stones."

<ROOM MINE-HEADS
    (DESC "The Mine Heads")
    (IN ROOMS)
    (LDESC "Timber headframes stand over capped shafts, grey with age. Iron
grates in the grass breathe warm air, and low chimney vents give off a steady
glow that never flickers. Here and there the grass is a brighter green, smooth
as baize, each patch ringed with small white stones. The pier is back south;
the bank rises north, and to the east a roofline shows above the grass.")
    (SOUTH TO STONE-PIER)
    (NORTH TO HOLLOW-GREEN)
    (EAST TO BURIED-HALL)
    (LANDING ,PIER)
    (FLAGS LIGHTBIT)
    (ACTION ROOM-F)>

<ROUTINE NOT-ENTERED-F ()
    <COND (<VERB? ENTER CLIMB OPEN PUSH>
           <TELL "You don't. It isn't that you can't." CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT HEADFRAMES
    (DESC "headframes")
    (SYNONYM HEADFRAMES SHAFTS SHAFT)
    (ADJECTIVE TIMBER CAPPED)
    (IN MINE-HEADS)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Old timber, older than the Ascendancy. The shafts under them are
capped with iron. Something down there is warm.")
    (ACTION NOT-ENTERED-F)>

<OBJECT GRATES
    (DESC "grates")
    (SYNONYM GRATES GRATE VENTS VENT CHIMNEYS CHIMNEY GLOW)
    (ADJECTIVE IRON)
    (IN MINE-HEADS)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "The grates breathe warm air. The chimney vents glow, steadily, the way
nothing on the Mingus side ever has. It never flickers.")
    (ACTION NOT-ENTERED-F)>

;"PATCH and PATCHES are different words even in z5 (both under nine
  letters), so one object can answer to both. There are two of these, one
  here and one in the Hollow Green, sharing PATCHES-F. Stepping on the
  patches is never deadly to you: before Lucan's death you are steered off
  them, and after it you remember."
<OBJECT MINE-PATCHES
    (DESC "bright patches")
    (SYNONYM PATCH PATCHES BAIZE TURF STONES STONE RING)
    (ADJECTIVE BRIGHT WHITE)
    (IN MINE-HEADS)
    (FLAGS NDESCBIT PLURALBIT)
    (GENERIC RING-GENERIC-F)
    (TEXT "Patches of turf a brighter green than the rest, smooth as baize, each
one ringed with small white stones. Warm air leaks out round the stones, as if
the grass were a lid.")
    (ACTION PATCHES-F)>

<ROUTINE PATCHES-F ()
    <COND (<VERB? ENTER> <STEP-ON-PATCH>)
          (<VERB? TAKE PULL DIG>
           <TELL "The turf is tight and smooth, and warm under your hand. You
leave it." CR>)>>

;"STEP ON PATCH, ENTER PATCH, STAND ON PATCH: one answer for both rooms."
<ROUTINE STEP-ON-PATCH ()
    <COND (<==? ,LUCAN-STATE ,DEAD>
           <TELL "You remember Lucan. You don't." CR>)
          (<IN? ,LUCAN ,HERE>
           <TELL "Lucan is standing on the best one, singing." CR>)
          (ELSE
           <TELL "Something about the bright turf makes you keep to the plain
grass." CR>)>>

;"--- 12. Outside the Half-Buried Hall --------------------------------------------
  The old side is never entered. IN, DOWN, ENTER and OPEN DOOR all get the
  same line; the exits are PER routines that print it and stay put."

<ROOM BURIED-HALL
    (DESC "Outside the Half-Buried Hall")
    (IN ROOMS)
    (LDESC "A roofline at the height of the grass, and below it a row of windows
at ground level, with warm light in them. A door stands half below the turf,
with steps going down to it. Nobody comes to the windows. The mine heads are
back west.")
    (WEST TO MINE-HEADS)
    (IN PER NOT-ENTERED-EXIT)
    (DOWN PER NOT-ENTERED-EXIT)
    (LANDING ,PIER)
    (FLAGS LIGHTBIT)
    (ACTION ROOM-F)>

<ROUTINE NOT-ENTERED-EXIT ()
    <TELL "You don't. It isn't that you can't." CR>
    <RFALSE>>

<OBJECT HALL-DOOR
    (DESC "door")
    (SYNONYM DOOR STEPS HALL ROOFLINE ROOF WINDOWS WINDOW LIGHT)
    (IN BURIED-HALL)
    (FLAGS NDESCBIT)
    (TEXT "The door is half below the turf, and the steps go down to it. The light
in the windows is warm and steady.")
    (ACTION NOT-ENTERED-F)>

;"--- 13. The Hollow Green -----------------------------------------------------------
  P6 lives here, and so does Lucan's death (section 11). Before it: the
  patches and the lifebelt. After it: the hole and his hat. DOWN is always
  refused, with a different line once he is gone."

<ROOM HOLLOW-GREEN
    (DESC "The Hollow Green")
    (IN ROOMS)
    (SOUTH TO MINE-HEADS)
    (NORTH TO OLD-FENCE)
    (DOWN PER HOLLOW-DOWN-F)
    (LANDING ,PIER)
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION HOLLOW-GREEN-F)>

<ROUTINE HOLLOW-GREEN-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "Here the green bank goes down to the water, the way the song
says. There are more of the bright patches, ringed with white stones, all across
the hollow">
           <COND (<==? ,LUCAN-STATE ,DEAD>
                  <TELL ", and among them is a dark hole in the bright turf,
ringed with white stones, breathing warm air. Lucan's hat lies at its edge">)>
           <TELL ".">
           <COND (<IN? ,LIFEBELT ,HOLLOW-GREEN>
                  <TELL " A white lifebelt hangs on a post at the water's
edge.">)
                 (ELSE <TELL " A bare post stands at the water's edge.">)>
           <TELL "|
|
The mine heads are back south. To the north, the bank runs on to an old
fence." CR>)
          (ELSE <ROOM-F .RARG>)>>

<ROUTINE HOLLOW-DOWN-F ()
    <COND (<==? ,LUCAN-STATE ,DEAD>
           <TELL "You remember Lucan. You don't." CR>)
          (ELSE <TELL "The bank goes down to the water here, and the water goes
on without you." CR>)>
    <RFALSE>>

<OBJECT GREEN-PATCHES
    (DESC "bright patches")
    (SYNONYM PATCH PATCHES BAIZE TURF GREEN STONES STONE)
    (ADJECTIVE BRIGHT WHITE)
    (IN HOLLOW-GREEN)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Bright turf, smooth as a stage, ringed with small white stones. Warm
air leaks round the stones.")
    (ACTION PATCHES-F)>

<OBJECT LIFEBELT-POST
    (DESC "post")
    (SYNONYM POST)
    (ADJECTIVE WOODEN)
    (IN HOLLOW-GREEN)
    (FLAGS NDESCBIT)
    (TEXT "A weathered post at the water's edge.")
    (ACTION FEATURE-F)>

;"P6: the lifebelt. TRY-TAKE does the library's normal checks and moves it;
  the T argument keeps it quiet so that we can print our own message. The
  points come with taking it. WEARBIT lets you WEAR it -- and wearing it is
  what P10 checks. NDESCBIT: the room description mentions it. RING is one
  of its words (RING-GENERIC-F, above, settles which ring you mean)."
<OBJECT LIFEBELT
    (DESC "lifebelt")
    (SYNONYM LIFEBELT BELT BUOY LIFEBUOY RING)
    (ADJECTIVE LIFE CORK WHITE)
    (IN HOLLOW-GREEN)
    (FLAGS TAKEBIT WEARBIT NDESCBIT)
    (GENERIC RING-GENERIC-F)
    (TEXT "A ring of cork, painted white, older than anything on the Mingus side.
It still floats; you can tell by the weight.")
    (ACTION LIFEBELT-F)>

<ROUTINE LIFEBELT-F ()
    <COND (<AND <VERB? TAKE> <PRSO? ,LIFEBELT> <NOT <IN? ,LIFEBELT ,WINNER>>>
           <COND (<TRY-TAKE ,LIFEBELT T>
                  <AWARD-POINTS 8 ,ACH?LIFEBELT>
                  <TELL "You lift the lifebelt off its post. Cork, painted white.
The song was right about this." CR>)>
           <RTRUE>)
          (<AND <VERB? WEAR> <IN? ,LIFEBELT ,WINNER>>
           ;"WEAR LIFEBELT straight off the post takes it first, without a
             TAKE action -- it still scores, as it would in Inform."
           <AWARD-POINTS 8 ,ACH?LIFEBELT>
           <RFALSE>)>>

;"After Lucan's death, LUCAN-DIES (section 11) moves these two here."
<OBJECT LUCAN-HOLE
    (DESC "hole")
    (SYNONYM HOLE TRAP AIR)
    (ADJECTIVE DARK WARM)
    (FLAGS NDESCBIT)
    (TEXT "A dark hole in the bright turf, ringed with white stones, breathing
warm air. You can't see the bottom.")
    (ACTION LUCAN-HOLE-F)>

<ROUTINE LUCAN-HOLE-F ()
    <COND (<VERB? ENTER SEARCH CLIMB>
           <TELL "You remember Lucan. You don't." CR>)
          (ELSE <FEATURE-F>)>>

<OBJECT LUCAN-HAT
    (DESC "Lucan's hat")
    (SYNONYM HAT BAND)
    (ADJECTIVE VELVET)
    (FLAGS NDESCBIT NARTICLEBIT)
    (TEXT "Velvet band. A Thursday hat.")
    (ACTION LUCAN-HAT-F)>

<ROUTINE LUCAN-HAT-F ()
    <COND (<VERB? TAKE PULL WEAR>
           <TELL "You leave it where he can find it." CR>)>>

;"--- 14. The Old Fence ---------------------------------------------------------------
  A glimpse, and nothing more: there is nothing to take, and nothing is
  explained."

<ROOM OLD-FENCE
    (DESC "The Old Fence")
    (IN ROOMS)
    (LDESC "A long, low, grass-covered hill behind an old fence. A gate that
hasn't opened in years. You could walk past it a hundred times. The hollow green
is back south.")
    (SOUTH TO HOLLOW-GREEN)
    (LANDING ,PIER)
    (FLAGS LIGHTBIT)
    (ACTION ROOM-F)>

<OBJECT FENCE
    (DESC "old fence")
    (SYNONYM FENCE GATE HILL GRASS)
    (ADJECTIVE OLD GRASSY LONG LOW)
    (IN OLD-FENCE)
    (FLAGS NDESCBIT)
    (TEXT "From the road it is nothing. From here it is a long, low hill, and a
fence, and a gate that hasn't opened in years.")
    (ACTION FENCE-F)>

<ROUTINE FENCE-F ()
    <COND (<VERB? CLIMB OPEN ENTER PUSH UNLOCK JUMP-OVER>
           <TELL "Not today. Something about that hill makes your hands want to
hold on to the fence." CR>)
          (ELSE <FEATURE-F>)>>


;"============================================================================
  9. PART FOUR: THE GILDED SPAN  --  mid-river (rooms 15-16)
 ----------------------------------------------------------------------------
  Passage 3's window is THROW GRAPNEL AT CHAIN (P7); miss it and the ship
  dies under the broken end. Up the chain: the diver's tag (N4) and the
  civic key in its velvet box (P8). You can't leave without the key.
 ============================================================================"

;"--- The grapnel's routines (it is used in Part Two as well) -----------------
  GRAPNEL-THROWN: THROW GRAPNEL, THROW GRAPNEL AT/INTO <target> and DROP
  GRAPNEL all end up here. TARGET <> means 'no target'. Throwing it astern
  while aground is the kedge (P4); at the chain, P7; anything else is
  refused, so it can never be lost."
<ROUTINE GRAPNEL-THROWN (TARGET)
    <COND (<OR <NOT .TARGET> <==? .TARGET ,VERDANCE>>
           <COND (<AND <==? ,HERE ,STERN> <==? ,SHIP-AT ,SANDBAR>> <KEDGE>)
                 (ELSE <TELL "You'd lose it." CR>)>)
          (<==? .TARGET ,CHAIN> <THROW-AT-CHAIN>)
          (ELSE <TELL "You'd lose it." CR>)>
    <RTRUE>>

;"P4, part one. The gate: you can't kedge off without a way to steer."
<ROUTINE KEDGE ()
    <COND (<NOT ,SWEEP-SHIPPED>
           <TELL "You'd be off the bar and into the river with no way to steer.
Even a funeral ship deserves better." CR>
           <RTRUE>)>
    <REMOVE ,GRAPNEL>
    <SETG KEDGE-SET T>
    <FLOAT-OBJECTS>               ;"the kedge line appears at once"
    <TELL "You swing the grapnel and throw it out over the stern. It splashes
down in the deep water, sinks, and bites into the riverbed astern. The line
comes taut." CR>>

;"P4, part two: PULL LINE is the cast-off for passage 2."
<ROUTINE PULL-KEDGE ()
    <SETG KEDGE-SET <>>
    <MOVE ,GRAPNEL ,WINNER>
    <FLOAT-OBJECTS>               ;"and the kedge line is gone"
    <AWARD-POINTS 8 ,ACH?KEDGE>
    <TELL "You haul on the line, hand over hand. For a long moment nothing
happens. Then the ship comes grinding off the bar stern first, into deep water,
and swings, and the current has it. You bring the grapnel in, dripping." CR>
    <CAST-OFF 2>
    <RTRUE>>

;"P7: the window. THROW-AT-CHAIN is only reachable where the chain is in
  scope: the Prow during passage 3, or once the ship hangs from it."
<ROUTINE THROW-AT-CHAIN ()
    <COND (<N==? ,HERE ,PROW> <TELL "You're already up here with it." CR>)
          (,GRAPNEL-HOOKED <TELL "It's already holding the chain." CR>)
          (<L? ,DRIFT 3> <TELL "The chain is still well ahead." CR>)
          (ELSE
           <MOVE ,GRAPNEL ,PROW>
           <SETG GRAPNEL-HOOKED T>
           <SHIP-TO ,SPAN>
           <AWARD-POINTS 8 ,ACH?CHAIN>
           <TELL "You swing the grapnel twice and let it go. The grapnel goes up,
over, and bites. The line snaps taut, the ship swings, and hangs, shuddering,
under the broken end. The current goes on without you." CR>)>>

;"The cast-off for the Span, with its gate: everything downstream was built
  by Vaunt, and the key opens anything Vaunt built."
<ROUTINE UNHOOK-GRAPNEL ()
    <COND (<NOT <HELD? ,CIVIC-KEY ,WINNER>>
           <TELL "Up there on the girder, the velvet box says VAUNT CIVIC KEY --
OPENS ANYTHING VAUNT BUILT. Everything downstream was built by Vaunt. You're
not leaving it." CR>
           <RTRUE>)>
    <SETG GRAPNEL-HOOKED <>>
    <MOVE ,GRAPNEL ,WINNER>
    <TELL "You work the grapnel free. The ship drops away from the chain, the
current takes it, and the broken end slides away overhead. You coil the line and
keep the grapnel." CR>
    <CAST-OFF 4>
    <RTRUE>>

;"The chain: a floating object -- at the Prow (during passage 3 and while
  held) and at the Broken End. CLIMB CHAIN goes up from the Prow; CLIMB
  (DOWN) CHAIN goes down from the Broken End. HOOK CHAIN WITH GRAPNEL is the
  PULL-WITH action (section 14) and means the same as THROW GRAPNEL AT
  CHAIN. In THROW GRAPNEL AT CHAIN the chain is PRSI and hears it first; it
  lets that one go by, so the grapnel can handle it."
<OBJECT CHAIN
    (DESC "chain")
    (SYNONYM CHAIN SHACKLE LINKS)
    (FLAGS NDESCBIT)
    (ACTION CHAIN-F)>

<ROUTINE CHAIN-F ()
    <COND (<AND <VERB? PULL-WITH> <PRSO? ,CHAIN>>
           <COND (<PRSI? ,GRAPNEL> <GRAPNEL-THROWN ,CHAIN>)
                 (ELSE <TELL "It's a span's worth of chain. It isn't coming with
you." CR>)>)
          (<NOT <PRSO? ,CHAIN>> <RFALSE>)
          (<VERB? EXAMINE>
           <COND (<==? ,HERE ,BROKEN-END>
                  <TELL "The chain hangs from the last girder's top shackle down
to the prow of your ship." CR>)
                 (,GRAPNEL-HOOKED
                  <TELL "Your grapnel is bitten into it, and the ship hangs from
it. You could climb it." CR>)
                 (ELSE <TELL "A heavy chain hanging from the broken end of the
span, down toward the water. If anything on this river could hold a ship, that
could." CR>)>)
          (<VERB? CLIMB>
           <COND (<==? ,HERE ,BROKEN-END> <DO-WALK ,P?DOWN>)
                 (<==? ,SHIP-AT ,SPAN> <DO-WALK ,P?UP>)
                 (ELSE <TELL "It's out over the water, ahead. You'd need to hook
it first." CR>)>
           <RTRUE>)
          (<VERB? TAKE PULL>
           <TELL "It's a span's worth of chain. It isn't coming with you." CR>)>>

;"--- 15. The Broken End ---------------------------------------------------------
  The lore's shared nightmare, written straight. EAST, OUT (WALK OUT) and GET
  ON GIRDER are river attempts; the girder's own line is the warning."

<ROOM BROKEN-END
    (DESC "The Broken End")
    (IN ROOMS)
    (LDESC "The end of Lord Vaunt's gilded suspension span. Behind you, VAUNT is
written on both towers in letters taller than a house. In front of you the
planks tilt very slightly toward the water, and the last girder hangs out over
the current like a sentence nobody could finish. A chain hangs from its top
shackle down to your ship. Out on the girder sits a small velvet box. The span
runs back west.")
    (WEST TO SPAN-DECK)
    (DOWN TO PROW)
    (EAST PER RIVER-EXIT-F)
    (OUT PER RIVER-EXIT-F)
    (LANDING ,SPAN)
    (RIVER-LINE "The planks tilt under your first step, very slightly, toward
the water. You step back.")
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION ROOM-F)>

;"An exit that is a river attempt (the Broken End, the Drowned Road): the
  room's own line, and false, so you stay put if you survive."
<ROUTINE RIVER-EXIT-F ()
    <RIVER-ATTEMPT <RIVER-LINE-HERE>>>

;"The girder: GET ON / STAND ON / ENTER it is a river attempt."
<OBJECT GIRDER
    (DESC "last girder")
    (SYNONYM GIRDER PLANKS PLANK TOWERS TOWER SPAN)
    (ADJECTIVE LAST)
    (IN BROKEN-END)
    (FLAGS NDESCBIT)
    (TEXT "It hangs out over the current like a sentence nobody could finish. The
velvet box is on it, out of reach.")
    (ACTION GIRDER-F)>

<ROUTINE GIRDER-F ()
    <COND (<VERB? ENTER CLIMB> <RIVER-ATTEMPT <RIVER-LINE-HERE>> <RTRUE>)
          (ELSE <FEATURE-F>)>>

;"N4: the only applicant there ever was."
<OBJECT DIVER-TAG
    (DESC "diver's tag")
    (SYNONYM TAG APPLICANT)
    (ADJECTIVE DIVERS BRASS)
    (IN BROKEN-END)
    (FLAGS TAKEBIT NAMEBIT)
    (FDESC "A brass tag hangs from the chain's top shackle.")
    (READING "Applicant No. 1")
    (TEXT "VERDANCE FOUNDATION DIVERS -- APPLICANT No. 1. Stamped underneath: M.
QUILLAN. There was never an applicant No. 2.")>

;"P8: the velvet box, out on the girder. TAKE is refused (not a river
  attempt, just a refusal). PULL / HOOK / GET BOX WITH PIKE reaches it."
<OBJECT VELVET-BOX
    (DESC "velvet box")
    (SYNONYM BOX RIBBON)
    (ADJECTIVE VELVET CEREMONIAL)
    (IN BROKEN-END)
    (FLAGS NDESCBIT)
    (ACTION VELVET-BOX-F)>

<ROUTINE VELVET-BOX-F ()
    <COND (<NOT <PRSO? ,VELVET-BOX>> <RFALSE>)
          (<VERB? EXAMINE>
           <COND (<FSET? ,VELVET-BOX ,OPENBIT>
                  <TELL "The ceremonial box for \"Phase 2: Far Bank\", open and
empty on the planks." CR>)
                 (ELSE <TELL "A ceremonial velvet box with a ribbon, labelled in
gilt: PHASE 2: FAR BANK. VAUNT CIVIC KEY -- OPENS ANYTHING VAUNT BUILT." CR>)>)
          (<VERB? TAKE PULL PUSH>
           <COND (<FSET? ,VELVET-BOX ,OPENBIT> <TELL "It's empty. Leave it." CR>)
                 (ELSE <TELL "Out on the girder. The planks between you tilt."
CR>)>)
          (<VERB? PULL-WITH>
           <COND (<FSET? ,VELVET-BOX ,OPENBIT> <TELL "It's empty. Leave it." CR>)
                 (<NOT <PRSI? ,PIKE>>
                  <TELL "It doesn't reach. You'd need something long." CR>)
                 (ELSE
                  <FSET ,VELVET-BOX ,OPENBIT>
                  <MOVE ,CIVIC-KEY ,WINNER>
                  <AWARD-POINTS 8 ,ACH?KEY>
                  <TELL "You reach the pike out over the girder, catch the box by
its ribbon, and ease it home. It falls open: on the velvet lies a gilded key,
stamped VAUNT CIVIC KEY. You take it." CR>)>)>>

<OBJECT CIVIC-KEY
    (DESC "Vaunt civic key")
    (SYNONYM KEY)
    (ADJECTIVE VAUNT CIVIC GILDED)
    (FLAGS TAKEBIT)
    (TEXT "A gilded key stamped VAUNT CIVIC KEY. OPENS ANYTHING VAUNT BUILT, says
the box it came from.")
    (ACTION CIVIC-KEY-F)>

<ROUTINE CIVIC-KEY-F ()
    <COND (<AND <VERB? TAKE> <PRSO? ,CIVIC-KEY> <IN? ,CIVIC-KEY ,STOP-SWITCH>>
           <TELL "It stays in the switch. Vaunt's last civic act." CR>)>>

;"--- 16. The Span Deck ---------------------------------------------------------"

<ROOM SPAN-DECK
    (DESC "The Span Deck")
    (IN ROOMS)
    (LDESC "The span's deck, gilded and empty. A tollbooth stands with its window
down. On a post is the roadmap plaque, and on the tollbooth is a recruiting
poster. Back toward the Mingus bank the span is closed by a chained gate: BRIDGE
CLOSED FOR PHASE 2. The broken end is east.")
    (EAST TO BROKEN-END)
    (WEST PER SPAN-GATE-F)
    (LANDING ,SPAN)
    (FLAGS LIGHTBIT)
    (ACTION ROOM-F)>

<ROUTINE SPAN-GATE-F ()
    <TELL "The gate is chained: BRIDGE CLOSED FOR PHASE 2." CR>
    <RFALSE>>

<OBJECT TOLLBOOTH
    (DESC "tollbooth")
    (SYNONYM TOLLBOOTH TOLL BOOTH)
    (IN SPAN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "TOLL: ONE $ALT. EXACT CHANGE. Nobody has ever paid it.")
    (ACTION FEATURE-F)>

<OBJECT ROADMAP-PLAQUE
    (DESC "roadmap plaque")
    (SYNONYM PLAQUE POST)
    (ADJECTIVE ROADMAP)
    (IN SPAN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "PHASE 1: BRIDGE. PHASE 2: FAR BANK.")
    (ACTION FEATURE-F)>

<OBJECT POSTER
    (DESC "poster")
    (SYNONYM POSTER DIVERS FOUNDATION)
    (ADJECTIVE RECRUITING)
    (IN SPAN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "THE VERDANCE FOUNDATION DIVERS. JOIN THE FIRST DEEP-WATER TEAM ON THE
RIVER! Generous token allocation. Vesting schedule TBD.")
    (ACTION FEATURE-F)>

<OBJECT SPAN-GATE
    (DESC "chained gate")
    (SYNONYM GATE CHAINS)
    (ADJECTIVE CHAINED)
    (IN SPAN-DECK)
    (FLAGS NDESCBIT)
    (TEXT "BRIDGE CLOSED FOR PHASE 2.")
    (ACTION SPAN-GATE-OBJ-F)>

<ROUTINE SPAN-GATE-OBJ-F ()
    <COND (<VERB? OPEN UNLOCK CLIMB>
           <TELL "It's chained, and Phase 2 never came." CR>)
          (ELSE <FEATURE-F>)>>


;"============================================================================
  10. PART FIVE: THE INTAKE  --  the Mingus bank (rooms 17-19)
 ----------------------------------------------------------------------------
  The current pins the ship to the intake screen. Sandwich is pinned there
  too, holding N5. Vaunt's key in Vaunt's switch stops the pump (P9); the
  next turn you are aboard, the ship comes off the screen into the Race.
 ============================================================================"

;"--- 17. The Intake Screen ---------------------------------------------------"

<ROOM INTAKE-SCREEN
    (DESC "The Intake Screen")
    (IN ROOMS)
    (IN TO MAIN-DECK)
    (WEST TO DIVERS-SHED)
    (NORTH TO DROWNED-ROAD)
    (LANDING ,INTAKE)
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION INTAKE-SCREEN-F)>

<ROUTINE INTAKE-SCREEN-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "A catwalk along the vast gilded grating of PUMPING STATION No. 2
-- INTAKE. It pumps the Verdance up the mountain, the one thing in the
Ascendancy that goes uphill">
           <COND (,PUMP-STOPPED <TELL ". It is still now, and the water goes
through the grating slowly">)
                 (ELSE <TELL ", and the whole screen hums with it">)>
           <TELL ". By the catwalk rail is a stop switch. Far off along the Mingus
bank the verdlings stand in silent rows, watching. Your ship is back in; a shed
stands to the west, and to the north a road comes down to the water." CR>)
          (ELSE <ROOM-F .RARG>)>>

<OBJECT GRATING
    (DESC "grating")
    (SYNONYM GRATING SCREEN INTAKE PUMP STATION)
    (ADJECTIVE GILDED)
    (IN INTAKE-SCREEN)
    (FLAGS NDESCBIT)
    (ACTION GRATING-F)>

<ROUTINE GRATING-F ()
    <COND (<VERB? EXAMINE>
           <COND (,PUMP-STOPPED
                  <TELL "Still. For the first time in its life, the Ascendancy has
stopped drinking the river." CR>)
                 (ELSE <TELL "PUMPING STATION No. 2 -- INTAKE. It is drinking the
Verdance and sending it up the mountain." CR>)>)
          (ELSE <FEATURE-F>)>>

;"P9. In PUT KEY IN SWITCH, UNLOCK SWITCH WITH KEY and TURN SWITCH WITH KEY
  the switch hears the action before the library can object that it is not
  a container (or not locked). TRANSBIT lets you see the key once it is in."
<OBJECT STOP-SWITCH
    (DESC "stop switch")
    (SYNONYM SWITCH KEYHOLE)
    (ADJECTIVE STOP EMERGENCY)
    (IN INTAKE-SCREEN)
    (FLAGS NDESCBIT CONTBIT TRANSBIT)
    (ACTION STOP-SWITCH-F)>

<ROUTINE STOP-SWITCH-F ()
    <COND (<KEEP-PIKE?> <RTRUE>)
          (<AND <VERB? PUT-IN PUT-ON> <PRSI? ,STOP-SWITCH>>
           <COND (<NOT <PRSO? ,CIVIC-KEY>>
                  <TELL "It takes a Vaunt civic key, and only that." CR>)
                 (ELSE <STOP-PUMP>)>)
          (<NOT <PRSO? ,STOP-SWITCH>> <RFALSE>)
          (<VERB? UNLOCK>
           <COND (<NOT <PRSI? ,CIVIC-KEY>>
                  <TELL "It takes a Vaunt civic key, and only that." CR>)
                 (ELSE <STOP-PUMP>)>)
          (<VERB? EXAMINE>
           <COND (,PUMP-STOPPED
                  <TELL "EMERGENCY STOP -- VAUNT CIVIC KEY ONLY. The civic key is
in it, turned." CR>)
                 (ELSE <TELL "EMERGENCY STOP -- VAUNT CIVIC KEY ONLY. There is a
keyhole." CR>)>)
          (<VERB? PUSH PULL TURN TURN-OFF FLIP>
           <COND (,PUMP-STOPPED <TELL "It's done." CR>)
                 (ELSE <TELL "EMERGENCY STOP -- VAUNT CIVIC KEY ONLY. The keyhole
waits." CR>)>)
          (<VERB? TAKE> <TELL "It's bolted to the catwalk." CR>)>>

<ROUTINE STOP-PUMP ()
    <COND (,PUMP-STOPPED <TELL "It's done." CR> <RTRUE>)>
    <SETG PUMP-STOPPED T>
    <MOVE ,CIVIC-KEY ,STOP-SWITCH>
    <AWARD-POINTS 8 ,ACH?PUMP>
    <TELL "You put the civic key in the switch and turn it. The pump runs down
with a sound like the mountain exhaling. For the first time in its life, the
Ascendancy stops drinking the river." CR>
    <SANDWICH-PAYS-UP>
    <RTRUE>>

;"N5: Sandwich holds it until the pump stops (section 11)."
<OBJECT SUTT-PLAQUE
    (DESC "funeral plaque")
    (SYNONYM PLAQUE SUTT AMBERLINE COUNCILLOR WORDS)
    (ADJECTIVE FUNERAL SEED)
    (FLAGS TAKEBIT NAMEBIT)
    (READING "Amberline Sutt")
    (TEXT "A funeral plaque: AMBERLINE SUTT -- COUNCILLOR, and twelve seed words,
very small. It is the Floor Price's plaque, from the launch register.")
    (ACTION SUTT-PLAQUE-F)>

<ROUTINE SUTT-PLAQUE-F ()
    <COND (<AND <VERB? TAKE> <PRSO? ,SUTT-PLAQUE> <IN? ,SUTT-PLAQUE ,SANDWICH>>
           <TELL "\"Unpin me first, chief. Then we'll talk.\"" CR>)>>

;"--- 18. The Divers' Shed ------------------------------------------------------"

<ROOM DIVERS-SHED
    (DESC "The Divers' Shed")
    (IN ROOMS)
    (LDESC "The Verdance Foundation Divers' recruiting shed, never used. A sign-up
sheet is pinned to the wall, and a diving helmet sits on a shelf. The catwalk is
back east.")
    (EAST TO INTAKE-SCREEN)
    (LANDING ,INTAKE)
    (FLAGS LIGHTBIT)
    (ACTION ROOM-F)>

<OBJECT SIGNUP-SHEET
    (DESC "sign-up sheet")
    (SYNONYM SIGN-UP SIGNUP SHEET WALL)
    (IN DIVERS-SHED)
    (FLAGS NDESCBIT)
    (TEXT "The sign-up sheet has room for a hundred divers. The first line has
been torn off. The rest are blank.")
    (ACTION FEATURE-F)>

<OBJECT HELMET
    (DESC "diving helmet")
    (SYNONYM HELMET SHELF)
    (ADJECTIVE DIVING)
    (IN DIVERS-SHED)
    (FLAGS NDESCBIT)
    (TEXT "It has never been wet.")
    (ACTION FEATURE-F)>

;"--- 19. The Drowned Road ------------------------------------------------------
  Written straight: no jokes here. DOWN, EAST and WALK DOWN ROAD are river
  attempts, with the road's own warning line."

<ROOM DROWNED-ROAD
    (DESC "The Drowned Road")
    (IN ROOMS)
    (LDESC "A road comes down out of the Ascendancy and runs straight into the
Verdance. Its centre line goes on under the water, a little blurred, for as far
as you can see into the green. At the top of the road a car stands with its
engine ticking and its headlights on, pointed down the road. The driver's door
is open. There is nobody in it and nobody near it, and the road is very clearly
meant to be driven. The intake is back south.")
    (SOUTH TO INTAKE-SCREEN)
    (DOWN PER RIVER-EXIT-F)
    (EAST PER RIVER-EXIT-F)
    (LANDING ,INTAKE)
    (RIVER-LINE "You take one step down the road toward the water, and the water
seems to take one step toward you. You step back.")
    (FLAGS LIGHTBIT RIVERSIDEBIT)
    (ACTION ROOM-F)>

<OBJECT THE-ROAD
    (DESC "road")
    (SYNONYM ROAD CENTRE CENTER LINE TARMAC)
    (IN DROWNED-ROAD)
    (FLAGS NDESCBIT)
    (TEXT "The centre line goes on under the water, a little blurred, as far as
you can see.")
    (ACTION THE-ROAD-F)>

<ROUTINE THE-ROAD-F ()
    <COND (<VERB? ENTER> <RIVER-ATTEMPT <RIVER-LINE-HERE>> <RTRUE>)
          (ELSE <FEATURE-F>)>>

<OBJECT THE-CAR
    (DESC "car")
    (SYNONYM CAR ENGINE HEADLIGHTS DOOR)
    (IN DROWNED-ROAD)
    (FLAGS NDESCBIT)
    (TEXT "The engine is ticking. The headlights are on. The driver's door is
open. Nobody is in it.")
    (ACTION THE-CAR-F)>

<ROUTINE THE-CAR-F ()
    <COND (<VERB? ENTER DRIVE OPEN CLOSE>
           <TELL "You don't. You know exactly where it goes." CR>)
          (ELSE <FEATURE-F>)>>

;"The Verdance itself: a floating object, in every riverside room. ENTER
  RIVER / JUMP IN RIVER / SWIM IN RIVER are river attempts, with the room's
  own line."
<OBJECT VERDANCE
    (DESC "Verdance")
    (SYNONYM VERDANCE RIVER WATER CURRENT STREAM)
    (FLAGS NDESCBIT NARTICLEBIT)
    (TEXT "Broad and green and fast, older and stranger than the Ascendancy. It
goes by quick and quiet.")
    (ACTION VERDANCE-F)>

<ROUTINE VERDANCE-F ()
    <COND (<VERB? ENTER JUMP-IN SWIM-IN>
           <RIVER-ATTEMPT <RIVER-LINE-HERE>>
           <RTRUE>)
          (<VERB? DRINK> <TELL "It tastes of a long way down." CR>)
          (<VERB? TAKE> <TELL "It runs through your fingers, on its way
somewhere." CR>)>>


;"============================================================================
  11. NPCS  --  Lucan (the showcase), Sandwich, Mrs. Thrumble
 ----------------------------------------------------------------------------
  Three patterns:
    LUCAN     a companion: follows, leads, talks, reacts, dies on a timer
    SANDWICH  an antagonist on a fixed, learnable schedule
    THRUMBLE  a stationary service NPC who answers a bell

  How an NPC is put together in ZIL:
    - It is an OBJECT with PERSONBIT. That one flag tells zillib it is a
      person: the parser lets it be ASKed, TOLD, GIVEn things, addressed
      (LUCAN, SING), and the pronouns HIM/HER find it. FEMALEBIT picks HER.
    - Its ACTION routine is its whole mind. It is called with no argument
      when the person is the subject of your action (PRSO or PRSI), and with
      ARG = M-WINNER when you give it an order. It handles what it cares
      about and returns false for anything else, so the library's default
      runs instead.
    - What it does ON ITS OWN, at the end of a turn, is one tick routine per
      NPC (LUCAN-TICK, SANDWICH-TICK), called by the dispatcher in section
      12 in a fixed order. Nothing an NPC does at the end of a turn happens
      anywhere else -- no M-END, no extra QUEUE -- which is what keeps the
      two versions of this game printing the same thing on the same turn.
  Rule of thumb: the TICK decides what an NPC does; the ACTION decides how
  it reacts to what YOU do. Copy this split for any NPC of your own.
 ============================================================================"

;"------------------------------------------------------------------------------
  LUCAN FAIRWEATHER, the Thursday tenor
 ------------------------------------------------------------------------------
  LESSON: the state machine. One global, LUCAN-STATE, says what he is doing:

    HIDDEN     not in play (stowed away in the hold)
       | passage 1, drift 2: he climbs out          (LUCAN-STOWAWAY)
    FOLLOWING  walks after you, on the ship and at the landing it is at
       | the end of the turn the ship lands at the Stone Pier
    GUIDING    goes ahead of you: Stone Pier -> Mine Heads -> Hollow Green
       | you and he are both in the Hollow Green
    ARRIVED    LUCAN-TIMER counts: 1 = the verse, 2 = the death
       | timer 2, whatever you do
    DEAD       removed from play; his hat and the hole remain

  The states are plain number CONSTANTs (section 1), so the machine is just
  a global and a COND in LUCAN-TICK. Each transition happens in exactly one
  place, and every one of them is a SETG LUCAN-STATE you can search for.
 ------------------------------------------------------------------------------"

;"He starts off-stage: an object with no IN is in no room at all, so the
  parser can't find him and the library never describes him. LUCAN-STOWAWAY
  MOVEs him in when his moment comes.

  LESSON: the DESCFCN is the line a room description prints for him -- one
  per state, so what you see matches what he is doing. The library first
  asks 'will you describe yourself?' (M-OBJDESC?; true means yes), then
  asks him to do it (M-OBJDESC).

  LESSON: the greeting is a property, GREETING, so V-HELLO (section 14) can
  print any person's greeting the same way: HELLO, HI, SAY HELLO, SAY HELLO
  TO LUCAN and GREET LUCAN all end up there."
<OBJECT LUCAN
    (DESC "Lucan Fairweather")
    (SYNONYM LUCAN FAIRWEATHER TENOR MAN SINGER WAISTCOAT)
    (ADJECTIVE LARGE)
    (FLAGS PERSONBIT NARTICLEBIT)
    (DESCFCN LUCAN-DESC)
    (TEXT "A large, kind man in a velvet waistcoat and a hat with a velvet band,
magnificently theatrical even when standing still. He has sung about the old
side for twenty years.")
    (GREETING "Lucan sweeps a bow that nearly takes him over the rail. \"Your
servant, chief.\"")
    (ACTION LUCAN-F)>

<ROUTINE LUCAN-DESC (ARG)
    <COND (<==? .ARG ,M-OBJDESC?> <RTRUE>)
          (<==? ,LUCAN-STATE ,FOLLOWING>
           <TELL "Lucan Fairweather is here, humming, his hat pushed back." CR>)
          (<==? ,LUCAN-STATE ,GUIDING>
           <TELL "Lucan Fairweather is here, impatient to go on." CR>)
          (ELSE
           <TELL "Lucan Fairweather stands at the edge of the bright green,
singing to the water." CR>)>>

;"LESSON: an NPC's ACTION, top to bottom.
    - ARG set: you gave him an order (LUCAN, SING). He answers it with the
      conversation's fallback line.
    - GIVE and SHOW: here he is PRSI ('give the coat TO LUCAN'). PERFORM
      asks PRSI before PRSO, so he sees it before the coat does. One
      reaction table serves both verbs (LUCAN-REACTS, below).
    - From here on, he must be PRSO; anything else is not about him.
    - ASK and TELL share one topic table (LUCAN-TOPIC).
    - Physical actions are the ways a player might try to save him -- and
      why none of them can: the scene is scripted on purpose."
<ROUTINE LUCAN-F ("OPT" ARG)
    <COND (.ARG
           <TELL "Lucan considers this, then sings a line about something else
entirely." CR>)
          (<AND <VERB? GIVE SHOW> <PRSI? ,LUCAN>> <LUCAN-REACTS ,PRSO>)
          (<NOT <PRSO? ,LUCAN>> <RFALSE>)
          (<VERB? ASK-ABOUT TELL-ABOUT> <LUCAN-TOPIC>)
          (<VERB? TAKE PULL WARN>
           <TELL "He waves you off mid-verse." CR>)
          (<VERB? PUSH>
           <TELL "He doesn't budge. A tenor is built on a firm foundation." CR>)
          (<VERB? KISS>
           <TELL "He offers a cheek, theatrically. \"Thursdays only.\"" CR>)
          (<VERB? ATTACK>
           <TELL "You'd sooner hit the river. He's the only friend you have down
here." CR>)>>

;"LESSON: conversation -- a topic table, read top to bottom. ABOUT?
  (section 4) is true when any of its words is in the topic the player typed
  (ASK LUCAN ABOUT THE OLD SIDE). The first row that matches answers; the
  last line is the FALLBACK, for anything the table doesn't know. In ZIL a
  'table' of replies is simply one COND, one clause per row. One exception
  comes first: TELLING him about the patches is a warning, and he waves it
  off. SAY ... TO LUCAN arrives here as an ASK (V-SAY, section 14)."
<ROUTINE LUCAN-TOPIC ()
    <COND (<AND <VERB? TELL-ABOUT>
                <ABOUT? ,W?PATCHES ,W?PATCH ,W?TURF ,W?GREEN ,W?STONES>>
           <TELL "He waves you off mid-verse." CR>)
          (<ABOUT? ,W?OLD ,W?SIDE ,W?ACROSS ,W?FAR ,W?BANK>
           <TELL "\"Twenty years I've sung it. Lamplight and low ceilings in one
song, a green field over a sleeping city in the next. Tonight I find out
which.\"" CR>)
          (<ABOUT? ,W?SONG ,W?SONGS ,W?VERSE ,W?POETS>
           <TELL "\"\"Where the green bank goes down to the water, there's a door
that was never a door.\" That one. It's always been that one.\"" CR>)
          (<ABOUT? ,W?SANDWICH ,W?RUNNER ,W?BOARDS ,W?SCULL>
           <TELL "\"He's always first, that one, and he's never once arrived
anywhere. Reach for the gilt and he'll have it -- he has never wanted anything
plain in his life.\"" CR>)
          (<ABOUT? ,W?VERDLINGS ,W?VERDLING>
           <TELL "\"They bowed to you. To you. I'd have given my voice for
that.\"" CR>)
          (<ABOUT? ,W?RIVER ,W?VERDANCE ,W?CURRENT ,W?WATER>
           <TELL "\"No one comes back. That's the line everybody knows. Nobody
knows the next line, because nobody came back to write it.\"" CR>)
          (<ABOUT? ,W?LANTERN>
           <TELL "\"Beckoning or warning. I sing it both ways, alternate
Thursdays.\"" CR>)
          (<ABOUT? ,W?ASCENDANCY ,W?MINGUS ,W?MOUNTAIN ,W?BALLROOM>
           <TELL "\"Thursdays in the ballroom, upside down, for $ALT. I don't miss
it. I miss the acoustics.\"" CR>)
          (<ABOUT? ,W?LUCAN ,W?TENOR ,W?HIMSELF ,W?YOU>
           <TELL "\"Lucan Fairweather. Tenor. Thursdays. Retired, as of last
night.\"" CR>)
          (<ABOUT? ,W?PATCHES ,W?PATCH ,W?TURF ,W?GREEN ,W?STONES>
           <TELL "\"Like little stages! The song says the green is a floor.\"" CR>)
          (<ABOUT? ,W?SHIP ,W?FUNERAL ,W?PLAQUE>
           <TELL "\"It was built for the dead. I'm hiding in it. Draw your own
conclusions; I have.\"" CR>)
          (<ABOUT? ,W?LIFEBELT ,W?RING ,W?BELT>
           <TELL "\"Everything that floats is a song waiting to happen.\"" CR>)
          (ELSE
           <TELL "Lucan considers this, then sings a line about something else
entirely." CR>)>>

;"LESSON: reacting to GIVE and SHOW, item by item. He never keeps anything:
  the routine prints and returns true, so the library's V-GIVE never runs
  and the item stays with you. NAMEBIT picks out the five names; each one's
  READING property is the name he reads aloud."
<ROUTINE LUCAN-REACTS (ITEM)
    <COND (<==? .ITEM ,COAT>
           <TELL "\"Esme's coat! I sang at her wedding. Both weddings. Same
song.\"" CR>)
          (<==? .ITEM ,PIKE>
           <TELL "He steps back. \"Not to me, chief. They'd never forgive either
of us.\"" CR>)
          (<FSET? .ITEM ,NAMEBIT>
           <TELL "He reads one name aloud, quietly -- \"" <GETP .ITEM ,P?READING>
"\" -- and takes his hat off. \"Somebody should sing them.\"" CR>)
          (<==? .ITEM ,LIFEBELT>
           <TELL "\"Ha! The song was right about something.\"" CR>)
          (ELSE
           <TELL "Lucan admires it politely and gives it back." CR>)>>

;"LESSON: the route. Leading needs to know 'how far along' a room is, so the
  route is a table and ROUTE-INDEX looks a room up in it (-1 = not on it).
  GET counts from 0: <GET ,LUCAN-ROUTE 0> is the Stone Pier."
<CONSTANT LUCAN-ROUTE <PTABLE STONE-PIER MINE-HEADS HOLLOW-GREEN>>

<ROUTINE ROUTE-INDEX (RM)
    <DO (I 0 2)
        <COND (<==? <GET ,LUCAN-ROUTE .I> .RM> <RETURN .I>)>>
    -1>

;"LUCAN-TICK: everything Lucan does at the end of a turn, by state. Called
  by the dispatcher (section 12) after the river and before Sandwich.
  DEAD (and HIDDEN outside passage 1) does nothing at all."
<ROUTINE LUCAN-TICK ()
    <COND (<==? ,LUCAN-STATE ,HIDDEN> <LUCAN-STOWAWAY>)
          (<==? ,LUCAN-STATE ,FOLLOWING> <LUCAN-FOLLOWS>)
          (<==? ,LUCAN-STATE ,GUIDING> <LUCAN-LEADS>)
          (<==? ,LUCAN-STATE ,ARRIVED> <LUCAN-ARRIVED>)>>

;"LESSON: a hidden NPC that announces itself. Passage 1, drift 1: a sneeze
  (a clue). Drift 2: the entrance, worded for where you are standing. MOVE
  puts him in your room, and the state machine moves on to FOLLOWING. His
  nest goes into the Hold at the same moment: it is part of his story now."
<ROUTINE LUCAN-STOWAWAY ()
    <COND (<N==? ,PASSAGE 1> <RFALSE>)
          (<==? ,DRIFT 1>
           <COND (<==? ,HERE ,HOLD>
                  <TELL CR "From under the medallions, someone sneezes." CR>)
                 (ELSE <TELL CR "From the hold, someone sneezes." CR>)>
           <RFALSE>)
          (<N==? ,DRIFT 2> <RFALSE>)>
    <MOVE ,LUCAN ,HERE>
    <MOVE ,LUCAN-NEST ,HOLD>
    <SETG LUCAN-STATE ,FOLLOWING>
    <COND (<==? ,HERE ,HOLD>
           <TELL CR "The medallions shift, and slide, and a large man in a velvet
waistcoat climbs out of them, brushing off $ALT.">)
          (ELSE
           <TELL CR "The hatch bangs open, and a large man in a velvet waistcoat
climbs up through it, brushing off $ALT.">)>
    <TELL " \"Lucan Fairweather. Tenor. Thursdays.\" In one breath he explains
that he has sung about the old side for twenty years, that a Mingan on the
valley floor gets poked, and that this ship is his only chance." CR>>

;"LESSON: following. Each turn: if he isn't in your room, and your room is
  somewhere he can go (the ship, or the landing it is at -- a room's
  LANDING property says which landing it belongs to), he MOVEs there and
  says so. Following is nothing more than 'end of turn: catch up with the
  player'. The landing ends this state: the turn the ship reaches the
  Stone Pier, he is over the rail first, and GUIDING begins."
<ROUTINE LUCAN-FOLLOWS ()
    <COND (<==? ,SHIP-AT ,PIER>
           <MOVE ,LUCAN ,STONE-PIER>
           <SETG LUCAN-STATE ,GUIDING>
           <TELL CR "Lucan is over the rail and onto the pier before the ship has
stopped moving." CR>)
          (<IN? ,LUCAN ,HERE> <RFALSE>)
          (<OR <FSET? ,HERE ,SHIPBIT> <==? <GETP ,HERE ,P?LANDING> ,SHIP-AT>>
           <MOVE ,LUCAN ,HERE>
           <TELL CR "Lucan follows you, humming." CR>)>>

;"LESSON: leading, with catch-up. The first rule that matches applies:
   (a) WAIT, THEN GO ON: you are in his room and were already there when the
       turn began (you didn't just arrive) -- he goes one room on. So when
       you arrive he waits one turn, and any action at all lets him go.
   (b) CATCH UP: you are further along the route than he is -- he hurries
       after you. You can't outrun the script.
   (c) CALL YOU ON: you are elsewhere on the old-side bank or on the ship.
   (d) ARRIVAL, checked after the rest: you are both in the Hollow Green.
  'You just arrived' is HERE ~= LAST-LOC: the dispatcher saves LAST-LOC at
  the end of every turn. Leading is following turned round: the NPC moves
  first, and the player's position decides whether he waits."
<ROUTINE LUCAN-LEADS ("AUX" (THEIRS <ROUTE-INDEX <LOC ,LUCAN>>)
                            (MINE <ROUTE-INDEX ,HERE>))
    <COND (<AND <IN? ,LUCAN ,HERE> <==? ,HERE ,LAST-LOC> <L? .THEIRS 2>>
           <MOVE ,LUCAN <GET ,LUCAN-ROUTE <+ .THEIRS 1>>>
           <TELL CR "Lucan goes north, singing. \"This way!\"" CR>)
          (<G? .MINE .THEIRS>
           <MOVE ,LUCAN ,HERE>
           <TELL CR "Lucan hurries up behind you, out of breath. \"Wait for
me!\"" CR>)
          (<AND <NOT <IN? ,LUCAN ,HERE>>
                <OR <==? <GETP ,HERE ,P?LANDING> ,PIER> <FSET? ,HERE ,SHIPBIT>>>
           <TELL CR "Somewhere ahead, Lucan is singing, and calling for you to keep
up." CR>)>
    <COND (<AND <IN? ,LUCAN ,HOLLOW-GREEN> <==? ,HERE ,HOLLOW-GREEN>>
           <SETG LUCAN-STATE ,ARRIVED>
           <SETG LUCAN-TIMER 0>
           <TELL CR "\"There!\" Lucan points. \"A ring on a post, where the green
bank goes down to the water. The song never said what for.\"" CR>)>>

;"LESSON: a scripted, timed event. Once ARRIVED, a timer counts turns, and
  nothing the player does changes it: timer 1 is the verse (and the step
  back, onto the bright green); timer 2 is the death. The text depends on
  whether you are there to see it; the event does not. (A ZIL programmer
  might reach for <QUEUE I-LUCAN-DIES 2> here; this game keeps the count in
  the state machine instead, so the dispatcher's order still decides when
  it prints.)"
<ROUTINE LUCAN-ARRIVED ()
    <SETG LUCAN-TIMER <+ ,LUCAN-TIMER 1>>
    <COND (<==? ,LUCAN-TIMER 1>
           <COND (<==? ,HERE ,HOLLOW-GREEN>
                  <TELL CR "Lucan sings the verse through once, softly, for the
first time in the place it was written about. Then he steps back to take it all
in, onto the bright green." CR>)>)
          (ELSE <LUCAN-DIES>)>>

;"LESSON: what persists after death. REMOVE the NPC, then leave his traces
  in the world: the hole and his hat here, his nest in the Hold (the Hold's
  description checks LUCAN-STATE), Mrs. Thrumble's line and his songbook
  (THRUMBLE-RING), Sandwich's question (SANDWICH-TICK), and a line in the
  ending (section 13). Every one of those reads LUCAN-STATE = DEAD: the
  state machine is also the game's memory of him."
<ROUTINE LUCAN-DIES ()
    <REMOVE ,LUCAN>
    <SETG LUCAN-STATE ,DEAD>
    <MOVE ,LUCAN-HOLE ,HOLLOW-GREEN>
    <MOVE ,LUCAN-HAT ,HOLLOW-GREEN>
    <COND (<==? ,HERE ,HOLLOW-GREEN>
           <TELL CR "The bright turf gives under him without a sound, the way a
stage trap opens. For a moment there is a hole in the grass, and warm air coming
up out of it, and the last note of the verse. Then Lucan is gone." CR>)
          (ELSE
           <TELL CR "From somewhere behind you, the song stops in the middle of a
line." CR>)>>

;"LESSON: following the leader. FOLLOW LUCAN works even when he has gone on
  ahead and is out of sight, so FOLLOW reads a TOPIC (section 14) rather
  than an object the parser would have to find in the room. If he is one
  room ahead on his route, DO-WALK takes you there exactly as NORTH would."
<ROUTINE FOLLOW-LUCAN ("AUX" (MINE <ROUTE-INDEX ,HERE>))
    <COND (<IN? ,LUCAN ,HERE>
           <TELL "He's right here, singing at you." CR>)
          (<AND <==? ,LUCAN-STATE ,GUIDING> <G=? .MINE 0>
                <==? <ROUTE-INDEX <LOC ,LUCAN>> <+ .MINE 1>>>
           <DO-WALK ,P?NORTH>)
          (ELSE <TELL "You can't see where he went." CR>)>
    <RTRUE>>

;"------------------------------------------------------------------------------
  SANDWICH, the front-runner
 ------------------------------------------------------------------------------
  LESSON: an antagonist on a fixed schedule. Every appearance is listed in
  SANDWICH-STATE's constants (section 1), and his interference follows one
  rule he says out loud, so it is learnable: 'Whatever you reach for, I'll
  have reached for it first.' He never takes what you already carry.

  CONTBIT and TRANSBIT make him a see-through container, so whatever he is
  holding up for you to admire (a decoy, the plaque) is in sight -- and in
  scope -- while it is in his hands.
 ------------------------------------------------------------------------------"

<OBJECT SANDWICH
    (DESC "Sandwich")
    (SYNONYM SANDWICH FRONTRUNNER BOARDS SCULL SLIPPAGE BOATHOOK)
    (ADJECTIVE THIN)
    (IN GANGPLANK-FOOT)
    (FLAGS PERSONBIT NARTICLEBIT CONTBIT TRANSBIT)
    (DESCFCN SANDWICH-DESC)
    (TEXT "A thin, cheerful Mingan in sandwich boards. The front one says FIRST!
and the back one says THANKS FOR THE ALPHA. He is eating a sandwich. Everybody
on the river calls him Sandwich, because he's always just in front of you and
just behind you. He floated down the Verdance years ago and never went back:
\"Why would I? Everything rolls downhill. I just wait at the bottom.\"")
    (GREETING "He waves a sandwich at you.")
    (ACTION SANDWICH-F)>

;"His line in a room description, one per state of his schedule."
<ROUTINE SANDWICH-DESC (ARG)
    <COND (<==? .ARG ,M-OBJDESC?> <RTRUE>)
          (<==? ,SANDWICH-STATE ,SW-UPSTREAM>
           <TELL "Offshore, a thin man in sandwich boards sits in a narrow gilded
scull, eating a sandwich and watching the ship." CR>)
          (<EQUAL? ,SANDWICH-STATE ,SW-AHEAD ,SW-WAITING>
           <TELL "Sandwich sits on the wreck's upturned side, a boathook across
his knees, eating a sandwich." CR>)
          (<==? ,SANDWICH-STATE ,SW-HOLDING>
           <TELL "Sandwich sits on the wreck's upturned side, holding ">
           <COND (<FIRST? ,SANDWICH> <TELL T <FIRST? ,SANDWICH>>)>
           <TELL " up for you to admire." CR>)
          (ELSE
           <TELL "Sandwich's scull is pinned against the screen next to your ship.
Sandwich sits in it, holding a funeral plaque against his chest like a menu."
CR>)>>

<ROUTINE SANDWICH-F ("OPT" ARG)
    <COND (.ARG <TELL "Sandwich has better things to do." CR>)
          (<KEEP-PIKE?> <RTRUE>)
          (<AND <VERB? GIVE> <PRSI? ,SANDWICH>>
           <COND (<PRSO? ,COAT> <SANDWICH-TAKES-COAT>)
                 (ELSE <TELL "\"Floor price: zero. Pass.\"" CR>)>)
          (<AND <VERB? SHOW> <PRSI? ,SANDWICH>>
           <TELL "\"Floor price: zero. Pass.\"" CR>)
          (<NOT <PRSO? ,SANDWICH>> <RFALSE>)
          ;"Just his TEXT: the library would go on to list what he holds,
            which his room line already shows."
          (<VERB? EXAMINE> <TELL <GETP ,SANDWICH ,P?TEXT> CR>)
          (<VERB? ASK-ABOUT TELL-ABOUT>
           <TELL "He taps his front board. FIRST!" CR>)
          (<VERB? TAKE PULL PUSH ATTACK KISS>
           <TELL "He's already out of reach, smiling. Latency." CR>)>>

;"The front-run rule, as an action. Called from the Wreck's M-BEG for every
  TAKE there while he is present; returning false lets the take go on."
<ROUTINE SANDWICH-GRAB (ITEM)
    <COND (<NOT <EQUAL? .ITEM ,SWEEP ,GRAPNEL ,STRONGBOX ,NAMEBOARD>> <RFALSE>)
          (<==? ,SANDWICH-STATE ,SW-HOLDING>
           <COND (<IN? .ITEM ,SANDWICH>
                  <TELL "He's already out of reach, smiling. Latency." CR>
                  <RTRUE>)
                 (<N==? .ITEM ,STRONGBOX> <RFALSE>)>
           ;"the rest are yours for the taking; the strongbox is a better offer"
           <MOVE <FIRST? ,SANDWICH> ,WRECK>
           <TELL "\"Better offer!\" He drops what he was holding, hooks the
strongbox instead, and tucks it under one arm.">
           <SANDWICH-ROWS-OFF T>)
          (<N==? ,SANDWICH-STATE ,SW-WAITING> <RFALSE>)
          (<==? .ITEM ,STRONGBOX>
           <TELL "His boathook flicks past your hand, and he has the strongbox
first. \"FIRST!\" He tucks it under one arm.">
           <SANDWICH-ROWS-OFF T>)
          (ELSE
           <MOVE .ITEM ,SANDWICH>
           <SETG SANDWICH-STATE ,SW-HOLDING>
           <TELL "His boathook flicks past your hand, and he has " T .ITEM "
first. \"FIRST!\" He holds it up and smiles. \"Yours for the coat.\"" CR>
           <RTRUE>)>>

;"GIVE COAT TO SANDWICH: while he holds a decoy, the trade. It always works,
  and it never scores P2."
<ROUTINE SANDWICH-TAKES-COAT ("AUX" (HELD <FIRST? ,SANDWICH>))
    <COND (<N==? ,SANDWICH-STATE ,SW-HOLDING>
           <TELL "He looks at the coat the way a man looks at a price. \"Not yet,
chief.\"" CR>
           <RTRUE>)>
    <TELL "He hands you " T .HELD " and takes the coat, and puts it on over his
boards. You paid the front-runner. Everyone does.">
    <MOVE .HELD ,WINNER>
    <REMOVE ,COAT>
    <SANDWICH-ROWS-OFF <>>>

;"He leaves the Sandbar: the beached scull goes with him, and he goes ahead
  to the intake, where he will be pinned with the plaque (Part Five)."
<ROUTINE SANDWICH-ROWS-OFF (WITH-BOX)
    <COND (.WITH-BOX
           <REMOVE ,STRONGBOX>
           <AWARD-POINTS 8 ,ACH?FEINT>)>
    <REMOVE ,BEACHED-SCULL>
    <MOVE ,SANDWICH ,INTAKE-SCREEN>
    <MOVE ,SUTT-PLAQUE ,SANDWICH>
    <SETG SANDWICH-STATE ,SW-INTAKE>
    <TELL " He rows away downstream, and is gone from the Sandbar." CR>
    <RTRUE>>

;"P9's payoff: the pump stops, the screen lets him go, he pays up."
<ROUTINE SANDWICH-PAYS-UP ()
    <MOVE ,SUTT-PLAQUE ,WINNER>
    <REMOVE ,SANDWICH>
    <SETG SANDWICH-STATE ,SW-RACING>
    <TELL CR "Sandwich's scull comes loose from the slackening screen. He looks at
the switch, and at you, and tosses you the plaque. \"Fair's fair. You front-ran
the front-runner.\" Then he pushes off and rows away downstream, to be first at
the bottom." CR>>

;"LESSON: a schedule is a tick routine with one clause per appointment.
  SANDWICH-TICK runs at the end of the turn, after Lucan, and handles at
  most one event per turn (the first clause that matches)."
<ROUTINE SANDWICH-TICK ()
    <COND ;"Passage 1, drift 1: he shoots past, to be at the Wreck first."
          (<AND <==? ,SANDWICH-STATE ,SW-UPSTREAM> <==? ,PASSAGE 1> <==? ,DRIFT 1>>
           <MOVE ,SANDWICH ,WRECK>
           <SETG SANDWICH-STATE ,SW-AHEAD>
           <TELL CR "A narrow gilded scull shoots past downstream, oars flashing.
The man in it has FIRST! painted on his chest. \"FIRST!\"" CR>)
          ;"Your first entrance at the Wreck: he says the rule out loud."
          (<AND <==? ,SANDWICH-STATE ,SW-AHEAD> <==? ,HERE ,WRECK>>
           <SETG SANDWICH-STATE ,SW-WAITING>
           <TELL CR "Sandwich looks up from his sandwich. \"Morning, chief. Here's
how it works down here. Whatever you reach for, chief, I'll have reached for it
first. Nothing personal. It's latency.\"" CR>)
          ;"At the intake, once: he asks after Lucan."
          (<AND <==? ,SANDWICH-STATE ,SW-INTAKE> <==? ,HERE ,INTAKE-SCREEN>
                <NOT ,SANDWICH-ASKED>>
           <SETG SANDWICH-ASKED T>
           <TELL CR "\"Where's your tenor?\" Sandwich asks, and then looks at your
face. A beat. \"Oh.\"" CR>)
          ;"The Race, drift 2: he goes past you, into the white water."
          (<AND <==? ,SANDWICH-STATE ,SW-RACING> <==? ,PASSAGE 5> <==? ,DRIFT 2>>
           <SETG SANDWICH-STATE ,SW-GONE>
           <TELL CR "Sandwich goes past you like a thrown knife, both oars up,
shouting \"FIRST ACROSS!\", and into the white water ahead. A moment later his
scull breaks up on the rocks." CR>)>>

;"------------------------------------------------------------------------------
  MRS. THRUMBLE, Clerk of Lost Property
 ------------------------------------------------------------------------------
  LESSON: a stationary service NPC. She is only in play while you are at the
  pier and have rung: RING BELL moves her in, leaving the pier removes her
  (the Stone Pier's M-BEG). She has no tick routine at all -- she never acts
  on her own -- and she never looks up.
 ------------------------------------------------------------------------------"

<OBJECT THRUMBLE
    (DESC "Mrs. Thrumble")
    (SYNONYM THRUMBLE CLERK WOMAN)
    (ADJECTIVE MRS)
    (FLAGS PERSONBIT FEMALEBIT NARTICLEBIT)
    (LDESC "Behind the bars of the hatch, Mrs. Thrumble is writing in a ledger.
She does not look up.")
    (TEXT "A small grey woman in a cardigan, behind bars, writing in a ledger. She
does not look up.")
    (GREETING "\"Lost property, dear. Downstream counter.\" She doesn't look
up.")
    (ACTION THRUMBLE-F)>

<ROUTINE THRUMBLE-F ("OPT" ARG)
    <COND (.ARG <TELL "Mrs. Thrumble has better things to do." CR>)
          (<KEEP-PIKE?> <RTRUE>)
          (<AND <VERB? GIVE SHOW> <PRSI? ,THRUMBLE>>
           <TELL "\"Is it lost? Then it isn't mine to take, dear.\"" CR>)
          (<NOT <PRSO? ,THRUMBLE>> <RFALSE>)
          (<VERB? ASK-ABOUT TELL-ABOUT> <THRUMBLE-TOPIC>)
          (<VERB? ATTACK KISS>
           <TELL "There are bars in the way, and she is busy." CR>)>>

;"Her topic table: the same pattern as Lucan's."
<ROUTINE THRUMBLE-TOPIC ()
    <COND (<ABOUT? ,W?ASCENDANCY ,W?MINGUS ,W?EMPIRE>
           <TELL "\"I'm sorry, I don't know what you're referring to.\"" CR>)
          (<ABOUT? ,W?MOUNTAIN ,W?ABOVE ,W?SKY>
           <TELL "\"I wouldn't know, dear. I don't look up.\"" CR>)
          (<ABOUT? ,W?SHIP ,W?FUNERAL>
           <TELL "\"Another one. They do keep coming.\"" CR>)
          (<ABOUT? ,W?LUCAN ,W?TENOR>
           <COND (<==? ,LUCAN-STATE ,DEAD> <THRUMBLE-TOWEL-LINE>)
                 (ELSE <TELL "\"I don't know the gentleman.\"" CR>)>)
          (<ABOUT? ,W?SANDWICH ,W?BOARDS>
           <TELL "\"A gentleman in boards? He's never once rung. He shouts.\"" CR>)
          (<ABOUT? ,W?EXPLORERS ,W?LOST ,W?PEOPLE>
           <TELL "\"People do turn up from time to time, soaked and blue with cold.
We give them a towel and a cup of tea, and they generally decide to stay.\""
CR>)
          (<ABOUT? ,W?RIVER ,W?VERDANCE>
           <TELL "\"It goes on, dear. They do.\"" CR>)
          (ELSE <TELL "\"Is that all? I've a queue.\"" CR>)>>

<ROUTINE THRUMBLE-TOWEL-LINE ()
    <TELL "\"We had a gentleman come down the old drainage shaft just now. I'm
afraid he was past a towel, dear.\"" CR>>

;"RING BELL. The first ring after Lucan's death hands over his songbook."
<ROUTINE THRUMBLE-RING ()
    <COND (<IN? ,THRUMBLE ,STONE-PIER>
           <TELL "\"She's already here, dear.\" She doesn't look up." CR>
           <RTRUE>)>
    <MOVE ,THRUMBLE ,STONE-PIER>
    <TELL "Footsteps on a ladder, somewhere below. The shutter behind the bars
slides up, and a small grey woman in a cardigan opens a ledger. She does not
look up. \"Lost property. Downstream counter.\"" CR>
    <COND (<AND <==? ,LUCAN-STATE ,DEAD> <NOT ,SONGBOOK-GIVEN>>
           <SETG SONGBOOK-GIVEN T>
           <MOVE ,SONGBOOK ,WINNER>
           <TELL CR "Then she pushes a small battered book through the bars. \"We
had a gentleman come down the old drainage shaft just now. I'm afraid he was
past a towel, dear. He'd want somebody to have it, I expect. Sign here.\" You
sign. It is Lucan's songbook." CR>)>
    <RTRUE>>

;"N3: his songbook, off-stage until she hands it over."
<OBJECT SONGBOOK
    (DESC "Lucan's songbook")
    (SYNONYM SONGBOOK BOOK)
    (ADJECTIVE BATTERED)
    (FLAGS TAKEBIT NAMEBIT NARTICLEBIT)
    (READING "L. Fairweather")
    (TEXT "A small battered songbook. Inside the cover: L. FAIRWEATHER --
THURSDAYS. On the first page, in his hand: \"Where the green bank goes down to
the water, there's a door that was never a door.\"")>


;"============================================================================
  12. THE DISPATCHER  --  the one end-of-turn interrupt
 ----------------------------------------------------------------------------
  I-WORLD is the only interrupt in the game (GO QUEUEs it with -1, 'every
  turn'), and nothing else prints at the end of a turn. zillib's main loop
  runs the room's M-END and then the CLOCKER after every command that
  passes time; the CLOCKER runs I-WORLD. Each run: first the river, then
  Lucan, then Sandwich, then it remembers where you are (LAST-LOC, which
  Lucan's leading rules read on the next turn).

  What passes time: every command except zillib's 'game verbs' (SCORE,
  SAVE, UNDO, VERBOSE...) and commands the parser rejects. LOOK, EXAMINE,
  WAIT, ASK, refused actions -- and, in this game, INVENTORY (section 14)
  -- all pass a turn, exactly as in the Inform version. WAIT is a game verb
  in zillib, but its V-WAIT runs the CLOCKER itself, once (STANDARD-WAIT is
  1, set in GO).

  If the river ends the game (the broken end, the wreck), JIGS-UP never
  returns, so Lucan and Sandwich don't get a turn -- the same as Inform,
  where the daemon stops once deadflag is set. The routine returns false:
  an interrupt that returns true tells V-WAIT 'something happened, stop
  waiting', which with one-turn waits makes no difference either way."
<ROUTINE I-WORLD ()
    <RIVER-TICK>
    <LUCAN-TICK>
    <SANDWICH-TICK>
    <SETG LAST-LOC ,HERE>
    <RFALSE>>

;"The passages' lines, by passage and drift. Drift 3 is the landing (or the
  window); RIVER-TICK decides what happens after it. PASSAGE * 10 + DRIFT
  makes one number per line: 23 is passage 2, drift 3."
<ROUTINE PASSAGE-LINE ("AUX" (K <+ <* ,PASSAGE 10> ,DRIFT>))
    <COND (<==? .K 11> <TELL "The current turns the ship's high prow downstream
and takes it, quick and quiet.">)
          (<==? .K 12> <TELL "The Mingus bank slides by, and the verdlings on it,
still bowed.">)
          (<==? .K 13> <TELL "The ship runs up onto a long pale sandbar and stops:
the way, by the look of it, they all do.">)
          (<==? .K 21> <TELL "The ship swings out into the main stream. Ahead, the
old-side bank begins to lean closer.">)
          (<==? .K 22> <TELL "The old-side bank is near now: green, quiet, low.
Something like a pier shows ahead.">)
          (<==? .K 23> <TELL "The old-side bank is alongside: a stone pier, an iron
ring. If you are going to steer for it, steer east now.">)
          (<==? .K 31> <TELL "The current picks up. Far ahead, the gilded span
reaches out over the river from the Mingus bank, and stops. A chain hangs from
its broken end.">)
          (<==? .K 32> <TELL "The broken end of the span is close now, and the chain
hangs from it into the current, swinging.">)
          (<==? .K 33> <TELL "The broken end is overhead, and the chain hangs from
it, dead ahead and coming fast. Throw now or not at all.">)
          (<==? .K 41> <TELL "The ship swings away under the broken end and runs on
downstream, toward the Mingus bank.">)
          (<==? .K 42> <TELL "A great gilded grating rises out of the water ahead, on
the Mingus bank, and the river is bending toward it.">)
          (<==? .K 43> <TELL "The intake pulls the ship sideways, gently, then not
gently, against the grating. PUMPING STATION No. 2 -- INTAKE, says the gilt above
you. The ship is pinned.">)
          (<==? .K 51> <TELL "The ship comes off the screen, and the Verdance takes
it, faster than before. White water ahead. Every song about this stretch ends the
same way: hold on to something that floats -- and it had better be on you.">)
          (<==? .K 52>
           <TELL "The river steepens. Rocks show white on both sides.">
           <COND (<NOT <FSET? ,LIFEBELT ,WORNBIT>>
                  <TELL " If you are going to put that lifebelt on, now would be
the time.">)>)
          (<==? .K 53> <TELL "The river narrows to a throat of white water, and the
old-side bank comes at you sideways, all rock. The high prow goes first. Then
everything does.">)>>

;"RIVER-TICK: the current. Exact rules (the spec's, in code order):
   1. Pinned at the intake, pump stopped, you aboard: the ship comes off the
      screen (passage 5's cast-off) -- and step 3 runs on the same turn.
   2. A window that was open last turn (drift 3 on passage 2 or 3) and you
      didn't act: the eddy brings you round (2) or the broken end kills (3).
      A successful STEER or THROW moves the ship inside the action, so by
      now SHIP-AT is no longer ADRIFT and none of this happens.
   3. Adrift: drift + 1, print that drift's line and the counter. Drift 3
      on passages 1, 4 and 5 lands automatically."
<ROUTINE RIVER-TICK ()
    <COND (<AND <==? ,SHIP-AT ,INTAKE> ,PUMP-STOPPED <FSET? ,HERE ,SHIPBIT>>
           <CAST-OFF 5>)>
    <COND (<N==? ,SHIP-AT ,ADRIFT> <RFALSE>)>
    <COND (<==? ,DRIFT 3>
           <COND (<==? ,PASSAGE 2>
                  <SETG DRIFT 1>
                  <TELL CR "The pier slides past. Behind the point the river turns
back on itself, and the eddy brings you round for another try." CR>
                  <PRINT-CURRENT>
                  <RFALSE>)
                 (<==? ,PASSAGE 3>
                  <CRLF>
                  <JIGS-UP "The current takes the ship under the broken end, where
everything that ever fell off the Gilded Span is waiting just under the surface.
The hull opens like a letter.">)>)>
    <SETG DRIFT <+ ,DRIFT 1>>
    <CRLF>
    <PASSAGE-LINE>
    <CRLF>
    <PRINT-CURRENT>
    <COND (<L? ,DRIFT 3> <RFALSE>)
          (<==? ,PASSAGE 1> <SHIP-TO ,SANDBAR>)
          (<==? ,PASSAGE 4> <SHIP-TO ,INTAKE>)
          (<==? ,PASSAGE 5> <THE-WRECK>)>
    <RFALSE>>


;"============================================================================
  13. FINALE: THE OLD-SIDE SHORE  (room 20)
 ----------------------------------------------------------------------------
  Reached only by the wreck. Wearing the lifebelt, you are carried ashore
  and the game ends with the win: GOTO describes the shore, MINGUS-WON picks
  the winning banner, and JIGS-UP prints the last lines and ends the game.
  Without the lifebelt, the river. (A worn lifebelt is still IN the player;
  WORNBIT only marks it worn.)
 ============================================================================"

<ROUTINE THE-WRECK ()
    <COND (<NOT <AND <IN? ,LIFEBELT ,WINNER> <FSET? ,LIFEBELT ,WORNBIT>>>
           <CRLF>
           <RIVER-DEATH>)>
    <AWARD-POINTS 8 ,ACH?RACE>
    <CRLF>
    <GOTO ,OLD-SIDE-SHORE>
    <SETG MINGUS-WON T>
    <JIGS-UP "You have gone further down the Verdance than anyone. Nobody has
ever come back. Somebody has to be first.">>

<ROOM OLD-SIDE-SHORE
    (DESC "The Old-Side Shore")
    (IN ROOMS)
    (LDESC "You come up in the shallows with the cork ring under your arms, and
the river lets go of you, the way it has never let go of anyone. You are on the
old-side bank. Behind you, what is left of the funeral ship is breaking up on the
rocks, and the current is taking the pieces south, quick and quiet. The custody
chest has washed up beside you, lid shut, still saying NOTHING HAS EVER BEEN
WITHDRAWN. In the reeds a painted board lies face up: FIRST! Of the man who wore
it there is no sign. Somewhere upstream, a hat with a velvet band is waiting at
the edge of a bright green. Across the water, very small, the lights of the
Ascendancy are flickering, the way they always do. Behind you the bank is green
and warm, and a few low chimney vents give off a steady light that never
flickers. Somewhere up there, a long way upstream, is home.")
    (FLAGS LIGHTBIT)
    (ACTION ROOM-F)>

;"How many names made it into the chest (for the teaser, section 3)."
<ROUTINE NAMES-IN-CHEST ("AUX" (N 0))
    <MAP-CONTENTS (I ,CUSTODY-CHEST)
        <COND (<FSET? .I ,NAMEBIT> <SET N <+ .N 1>>)>>
    .N>


;"============================================================================
  14. GRAMMAR  --  the game's own verbs
  ----------------------------------------------------------------------------
  zillib supplies the standard verbs (in its verbs.zil). A SYNTAX line maps
  a sentence pattern to an action routine (V-...). OBJECT is a noun phrase;
  (FIND flag) tells the parser what to guess when the player leaves the
  object out; TOPIC accepts any words at all. A word that appears in a
  SYNTAX line between the verb and an OBJECT becomes a preposition. Object
  ACTION routines see the action first and can override any of these.

  When two SYNTAX lines match a sentence equally well, the parser prefers
  the one defined LATER -- which is how this section can replace a few of
  zillib's own lines (INVENTORY, READ, SWIM, JUMP, TELL ... ABOUT) without
  touching the library.
 ============================================================================"

;"--- INVENTORY is a turn ------------------------------------------------------
  zillib lists INVENTORY among its 'game verbs' (the GAME-VERB? macro): the
  main loop skips M-END and the CLOCKER for them, so they pass no time.
  Here, as in the Inform version, only true meta commands are free, so I,
  INV, INVENTORY and TAKE INVENTORY map to a game action of our own,
  TURN-INVENTORY, which is NOT on that list. It prints the library's usual
  list, and the main loop then ends the turn as normal."
<SYNTAX INVENTORY = V-TURN-INVENTORY>
<SYNTAX TAKE INVENTORY OBJECT (FIND KLUDGEBIT) = V-TURN-INVENTORY>
<VERB-SYNONYM INVENTORY INV>

<ROUTINE V-TURN-INVENTORY ()
    <V-INVENTORY>>

;"--- READ is EXAMINE -------------------------------------------------------------
  In Inform, READ is EXAMINE for anything. zillib's READ wants READBIT and
  can pick things up first; this line sends READ to EXAMINE instead, so
  every description doubles as the text on the thing."
<SYNTAX READ OBJECT (MANY HELD CARRIED ON-GROUND IN-ROOM) = V-READ-IT>

<ROUTINE V-READ-IT ()
    <PERFORM ,V?EXAMINE ,PRSO>
    <RTRUE>>

;"--- Talking ---------------------------------------------------------------------
  ASK and TELL ... ABOUT take a TOPIC, read back with ABOUT? (section 4).
  zillib's own TELL line wants an object after ABOUT; this one, defined
  later, wins. Both reach the person's ACTION as ASK-ABOUT or TELL-ABOUT."
<SYNTAX ASK OBJECT (FIND PERSONBIT) ABOUT TOPIC = V-ASK-ABOUT>
<VERB-SYNONYM ASK QUESTION QUIZ>
<SYNTAX TELL OBJECT (FIND PERSONBIT) ABOUT TOPIC = V-TELL-ABOUT PRE-TELL>

<ROUTINE V-ASK-ABOUT ()
    <TELL "There is no reply." CR>>

;"HELLO, HI, GREETINGS, GREET LUCAN, SALUTE: one action, HELLO. V-HELLO
  greets the person you named, or the first one present (Lucan, then
  Sandwich, then Mrs. Thrumble), printing that person's GREETING property."
<SYNTAX HELLO = V-HELLO>
<SYNTAX HELLO OBJECT (FIND PERSONBIT) = V-HELLO>
<VERB-SYNONYM HELLO HI GREETINGS>
<SYNTAX GREET OBJECT (FIND PERSONBIT) = V-HELLO>
<VERB-SYNONYM GREET SALUTE>

<ROUTINE V-HELLO ("AUX" P)
    <SET P ,PRSO>
    <COND (<NOT .P>
           <COND (<IN? ,LUCAN ,HERE> <SET P ,LUCAN>)
                 (<IN? ,SANDWICH ,HERE> <SET P ,SANDWICH>)
                 (<IN? ,THRUMBLE ,HERE> <SET P ,THRUMBLE>)>)>
    <COND (<OR <NOT .P> <NOT <GETP .P ,P?GREETING>>>
           <TELL "Nobody answers. The river doesn't." CR>)
          (ELSE <TELL <GETP .P ,P?GREETING> CR>)>
    <RTRUE>>

;"SAY: a TOPIC takes every word after the verb, so SAY HELLO TO LUCAN
  arrives here whole, and V-SAY sorts it out itself:
    SAY HELLO / SAY HI (TO someone)  -> the greeting, V-HELLO;
    SAY <words> TO someone           -> an answer: the person hears it as
                                        if you had ASKed about <words>;
    SAY <words>                      -> the same, to whoever is here.
  To find 'someone', V-SAY looks for TO in the topic and matches the next
  word against the SYNONYM list of each person in the room (PERSON-NAMED).
  Then it narrows the topic to the words before TO and PERFORMs the action,
  exactly as if the player had typed it."
<SYNTAX SAY TOPIC = V-SAY>
<VERB-SYNONYM SAY ANSWER SHOUT SPEAK>

<ROUTINE V-SAY ("AUX" (TO-AT 0) P W)
    <DO (I ,P-TOPIC-START ,P-TOPIC-END)
        <COND (<AND <==? <GETWORD? .I> ,W?TO> <0? .TO-AT>> <SET TO-AT .I>)>>
    <COND (.TO-AT
           <SET P <PERSON-NAMED <GETWORD? <+ .TO-AT 1>>>>
           <COND (<NOT .P>
                  <TELL "Nobody answers. The river doesn't." CR>
                  <RTRUE>)>)>
    <SET W <GETWORD? ,P-TOPIC-START>>
    <COND (<EQUAL? .W ,W?HELLO ,W?HI>
           <COND (.P <PERFORM ,V?HELLO .P>) (ELSE <PERFORM ,V?HELLO>)>
           <RTRUE>)>
    ;"No TO: say it to whoever is here, the way Inform's parser fills in
      '(to Lucan Fairweather)'."
    <COND (.TO-AT <SETG P-TOPIC-END <- .TO-AT 1>>)
          (<IN? ,LUCAN ,HERE> <SET P ,LUCAN>)
          (<IN? ,SANDWICH ,HERE> <SET P ,SANDWICH>)
          (<IN? ,THRUMBLE ,HERE> <SET P ,THRUMBLE>)>
    <COND (<NOT .P>
           <TELL "Nobody answers. The river doesn't." CR>)
          (ELSE
           <COND (<NOT .TO-AT> <TELL "(to " T .P ")" CR>)>
           <PERFORM ,V?ASK-ABOUT .P>)>
    <RTRUE>>

;"THING-NAMED: the object in container C whose SYNONYM list holds word W
  (only people, if PEOPLE? is true), or false. GETPT finds the property's
  table of words and PTSIZE its size in bytes (two per word); zillib's
  IN-WTBL? looks for W in it. PERSON-NAMED asks it about the room."
<ROUTINE THING-NAMED (W C PEOPLE? "AUX" PT (F <>))
    <COND (<NOT .W> <RFALSE>)>
    <MAP-CONTENTS (I .C)
        <COND (<AND <N==? .I ,WINNER>
                    <OR <NOT .PEOPLE?> <FSET? .I ,PERSONBIT>>
                    <SET PT <GETPT .I ,P?SYNONYM>>
                    <IN-WTBL? .PT </ <PTSIZE .PT> 2> .W>>
               ;"RETURN leaves the MAP-CONTENTS loop, not the routine, so
                 the answer goes in F."
               <SET F .I>
               <RETURN>)>>
    .F>

<ROUTINE PERSON-NAMED (W)
    <THING-NAMED .W ,HERE T>>

;"WARN LUCAN (ABOUT THE PATCHES): Lucan's ACTION waves it off."
<SYNTAX WARN OBJECT (FIND PERSONBIT) = V-WARN>
<SYNTAX WARN OBJECT (FIND PERSONBIT) ABOUT TOPIC = V-WARN>
<SYNTAX WARN OBJECT (FIND PERSONBIT) OF TOPIC = V-WARN>
<VERB-SYNONYM WARN CAUTION>

<ROUTINE V-WARN ()
    <TELL "Nobody here is listening for a warning." CR>>

;"SHOW mirrors zillib's GIVE (including SHOW LUCAN THE COAT)."
<SYNTAX SHOW OBJECT (HAVE HELD CARRIED) TO OBJECT (FIND PERSONBIT) = V-SHOW>
<SYNTAX SHOW OBJECT (FIND PERSONBIT) OBJECT (HAVE HELD CARRIED) = V-SSHOW>
<VERB-SYNONYM SHOW DISPLAY>

<ROUTINE V-SHOW ()
    <TELL CT ,PRSI " glances at " T ,PRSO " without interest." CR>>

<ROUTINE V-SSHOW ()
    <PERFORM ,V?SHOW ,PRSI ,PRSO>
    <RTRUE>>

<SYNTAX KISS OBJECT = V-KISS>
<VERB-SYNONYM KISS HUG EMBRACE>

<ROUTINE V-KISS ()
    <TELL "This is not that kind of river." CR>>

;"--- FOLLOW LUCAN / FOLLOW HIM --------------------------------------------------
  A TOPIC slot, because the person you want to follow may have walked out
  of sight, and an OBJECT slot only finds things the parser can see. V-FOLLOW
  reads the word itself: LUCAN, TENOR, FAIRWEATHER (or HIM, once he is in
  play) is Lucan; Sandwich, if he is here, is a joke; anything else in
  the room is 'right here' (and anything you carry has gone nowhere you
  can see); and anything else is nobody to follow."
<SYNTAX FOLLOW TOPIC = V-FOLLOW>
<VERB-SYNONYM FOLLOW CHASE PURSUE>

<ROUTINE V-FOLLOW ("AUX" W)
    <SET W <GETWORD? ,P-TOPIC-START>>
    <COND (<AND <EQUAL? .W ,W?LUCAN ,W?TENOR ,W?FAIRWEATHER ,W?HIM>
                <EQUAL? ,LUCAN-STATE ,FOLLOWING ,GUIDING ,ARRIVED>>
           <FOLLOW-LUCAN>)
          (<AND <==? .W ,W?SANDWICH> <IN? ,SANDWICH ,HERE>>
           <TELL "Nobody follows Sandwich. Everybody arrives after him." CR>)
          (<THING-NAMED .W ,HERE <>> <TELL "It's right here." CR>)
          (<THING-NAMED .W ,WINNER <>> <TELL "You can't see where it went." CR>)
          (ELSE <TELL "You can't see anyone like that to follow." CR>)>>

;"--- The launch: BOW (P1) ------------------------------------------------------"
<SYNTAX BOW = V-BOW>
<SYNTAX BOW OBJECT = V-BOW>
<SYNTAX BOW TO OBJECT = V-BOW>
<SYNTAX BOW BEFORE OBJECT = V-BOW>
<VERB-SYNONYM BOW KNEEL CURTSEY CURTSY>

<ROUTINE V-BOW ()
    <COND (<AND <==? ,HERE ,MAIN-DECK> <==? ,SHIP-AT ,SLUICE>>
           <COND (,LINES-LET-GO
                  <TELL "They have let go already. The lever is yours." CR>)
                 (ELSE
                  <SETG LINES-LET-GO T>
                  <TELL "You bow to the verdlings on the bank. A thousand small
hands let go of the lines at once." CR>)>)
          (<EQUAL? ,HERE ,GANGPLANK-FOOT ,SLUICE-MOUTH>
           <TELL "The verdlings bow back, lower. The drill wants the passenger
aboard." CR>)
          (ELSE <TELL "You bow to nobody in particular. The river does not bow
back." CR>)>>

;"BOARD SHIP is zillib's ENTER already; EMBARK joins it."
<VERB-SYNONYM ENTER EMBARK>

;"--- Steering: STEER EAST, STEER FOR PIER (P5) ---------------------------------
  zillib files compass words specially, so STEER takes a TOPIC and V-STEER
  reads the word straight after the verb from the parser's word buffer
  (P-V-WORDN is the verb's position; GETWORD? returns the dictionary word at
  a position). STEER FOR / TO / TOWARD <words> reads the whole topic, so
  STEER FOR PIER works without a pier object in sight from the stern."
<SYNTAX STEER TOPIC = V-STEER>
<SYNTAX STEER FOR TOPIC = V-STEER-FOR>
<SYNTAX STEER TO TOPIC = V-STEER-FOR>
<SYNTAX STEER TOWARD TOPIC = V-STEER-FOR>
<SYNTAX STEER TOWARDS TOPIC = V-STEER-FOR>
<VERB-SYNONYM STEER HELM>

<ROUTINE V-STEER ()
    <STEER <EQUAL? <GETWORD? <+ ,P-V-WORDN 1>> ,W?EAST ,W?E>>>

<ROUTINE V-STEER-FOR ()
    <STEER <ABOUT? ,W?PIER ,W?BANK ,W?RING ,W?SHORE ,W?EAST ,W?SIDE>>>

<ROUTINE STEER (EAST?)
    <COND (<OR <N==? ,HERE ,STERN> <NOT ,SWEEP-SHIPPED>>
           <TELL "You'd need to be at the stern, with something to steer with."
CR>)
          (<NOT <AND .EAST? <==? ,SHIP-AT ,ADRIFT> <==? ,PASSAGE 2>>>
           <TELL "The river has its own ideas about that." CR>)
          (<L? ,DRIFT 3>
           <TELL "Not yet -- the bank is still too far." CR>)
          (ELSE
           <SHIP-TO ,PIER>
           <AWARD-POINTS 8 ,ACH?CROSSING>
           <TELL "No one crosses the Verdance. You lean on the sweep, and the ship
turns its high prow toward the old side, and crosses. It bumps along a stone
pier, and you make fast to an iron ring. Far behind you, on the Mingus bank, the
verdlings have turned their backs." CR>)>
    <RTRUE>>

;"--- Throwing, hooking, pulling: the grapnel and the pike ------------------------
  zillib only has THROW ... AT and THROW ... TO. THROW GRAPNEL on its own,
  THROW GRAPNEL OVERBOARD and THROW GRAPNEL ASTERN are our THROW-AWAY: a
  throw with no target (Inform's ThrowAt with no second noun). THROW
  GRAPNEL INTO RIVER is zillib's THROW-AT. The grapnel's ACTION catches both,
  and so does KEEP-PIKE? for the pike."
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) = V-THROW-AWAY>
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) OVERBOARD OBJECT (FIND KLUDGEBIT) = V-THROW-AWAY>
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) ASTERN OBJECT (FIND KLUDGEBIT) = V-THROW-AWAY>
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) INTO OBJECT = V-THROW-AT>
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) IN OBJECT = V-THROW-AT>
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) OVER OBJECT = V-THROW-AT>
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) ON OBJECT = V-THROW-AT>
<SYNTAX THROW OBJECT (HAVE HELD CARRIED) AGAINST OBJECT = V-THROW-AT>

<ROUTINE V-THROW-AWAY ()
    <TELL "Futile." CR>>

;"PULL BOX WITH PIKE (P8), HOOK BOX WITH PIKE, GET BOX WITH PIKE, and HOOK
  CHAIN WITH GRAPNEL (P7): one action, PULL-WITH, which the box and the
  chain answer in their own ACTIONs. The second object must be held."
<SYNTAX PULL OBJECT WITH OBJECT (HAVE HELD CARRIED) = V-PULL-WITH>
<SYNTAX GET OBJECT WITH OBJECT (HAVE HELD CARRIED) = V-PULL-WITH>
<SYNTAX HOOK OBJECT WITH OBJECT (HAVE HELD CARRIED) = V-PULL-WITH>
<VERB-SYNONYM HOOK SNAG>

<ROUTINE V-PULL-WITH ()
    <TELL "Nothing comes of it." CR>>

;"TURN on its own, and TURN SWITCH WITH KEY (P9), which is zillib's UNLOCK
  -- as UNLOCK SWITCH WITH KEY already is (zillib only has TURN ON and TURN
  OFF)."
<SYNTAX TURN OBJECT = V-TURN>
<SYNTAX TURN OBJECT WITH OBJECT (HAVE HELD CARRIED) = V-UNLOCK>
<VERB-SYNONYM TURN ROTATE>

<ROUTINE V-TURN ()
    <TELL "Nothing obvious happens." CR>>

;"UNHOOK / FREE / RELEASE GRAPNEL: the Span's cast-off."
<SYNTAX UNHOOK OBJECT = V-UNHOOK>
<VERB-SYNONYM UNHOOK FREE RELEASE>

<ROUTINE V-UNHOOK ()
    <TELL "It isn't hooked on anything." CR>>

;"UNTIE ROPE / UNTIE LINE / UNTIE SHIP / CAST OFF: the Pier's cast-off. CAST
  OFF uses the KLUDGEBIT trick: OFF is a preposition, and a trailing
  preposition needs an object slot after it, which the parser fills with a
  dummy object by itself."
<SYNTAX UNTIE OBJECT = V-UNTIE>
<VERB-SYNONYM UNTIE UNFASTEN UNMOOR UNHITCH>

<ROUTINE V-UNTIE ()
    <TELL "There's nothing there to untie." CR>>

<SYNTAX CAST OFF OBJECT (FIND KLUDGEBIT) = V-CAST-OFF>

<ROUTINE V-CAST-OFF ()
    <COND (<AND <==? ,SHIP-AT ,PIER> <EQUAL? ,HERE ,MAIN-DECK ,STONE-PIER>>
           <PERFORM ,V?UNTIE ,MOORING-ROPE>)
          (ELSE <TELL "There's nothing here to cast off." CR>)>
    <RTRUE>>

;"CLIMB UP / DOWN / OVER something (zillib has CLIMB and CLIMB OBJECT)."
<SYNTAX CLIMB UP OBJECT = V-CLIMB>
<SYNTAX CLIMB DOWN OBJECT = V-CLIMB>
<SYNTAX CLIMB OVER OBJECT = V-CLIMB>

;"--- The river: SWIM, DIVE, JUMP (OVERBOARD), ENTER RIVER, STEP ON PATCH ------
  SWIM and JUMP replace zillib's own lines: in a riverside room they are
  river attempts (section 4), anywhere else the library's usual reply."
<SYNTAX SWIM = V-RIVER-SWIM>
<SYNTAX SWIM IN OBJECT = V-SWIM-IN>
<VERB-SYNONYM SWIM DIVE>
<SYNTAX JUMP = V-RIVER-JUMP>
<SYNTAX JUMP OVERBOARD OBJECT (FIND KLUDGEBIT) = V-RIVER-JUMP>
<SYNTAX JUMP IN OBJECT = V-JUMP-IN>
<SYNTAX JUMP OVER OBJECT = V-JUMP-OVER>

<ROUTINE V-RIVER-SWIM ()
    <COND (<FSET? ,HERE ,RIVERSIDEBIT> <RIVER-ATTEMPT <RIVER-LINE-HERE>>)
          (ELSE <V-SWIM>)>
    <RTRUE>>

<ROUTINE V-SWIM-IN ()
    <V-RIVER-SWIM>>

<ROUTINE V-RIVER-JUMP ()
    <COND (<FSET? ,HERE ,RIVERSIDEBIT> <RIVER-ATTEMPT <RIVER-LINE-HERE>>)
          (ELSE <V-JUMP>)>
    <RTRUE>>

<ROUTINE V-JUMP-IN ()
    <TELL "That would be less than wise." CR>>

<ROUTINE V-JUMP-OVER ()
    <TELL "You would achieve nothing by this." CR>>

;"STEP ON PATCH, STAND ON PATCH, WALK DOWN ROAD, GO ALONG ROAD: all ENTER."
<SYNTAX STEP ON OBJECT = V-ENTER>
<SYNTAX STEP IN OBJECT = V-ENTER>
<SYNTAX STAND ON OBJECT = V-ENTER>
<SYNTAX WALK DOWN OBJECT = V-ENTER>
<SYNTAX WALK ALONG OBJECT = V-ENTER>

;"--- Ringing, driving, digging ---------------------------------------------------"
<SYNTAX RING OBJECT = V-RING>
<VERB-SYNONYM RING BUZZ>

<ROUTINE V-RING ()
    <TELL "Nothing rings." CR>>

<SYNTAX DRIVE = V-DRIVE>
<SYNTAX DRIVE OBJECT = V-DRIVE>

<ROUTINE V-DRIVE ()
    <COND (<==? ,HERE ,DROWNED-ROAD>
           <TELL "You don't. You know exactly where it goes." CR>)
          (ELSE <TELL "There's nothing here to drive." CR>)>>

<SYNTAX DIG OBJECT = V-DIG>

<ROUTINE V-DIG ()
    <TELL "Digging would achieve nothing here." CR>>
