;"============================================================================
  THE ARCHITECT'S LEGACY  --  frotzsmith sample (ZIL, zillib, target z5)
 ----------------------------------------------------------------------------
  A longer game, written to show what a BIG ZIL project looks like once it
  has outgrown a single room and a single puzzle. The small samples each
  teach one idea; this one shows how dozens of ideas sit together in one
  file without turning into soup. Skim it top to bottom: the layout is the
  lesson as much as the code.

  The same game exists in Inform 6 (the Inform 6 sample of the same name).
  Both versions share one walkthrough, so comparing them side by side is a
  good way to learn either language.

  THE STORY
    You are a county building surveyor sent to assess Quillon House, home of
    the late architect Ambrose Quill, before demolition. The house is a
    puzzle box. Beneath it lies an unfinished construction site, and beneath
    that, a prototype vault. At the bottom is the master blueprint.

  HOW THIS FILE IS ORGANISED  (search for the banner text to jump)
    1. SETUP ............ banner, scoring switch, ALL puzzle state, tables
    2. GO ............... the entry point: intro text, first room
    3. LIBRARY .......... INSERT-FILE parser, the score table, game over
    4. SHARED ROUTINES .. what Inform would call classes: one action routine
                          shared by many objects (features, plaques, brass,
                          people), plus chapter banners, topics, puzzles
    5. CHAPTER ONE ...... Surface Secrets       (the house, rooms 1-6)
    6. CHAPTER TWO ...... The Unfinished Dream  (the construction site, 7-13)
    7. CHAPTER THREE .... Legacy of the Deep    (the prototype vault, 14-18)
    8. GRAMMAR .......... the game's own SYNTAX lines and V- routines

  THE MAP  (18 rooms; north is up; [*] = optional, lore only)

    CHAPTER ONE -- the house
                                 Study
                                   |
           Library ------- Entrance Hall ------- Drawing Room
                                   |                   | down, once the brass
                           Overgrown Garden            |   panel is open (P3)
                               (start)           Cellar Stairs
                                                       | down
    CHAPTER TWO -- the construction site           Lift Landing
                                                       | down, the lift (P4)
                         [*]Foreman's Hut              |
                                 |                     |
                             Great Hall ---------- Survey Chamber
                             (Foreman)                 | south
                                                 Spring Gallery
                                                       | east
                                                 Flooded Passage
                                                       | east, once drained (P6)
                                                 Mirror Gallery
                                                       | down, once the crystal
                                                       |   is taken (P7)
    CHAPTER THREE -- the prototype vault
                 Final Chamber
                       | north, once the stones sing (P8)
               Resonance Chamber
                       | north, when the counter shows 13 (P8)
                 Shifting Room
                       | north
               Vault Antechamber ---- east ---- [*]Messenger's Alcove

    (The Great Hall lies EAST of the Survey Chamber; it is drawn to the
    left only to keep the chapter on the page. Every chapter section below
    repeats its own part of the map with the exact exit of every room.)

  THE PUZZLE CHAIN  (each unlocks the next; 5 points apiece = 40)
    P1 Fibonacci dial  plaques 1,1,2,3,5 + library note  -> SET DIAL TO 8
    P2 Torn blueprint  half in a book, half in a bin     -> PUT LEFT HALF ON
                                                            RIGHT HALF
    P3 Brass devices   journal: low, high, between       -> RING BELL, STRIKE
                                                            CHIME, BLOW HORN
    P4 The lift        brass key + blueprint's spiral    -> UNLOCK CAGE, SET
                                                            DIAL TO SPIRAL,
                                                            PULL LEVER
    P5 The Foreman     he knew Quill                     -> SHOW JOURNAL TO
                                                            FOREMAN (a fork)
    P6 The springs     ancient + modern water            -> TURN WHEEL, TURN
                                                            ON PUMP
    P7 The mirror      aim the daylight east             -> TURN MIRROR (x2),
                                                            TAKE CRYSTAL
    P8 Resonance       wait for 13, then sing the stones -> WAIT, PUT CRYSTAL
                                                            ON PEDESTAL,
                                                            STRIKE FORK
    Lore (optional, 2 points each = 10): the calling cards, the survey
    marks, the Inspector's complaint, the Messenger's note, the formula wall.
    Win: READ BLUEPRINT in the Final Chamber.  Maximum score 50.

  TECHNIQUES WORTH STEALING
    - Scoring with zillib's achievements (SCORING-ACHIEVEMENTS and
      AWARD-POINTS), declared in one list so the whole score is visible at
      a glance. FULL SCORE names every achievement.
    - Every puzzle flag is a GLOBAL in section 1: one place to look when you
      ask 'what has the player done so far?'
    - ZIL has no classes, so shared behaviour lives in shared ACTION
      routines. Objects that only need the shared behaviour name it as their
      ACTION; objects with something special say so first and then fall
      back to the shared routine. Custom properties (YARDS, ORDER, NOTE,
      NO-ANSWER, ...) carry the per-object differences.
    - An interrupt (QUEUE / DEQUEUE) drives the Shifting Room, and a room's
      M-END handler gives the Foreman something to do between turns.
    - Conversation: SHOW, GIVE, TELL, and ASK ... ABOUT with a TOPIC slot,
      so any words at all can be asked about.
    - Exits of every kind: plain (NORTH TO ...), conditional (DOWN TO ...
      IF flag ELSE message), refused (SORRY), and routine exits (PER).
    - A GENERIC routine to settle 'which blueprint?' without a question.

  Compiles cleanly with the bundled ZILF; targets z5.
 ============================================================================"


;"============================================================================
  0. HOW THIS GAME IS BUILT  --  read this before the code
 ----------------------------------------------------------------------------
  The design in one paragraph. The world is 18 ROOMs and their OBJECTs;
  zillib (inserted in section 3) supplies the parser, the verbs and the
  turn cycle. The game adds behaviour in three places only: ACTION routines
  on objects (what happens when the player does something TO a thing), room
  routines (what happens IN a room: its changing description, refusals,
  background life), and a handful of new verbs (section 8). Every fact the
  game must remember about progress is a GLOBAL in section 1, or a flag
  zillib already understands (LOCKEDBIT, OPENBIT, ONBIT), or simply where an
  object is (the crystal on the pedestal). Nothing is random, so the same
  commands always produce the same game, which is what lets one walkthrough
  serve as its test.

  THE TURN CYCLE (zillib's MAIN-LOOP, which GO hands over to)
    1. read a command and parse it: PRSA (the action, e.g. SET-TO), PRSO
       (the direct object, e.g. the dial) and PRSI (the indirect object,
       e.g. the NUMBER 8).
    2. PERFORM it: offer the action to these, in order, until one returns
       true --
         the player's ACTION (M-WINNER)       -- zillib's PLAYER-F
         the room's ACTION with M-BEG         -- e.g. GARDEN-F, SHIFTING-ROOM-F
         the verb's PRE- routine              -- zillib's checks
         PRSI's ACTION, then PRSO's ACTION    -- e.g. DRAWER-DIAL-F
         the verb's V- routine                -- zillib's default, or section 8
    3. unless it was a 'game verb' (SAVE, SCORE, WAIT, INVENTORY...), call
       the room's ACTION with M-END (the Great Hall's Foreman) and then
       CLOCKER, which runs the queued interrupts (the Shifting Room).
    4. print '[Your score has gone up ...]' if it did, and go round again.
  So a puzzle is nearly always one ACTION routine that answers one verb on
  one object, changes a global or a flag, and prints what happened.

  THE RETURN-VALUE CONTRACT (the rule everything above depends on)
    An ACTION routine that returns TRUE has handled the command: PERFORM
    stops, and zillib's own verb never runs. Returning FALSE means 'not
    mine': the next handler in the list gets its turn, ending with zillib's
    stock reply. In ZIL a routine returns the value of its last form, a
    COND gives the value of the last form of the clause that ran (false if
    none ran), and TELL counts as true -- so a clause that ends in a TELL
    says 'handled' without an explicit <RTRUE>, and a verb that matches no
    clause falls through to the library. FEATURE-F (section 4) is built on
    exactly that: it answers TAKE, PULL, PUSH and TURN, and lets EXAMINE fall
    through to zillib, which prints the object's TEXT property.

  WHY IT IS LAID OUT LIKE THIS
    - The world reads in play order: chapter by chapter, and within a
      chapter room by room, each room followed by its objects and routines.
      To find the code for a puzzle, find its room.
    - Shared behaviour comes before the chapters (section 4), because ZIL
      has no classes: one routine shared by many objects plays that part,
      and the per-object differences live in custom properties (YARDS,
      ORDER, NOTE, NO-ANSWER, NO-INTEREST, SOUNDS, SETTING...). ZILF creates
      a property the first time an object uses it; GETP reads it.
    - Each puzzle's state is a GLOBAL named for its puzzle number, so
      'what has the player done?' has one answer, in section 1. The table
      below says which routines change each one and which read it.
    - Chapter banners are printed by the first room of each chapter on
      M-ENTER (BEGIN-CHAPTER; chapter one's by GO), and only the first
      time, by comparing with the CHAPTER global.

  THE PUZZLE DEPENDENCIES (what each step needs, and what it opens)
    P1 dial        needs: the five plaque widths 1,1,2,3,5 (one per room of
                   chapter one; the book's margin note gives the rule).
                   SET DIAL TO 8 -> the drawer opens: the JOURNAL (the brass
                   hint for P3, and P5's evidence) and the BRASS KEY (P4).
    P2 blueprint   independent of P1, in either order. READ, EXAMINE or
                   TAKE the slim book drops the left half; SEARCH the
                   wastebasket finds the right half. Holding both, PUT one
                   ON (or IN) the other, or JOIN HALVES -> the BLUEPRINT,
                   which shows the SPIRAL (P4's hint). The blueprint itself
                   is never needed again: it is knowledge, not a key.
    P3 brass       the journal says the order (low, high, between), but the
                   devices do not check that you have read it. Bell, chime,
                   horn -> PANEL-OPEN -> DOWN from the Drawing Room.
    P4 lift        needs P3 (to reach the landing) and P1's brass key.
                   UNLOCK CAGE WITH KEY, SET DIAL TO SPIRAL, PULL LEVER ->
                   LIFT-READY -> DOWN to chapter two. The lever checks only
                   the dial, so the spiral can be guessed; the blueprint,
                   the key's spiral bow and the survey marks all hint at it.
    P5 Foreman     needs P4. SHOW (or GIVE) JOURNAL TO FOREMAN, or ASK
                   FOREMAN ABOUT QUILL (no journal needed) -> the TUNING
                   FORK, for P8.
    P6 springs     needs P4. TURN WHEEL and TURN ON PUMP, either order ->
                   PASSAGE-DRAINED -> EAST from the Flooded Passage.
    P7 mirror      needs P6. TURN MIRROR until it faces east (it starts
                   west: two turns) -> the crystal grows in the socket;
                   TAKE CRYSTAL -> STAIRS-OPEN -> DOWN to chapter three.
    P8 resonance   part one needs P7: NORTH from the antechamber starts the
                   Shifting Room's cycle; WAIT until the counter shows 13,
                   then NORTH. Part two needs the crystal (P7) and the fork
                   (P5): PUT CRYSTAL ON PEDESTAL, STRIKE FORK ->
                   RESONANCE-DONE -> NORTH.
    Win            READ BLUEPRINT in the Final Chamber (the master
                   blueprint) -> JIGS-UP ends the game.
    Mechanically required, in order: P1 (key) and P3 -> P4 -> P5 and P6
    -> P7 -> P8 -> win. P2 is required only for its points.

  THE STATE TABLE (every GLOBAL in section 1; who sets it, who reads it)
    CHAPTER          set by BEGIN-CHAPTER; read by BEGIN-CHAPTER (so each
                     banner prints once)
    HALF-FALLEN      set by RELEASE-HALF; read by RELEASE-HALF, TREATISE-F
    BASKET-SEARCHED  set and read by WASTEBASKET-F
    BRASS-PROGRESS   set and read by BRASS-SOUNDED (0-3; a wrong note
                     resets it to 0)
    PANEL-OPEN       set by BRASS-SOUNDED; read by BRASS-SOUNDED, the
                     Drawing Room's DOWN exit, DRAWING-ROOM-F, FLOOR-PANEL-F
    LIFT-SYMBOL      set by GO (the circle) and LIFT-DIAL-F; read by
                     LIFT-DIAL-F, SYMBOL-F, LIFT-LEVER-F
    LIFT-READY       set by LIFT-LEVER-F; read by LIFT-LEVER-F,
                     LIFT-DOWN-F, LIFT-LANDING-F, LIFT-CAGE-F
    FOREMAN-HELPED   set and read by FOREMAN-CONFIDE (the fork is given
                     once)
    WHEEL-TURNED     set by BRONZE-WHEEL-F; read by BRONZE-WHEEL-F,
                     CHECK-SPRINGS
    PASSAGE-DRAINED  set by CHECK-SPRINGS; read by CHECK-SPRINGS, PUMP-F,
                     SPRING-GALLERY-F, the Flooded Passage's EAST exit,
                     FLOODED-PASSAGE-F, FLOOD-WATER-F
    MIRROR-FACING    set by GREAT-MIRROR-F (0-3); read by GREAT-MIRROR-F,
                     MIRROR-GALLERY-F
    STAIRS-OPEN      set by CRYSTAL-F; read by CRYSTAL-F, GREAT-MIRROR-F,
                     MIRROR-GALLERY-F, the Mirror Gallery's DOWN exit
    SHIFT-STEP       set by ENTER-SHIFTING-ROOM (to 1) and I-SHIFTING-ROOM;
                     read by I-SHIFTING-ROOM, SHIFT-NORTH-F, SHIFTING-ROOM-F,
                     ARCH-DIRECTION, PRINT-COUNTER, MOVING-ARCH-F
    SHIFT-STILLED    set by SHIFT-NORTH-F; read by ENTER-SHIFTING-ROOM,
                     SHIFTING-ROOM-F
    RESONANCE-DONE   set by TUNING-FORK-F; read by TUNING-FORK-F,
                     RESONANCE-CHAMBER-F, the Resonance Chamber's NORTH exit
  State kept in objects instead of globals:
    DESK-DRAWER  LOCKEDBIT / OPENBIT   cleared / set by DRAWER-DIAL-F (P1)
    DRAWER-DIAL  SETTING property      PUTP by DRAWER-DIAL-F, shown by EXAMINE
    LIFT-CAGE    LOCKEDBIT / OPENBIT   cleared / set by LIFT-CAGE-F (P4)
    PUMP         ONBIT                 set / cleared by PUMP-F (P6)
    LEFT-HALF, RIGHT-HALF, BLUEPRINT, TUNING-FORK, CRYSTAL
                 where they are         MOVE / REMOVE in the routines above;
                                        IN? asks
    the achievements                    zillib's own table (see below)

  THE SCORING TABLE (MAX-SCORE 50; each achievement counts once)
    achievement  pts  awarded in            by the command
    DIAL          5   DRAWER-DIAL-F         SET DIAL TO 8
    BLUEPRINT     5   JOIN-HALVES           PUT LEFT HALF ON RIGHT HALF / JOIN
    BRASS         5   BRASS-SOUNDED         BLOW HORN (the third right note)
    LIFT          5   LIFT-LEVER-F          PULL LEVER (dial on the spiral)
    FOREMAN       5   FOREMAN-CONFIDE       SHOW JOURNAL TO FOREMAN / ASK
    SPRINGS       5   CHECK-SPRINGS         the second of WHEEL and PUMP
    MIRROR        5   CRYSTAL-F             TAKE CRYSTAL (the first time)
    RESONANCE     5   TUNING-FORK-F         STRIKE FORK (crystal on pedestal)
    LORE-CARDS    2   CALLING-CARDS-F       EXAMINE or READ CARDS
    LORE-MARKS    2   SURVEY-MARKS-F        EXAMINE or READ MARKS
    LORE-FORMS    2   INSPECTOR-F           ASK INSPECTOR ABOUT IRREGULAR...
    LORE-NOTE     2   CODED-NOTE-F          EXAMINE or READ NOTE
    LORE-WALL     2   FORMULA-WALL-F        EXAMINE or READ FORMULAS
  The puzzles make 40 and the lore 10. The walkthrough skips the lore, so
  it ends on 40 of 50.

  THE WALKTHROUGH, TIED TO THE CODE
    The Solution tab replays app/modules/samples-shared/
    architect-legacy.walkthrough.txt (the same 48 commands drive the Inform
    6 version). Line numbers are that file's; '->' is where you end up.
       1  north                        -> Entrance Hall
       2  west                         -> Library
       3  examine plaque               PLAQUE-F: WIDTH 2 YARDS
       4  read book                    TREATISE-F, RELEASE-HALF: left half falls
       5  take half                    the left half
       6  east  7 north                -> Study
       8  examine plaque               PLAQUE-F: WIDTH 5 YARDS
       9  search wastebasket           WASTEBASKET-F: right half found
      10  take half                    the right half (the left is already held)
      11  put left half on right half  HALF-F -> JOIN-HALVES          P2 +5
      12  set dial to 8                DRAWER-DIAL-F: drawer opens    P1 +5
      13  take journal  14 take key  15 read journal (low, high, between)
      16  south  17 east               -> Drawing Room
      18  ring bell  19 strike chime  20 blow horn
                                       BRASS-F -> BRASS-SOUNDED     P3 +5
      21  down                         -> Cellar Stairs (exit IF PANEL-OPEN)
      22  down                         -> Lift Landing: Chapter Two banner
      23  unlock cage with key         LIFT-CAGE-F
      24  set dial to spiral           LIFT-DIAL-F: LIFT-SYMBOL = spiral
      25  pull lever                   LIFT-LEVER-F: LIFT-READY       P4 +5
      26  down                         LIFT-DOWN-F -> Survey Chamber
      27  east                         -> Great Hall
      28  show journal to foreman      FOREMAN-F -> FOREMAN-CONFIDE  P5 +5
      29  west  30 south               -> Spring Gallery
      31  turn wheel                   BRONZE-WHEEL-F (not enough alone)
      32  turn on pump                 PUMP-F -> CHECK-SPRINGS        P6 +5
      33  east                         -> Flooded Passage
      34  east                         -> Mirror Gallery (IF PASSAGE-DRAINED)
      35  turn mirror                  GREAT-MIRROR-F: west -> north
      36  turn mirror                  north -> east: the crystal grows
      37  take crystal                 CRYSTAL-F: STAIRS-OPEN         P7 +5
      38  down                         -> Vault Antechamber: Chapter Three
      39  north                        ENTER-SHIFTING-ROOM -> Shifting Room
                                       (step 1; the interrupt makes it 2)
      40-43  wait x4                   SHIFTING-ROOM-F + I-SHIFTING-ROOM:
                                       steps 3, 4, 5, 6 -- the counter at 13
      44  north                        SHIFT-NORTH-F -> Resonance Chamber
      45  put crystal on pedestal      PEDESTAL-F
      46  strike fork                  TUNING-FORK-F: RESONANCE-DONE  P8 +5
      47  north                        -> Final Chamber
      48  read blueprint               BLUEPRINT-GENERIC-F picks the master;
                                       MASTER-BLUEPRINT-F -> JIGS-UP: the end
    The golden test (app/modules/zil/sample-walkthroughs.golden.test.ts)
    replays exactly these commands and checks that the last turn shows
    'The work continues', the game-over line from PRINT-GAME-OVER.

  READING ZIL, IF IT IS NEW TO YOU (each also explained where first used)
    <NAME arg ...>  a FORM: a call (of a routine or a built-in) or a
                    definition (ROUTINE, ROOM, OBJECT, GLOBAL...).
    (a b c)         a LIST. In a ROOM or OBJECT, each list is one property,
                    named by its first item; in a COND, each list is one
                    clause.
    ,NAME / .NAME   the value of a global (GLOBAL, CONSTANT, object, room)
                    or of a local (an argument or an AUX variable).
    <>              false (an empty form). T is true.
    ;'...'          a comment: the semicolon removes the next item, here a
                    string. (In these comments single quotes stand in for
                    double quotes, which would end the comment.)
    'text|more'     in a string, | is a line break, and a backslash before a
                    double quote prints the quote. A line break typed in the
                    source prints as a space."


;"============================================================================
  1. SETUP  --  banner, scoring switch, and all puzzle state
 ============================================================================"

;"RELEASEID and GAME-BANNER. CONSTANT gives a fixed name to a value that
  never changes. RELEASEID is the release number: the compiler writes it
  into the story file's header, and zillib's VERSION verb (called from GO)
  prints it under GAME-BANNER as 'Release 1 / Serial number ...'. In
  GAME-BANNER, the | is a line break.

  There is no <VERSION XZIP> form at the top of this file: frotzsmith adds
  the version when it compiles, from the format picked in the toolbar (z5
  for this game). It uses bold text (HLIGHT, in BEGIN-CHAPTER), which z3
  does not have."
<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"The Architect's Legacy|
A frotzsmith sample: a longer game in three chapters.">

;"--- Scoring ----------------------------------------------------------------
  USE-SCORING? switches on zillib's scoring module (SCORE, FULL SCORE, the
  '[Your score has gone up]' notices, and the score at game end). It must be
  set BEFORE the parser is inserted. The achievements themselves are listed
  in section 3, right after the library.

  <SETG USE-SCORING? T> at the top level of the file is not game code: it
  sets a value while the file is being compiled, and zillib's parser.zil
  tests it as it is read in, compiling its scoring file only if it is set.
  T means true. Once scoring is on, MAX-SCORE must be defined, or the
  compile stops with an error; it is also what SCORE prints as 'out of a
  possible 50'."

<SETG USE-SCORING? T>
<CONSTANT MAX-SCORE 50>

;"--- Puzzle state -----------------------------------------------------------
  Everything the game needs to remember about the player's progress lives
  here, named for the puzzle it belongs to. Objects still use flags
  (OPENBIT, LOCKEDBIT, ONBIT) where the library already understands them.

  <GLOBAL NAME initial-value> creates a variable that lasts the whole game
  and is saved and restored with it. Code reads it as ,NAME (comma: global)
  and changes it with <SETG NAME new-value>. <> is false (an empty form), so
  the flags below all start false; T would be true. A ;'string' after a
  form on the same line is a comment like any other. Section 0 lists, for
  every one of these, the routines that change it and the ones that read
  it."

<GLOBAL CHAPTER 0>              ;"which chapter banner has been shown"
<GLOBAL HALF-FALLEN <>>         ;"P2: the left half has dropped out of the book"
<GLOBAL BASKET-SEARCHED <>>     ;"P2: the right half has been found in the bin"
<GLOBAL BRASS-PROGRESS 0>       ;"P3: notes played correctly so far (0-3)"
<GLOBAL PANEL-OPEN <>>          ;"P3: the Drawing Room floor panel"
<GLOBAL LIFT-SYMBOL <>>         ;"P4: the symbol the lift dial points to (set in GO)"
<GLOBAL LIFT-READY <>>          ;"P4: lever pulled with the right symbol"
<GLOBAL FOREMAN-HELPED <>>      ;"P5: the Foreman has given you the fork"
<GLOBAL WHEEL-TURNED <>>        ;"P6: the ancient sluice is open"
<GLOBAL PASSAGE-DRAINED <>>     ;"P6: both waters moving: the passage is dry"
<GLOBAL MIRROR-FACING 3>        ;"P7: 0 north, 1 east, 2 south, 3 west"
<GLOBAL STAIRS-OPEN <>>         ;"P7: crystal taken, stairs down revealed"
<GLOBAL SHIFT-STEP 1>           ;"P8: Shifting Room position, 0-6 (see there)"
<GLOBAL SHIFT-STILLED <>>       ;"P8: once passed, the Shifting Room stands still"
<GLOBAL RESONANCE-DONE <>>      ;"P8: the stones have sung; north is open"

;"Lookup tables. GET counts from 0, so <GET ,FIBONACCI 6> is 13.

  <TABLE a b c ...> builds an array of words in the story file and gives
  back its address; CONSTANT names that address. <GET table n> reads entry
  n, counting from 0 (PUT would change it). A string in a table is stored as
  the address of the text, so <TELL <GET ,COMPASS-NAMES 1>> prints 'east'.
    COMPASS-NAMES   0 north, 1 east, 2 south, 3 west -- the encoding used by
                    MIRROR-FACING (P7) and by ARCH-DIRECTION (P8).
    FIBONACCI       the Shifting Room's counter, entries 0-6 (P8).
    CHAPTER-TITLES  entry 0 is an empty string so that chapter N's title is
                    simply entry N (BEGIN-CHAPTER)."
<CONSTANT COMPASS-NAMES <TABLE "north" "east" "south" "west">>
<CONSTANT FIBONACCI <TABLE 1 1 2 3 5 8 13>>
<CONSTANT CHAPTER-TITLES
    <TABLE "" "One: Surface Secrets" "Two: The Unfinished Dream"
           "Three: Legacy of the Deep">>


;"============================================================================
  2. GO  --  the entry point
  ----------------------------------------------------------------------------
  GO may not have local variables; it sets up the world and hands over to
  MAIN-LOOP, which never returns.

  GO is the routine the Z-machine starts in. <ROUTINE GO () ...> defines
  it: ROUTINE, the name, the argument list (empty: in z3-z5 the start
  routine is jumped into, not called, so it can have no arguments or locals)
  and then the body, run top to bottom. Line by line:
    <SETG MODE ,VERBOSE>     zillib's description mode. VERBOSE prints a
                             room's full description on every visit (the
                             default, BRIEF, only on the first).
    <SETG STANDARD-WAIT 1>   how many turns zillib's WAIT lets pass. The
                             Shifting Room answers WAIT itself, but
                             everywhere else Z is now exactly one turn.
    <SETG LIFT-SYMBOL ,CIRCLE-SYMBOL>
                             the lift dial's starting position (P4). An
                             object's name (,CIRCLE-SYMBOL) is a value like
                             any other and can be stored in a global.
    <CRLF> <TELL ... CR CR>  the opening text. TELL prints a run of items;
                             CR is a line break. In the string, a backslash
                             before a double quote prints the quote, and |
                             is a line break (|| a blank line).
    <INIT-STATUS-LINE>       on z5, zillib splits off the top line of the
                             screen for the room name, score and turns.
    <V-VERSION>              zillib's VERSION verb: GAME-BANNER, release.
    <SETG HERE ,GARDEN> <MOVE ,PLAYER ,HERE>
                             put the player in the first room. HERE is
                             zillib's current room; the PLAYER object must
                             also really be IN it, since what the player can
                             see and touch is worked out from that.
    <BEGIN-CHAPTER 1>        the first chapter banner. The other chapters'
                             banners come from their first room's M-ENTER,
                             but nobody 'enters' the garden at the start,
                             so GO prints this one itself.
    <V-LOOK>                 describe the garden.
    <MAIN-LOOP>              zillib's turn cycle (section 0), forever.
 ============================================================================"

<ROUTINE GO ()
    <SETG MODE ,VERBOSE>          ;"full room descriptions on every visit"
    <SETG STANDARD-WAIT 1>        ;"WAIT is one turn (zillib's default is 4)"
    <SETG LIFT-SYMBOL ,CIRCLE-SYMBOL>
    <CRLF> <CRLF>
    <TELL "The county's letter is in your breast pocket, folded into exact
thirds. Quillon House, former residence of the late Ambrose Quill, architect,
is to be surveyed for structural soundness prior to demolition. \"Report any
irregularities.\"|
|
Everyone at the planning office laughed at that last word. Quill's building
was famous for nothing else." CR CR>
    <INIT-STATUS-LINE>
    <V-VERSION>
    <SETG HERE ,GARDEN>
    <MOVE ,PLAYER ,HERE>
    <BEGIN-CHAPTER 1>
    <V-LOOK>
    <MAIN-LOOP>>


;"============================================================================
  3. LIBRARY  --  zillib, the score table, and the game-over line
 ============================================================================"

;"PRINT-GAME-OVER is a library routine we replace below; DELAY-DEFINITION
  tells the library not to define its own copy.

  zillib wraps the pieces a game may replace in DEFAULT-DEFINITION. A game
  can supply its own with REPLACE-DEFINITION -- before the INSERT-FILE, or,
  as here, after it once DELAY-DEFINITION has reserved the slot. (A
  replacement that arrives after zillib has already used its default is a
  compile error.) Keeping the replacement just below the score table puts
  everything about how the game ends in one place."
<DELAY-DEFINITION PRINT-GAME-OVER>

;"INSERT-FILE reads zillib's parser.zil, which reads the rest of the
  library: the parser, the standard verbs (verbs.zil), the event queue
  (events.zil), the PLAYER and ROOMS objects, and -- because USE-SCORING? is
  set -- the scoring module. Everything after this line can use what the
  library defines: its flags (LIGHTBIT, TAKEBIT...), its globals (HERE,
  PRSO, WINNER, MOVES...), its routines (TRY-TAKE, DO-WALK, JIGS-UP...)."
<INSERT-FILE "parser">

;"--- The score table ---------------------------------------------------------
  One line per achievement. AWARD-POINTS n ,ACH?NAME grants it exactly once
  (the library remembers), and FULL SCORE prints these descriptions.
                     P1-P8: 5 points each  |  lore: 2 points each

  SCORING-ACHIEVEMENTS runs while compiling: each (NAME 'description') line
  creates a constant ACH?NAME for AWARD-POINTS, and a row in a table where
  zillib records that the achievement has been granted -- which is why
  reading the calling cards ten times scores 2, not 20. The descriptions are
  what FULL SCORE prints under 'Your score includes:'. Section 0 lists where
  each one is awarded."
<SCORING-ACHIEVEMENTS
    (DIAL "opening Quill's desk")
    (BLUEPRINT "mending the blueprint")
    (BRASS "playing the brass chord")
    (LIFT "waking the lift")
    (FOREMAN "earning the Foreman's trust")
    (SPRINGS "turning the springs")
    (MIRROR "growing the crystal")
    (RESONANCE "singing the stones awake")
    (LORE-CARDS "reading the calling cards")
    (LORE-MARKS "decoding the survey marks")
    (LORE-FORMS "hearing the Inspector out")
    (LORE-NOTE "reading the Messenger's note")
    (LORE-WALL "checking Quill's arithmetic")>

;"JIGS-UP (called by the master blueprint) prints its message, then this,
  then the final score.

  REPLACE-DEFINITION's first argument names the slot that DELAY-DEFINITION
  reserved; the rest is ordinary code, put where zillib's own definition
  would have been. The four leading spaces are part of the printed line."
<REPLACE-DEFINITION PRINT-GAME-OVER
    <ROUTINE PRINT-GAME-OVER ()
        <TELL "    *** The work continues ***" CR CR>>>

;"Words that only ever appear in ASK ... ABOUT topics. Topic words still have
  to be in the dictionary for the code below to name them as ,W?WORD.

  <VOC 'WORD' NOUN> adds a word to the story's dictionary without giving it
  to any object. Every word in an object's SYNONYM or ADJECTIVE list (and
  every verb and preposition in a SYNTAX line) is already in the
  dictionary; these are the extra words ABOUT? (section 4) is asked to look
  for. ,W?ARCHITECT is the dictionary entry for ARCHITECT, the same value the
  parser stores for the word when the player types it."
<VOC "ARCHITECT" NOUN>
<VOC "AMBROSE" NOUN>
<VOC "APPRENTICE" NOUN>
<VOC "STEAM" NOUN>
<VOC "SPRINGS" NOUN>
<VOC "SPRING" NOUN>
<VOC "SUN" NOUN>
<VOC "SHIFTING" NOUN>
<VOC "COUNTER" NOUN>
<VOC "WOMAN" NOUN>
<VOC "LANTERNLESS" NOUN>
<VOC "WORK" NOUN>
<VOC "SITE" NOUN>
<VOC "ACOUSTICS" NOUN>
<VOC "IRREGULAR" NOUN>
<VOC "BUILDING" NOUN>
<VOC "PRACTICES" NOUN>
<VOC "PRACTICE" NOUN>
<VOC "COUNTY" NOUN>
<VOC "DEMOLITION" NOUN>
<VOC "SURVEY" NOUN>
<VOC "PASSAGE" NOUN>
<VOC "ROOM" NOUN>
<VOC "HALL" NOUN>


;"============================================================================
  4. SHARED ROUTINES  --  write shared behaviour once
  ----------------------------------------------------------------------------
  An object's ACTION routine is called with PRSO (and PRSI) already set, so
  one routine can serve many objects: it asks 'which object is this?' with
  ,PRSO and reads the differences from the object's own properties.

  The globals every routine below leans on, all set by zillib's parser
  before an ACTION routine is called:
    PRSA    the action, tested with <VERB? NAME ...>.
    PRSO    the direct object (the dial in SET DIAL TO 8), tested with
            <PRSO? ,OBJECT>.
    PRSI    the indirect object (the 8), tested with <PRSI? ,OBJECT>.
    WINNER  who is acting: normally the PLAYER, but the Foreman while the
            player is giving him an order (FOREMAN, DANCE).
    HERE    the room the player is in.
  And the TELL items used throughout: a string prints as it is; CR is a line
  break; D obj prints the object's DESC; T obj prints 'the' + DESC; A obj
  prints 'a' or 'an' + DESC; CT obj is T with a capital (The brass bell);
  N number prints a number. Any other value, such as <GETP ,PRSO ,P?NOTE>,
  is printed as a string.
 ============================================================================"

;"FEATURE-F: things named in a room description that you can examine but
  should neither carry off nor wrench about. Give an object (ACTION
  FEATURE-F) and NDESCBIT and it behaves like Inform's scenery.

  How it works: <VERB? TAKE PULL PUSH TURN> is true for any of the four. For
  those it prints, for example, 'The flower beds are part of the property,
  and the property is the county's until it is demolished.' -- CT ,PRSO
  gives 'The flower beds', and PLURALBIT (set on things named in the
  plural) picks 'are' over 'is'. For any other verb the COND finds no
  clause, the routine returns false, and zillib carries on: EXAMINE prints
  the object's TEXT property, which is why the scenery objects below have a
  TEXT and no EXAMINE code of their own. Other routines end with
  (ELSE <FEATURE-F>) to fall back on it."
<ROUTINE FEATURE-F ()
    <COND (<VERB? TAKE PULL PUSH TURN>
           <TELL CT ,PRSO>
           <COND (<FSET? ,PRSO ,PLURALBIT> <TELL " are">)
                 (ELSE <TELL " is">)>
           <TELL " part of the property, and the property is the county's
until it is demolished." CR>)>>

;"PLAQUE-F: Quill screwed a plaque into every room of the house (and one
  flower bed). The five plaques differ only in their YARDS property (and the
  garden's PLAQUE-WHAT), so one routine describes them all.

  The argument list ('AUX' (Y ...) (W ...)) -- in the code AUX is in double
  quotes, as all such keywords are -- declares two local variables. Everything
  after AUX is a local that the caller does not pass; (Y <GETP ...>) gives
  Y a starting value, computed each time the routine is called. Read them
  as .Y and .W (dot: local).
  <GETP ,PRSO ,P?YARDS> reads the YARDS property of whichever plaque this
  is (P?YARDS is the property's number). YARDS and PLAQUE-WHAT are this
  game's own properties: ZILF creates a property the first time an object
  lists it. An object without the property gives 0 (false), so for the
  four house plaques .W is false and the routine prints ROOM instead.
  <1? .Y> asks 'is Y exactly 1?' (YARD or YARDS)."
<ROUTINE PLAQUE-F ("AUX" (Y <GETP ,PRSO ,P?YARDS>) (W <GETP ,PRSO ,P?PLAQUE-WHAT>))
    <COND (<VERB? EXAMINE READ>
           <TELL "A small brass plaque, set perfectly level. It is engraved: ">
           <COND (.W <TELL .W>) (ELSE <TELL "ROOM">)>
           <TELL " WIDTH " N .Y>
           <COND (<1? .Y> <TELL " YARD">) (ELSE <TELL " YARDS">)>
           <TELL ". Quill evidently wanted every visitor to know." CR>)
          (ELSE <FEATURE-F>)>>

;"BRASS-F: the bell, the chime and the horn in the Drawing Room. Ringing,
  striking, blowing or hitting any of them goes to BRASS-SOUNDED, which
  keeps the puzzle logic in a single place. ORDER is the device's position
  in the correct sequence; NOTE describes its voice.

  SOUND is this game's own action (section 8): RING, STRIKE, BLOW, PLAY,
  TAP... all become SOUND. ATTACK (HIT), PUSH and RUB are zillib's. The
  routine passes the device on as an argument -- <BRASS-SOUNDED ,PRSO> --
  so BRASS-SOUNDED never has to know which verb was typed."
<ROUTINE BRASS-F ()
    <COND (<VERB? SOUND ATTACK PUSH RUB>
           <BRASS-SOUNDED ,PRSO>)
          (<VERB? TAKE PULL TURN>
           <TELL CT ,PRSO " is bolted to the mahogany board." CR>)>>

;"PERSON-F: the in-character fallbacks for all three characters (the
  Foreman, the Inspector and the Messenger). Each person's
  own ACTION handles the topics it cares about and calls PERSON-F for
  everything else. NO-ANSWER and NO-INTEREST are per-person properties.
  ARG is M-WINNER when the player gives an order (FOREMAN, DANCE).

  ('OPT' ARG) -- OPT in double quotes, in the code -- makes ARG an
  optional argument: zillib calls an object's ACTION with no argument for
  an ordinary command, and with M-WINNER when that object is the one being
  ordered about; an argument that is left out reads as false. Because
  WINNER is the person in an order, CT ,WINNER names them.
  For ASK and TELL ... ABOUT the person is PRSO; for SHOW and GIVE the
  person is PRSI (SHOW JOURNAL TO FOREMAN), hence the PERSONBIT test on
  PRSI. <TELL <GETP ,PRSO ,P?NO-ANSWER> CR> prints whatever string the
  person's NO-ANSWER property holds. The Messenger has no routine of their
  own at all: (ACTION PERSON-F) is the whole of it."
<ROUTINE PERSON-F ("OPT" ARG)
    <COND (<==? .ARG ,M-WINNER>
           <TELL CT ,WINNER " gives you the look that professionals reserve for
other professionals' bright ideas." CR>)
          (<VERB? ASK-ABOUT TELL-ABOUT>
           <TELL <GETP ,PRSO ,P?NO-ANSWER> CR>)
          (<AND <VERB? SHOW GIVE> <FSET? ,PRSI ,PERSONBIT>>
           <TELL <GETP ,PRSI ,P?NO-INTEREST> CR>)
          (<VERB? KISS>
           <TELL "This is a building survey." CR>)
          (<VERB? ATTACK>
           <TELL "Violence would only add to the paperwork." CR>)>>

;"BEGIN-CHAPTER: print a chapter banner the first time the player crosses
  into chapter N. Called from each chapter's first room on M-ENTER, which
  zillib sends as the player arrives, just before the room is described.

  (N) is a required argument, read as .N. <L=? .N ,CHAPTER> is 'N is less
  than or equal to CHAPTER': this chapter's banner (or a later one) has
  been shown already, so <RFALSE> leaves at once -- riding the lift back
  up to the Lift Landing never reprints chapter two. <HLIGHT ,H-BOLD>
  switches to bold text and H-NORMAL back (z4 and later). The title comes
  from the CHAPTER-TITLES table in section 1."
<ROUTINE BEGIN-CHAPTER (N)
    <COND (<L=? .N ,CHAPTER> <RFALSE>)>
    <SETG CHAPTER .N>
    <CRLF>
    <HLIGHT ,H-BOLD>
    <TELL "       Chapter " <GET ,CHAPTER-TITLES .N>>
    <HLIGHT ,H-NORMAL>
    <CRLF> <CRLF>>

;"ABOUT?: true if any of the given words appears anywhere in the topic of
  the current ASK ... ABOUT. The parser leaves the topic's word numbers in
  P-TOPIC-START and P-TOPIC-END, so ASK FOREMAN ABOUT THE OLD ARCHITECT
  matches ,W?ARCHITECT. Unknown words read as 0, hence the .W check.

  The argument list: W1 is required, W2-W6 are optional (after OPT), and W
  is a plain local (after AUX). Callers pass between one and six words;
  the ones left out are false. <DO (I first last) body> is a counting loop:
  I runs from P-TOPIC-START to P-TOPIC-END inclusive. <GETWORD? .I> is
  zillib's 'the dictionary word the player typed at position I'.
  <EQUAL? .W .W1 .W2 .W3> is true if W equals any of the others; the six
  candidates are tested in two groups of three. <RTRUE>
  inside the loop returns from the whole routine at once; reaching the end
  of the loop means no word matched, so <RFALSE>."
<ROUTINE ABOUT? (W1 "OPT" W2 W3 W4 W5 W6 "AUX" W)
    <DO (I ,P-TOPIC-START ,P-TOPIC-END)
        <SET W <GETWORD? .I>>
        <COND (<AND .W <EQUAL? .W .W1 .W2 .W3>> <RTRUE>)
              (<AND .W <EQUAL? .W .W4 .W5 .W6>> <RTRUE>)>>
    <RFALSE>>

;"P2: lay the two halves of the blueprint together. Reached from PUT ... ON
  and PUT ... IN (one half with the other) and from the JOIN verb.

  <IN? obj container> asks whether obj is directly inside container; IN?
  ,LEFT-HALF ,WINNER is 'is the left half in the player's hands?'. The
  first clause catches the puzzle already solved, the second says which
  half is missing, and only the ELSE does the work: <REMOVE obj> takes an
  object out of play (it is now nowhere), MOVE gives the player the whole
  BLUEPRINT (which, until now, was nowhere: it has no IN property), and
  AWARD-POINTS scores P2 once. Because the halves are removed, nothing can
  ever be joined twice."
<ROUTINE JOIN-HALVES ()
    <COND (<IN? ,BLUEPRINT ,WINNER>
           <TELL "You've already mended the blueprint." CR>)
          (<OR <NOT <IN? ,LEFT-HALF ,WINNER>> <NOT <IN? ,RIGHT-HALF ,WINNER>>>
           <COND (<OR <IN? ,LEFT-HALF ,WINNER> <IN? ,RIGHT-HALF ,WINNER>>
                  <TELL "You have only one half of the blueprint in hand." CR>)
                 (ELSE
                  <TELL "You'd need both halves of the blueprint for that." CR>)>)
          (ELSE
           <REMOVE ,LEFT-HALF>
           <REMOVE ,RIGHT-HALF>
           <MOVE ,BLUEPRINT ,WINNER>
           <AWARD-POINTS 5 ,ACH?BLUEPRINT>
           <TELL "You lay the two halves edge to edge. The tear matches exactly
-- of course it does -- and the drawing runs straight across the join as if it
had never been parted. You are holding a blueprint of Quillon House, and of
what lies beneath it." CR>)>>

;"P3: one of the brass devices has sounded. The correct order is
  bell (ORDER 0, low), chime (ORDER 1, high), horn (ORDER 2, between).

  BRASS-PROGRESS counts the right notes played so far. The trick: the device
  that should sound next is the one whose ORDER equals BRASS-PROGRESS, so
  <==? <GETP .DEV ,P?ORDER> ,BRASS-PROGRESS> is the whole rule. The clauses,
  in order:
    PANEL-OPEN          solved already: the note plays, nothing happens.
    the right device    count it; the third right note opens the panel and
                        scores P3.
    <0? ,BRASS-PROGRESS> a wrong first note: nothing to undo.
    ELSE                a wrong note mid-chord: back to 0.
  .DEV is the argument (the device); CT .DEV prints 'The brass bell'."
<ROUTINE BRASS-SOUNDED (DEV)
    <COND (,PANEL-OPEN
           <TELL CT .DEV " gives " <GETP .DEV ,P?NOTE>
                 ". The open panel does not care." CR>)
          (<==? <GETP .DEV ,P?ORDER> ,BRASS-PROGRESS>
           <SETG BRASS-PROGRESS <+ ,BRASS-PROGRESS 1>>
           <COND (<==? ,BRASS-PROGRESS 1>
                  <TELL "BONG. A deep, low note rolls out of the bell and into
the floor, where something mechanical seems to catch it and hold it." CR>)
                 (<==? ,BRASS-PROGRESS 2>
                  <TELL "A high, glassy note shivers out of the chime. Beneath
the floor a second mechanism takes it up, and the bell's note is still humming
underneath." CR>)
                 (ELSE
                  <SETG PANEL-OPEN T>
                  <AWARD-POINTS 5 ,ACH?BRASS>
                  <TELL "You blow the horn. A reedy, mellow note settles exactly
between the other two, and the three sound together in a chord so satisfying
that the whole room seems to exhale. With a long, oiled sigh, a panel in the
floor beneath the board slides aside, revealing a stone staircase leading
down." CR>)>)
          (<0? ,BRASS-PROGRESS>
           <TELL CT .DEV " gives " <GETP .DEV ,P?NOTE> ", alone. Beneath the
floor something stirs, considers it, and settles back. It was not the note it
was waiting for." CR>)
          (ELSE
           <SETG BRASS-PROGRESS 0>
           <TELL CT .DEV "'s note jars against the last, and the chord
collapses into a discord that sets your teeth on edge. Beneath the floor,
something mechanical clunks back to where it started." CR>)>>

;"P6: called after either water machine is worked. Drains the passage once
  BOTH the ancient wheel and the modern pump are going, in either order.

  The pattern is 'guard, then act': the first COND returns false at once
  unless the work is still to do (not yet drained, the wheel turned, the
  pump's ONBIT set). The callers use that answer: false means 'not drained
  this time', and they print why. Otherwise the routine sets
  PASSAGE-DRAINED, scores P6 and returns the true of its final TELL."
<ROUTINE CHECK-SPRINGS ()
    <COND (<OR ,PASSAGE-DRAINED <NOT ,WHEEL-TURNED> <NOT <FSET? ,PUMP ,ONBIT>>>
           <RFALSE>)>
    <SETG PASSAGE-DRAINED T>
    <AWARD-POINTS 5 ,ACH?SPRINGS>
    <TELL CR "With both waters moving at once -- the ancient one going home,
the modern one hurrying it along -- the dark pool at the end of the gallery
shivers, sinks, and drains away down the passage with a long, satisfied
gurgle. The flooded passage is flooded no longer." CR>>

;"P8: the Shifting Room's arch. Position 0-6 runs with the counter
  1,1,2,3,5,8,13; the arch moves a quarter turn per step and stands north
  (with the shutter down) only at step 6, when the counter reads 13.

  <MOD a b> is the remainder of a divided by b, so <MOD <+ ,SHIFT-STEP 2> 4>
  turns the steps 1, 2, 3, 4, 5, 6 into 3, 0, 1, 2, 3, 0: west, north, east,
  south, west, north. The routine returns a string (an entry of
  COMPASS-NAMES), which callers print inside TELL: <TELL ... <ARCH-DIRECTION>
  ...>. The arch is north at steps 2 and 6, but the shutter is open only at
  6: I-SHIFTING-ROOM says so at step 2."
<ROUTINE ARCH-DIRECTION ()
    <GET ,COMPASS-NAMES <MOD <+ ,SHIFT-STEP 2> 4>>>

;"PRINT-COUNTER: the Shifting Room's counter so far, as a comma list: the
  Fibonacci numbers from step 0 up to SHIFT-STEP (1, 1, 2, ...). Used by the
  brass counter and the room description, so both always agree.

  The DO loop runs I from 0 to SHIFT-STEP; <G? .I 0> ('greater than')
  prints the comma before every number but the first. At step 1 it prints
  '1, 1'; at step 6, '1, 1, 2, 3, 5, 8, 13'."
<ROUTINE PRINT-COUNTER ()
    <DO (I 0 ,SHIFT-STEP)
        <COND (<G? .I 0> <TELL ", ">)>
        <TELL N <GET ,FIBONACCI .I>>>>


;"============================================================================
  5. CHAPTER ONE: SURFACE SECRETS  --  the house
 ----------------------------------------------------------------------------
  Rooms: Overgrown Garden, Entrance Hall, Library, Drawing Room, Study,
  Cellar Stairs. Puzzles P1 (dial), P2 (blueprint), P3 (brass devices).
  The plaques give the widths 1, 1, 2, 3, 5; the library note says the
  next one opens the house's 'vault' (the desk drawer): 8.

  EXITS (exactly as the ROOM definitions below have them)
    Overgrown Garden  NORTH Entrance Hall. Every other direction is refused
                      by GARDEN-F (the gate has rusted shut).
    Entrance Hall     SOUTH Garden, WEST Library, EAST Drawing Room, NORTH
                      Study.
    Library           EAST Entrance Hall.
    Drawing Room      WEST Entrance Hall. DOWN Cellar Stairs, but only IF
                      PANEL-OPEN (a conditional exit; until then a refusal).
    Study             SOUTH Entrance Hall.
    Cellar Stairs     UP Drawing Room, DOWN Lift Landing (chapter two).

  HOW THE CHAPTER PLAYS
    Everything in the house is a clue to one number. Each room's brass
    plaque (and the garden bed's) gives its width: garden 1, hall 1,
    library 2, drawing room 3, study 5. The slim book's margin note says
    each room is the sum of the two before it, so the vault is 8: SET DIAL
    TO 8 in the Study opens the drawer (P1), which holds the journal and
    the brass key. Meanwhile the book has dropped the left half of a
    blueprint and the wastebasket hides the right half; together they make
    the blueprint (P2). The journal's 'low, then high, then the voice
    between' is the order for the Drawing Room's bell, chime and horn (P3),
    which opens the floor: DOWN to the cellar stairs and on to the lift.

  ZIL MET FOR THE FIRST TIME IN THIS CHAPTER (each explained where it is
  used): ROOM and OBJECT and their properties (DESC, LDESC, FDESC, TEXT,
  SYNONYM, ADJECTIVE, IN, FLAGS, ACTION, CAPACITY); the game's own
  properties (SOUNDS, YARDS, PLAQUE-WHAT, ORDER, NOTE, SETTING, GENERIC);
  exits plain and conditional; room routines with M-BEG and M-LOOK;
  NUMBER and P-NUMBER; TRY-TAKE, DO-WALK, MOVE, REMOVE, PUTP.
 ============================================================================"

;"--- The player's own belongings ---------------------------------------------

  The notebook is a prop: it does nothing, but every surveyor has one.
  (IN PLAYER) means it starts in the inventory; PLAYER is zillib's object
  for the player. TAKEBIT lets it be dropped and picked up again; READBIT
  says it can be read. TEXT is the property both zillib's EXAMINE and its
  READ print, so a thing that only needs describing needs no ACTION routine
  at all -- the same is true of the journal and the key further on.
  SYNONYM is the noun the player types; ADJECTIVE the words that may come
  before it (MY NOTEBOOK, SURVEYOR NOTEBOOK)."

<OBJECT NOTEBOOK
    (DESC "surveyor's notebook")
    (SYNONYM NOTEBOOK)
    (ADJECTIVE SURVEYOR MY)
    (IN PLAYER)
    (FLAGS TAKEBIT READBIT)
    (TEXT "Your county-issue notebook. The first page bears today's date and,
underlined twice, QUILLON HOUSE: STRUCTURAL SURVEY. The rest is blank, waiting
for an irregularity.")>

;"--- 1. Overgrown Garden -------------------------------------------------------"

;"The first room, where GO puts the player. Property by property:
    (DESC ...)   the room's name, the heading of its description and the
                 status line's text.
    (IN ROOMS)   every room starts inside zillib's ROOMS object; that is
                 what makes it a room.
    (LDESC ...)  the description LOOK prints. Inside the string, | | (two
                 bars, here on lines of their own) leave a blank line
                 between the two paragraphs.
    (SOUNDS ...) this game's own property: V-LISTEN (section 8) prints it
                 for LISTEN. ZILF makes a new property the first time an
                 object or room uses one.
    (NORTH TO ENTRANCE-HALL)
                 a plain exit: NORTH (or N) moves the player there.
    (FLAGS LIGHTBIT)
                 the room is lit. Every room in this game is lit; darkness
                 is not one of its puzzles.
    (ACTION GARDEN-F)
                 the room's routine, called at several moments of each turn
                 spent here (see GARDEN-F)."
<ROOM GARDEN
    (DESC "Overgrown Garden")
    (IN ROOMS)
    (LDESC "The garden has run wild in every way but one: the flower beds.
Beneath the brambles and bindweed they keep their shapes exactly -- squares
beside squares, each bed as wide as the two before it put together, as if the
soil had been ruled with a straightedge. A small brass plaque is set into the
edge of the nearest bed.|
|
To the north rises Quillon House, red brick and grey slate, every window the
same height and every chimney the same distance from the next.")
    (SOUNDS "Bees, somewhere in the brambles, and far off the traffic on the
county road. Nothing from the house.")
    (NORTH TO ENTRANCE-HALL)
    (FLAGS LIGHTBIT)
    (ACTION GARDEN-F)>

;"Room ACTION routines get an argument saying why they were called. M-BEG
  runs before every action here; returning true stops the action. This one
  turns every exit except north into the same refusal.

  (RARG) names that argument; .RARG reads it (dot: a local). zillib calls
  a room's routine with M-BEG (before a command runs here), M-END (after
  it), M-ENTER (as the player arrives), M-LOOK (to print the description
  itself; return true and the LDESC is skipped) and M-FLASH (just after the
  description). <AND a b c> is true only if all three are: the reason is
  M-BEG, the action is WALK, and the direction is not north. For a WALK the
  parser puts the direction in PRSO as the exit property itself, so
  <PRSO? ,P?NORTH> asks 'north?'. The TELL makes the clause true and stops
  the walk; for every other reason or action the COND is false and play
  goes on as usual."
<ROUTINE GARDEN-F (RARG)
    <COND (<AND <==? .RARG ,M-BEG> <VERB? WALK> <NOT <PRSO? ,P?NORTH>>>
           <TELL "The garden wall is high and the gate has rusted shut behind
you. The county expects its report: the house is north." CR>)>>

;"The garden's plaque: the first of five, all sharing PLAQUE-F. (YARDS 1)
  is its width and (PLAQUE-WHAT 'BED') makes it read BED WIDTH 1 YARD
  rather than ROOM. NDESCBIT keeps it out of the list of things lying in
  the room (the room text mentions it already); READBIT says READ PLAQUE is
  meaningful. With no TAKEBIT, TAKE PLAQUE falls through PLAQUE-F to
  FEATURE-F's 'part of the property' reply."
<OBJECT GARDEN-PLAQUE
    (DESC "brass plaque")
    (SYNONYM PLAQUE)
    (ADJECTIVE SMALL BRASS)
    (IN GARDEN)
    (YARDS 1)
    (PLAQUE-WHAT "BED")
    (FLAGS NDESCBIT READBIT)
    (ACTION PLAQUE-F)>

;"The flower beds: scenery (NDESCBIT, FEATURE-F) with a TEXT that is the
  chapter's first clue, the widths 1, 1, 2, 3, 5. PLURALBIT says the name
  is plural, so zillib and FEATURE-F write 'The flower beds are...'. The
  long SYNONYM list catches everything the description mentions, so
  EXAMINE BRAMBLES or EXAMINE SOIL lands here too."
<OBJECT FLOWER-BEDS
    (DESC "flower beds")
    (SYNONYM FLOWERS BED BEDS BRAMBLES BINDWEED SOIL)
    (ADJECTIVE FLOWER)
    (IN GARDEN)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "You pace the beds out. The smallest is a yard wide, and so is its
neighbour; the next is two yards, the next three, then five. Weeds have taken
every bed, but not one of them has dared to cross a border.")
    (ACTION FEATURE-F)>

;"The house seen from outside. NARTICLEBIT means 'no article': it is
  called Quillon House, never 'the Quillon House'. Its own routine turns
  ENTER HOUSE into walking north."
<OBJECT HOUSE-EXTERIOR
    (DESC "Quillon House")
    (SYNONYM HOUSE BRICK SLATE WINDOW WINDOWS CHIMNEY CHIMNEYS)
    (ADJECTIVE QUILLON)
    (IN GARDEN)
    (FLAGS NDESCBIT NARTICLEBIT)
    (TEXT "A square-shouldered Victorian house, handsome and unremarkable,
which is the most suspicious thing about it. Nothing about it is out of true.
You have surveyed churches that were less sure of themselves.")
    (ACTION HOUSE-EXTERIOR-F)>

;"ENTER HOUSE walks you in (north, the front door); anything else gets the
  shared scenery reply from FEATURE-F.

  <DO-WALK ,P?NORTH> is zillib's 'perform WALK NORTH, as if typed': the
  player goes through the garden's NORTH exit (and GARDEN-F, which allows
  north, does not object). Its result -- true -- is the routine's answer,
  so zillib's ENTER never runs. (ELSE <FEATURE-F>) hands everything else
  to the shared scenery routine, and whatever FEATURE-F returns is this
  routine's answer too."
<ROUTINE HOUSE-EXTERIOR-F ()
    <COND (<VERB? ENTER> <DO-WALK ,P?NORTH>)
          (ELSE <FEATURE-F>)>>

;"--- 2. Entrance Hall ----------------------------------------------------------"

;"The hub of chapter one: four plain exits, one per side (the front door,
  the library, the drawing room, the study). No ACTION: nothing in the
  hall behaves specially, so zillib's defaults serve. The brass devices in
  the description are a hint that the drawing room (east) matters."
<ROOM ENTRANCE-HALL
    (DESC "Entrance Hall")
    (IN ROOMS)
    (LDESC "A tall, chilly hall with a black-and-white tiled floor in a pattern
that never quite repeats. Brass devices -- dials, gauges, small trumpet-mouthed
pipes -- are mounted along the walls at regular intervals, polished and
silent, like the instruments of a ship that has never sailed. On a side table,
a silver tray holds a stack of calling cards, and a brass plaque is fixed
beside the door.|
|
The library is west and the drawing room east; a corridor runs north to the
study, and the front door stands open to the garden, south.")
    (SOUNDS "The tick of the house cooling. Once, very faintly, a tone from the
pipes in the walls, as if something were humming to itself.")
    (SOUTH TO GARDEN)
    (WEST TO LIBRARY-ROOM)
    (EAST TO DRAWING-ROOM)
    (NORTH TO STUDY)
    (FLAGS LIGHTBIT)>

;"The hall's plaque: ROOM WIDTH 1 YARD (no PLAQUE-WHAT, so ROOM)."
<OBJECT HALL-PLAQUE
    (DESC "brass plaque")
    (SYNONYM PLAQUE)
    (ADJECTIVE SMALL BRASS)
    (IN ENTRANCE-HALL)
    (YARDS 1)
    (FLAGS NDESCBIT READBIT)
    (ACTION PLAQUE-F)>

;"The hall's dials and pipes: scenery whose TEXT points east, toward the
  drawing room's working instruments."
<OBJECT HALL-DEVICES
    (DESC "brass devices")
    (SYNONYM DEVICES DEVICE DIALS GAUGES PIPES PIPE INSTRUMENTS)
    (ADJECTIVE BRASS)
    (IN ENTRANCE-HALL)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Dials that measure nothing, gauges that point at zero, little
trumpet-mouthed pipes. Following the pipes with your eye, you notice that
every one of them runs along the wall and disappears eastward, toward the
drawing room. \"Decorative,\" says the estate inventory. You make a note:
possibly not.")
    (ACTION FEATURE-F)>

;"The tiled floor: scenery, and a joke about patience."
<OBJECT FLOOR-TILES
    (DESC "tiled floor")
    (SYNONYM TILE TILES FLOOR PATTERN)
    (ADJECTIVE TILED)
    (IN ENTRANCE-HALL)
    (FLAGS NDESCBIT)
    (TEXT "You try to find where the pattern repeats and give up after the
fortieth tile. It is not random. It is simply longer than your patience.")
    (ACTION FEATURE-F)>

;"Lore: examining (or reading) the cards awards LORE-CARDS once."
<OBJECT CALLING-CARDS
    (DESC "calling cards")
    (SYNONYM CARD CARDS STACK TRAY TABLE)
    (ADJECTIVE CALLING SILVER SIDE)
    (IN ENTRANCE-HALL)
    (FLAGS NDESCBIT PLURALBIT READBIT)
    (ACTION CALLING-CARDS-F)>

;"EXAMINE and READ print the cards and award the lore points. AWARD-POINTS
  is called every time, but zillib grants an achievement once, so the
  points count once. TAKE is refused in character. The cards foreshadow
  the lift dial's symbols and the Lanternless. Every other verb returns
  false and gets zillib's default."
<ROUTINE CALLING-CARDS-F ()
    <COND (<VERB? EXAMINE READ>
           <AWARD-POINTS 2 ,ACH?LORE-CARDS>
           <TELL "There are a dozen of them, left by different visitors on the
same day nine years ago; the date is pencilled on every card. None bears a
name. Each is printed instead with a single symbol: a circle, a wave, a
spiral, a star, and -- on several -- a lantern with a line struck through it.
The last card carries a message in violet ink: \"We are ready when you are.
-- L.\"" CR>)
          (<VERB? TAKE>
           <TELL "They belong to the house's correspondence, and you are a
surveyor, not a burglar. You can read them where they lie." CR>)>>

;"--- 3. Library ----------------------------------------------------------------"

;"The library: one exit, back east. It holds the slim book (the left half
  of the blueprint and the rule behind the plaques), the ladder, and a
  plaque reading 2."
<ROOM LIBRARY-ROOM
    (DESC "Library")
    (IN ROOMS)
    (LDESC "Shelves climb from floor to ceiling on every wall, loaded with
architectural texts in four languages and at least one alphabet you don't
recognise. A wheeled ladder leans against them, waiting for someone to need
the top shelf. A brass plaque is fixed by the door, and the only way out is
east, back to the hall.")
    (SOUNDS "The particular silence of a great many books.")
    (EAST TO ENTRANCE-HALL)
    (FLAGS LIGHTBIT)>

;"The library's plaque: ROOM WIDTH 2 YARDS."
<OBJECT LIBRARY-PLAQUE
    (DESC "brass plaque")
    (SYNONYM PLAQUE)
    (ADJECTIVE SMALL BRASS)
    (IN LIBRARY-ROOM)
    (YARDS 2)
    (FLAGS NDESCBIT READBIT)
    (ACTION PLAQUE-F)>

;"The shelves: scenery. Note that BOOKS is a SYNONYM here while the slim
  book answers to BOOK: zillib treats them as different words, so EXAMINE
  BOOKS means the shelves and READ BOOK means the treatise."
<OBJECT SHELVES
    (DESC "shelves")
    (SYNONYM SHELF SHELVES TEXTS BOOKS VOLUMES ALPHABET)
    (IN LIBRARY-ROOM)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Vitruvian commentaries, treatises on the catenary arch, a monograph
on the load-bearing properties of music. Several spines have been rebound in
Quill's own green leather.")
    (ACTION FEATURE-F)>

;"The wheeled ladder: scenery with one extra, CLIMB LADDER (LADDER-F)."
<OBJECT LADDER
    (DESC "wheeled ladder")
    (SYNONYM LADDER RUNGS)
    (ADJECTIVE WHEELED)
    (IN LIBRARY-ROOM)
    (FLAGS NDESCBIT)
    (TEXT "Oak and brass, on a rail. Each rung is a little further from the
last than the one below it.")
    (ACTION LADDER-F)>

;"CLIMB LADDER is a small reward for curiosity; nothing up there matters."
<ROUTINE LADDER-F ()
    <COND (<VERB? CLIMB>
           <TELL "You climb the ladder and inspect the top shelf: dust, an atlas
of bridges that were never built, and a tin of humbugs long since fused into a
single geological humbug. You climb back down." CR>)
          (ELSE <FEATURE-F>)>>

;"The slim book hides the LEFT half of the blueprint. The first time it is
  read, examined or taken, RELEASE-HALF drops the half onto the floor.
  FDESC is the book's description until it has been picked up (TOUCHBIT).

  TRYTAKEBIT matters here. zillib's READ syntax lets the parser pick a
  book up first ('(first taking the slim book)') when the player reads
  something lying about; TRYTAKEBIT turns that off for this object, so READ
  BOOK reads it on its stand and the half falls to the floor, as the text
  says. TAKE BOOK still works: TREATISE-F takes it on purpose."
<OBJECT TREATISE
    (DESC "slim book")
    (SYNONYM BOOK TREATISE GRAMMAR MARGIN)
    (ADJECTIVE SLIM)
    (IN LIBRARY-ROOM)
    (FDESC "On a reading stand by the window lies a slim book.")
    (FLAGS TAKEBIT READBIT TRYTAKEBIT)
    (ACTION TREATISE-F)>

;"The book's routine, two clauses:
    EXAMINE / READ  the margin note (the rule: each room is the sum of the
                    two before it), then RELEASE-HALF, then <RTRUE> so
                    zillib's own READ never runs.
    TAKE, before the half has fallen
                    take the book ourselves with <TRY-TAKE ,TREATISE T>:
                    TRY-TAKE is zillib's TAKE with all its checks, and T
                    means 'silently', so the game can print 'Taken.' and
                    then add the surprise. Once HALF-FALLEN is true this
                    clause no longer matches, and TAKE is zillib's again.
  The comment inside the routine (;'Take it ourselves...') is ignored by
  the compiler like every other."
<ROUTINE TREATISE-F ()
    <COND (<VERB? EXAMINE READ>
           <TELL "\"The Grammar of Rooms\", by A. Quill. It argues, at length
and with diagrams, that a building is a sentence and its rooms are words, and
that most architects are illiterate. In the margin of the first chapter, in
pencil:|
|
    \"Every room is the sum of the two before it. The vault of the house is
the next.\"" CR>
           <RELEASE-HALF>
           <RTRUE>)
          (<AND <VERB? TAKE> <NOT ,HALF-FALLEN>>
           ;"Take it ourselves (silently), then add the surprise."
           <COND (<TRY-TAKE ,TREATISE T>
                  <TELL "Taken." CR>
                  <RELEASE-HALF>)>
           <RTRUE>)>>

;"RELEASE-HALF: drop the left half of the blueprint into the room, once.
  TREATISE-F calls it from READ, EXAMINE and TAKE; HALF-FALLEN makes sure
  only the first of those does anything."
<ROUTINE RELEASE-HALF ()
    <COND (,HALF-FALLEN <RFALSE>)>
    <SETG HALF-FALLEN T>
    <MOVE ,LEFT-HALF ,HERE>
    <TELL CR "A folded sheet slips from between the pages and see-saws to the
floor: half of a torn blueprint." CR>>

;"The left half. It has no IN property, so it starts nowhere -- out of
  play, invisible and unreachable -- until RELEASE-HALF moves it into the
  room. Both halves and the mended blueprint share the nouns HALF,
  BLUEPRINT, PIECE and SHEET; the ADJECTIVEs LEFT and RIGHT are what tell
  the halves apart (PUT LEFT HALF ON RIGHT HALF). TEXT is its description;
  HALF-F does the joining."
<OBJECT LEFT-HALF
    (DESC "left half of a blueprint")
    (SYNONYM HALF BLUEPRINT PIECE SHEET)
    (ADJECTIVE LEFT TORN)
    (FLAGS TAKEBIT READBIT)
    (TEXT "The left half of a blueprint on heavy linen paper, torn down the
middle. You can make out the left side of a house in cross-section -- and,
beneath it, lines continuing down off the edge of anything a house should
need.")
    (ACTION HALF-F)>

;"--- 4. Drawing Room -----------------------------------------------------------

  The drawing room has no LDESC: its routine prints the description on
  M-LOOK, because the description changes once the panel is open."

<ROOM DRAWING-ROOM
    (DESC "Drawing Room")
    (IN ROOMS)
    (SOUNDS "When you hold still, the three instruments hum very faintly, as if
something below the floor were still listening.")
    (WEST TO ENTRANCE-HALL)
    ;"A conditional exit: DOWN works only while the global PANEL-OPEN is true;
      otherwise the ELSE message is printed."
    (DOWN TO CELLAR-STAIRS IF PANEL-OPEN ELSE "The floor is oak, and very well
laid. Suspiciously well laid.")
    (FLAGS LIGHTBIT)
    (ACTION DRAWING-ROOM-F)>

;"M-LOOK lets a room print a description that changes with the game state.

  The description is built from pieces: a TELL with no CR, then, only if
  PANEL-OPEN, a second paragraph (the || in the string makes the blank
  line), then <CRLF> to end it. CRLF, as the last form of the clause, makes
  the routine return true: 'description printed, skip the LDESC'. For every
  other reason (M-BEG, M-END...) the COND is false and nothing changes."
<ROUTINE DRAWING-ROOM-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "A long, formal room of faded green silk and dust-sheeted
chairs. On the north wall, mounted on a polished mahogany board, are three
brass instruments: a squat bell, a slender chime of hanging tubes, and a
coiled horn. Unlike the devices in the hall, these show signs of use --
fingerprints on the bell, the horn's mouthpiece worn bright. A brass plaque is
fixed by the door, and the hall is back to the west.">
           <COND (,PANEL-OPEN
                  <TELL "|
|
Beneath the board, a panel in the floor stands open over a stone staircase
leading down.">)>
           <CRLF>)>>

;"The drawing room's plaque: ROOM WIDTH 3 YARDS."
<OBJECT DRAWING-PLAQUE
    (DESC "brass plaque")
    (SYNONYM PLAQUE)
    (ADJECTIVE SMALL BRASS)
    (IN DRAWING-ROOM)
    (YARDS 3)
    (FLAGS NDESCBIT READBIT)
    (ACTION PLAQUE-F)>

;"The board the instruments hang on: scenery."
<OBJECT BRASS-BOARD
    (DESC "mahogany board")
    (SYNONYM BOARD)
    (ADJECTIVE MAHOGANY POLISHED)
    (IN DRAWING-ROOM)
    (FLAGS NDESCBIT)
    (TEXT "A polished board holding the bell, the chime and the horn in a row.
Small brass pipes run from the back of each instrument down into the floor.")
    (ACTION FEATURE-F)>

;"The three brass devices share BRASS-F. Only ORDER, NOTE and TEXT differ."
<OBJECT BRASS-BELL
    (DESC "brass bell")
    (SYNONYM BELL)
    (ADJECTIVE SQUAT BRASS)
    (IN DRAWING-ROOM)
    (ORDER 0)
    (NOTE "a low, round note")
    (FLAGS NDESCBIT)
    (TEXT "A squat, heavy bell, broad at the lip. It would speak low, and take
its time about it.")
    (ACTION BRASS-F)>

;"The chime: ORDER 1, the second note (high)."
<OBJECT BRASS-CHIME
    (DESC "brass chime")
    (SYNONYM CHIME CHIMES TUBE TUBES)
    (ADJECTIVE SLENDER BRASS)
    (IN DRAWING-ROOM)
    (ORDER 1)
    (NOTE "a high, glassy note")
    (FLAGS NDESCBIT)
    (TEXT "Five slender tubes, the longest no longer than your hand. Whatever
they say, they will say it high.")
    (ACTION BRASS-F)>

;"The horn: ORDER 2, the third note (between)."
<OBJECT BRASS-HORN
    (DESC "brass horn")
    (SYNONYM HORN MOUTHPIECE)
    (ADJECTIVE COILED BRASS)
    (IN DRAWING-ROOM)
    (ORDER 2)
    (NOTE "a mellow, reedy note")
    (FLAGS NDESCBIT)
    (TEXT "A coiled horn with a bright mouthpiece. Its voice, you judge, would
fall somewhere in the middle: neither as deep as the bell nor as shrill as the
chime.")
    (ACTION BRASS-F)>

;"The panel in the floor, which becomes the staircase down. One object
  stands for both (PANEL, FLOOR, STAIRS, STEPS...); FLOOR-PANEL-F reads
  PANEL-OPEN to say which it is now."
<OBJECT FLOOR-PANEL
    (DESC "floor panel")
    (SYNONYM PANEL FLOOR FLOORBOARDS STAIRCASE STAIR STAIRS STEPS)
    (ADJECTIVE FLOOR)
    (IN DRAWING-ROOM)
    (FLAGS NDESCBIT)
    (ACTION FLOOR-PANEL-F)>

;"The floor panel is P3's reward: closed until the three brass notes are
  played (PANEL-OPEN), then a staircase. ENTER or CLIMB it to go down."
<ROUTINE FLOOR-PANEL-F ()
    <COND (<VERB? EXAMINE>
           <COND (,PANEL-OPEN
                  <TELL "The panel has slid neatly under the floorboards. Stone
steps lead down into cold air." CR>)
                 (ELSE
                  <TELL "The oak floorboards beneath the board fit together
without a gap you could slide a card into." CR>)>)
          (<VERB? ENTER CLIMB> <DO-WALK ,P?DOWN>)
          (ELSE <FEATURE-F>)>>

;"--- 5. Study ------------------------------------------------------------------"

;"The study: one exit, south. The heart of P1 (the desk drawer and its
  dial) and P2's second half (the wastebasket). Its plaque reads 5."
<ROOM STUDY
    (DESC "Study")
    (IN ROOMS)
    (LDESC "The only room in the house that looks lived in: ink stains, a coat
over the back of the chair, a cup of something that gave up years ago. A heavy
desk faces the window; its single drawer is fitted with a brass dial lock. A
wastebasket beside it overflows with crumpled drafts. A brass plaque is fixed
by the door, and the hall lies south.")
    (SOUNDS "A clock somewhere, ticking at what you would swear is very slightly
less than once a second.")
    (SOUTH TO ENTRANCE-HALL)
    (FLAGS LIGHTBIT)>

;"The study's plaque: ROOM WIDTH 5 YARDS."
<OBJECT STUDY-PLAQUE
    (DESC "brass plaque")
    (SYNONYM PLAQUE)
    (ADJECTIVE SMALL BRASS)
    (IN STUDY)
    (YARDS 5)
    (FLAGS NDESCBIT READBIT)
    (ACTION PLAQUE-F)>

;"X DESK means the desk, not the drawer: DESK is a noun (a SYNONYM) of the
  desk but only an ADJECTIVE of the drawer, and zillib prefers the better
  match. OPEN DESK DRAWER still finds the drawer.

  CONTBIT + SURFACEBIT make the desk a surface the player can PUT things
  ON (zillib's PUT ... ON wants both), and OPENBIT marks it open, so zillib
  never treats it as a closed box; (CAPACITY 20) is how much it holds,
  measured in the SIZE units zillib gives every object (5 unless an object
  says otherwise). FEATURE-F refuses TAKE and the rest."
<OBJECT STUDY-DESK
    (DESC "heavy desk")
    (SYNONYM DESK)
    (ADJECTIVE HEAVY WRITING WALNUT)
    (IN STUDY)
    (CAPACITY 20)
    (FLAGS NDESCBIT CONTBIT SURFACEBIT OPENBIT)
    (TEXT "A partners' desk in walnut, scarred by a lifetime of compasses. Its
single drawer has a brass dial set into its face.")
    (ACTION FEATURE-F)>

;"The coat, the chair and the cup: one scenery object for all of them."
<OBJECT STUDY-CLUTTER
    (DESC "study clutter")
    (SYNONYM COAT CHAIR CUP INK STAINS)
    (IN STUDY)
    (FLAGS NDESCBIT)
    (TEXT "The coat has a pencil in every pocket. The cup has been growing
something with real architectural ambition.")
    (ACTION FEATURE-F)>

;"The locked drawer. CONTBIT makes it a container, OPENABLEBIT lets OPEN
  and CLOSE apply, LOCKEDBIT starts it locked; with no OPENBIT it starts
  closed, and the journal and key inside it cannot be seen. Its lock is the
  dial (DRAWER-DIAL), not a keyhole."
<OBJECT DESK-DRAWER
    (DESC "desk drawer")
    (SYNONYM DRAWER)
    (ADJECTIVE DESK)
    (IN STUDY)
    (FLAGS NDESCBIT CONTBIT OPENABLEBIT LOCKEDBIT)
    (ACTION DESK-DRAWER-F)>

;"P1: the drawer is locked by its dial, not a key. OPEN and UNLOCK say so
  and point at the dial (DRAWER-DIAL-F does the unlocking). Once it is open,
  EXAMINE lists what is inside."
<ROUTINE DESK-DRAWER-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A shallow drawer with a brass dial lock. ">
           <COND (<FSET? ,DESK-DRAWER ,OPENBIT>
                  <TELL "It stands open." CR>
                  <COND (<FIRST? ,DESK-DRAWER> <DESCRIBE-CONTENTS ,DESK-DRAWER>)>
                  <RTRUE>)
                 (ELSE <TELL "It is locked." CR>)>)
          (<AND <VERB? OPEN> <FSET? ,DESK-DRAWER ,LOCKEDBIT>>
           <TELL "The drawer is locked. The dial on its face is numbered from 0
to 21." CR>)
          (<VERB? UNLOCK>
           <TELL "There is no keyhole: only the dial, numbered from 0 to 21." CR>)
          (<VERB? TAKE PULL PUSH TURN> <FEATURE-F>)>>

;"P1. SET DIAL TO 8: the parser turns a typed number into the NUMBER object
  and leaves its value in P-NUMBER."
<OBJECT DRAWER-DIAL
    (DESC "brass dial")
    (SYNONYM DIAL LOCK COMBINATION NUMBERS)
    (ADJECTIVE BRASS)
    (IN STUDY)
    (SETTING 0)
    (FLAGS NDESCBIT)
    (ACTION DRAWER-DIAL-F)>

;"The dial's routine (P1). The clauses:
    EXAMINE     where it points: N prints the number, read from the dial's
                own SETTING property with GETP.
    SET / TURN  with no number: ask for one. (SET and TURN are this game's
                verbs, section 8.)
    SET-TO      SET DIAL TO 8 (or TURN DIAL TO 8). zillib's parser turns
                any typed number into its NUMBER object, so the number is
                PRSI and its value is the global P-NUMBER.
                  not a number, or out of 0-21  -> refuse.
                  the drawer already unlocked   -> just move the dial.
                  any number but 8 (N==?: not equal) -> move the dial, no
                                                   luck.
                  8 -> PUTP stores 8 in SETTING, FCLEAR LOCKEDBIT and FSET
                       OPENBIT unlock and open the drawer, AWARD-POINTS
                       scores P1.
    TAKE, PULL, PUSH -> FEATURE-F.
  <PUTP obj property value> changes a property while the game runs (it
  works because the dial was given a SETTING property to begin with).
  Opening the drawer here, rather than leaving the player to OPEN it, means
  its contents can be named in the same message."
<ROUTINE DRAWER-DIAL-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A brass dial numbered from 0 to 21, set into the drawer's face.
It points to " N <GETP ,DRAWER-DIAL ,P?SETTING> "." CR>)
          (<VERB? SET TURN>
           <TELL "Set it to which number? It runs from 0 to 21." CR>)
          (<VERB? SET-TO>
           <COND (<OR <NOT <PRSI? ,NUMBER>> <L? ,P-NUMBER 0> <G? ,P-NUMBER 21>>
                  <TELL "The dial is numbered from 0 to 21, and offers nothing
else." CR>)
                 (<NOT <FSET? ,DESK-DRAWER ,LOCKEDBIT>>
                  <PUTP ,DRAWER-DIAL ,P?SETTING ,P-NUMBER>
                  <TELL "You set the dial to " N ,P-NUMBER ". The drawer is
already open." CR>)
                 (<N==? ,P-NUMBER 8>
                  <PUTP ,DRAWER-DIAL ,P?SETTING ,P-NUMBER>
                  <TELL "You set the dial to " N ,P-NUMBER ". Something inside
the drawer considers this, and declines." CR>)
                 (ELSE
                  <PUTP ,DRAWER-DIAL ,P?SETTING 8>
                  <FCLEAR ,DESK-DRAWER ,LOCKEDBIT>
                  <FSET ,DESK-DRAWER ,OPENBIT>
                  <AWARD-POINTS 5 ,ACH?DIAL>
                  <TELL "You set the dial to 8. One, one, two, three, five -- and
eight. The lock gives a small, satisfied click and the drawer slides open of
its own accord, revealing a leather journal and a brass key." CR>)>)
          (<VERB? TAKE PULL PUSH> <FEATURE-F>)>>

;"Quill's journal, in the drawer. No ACTION: zillib's EXAMINE and READ
  print its TEXT, which holds P3's order (low, high, between). It is also
  the evidence that wins the Foreman over (P5)."
<OBJECT JOURNAL
    (DESC "leather journal")
    (SYNONYM JOURNAL DIARY)
    (ADJECTIVE LEATHER GREEN QUILL)
    (IN DESK-DRAWER)
    (FLAGS TAKEBIT READBIT)
    (TEXT "Quill's journal, bound in green leather, his handwriting small and
untroubled. Most of it is measurements. Some of it is dreams: a city beneath
the downs, lit by its own light, where the streets curve the way water wants
to go and the rooms grow in proportion like the chambers of a shell. One page,
underlined twice, reads:|
|
    \"The house will open for one who listens. Low, then high, then the voice
between.\"|
|
The last entry says only: \"Spring. Begin the city.\"")>

;"The brass key, in the drawer: the lift cage's key (P4). TOOLBIT is the
  flag zillib's UNLOCK ... WITH syntax uses to guess the key, so UNLOCK
  CAGE alone can supply it once it is held. The spiral on its bow is a
  hint for the lift dial."
<OBJECT BRASS-KEY
    (DESC "brass key")
    (SYNONYM KEY)
    (ADJECTIVE BRASS LONG)
    (IN DESK-DRAWER)
    (FLAGS TAKEBIT TOOLBIT)
    (TEXT "A long brass key, its bow cast in the shape of a spiral.")>

;"The wastebasket: an open container (CONTBIT OPENBIT) that looks full of
  rubbish. The right half is not in it until SEARCH puts it there."
<OBJECT WASTEBASKET
    (DESC "wastebasket")
    (SYNONYM WASTEBASKET BASKET BIN DRAFTS RUBBISH)
    (ADJECTIVE WICKER CRUMPLED)
    (IN STUDY)
    (CAPACITY 20)
    (FLAGS NDESCBIT CONTBIT OPENBIT)
    (TEXT "A wicker wastebasket overflowing with crumpled drafts: elevations,
sections, a staircase that seems to go down in both directions.")
    (ACTION WASTEBASKET-F)>

;"P2's other half. The right half of the blueprint is not in the basket at
  the start: SEARCH (or EMPTY) puts it there the first time, so it is found
  rather than seen. BASKET-SEARCHED remembers that."
<ROUTINE WASTEBASKET-F ()
    <COND (<VERB? SEARCH EMPTY>
           <COND (,BASKET-SEARCHED
                  <TELL "Nothing else, unless you count beautifully drawn
mistakes." CR>)
                 (ELSE
                  <SETG BASKET-SEARCHED T>
                  <MOVE ,RIGHT-HALF ,WASTEBASKET>
                  <TELL "You sift through the drafts. Most are abandoned
elevations of buildings that would not stand up -- or would, uncomfortably.
Near the bottom you find something that was not thrown away so much as
hidden: half of a torn blueprint." CR>)>)
          (<VERB? TAKE>
           <TELL "It's mostly rubbish, and the rubbish is mostly mistakes.
You'd rather not carry it." CR>)>>

;"The right half: like the left, it has no IN and starts out of play.
  WASTEBASKET-F moves it into the basket; TAKE HALF then finds it there
  (the left half, already held, is not what TAKE looks for)."
<OBJECT RIGHT-HALF
    (DESC "right half of a blueprint")
    (SYNONYM HALF BLUEPRINT PIECE SHEET)
    (ADJECTIVE RIGHT TORN)
    (FLAGS TAKEBIT READBIT)
    (TEXT "The right half of a blueprint, torn down the middle. A shaft drops
from the floor of a drawing room into the earth, and beside the shaft someone
has inked a careful mark -- but the tear runs straight through it.")
    (ACTION HALF-F)>

;"P2. Both halves share HALF-F. In PUT LEFT HALF ON RIGHT HALF the right
  half is PRSI, and zillib calls PRSI's ACTION before PRSO's, so either half
  can catch the action; whichever does first joins them."
<ROUTINE HALF-F ()
    <COND (<AND <VERB? PUT-ON PUT-IN>
                <OR <AND <PRSO? ,LEFT-HALF> <PRSI? ,RIGHT-HALF>>
                    <AND <PRSO? ,RIGHT-HALF> <PRSI? ,LEFT-HALF>>>>
           <JOIN-HALVES>)>>

;"The mended blueprint. 'House' is only an ADJECTIVE here, so in the garden
  X HOUSE still means the house.

  No IN: JOIN-HALVES creates it in the player's hands by MOVE. Its TEXT
  shows the SPIRAL beside the shaft, the hint for the lift (P4). (GENERIC
  BLUEPRINT-GENERIC-F) is for the Final Chamber, where two blueprints are
  in reach at once (see there)."
<OBJECT BLUEPRINT
    (DESC "blueprint of Quillon House")
    (SYNONYM BLUEPRINT PLAN)
    (ADJECTIVE MENDED HOUSE QUILLON)
    (FLAGS TAKEBIT READBIT)
    (GENERIC BLUEPRINT-GENERIC-F)
    (TEXT "A cross-section of Quillon House, drawn with a draughtsman's
tenderness. You can see the garden, the hall and the four rooms in their proper
widths; below the drawing room a stair, below the stair a shaft, and beside the
shaft, inked boldly, a SPIRAL. Beneath that the drawing fades into faint pencil
-- vast chambers, waterways, a mirror -- as if Quill had not quite dared to
commit them to ink.")>

;"--- 6. Cellar Stairs ----------------------------------------------------------"

;"The way from the house to the site: UP to the drawing room, DOWN to
  the lift landing. Nothing to do here but listen."
<ROOM CELLAR-STAIRS
    (DESC "Cellar Stairs")
    (IN ROOMS)
    (LDESC "Narrow stone steps descend in a tight square spiral, each flight one
step shorter than the last. The air grows colder with every turn and smells of
wet rock and machine oil. Somewhere below, something hisses quietly, like a
kettle that has been told to wait. The steps climb to the drawing room and
fall away below toward a faint blue glow.")
    (SOUNDS "A slow hiss of steam from below, and the drip of water.")
    (UP TO DRAWING-ROOM)
    (DOWN TO LIFT-LANDING)
    (FLAGS LIGHTBIT)>

;"The stone steps: scenery."
<OBJECT CELLAR-STEPS
    (DESC "stone steps")
    (SYNONYM STEPS STAIR STAIRS FLIGHT FLIGHTS)
    (ADJECTIVE STONE NARROW)
    (IN CELLAR-STAIRS)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Cut from one block, by the look of them. The house has been sitting
on this staircase all along.")
    (ACTION FEATURE-F)>


;"============================================================================
  6. CHAPTER TWO: THE UNFINISHED DREAM  --  the construction site
 ----------------------------------------------------------------------------
  Rooms: Lift Landing, Survey Chamber, Great Hall, Spring Gallery, Flooded
  Passage, Mirror Gallery, and (optional) the Foreman's Hut.
  Puzzles P4 (lift), P5 (Foreman), P6 (springs), P7 (mirror).
  The chapter banner is printed by Lift Landing's M-ENTER.

  EXITS
    Lift Landing     UP Cellar Stairs. DOWN is a routine exit (PER
                     LIFT-DOWN-F): the Survey Chamber once LIFT-READY,
                     otherwise a reason why not.
    Survey Chamber   UP (PER SURVEY-UP-F) back to the landing; EAST Great
                     Hall; SOUTH Spring Gallery.
    Great Hall       WEST Survey Chamber; NORTH Foreman's Hut.
    Foreman's Hut    SOUTH Great Hall.
    Spring Gallery   NORTH Survey Chamber; EAST Flooded Passage.
    Flooded Passage  WEST Spring Gallery; EAST Mirror Gallery IF
                     PASSAGE-DRAINED.
    Mirror Gallery   WEST Flooded Passage; DOWN Vault Antechamber IF
                     STAIRS-OPEN.

  HOW THE CHAPTER PLAYS
    The lift (P4) wants three things in order: the cage unlocked with the
    brass key, the dial set to the spiral, the lever pulled. Below, the
    Survey Chamber branches: east to the Great Hall, where the Foreman
    trades the tuning fork for proof that you knew Quill (P5); south to the
    Spring Gallery, where the old wheel and the new pump together drain
    the passage (P6). Beyond it the mirror must be turned to throw the
    daylight east (P7); taking the crystal that grows there opens the
    stairs to chapter three. P5 and P6 can be done in either order.

  ZIL MET FOR THE FIRST TIME IN THIS CHAPTER: routine exits (PER), M-ENTER
  and M-END, a flag of the game's own (SYMBOLBIT), conversation (M-WINNER,
  ASK ... ABOUT topics), FEMALEBIT, DEVICEBIT and ONBIT, NARTICLEBIT,
  SIZE, and objects that enter play only when a routine MOVEs them.
 ============================================================================"

;"--- 7. Lift Landing -----------------------------------------------------------"

;"The top of the shaft. No LDESC: LIFT-LANDING-F prints the description,
  because the crystals glow once the lift is ready. Its DOWN exit is a
  routine (PER), because whether the lift can go depends on two things."
<ROOM LIFT-LANDING
    (DESC "Lift Landing")
    (IN ROOMS)
    (SOUNDS "Steam, breathing in and out of the copper pipes. Far below,
something enormous drips.")
    (UP TO CELLAR-STAIRS)
    ;"A routine exit: LIFT-DOWN-F returns the room to go to, or false (after
      printing why not) to stay put."
    (DOWN PER LIFT-DOWN-F)
    (FLAGS LIGHTBIT)
    (ACTION LIFT-LANDING-F)>

;"Two moments matter here:
    M-ENTER  the player has just arrived: print the Chapter Two banner (the
             first time only; BEGIN-CHAPTER checks). M-ENTER comes before
             the room is described, so the banner is printed above it.
    M-LOOK   the description, with the crystals and the last sentence
             depending on LIFT-READY. The TELL that ends the clause makes
             it true: description printed."
<ROUTINE LIFT-LANDING-F (RARG)
    <COND (<==? .RARG ,M-ENTER> <BEGIN-CHAPTER 2>)
          (<==? .RARG ,M-LOOK>
           <TELL "You stand on an iron platform bolted to the wall of a vast
vertical shaft. The cold here is the cold of deep stone, and your breath hangs
in the air. Before you hangs a lift unlike any you have surveyed: a brass
cage, riveted and gleaming, slung from cables that vanish upward into the
dark, fed by copper pipes that pulse with steam. Clusters of crystals are set
into its frame like rivets">
           <COND (,LIFT-READY <TELL ", every one of them glowing a steady blue.">)
                 (ELSE <TELL ", dull and grey.">)>
           <TELL " Beside the cage gate are a dial engraved with symbols and a
long iron lever. The stairs lead back up">
           <COND (,LIFT-READY <TELL "; the lift is ready to go down." CR>)
                 (ELSE <TELL "." CR>)>)>>

;"P4: the Lift Landing's DOWN exit. A PER routine returns the room to go
  to, or false to stay: only with LIFT-READY does the lift carry you to the
  Survey Chamber; a locked or dead cage says why not.

  zillib's WALK calls the routine and, if it gets a room back, moves the
  player there and describes it. The first clause prints the ride and
  then ends with the bare value ,SURVEY-CHAMBER: the last value in a COND
  clause is what the clause (and here the routine) gives back. The other
  two clauses print their reason and give <RFALSE>: stay put."
<ROUTINE LIFT-DOWN-F ()
    <COND (,LIFT-READY
           <TELL "You step into the cage and draw the gate shut. With a shriek
of steam and a chord from the crystals the lift drops, gently at first and then
with alarming conviction. Rock streams past the bars; the blue light climbs the
shaft walls with you. After a long minute it slows, sighs, and settles at the
bottom." CR CR>
           ,SURVEY-CHAMBER)
          (<FSET? ,LIFT-CAGE ,LOCKEDBIT>
           <TELL "The cage gate is locked." CR>
           <RFALSE>)
          (ELSE
           <TELL "You step into the cage, but the lift is dead: no steam, no
light. You step out again, feeling foolish." CR>
           <RFALSE>)>>

;"The lift itself: one object for the cage, its gate, the crystals, the
  cables and the pipes (see the SYNONYM list), so EXAMINE CRYSTALS or
  UNLOCK GATE all land here. OPENABLEBIT and LOCKEDBIT: a lockable thing
  that starts locked. NDESCBIT: the landing's description already shows it."
<OBJECT LIFT-CAGE
    (DESC "lift cage")
    (SYNONYM LIFT CAGE GATE ELEVATOR CRYSTALS CABLES PIPES KEYHOLE)
    (ADJECTIVE LIFT BRASS COPPER)
    (IN LIFT-LANDING)
    (FLAGS NDESCBIT OPENABLEBIT LOCKEDBIT)
    (ACTION LIFT-CAGE-F)>

;"P4, step one: the cage gate takes the brass key (the spiral key). UNLOCK
  with anything else is refused; EXAMINE reports the gate and the crystals."
<ROUTINE LIFT-CAGE-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A brass cage the size of a garden shed. Its gate ">
           <COND (<FSET? ,LIFT-CAGE ,LOCKEDBIT>
                  <TELL "is locked, and the keyhole is cut in the shape of a
spiral">)
                 (ELSE <TELL "stands open">)>
           <TELL ". The crystals in its frame are ">
           <COND (,LIFT-READY <TELL "glowing." CR>)
                 (ELSE <TELL "dull." CR>)>)
          (<VERB? UNLOCK>
           <COND (<NOT <FSET? ,LIFT-CAGE ,LOCKEDBIT>>
                  <TELL "The gate is already unlocked." CR>)
                 (<PRSI? ,BRASS-KEY>
                  <FCLEAR ,LIFT-CAGE ,LOCKEDBIT>
                  <FSET ,LIFT-CAGE ,OPENBIT>
                  <TELL "The brass key turns with the sound of a well-made
clock, and the cage gate folds back." CR>)
                 (ELSE
                  <TELL "That will not fit a keyhole cut in the shape of a
spiral." CR>)>)
          (<VERB? ENTER> <DO-WALK ,P?DOWN>)
          (<VERB? TAKE PULL PUSH TURN> <FEATURE-F>)>>

;"P4. The symbol dial. Its six symbols are real objects in the room, so
  SET DIAL TO SPIRAL parses like any other SET ... TO ...; the global
  LIFT-SYMBOL remembers which one is selected."
<OBJECT LIFT-DIAL
    (DESC "symbol dial")
    (SYNONYM DIAL SYMBOLS)
    (ADJECTIVE SYMBOL)
    (IN LIFT-LANDING)
    (FLAGS NDESCBIT)
    (ACTION LIFT-DIAL-F)>

;"The symbol dial's routine. EXAMINE names the selected symbol with
  D ,LIFT-SYMBOL (D prints an object's DESC). SET-TO (SET DIAL TO SPIRAL)
  accepts any object with SYMBOLBIT as PRSI and stores it in LIFT-SYMBOL;
  anything else, a number included, is refused. Nothing is checked yet:
  the lever does that."
<ROUTINE LIFT-DIAL-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A brass dial engraved with six symbols: a circle, a square, a
triangle, a wave, a star and a spiral. It points to the " D ,LIFT-SYMBOL "." CR>)
          (<VERB? SET TURN>
           <TELL "Set it to which symbol? Circle, square, triangle, wave, star
or spiral." CR>)
          (<VERB? SET-TO>
           <COND (<FSET? ,PRSI ,SYMBOLBIT>
                  <SETG LIFT-SYMBOL ,PRSI>
                  <TELL "The dial clicks round to the " D ,PRSI "." CR>)
                 (ELSE
                  <TELL "The dial has no numbers and no such symbol: only a
circle, square, triangle, wave, star and spiral." CR>)>)
          (<VERB? TAKE PULL PUSH> <FEATURE-F>)>>

;"SYMBOLBIT is a flag of our own: ZILF creates a new flag the first time one
  is named.

  The six symbols are tiny objects written one per line: an OBJECT's
  properties are just lists and can share a line. Each is in the landing
  (so the parser can find SPIRAL there), NDESCBIT (never listed), and
  answers to SYMBOL-F."
<OBJECT CIRCLE-SYMBOL (DESC "circle") (SYNONYM CIRCLE) (IN LIFT-LANDING)
    (FLAGS NDESCBIT SYMBOLBIT) (ACTION SYMBOL-F)>
;"The other five symbols, the same in every way but their names."
<OBJECT SQUARE-SYMBOL (DESC "square") (SYNONYM SQUARE) (IN LIFT-LANDING)
    (FLAGS NDESCBIT SYMBOLBIT) (ACTION SYMBOL-F)>
<OBJECT TRIANGLE-SYMBOL (DESC "triangle") (SYNONYM TRIANGLE) (IN LIFT-LANDING)
    (FLAGS NDESCBIT SYMBOLBIT) (ACTION SYMBOL-F)>
<OBJECT WAVE-SYMBOL (DESC "wave") (SYNONYM WAVE) (IN LIFT-LANDING)
    (FLAGS NDESCBIT SYMBOLBIT) (ACTION SYMBOL-F)>
<OBJECT STAR-SYMBOL (DESC "star") (SYNONYM STAR) (IN LIFT-LANDING)
    (FLAGS NDESCBIT SYMBOLBIT) (ACTION SYMBOL-F)>
<OBJECT SPIRAL-SYMBOL (DESC "spiral") (SYNONYM SPIRAL) (IN LIFT-LANDING)
    (FLAGS NDESCBIT SYMBOLBIT) (ACTION SYMBOL-F)>

;"The six symbols are objects of their own so SET DIAL TO SPIRAL can name
  one. SYMBOL-F answers EXAMINE (and says which one the dial points at) and
  steers TAKE and friends back to the dial."
<ROUTINE SYMBOL-F ()
    <COND (<VERB? EXAMINE>
           <TELL "One of the six symbols engraved on the lift's dial: the "
                 D ,PRSO ".">
           <COND (<==? ,PRSO ,LIFT-SYMBOL> <TELL " The dial points to it.">)>
           <CRLF>)
          (<VERB? TAKE PULL PUSH TURN>
           <TELL "It is engraved on the dial. Try setting the dial to it." CR>)>>

;"The lever. VOWELBIT gives 'an iron lever'. Its plate's MIND THE SYMBOL
  is the hint that the dial matters."
<OBJECT LIFT-LEVER
    (DESC "iron lever")
    (SYNONYM LEVER HANDLE GRIP)
    (ADJECTIVE IRON LONG)
    (IN LIFT-LANDING)
    (FLAGS NDESCBIT VOWELBIT)
    (TEXT "A long iron lever with a wooden grip, standing upright. A brass
plate beneath it reads, in Quill's lettering: MIND THE SYMBOL.")
    (ACTION LIFT-LEVER-F)>

;"P4, last step: the lever only starts the lift with the cage unlocked and
  the dial on the spiral. Wrong symbol: it springs back, a hint, no harm."
<ROUTINE LIFT-LEVER-F ()
    <COND (<VERB? PULL PUSH TURN>
           <COND (,LIFT-READY
                  <TELL "The lever is already down. The lift is ready." CR>)
                 (<FSET? ,LIFT-CAGE ,LOCKEDBIT>
                  <TELL "The lever will not move: an interlock holds it while
the cage is locked." CR>)
                 (<N==? ,LIFT-SYMBOL ,SPIRAL-SYMBOL>
                  <TELL "You haul on the lever. Steam coughs, the crystals
flicker an unhappy red, and the lever springs back. The machine wants a
different symbol." CR>)
                 (ELSE
                  <SETG LIFT-READY T>
                  <AWARD-POINTS 5 ,ACH?LIFT>
                  <TELL "You haul the lever down. Steam hisses through every
pipe at once, the cables tighten with a groan, and one by one the crystals in
the cage frame kindle, until the whole lift is glowing a steady, impossible
blue. It is ready to go down." CR>)>)
          (<VERB? TAKE> <FEATURE-F>)>>

;"--- 8. Survey Chamber ---------------------------------------------------------"

;"The foot of the lift shaft and the chapter's crossroads: UP rides the
  lift back (a PER routine, so it can describe the ride), EAST to the
  Great Hall, SOUTH to the Spring Gallery."
<ROOM SURVEY-CHAMBER
    (DESC "Survey Chamber")
    (IN ROOMS)
    (LDESC "A broad chamber cut from the living rock with a precision that
makes you, professionally, uneasy: the walls are true to a hair, the corners
exact, the floor level enough to set a marble on and have it stay put. Every
surface is covered with construction marks, the working notes of a mason who
expected to come back. The lift waits to take you up. A passage leads east
toward a great echo, and another runs south toward the sound of water.")
    (SOUNDS "From the east, your own breathing, returned with interest. From
the south, running water.")
    (UP PER SURVEY-UP-F)
    (EAST TO GREAT-HALL)
    (SOUTH TO SPRING-GALLERY)
    (FLAGS LIGHTBIT)>

;"UP from the Survey Chamber: the lift takes you back to the landing. A PER
  routine can print a line and then return the room to move to."
<ROUTINE SURVEY-UP-F ()
    <TELL "The lift carries you back up the shaft, wheezing companionably." CR CR>
    ,LIFT-LANDING>

;"The mason's marks: scenery that can be read (READBIT), worth a lore
  point, and the key to the lift dial's symbols."
<OBJECT SURVEY-MARKS
    (DESC "construction marks")
    (SYNONYM MARKS MARK SYMBOLS TALLIES LINES)
    (ADJECTIVE CONSTRUCTION MASON MASONS)
    (IN SURVEY-CHAMBER)
    (FLAGS NDESCBIT PLURALBIT READBIT)
    (ACTION SURVEY-MARKS-F)>

;"Lore (2 points): reading the marks decodes the lift symbols. AWARD-POINTS
  with an achievement only ever counts once, however often you read."
<ROUTINE SURVEY-MARKS-F ()
    <COND (<VERB? EXAMINE READ>
           <AWARD-POINTS 2 ,ACH?LORE-MARKS>
           <TELL "Most are ordinary mason's marks, the private shorthand of a
working builder: a tick for checked, a cross for load-bearing. But there is a
second vocabulary among them -- the symbols from the lift dial, used like
words. With your notebook you decode a line: the SPIRAL means descend, the
WAVE means water, the STAR means light. One symbol you have seen only on a
calling card -- a lantern with a line struck through it -- appears just once,
beside an arrow pointing down." CR>)
          (ELSE <FEATURE-F>)>>

;"--- 9. Great Hall -------------------------------------------------------------"

;"The Foreman's hall. EAST of the Survey Chamber (its WEST exit goes
  back), with the Foreman's Hut to the north. GREAT-HALL-F gives the
  Foreman something to do between turns."
<ROOM GREAT-HALL
    (DESC "Great Hall")
    (IN ROOMS)
    (LDESC "The hall is enormous and unfinished. Half of it is roofed by a
vault of breathtaking delicacy; the other half is bare scaffolding and stacked,
numbered stone. The acoustics are perfect: your footsteps return from the far
end clear and slightly delayed, as if the hall were considering them. A timber
site hut stands against the north wall, and the survey chamber is back to the
west.")
    (SOUNDS "Your own heartbeat, faintly, handed back to you by the vault.")
    (WEST TO SURVEY-CHAMBER)
    (NORTH TO FOREMANS-HUT)
    (FLAGS LIGHTBIT)
    (ACTION GREAT-HALL-F)>

;"M-END runs at the end of every turn the player spends here: the place for
  a little background life. MOVES is zillib's turn counter, so the Foreman
  does something every third turn, in a fixed rotation (no randomness, so
  the walkthrough always reads the same).

  The arithmetic: <0? <MOD ,MOVES 3>> is true on turns 3, 6, 9...;
  </ ,MOVES 3> (division, whole numbers only) counts those beats 1, 2,
  3..., and MOD 3 of that picks one of the three lines in turn. zillib only
  calls the current room's routine, so this never fires while the player
  is elsewhere; the IN? test keeps it honest if the Foreman were ever moved.
  TELL CR starts the line on a fresh line after the turn's own output."
<ROUTINE GREAT-HALL-F (RARG)
    <COND (<AND <==? .RARG ,M-END> <IN? ,FOREMAN ,HERE> <0? <MOD ,MOVES 3>>>
           <COND (<0? <MOD </ ,MOVES 3> 3>>
                  <TELL CR "The Foreman taps a stone with his hammer and listens
to the hall answer." CR>)
                 (<1? <MOD </ ,MOVES 3> 3>>
                  <TELL CR "Somewhere up in the scaffolding, the hall repeats a
cough that nobody made." CR>)
                 (ELSE
                  <TELL CR "The Foreman chalks a small mark on a stone: an
unfinished spiral." CR>)>)>>

;"The half-built vault and its stones: scenery."
<OBJECT HALL-VAULT
    (DESC "vaulted ceiling")
    (SYNONYM VAULT CEILING SCAFFOLDING STONE STONES ROOF)
    (ADJECTIVE VAULTED NUMBERED STACKED)
    (IN GREAT-HALL)
    (FLAGS NDESCBIT)
    (TEXT "Every stone of the finished half is cut to a curve no two share;
every stone of the unfinished half is numbered in chalk, waiting for its place.
The work stopped mid-sentence.")
    (ACTION FEATURE-F)>

;"The Foreman (P5). The pattern for every person in the game: handle what
  he cares about, then hand everything else to PERSON-F. LDESC is how he
  appears in the room; TEXT is what EXAMINE shows."
<OBJECT FOREMAN
    (DESC "Foreman")
    (SYNONYM FOREMAN MAN APRON)
    (ADJECTIVE GREY WHISKERED)
    (IN GREAT-HALL)
    (FLAGS PERSONBIT)
    (LDESC "The Foreman is here, measuring a joint that is already perfect.")
    (TEXT "A broad, grey-whiskered man in a canvas apron, chalk-dusted to the
elbows. He is checking the joint between two stones with a feeler gauge and the
expression of a man reading a letter from an old friend.")
    (NO-ANSWER "The Foreman considers this, then considers the joint again.
\"Can't say.\"")
    (NO-INTEREST "The Foreman glances at it. \"Very nice.\"")
    (ACTION FOREMAN-F)>

;"The Foreman's routine, clause by clause:
    M-WINNER            the player ordered him about (FOREMAN, DANCE): he
                        declines. ARG is only M-WINNER for orders.
    SHOW/GIVE JOURNAL   P5: FOREMAN-CONFIDE with SHOWN true. <PRSI?
                        ,FOREMAN> makes sure he is the one being shown, and
                        <PRSO? ,JOURNAL> that the journal is what is shown.
    SHOW/GIVE BLUEPRINT a line about Quill's drawing.
    TELL ... ABOUT      polite silence.
    anything but ASK    the shared PERSON-F.
    ASK FOREMAN ABOUT   each ABOUT? clause tests the topic words; the first
                        to match answers. Asking about Quill (or his
                        apprentice, or the journal) also confides -- P5
                        without the journal.
    ELSE                PERSON-F's in-character 'Can't say.'
  The ;'ASK FOREMAN ABOUT ...' line inside the COND is a comment between
  two clauses; the compiler skips it."
<ROUTINE FOREMAN-F ("OPT" ARG)
    <COND (<==? .ARG ,M-WINNER>
           <TELL "\"I take my orders from one man,\" says the Foreman, \"and
he's been dead nine years.\"" CR>)
          (<AND <VERB? SHOW GIVE> <PRSI? ,FOREMAN> <PRSO? ,JOURNAL>>
           <FOREMAN-CONFIDE T>)
          (<AND <VERB? SHOW GIVE> <PRSI? ,FOREMAN> <PRSO? ,BLUEPRINT>>
           <TELL "\"His drawing,\" says the Foreman, without surprise. \"He drew
the house last. Like signing a letter.\"" CR>)
          (<VERB? TELL-ABOUT>
           <TELL "He listens politely, the way stone listens to rain." CR>)
          (<NOT <VERB? ASK-ABOUT>>
           <PERSON-F .ARG>)
          ;"ASK FOREMAN ABOUT ...: test the topic against each subject."
          (<ABOUT? ,W?ARCHITECT ,W?QUILL ,W?AMBROSE ,W?APPRENTICE ,W?JOURNAL
                   ,W?MASTER>
           <FOREMAN-CONFIDE <>>)
          (<ABOUT? ,W?LIFT ,W?STEAM ,W?CRYSTAL ,W?CRYSTALS>
           <TELL "\"Steam and crystal. He never trusted either on its own.\"" CR>)
          (<ABOUT? ,W?WATER ,W?SPRINGS ,W?SPRING ,W?PUMP ,W?WHEEL ,W?PASSAGE>
           <TELL "\"The old water wants to go back where it came from. The new
pump only helps it on its way.\"" CR>)
          (<ABOUT? ,W?MIRROR ,W?LIGHT ,W?SUN ,W?DAYLIGHT>
           <TELL "\"The light comes down from the world,\" he says. \"He always
said you must point it where the day starts.\"" CR>)
          (<ABOUT? ,W?FORK ,W?STONES ,W?PEDESTAL>
           <TELL "\"It's for the stones. You'll know.\"" CR>)
          (<ABOUT? ,W?COUNTER ,W?SHIFTING ,W?DOOR ,W?ARCH ,W?ROOM>
           <TELL "\"Patience. Same as the garden. Same as everything he
built.\"" CR>)
          (<ABOUT? ,W?INSPECTOR ,W?WOMAN ,W?FORMS>
           <TELL "\"Her? Been here three seasons now. Nice woman.
Can't find the form for any of it.\"" CR>)
          (<ABOUT? ,W?MESSENGER ,W?FIGURE>
           <TELL "\"Comes and goes. I've never seen the face.\"" CR>)
          (<ABOUT? ,W?LANTERNLESS>
           <TELL "He looks at you sharply. \"Where did you hear that word?\" He
does not wait for an answer, and he does not give one." CR>)
          (<ABOUT? ,W?HALL ,W?WORK ,W?SITE ,W?ACOUSTICS>
           <TELL "\"Listen.\" He taps a stone with his hammer, and the hall sings
the note back to you from every direction at once. \"That's not luck.\"" CR>)
          (ELSE <PERSON-F .ARG>)>>

;"The confidence he shares, reached by SHOW/GIVE JOURNAL (SHOWN is true) or
  by asking about Quill (SHOWN is false).

  FOREMAN-HELPED makes it happen once: the first COND prints a short reply
  and returns. Otherwise: set the flag, MOVE the tuning fork (until now
  nowhere) into the player's hands, score P5, and print. The speech is
  stitched together: the opening differs with SHOWN, the rest is shared,
  so the one TELL after the COND finishes either version."
<ROUTINE FOREMAN-CONFIDE (SHOWN)
    <COND (,FOREMAN-HELPED
           <TELL "\"I've told you what I know,\" says the Foreman. \"The rest is
further down.\"" CR>
           <RTRUE>)>
    <SETG FOREMAN-HELPED T>
    <MOVE ,TUNING-FORK ,WINNER>
    <AWARD-POINTS 5 ,ACH?FOREMAN>
    <COND (.SHOWN
           <TELL "The Foreman takes the journal from you, turns three pages, and
stops. For a long moment the only sound in the hall is the hall, listening.|
|
\"His hand,\" he says at last. \"I'd know it anywhere.">)
          (ELSE
           <TELL "The Foreman lays down his gauge. For a long moment the only
sound in the hall is the hall, listening.|
|
\"Quill,\" he says at last. \"Ambrose Quill.">)>
    <TELL " I was his apprentice, you know. Forty years. I carried his levels
and I learned his numbers, and when he went I stayed to finish what I could.\"
From his apron pocket he draws a steel tuning fork, its tines etched with tiny
spirals. \"You'll be wanting this further down. He made it to answer the
stones.\" He folds your fingers round it. \"And the springs: the old water
wants to go back where it came from. The new pump only helps it on its
way.\"" CR>>

;"P8's tool, given by the Foreman. STRIKE FORK is the SOUND action (section 8)."
<OBJECT TUNING-FORK
    (DESC "tuning fork")
    (SYNONYM FORK TINES)
    (ADJECTIVE STEEL TUNING)
    (FLAGS TAKEBIT)
    (TEXT "A steel tuning fork, heavier than it looks, its tines etched with
tiny spirals. Struck, it would give a single pure note.")
    (ACTION TUNING-FORK-F)>

;"The fork's routine, which carries P8's last step. The first clause is a
  guard: unless the action is SOUND (STRIKE, RING...) or ATTACK and the
  fork is the thing being struck, return false and let zillib handle it --
  EXAMINE FORK, for instance, falls through to its TEXT. Then:
    not in the Resonance Chamber -> a pure note, nothing more.
    already done                 -> the stones hum along.
    crystal not on the pedestal  -> the note fades.
    otherwise                    -> RESONANCE-DONE, P8 scored, the north
                                    wall opens."
<ROUTINE TUNING-FORK-F ()
    <COND (<NOT <AND <VERB? SOUND ATTACK> <PRSO? ,TUNING-FORK>>> <RFALSE>)
          (<N==? ,HERE ,RESONANCE-CHAMBER>
           <TELL "The fork gives a pure, thin note that dies away unremarked. It
was made for some other room." CR>)
          (,RESONANCE-DONE
           <TELL "The fork sings, and the stones hum along, contentedly. The way
north is already open." CR>)
          (<NOT <IN? ,CRYSTAL ,PEDESTAL>>
           <TELL "The fork's note rises, and the standing stones stir in their
ring -- but nothing on the pedestal carries the note to them, and it fades." CR>)
          (ELSE
           <SETG RESONANCE-DONE T>
           <AWARD-POINTS 5 ,ACH?RESONANCE>
           <TELL "You strike the fork against the pedestal's edge and hold it
up. A pure, thin note rises -- and the crystal answers it. Light pulses out of
the crystal in time with the note, and one by one the standing stones take up
the tone, each groove singing a little lower than the last, until the whole
ring rings like a bell the size of a church. Dust sifts from the dome. Then,
with a sound like a great breath let out, the north wall of the chamber slides
apart." CR>)>>

;"--- 13. Foreman's Hut (optional: the Inspector) --------------------------------"

;"An optional room (no puzzle): the Inspector's hut, north of the Great
  Hall, with one exit back."
<ROOM FOREMANS-HUT
    (DESC "Foreman's Hut")
    (IN ROOMS)
    (LDESC "A timber site hut, the kind that stands beside every building
project on earth, transported somehow a quarter of a mile underground. It holds
a desk, a kettle, a calendar stopped at a month nine years ago, and a stack of
forms tall enough to need its own planning permission. The door is south.")
    (SOUNDS "The scratch of a pencil, and a kettle that will never boil.")
    (SOUTH TO GREAT-HALL)
    (FLAGS LIGHTBIT)>

;"The hut's desk, kettle, calendar and forms: one scenery object. Its DESK
  is a different object from the Study's desk, in a different room, so the
  parser never has to choose between them."
<OBJECT HUT-FURNITURE
    (DESC "hut furniture")
    (SYNONYM DESK KETTLE CALENDAR FORMS FORM STACK PAPERWORK)
    (IN FOREMANS-HUT)
    (FLAGS NDESCBIT)
    (TEXT "The calendar has a ring round one date nine years ago, and a single
word: GONE. The forms are all addressed to the county. You suspect they are
addressed to you.")
    (ACTION FEATURE-F)>

;"The Inspector. PERSONBIT makes her a person; FEMALEBIT tells zillib to
  call her 'her'; VOWELBIT gives 'an Inspector'. LDESC is her line in the
  room description; TEXT is what EXAMINE shows. NO-ANSWER and NO-INTEREST
  are the lines the shared PERSON-F uses for her."
<OBJECT INSPECTOR
    (DESC "Inspector")
    (SYNONYM INSPECTOR WOMAN OFFICIAL RAINCOAT BADGE LANYARD CLIPBOARD)
    (ADJECTIVE THIN)
    (IN FOREMANS-HUT)
    (FLAGS PERSONBIT FEMALEBIT VOWELBIT)
    (LDESC "The Inspector sits at the desk, filling in a form in triplicate.")
    (TEXT "A thin woman in a raincoat and lanyard, writing on a clipboard with a
pencil worn to a stub. Her badge reads COUNTY BUILDING INSPECTORATE. By the
height of the forms, she has been here for some time.")
    (NO-ANSWER "\"You'd have to put that in writing,\" says the Inspector, without
looking up.")
    (NO-INTEREST "\"I'll need that in triplicate,\" says the Inspector.")
    (ACTION INSPECTOR-F)>

;"The Inspector. Anything but ASK ABOUT goes to the shared PERSON-F (which
  uses her NO-ANSWER and NO-INTEREST lines). ABOUT? checks the topic words:
  asking about irregular building practices is a lore point."
<ROUTINE INSPECTOR-F ("OPT" ARG)
    <COND (<OR .ARG <NOT <VERB? ASK-ABOUT>>> <PERSON-F .ARG>)
          (<ABOUT? ,W?IRREGULAR ,W?BUILDING ,W?PRACTICES ,W?PRACTICE>
           <AWARD-POINTS 2 ,ACH?LORE-FORMS>
           <TELL "\"Irregular,\" the Inspector repeats, and lays her pencil down
for the first time. \"I have been here nine months. I have measured every wall
on this site. They are all correct. Not within tolerance -- correct. Do you
know what that does to a person, finding nothing wrong? I have filed four
hundred and twelve forms.\" She picks the pencil up again. \"There is no form
for this,\" she says quietly, and begins another." CR>)
          (<ABOUT? ,W?FOREMAN>
           <TELL "\"Helpful man. Answers every question with a different
question.\"" CR>)
          (<ABOUT? ,W?QUILL ,W?ARCHITECT ,W?AMBROSE>
           <TELL "\"Deceased. I have the certificate. I have filed it twice.\"" CR>)
          (<ABOUT? ,W?FORM ,W?FORMS>
           <TELL "She hands you one. It is Form 114 (Supplementary): Declaration
of Unaccountable Features. Every box has been ticked. You hand it back." CR>)
          (<ABOUT? ,W?COUNTY ,W?DEMOLITION ,W?SURVEY>
           <TELL "\"They sent you too? They always send someone. Mind the
paperwork.\"" CR>)
          (ELSE <PERSON-F .ARG>)>>

;"--- 10. Spring Gallery --------------------------------------------------------"

;"The two water machines (P6). No LDESC: SPRING-GALLERY-F describes the
  pool, which drains once the puzzle is solved."
<ROOM SPRING-GALLERY
    (DESC "Spring Gallery")
    (IN ROOMS)
    (SOUNDS "Water, in every register: drip, trickle, rush.")
    (NORTH TO SURVEY-CHAMBER)
    (EAST TO FLOODED-PASSAGE)
    (FLAGS LIGHTBIT)
    (ACTION SPRING-GALLERY-F)>

;"M-LOOK only: a description in three TELLs, the middle one chosen by
  PASSAGE-DRAINED."
<ROUTINE SPRING-GALLERY-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "Water is everywhere here: dripping from the ceiling, running
in channels along the walls">
           <COND (,PASSAGE-DRAINED
                  <TELL ", and draining away eastward with a cheerful gurgle">)
                 (ELSE
                  <TELL ", and gathering in a dark, still pool at the gallery's
eastern end">)>
           <TELL ". Two machines face each other across the floor, centuries
apart. One is a great bronze wheel, green with age, set into the wall of an
ancient carved waterway; the other is a modern electric pump, yellow and black,
its hose snaking off to the east. The survey chamber lies north, and the
gallery runs east into the flooded passage." CR>)>>

;"The ancient half of P6: the bronze wheel and its sluice."
<OBJECT BRONZE-WHEEL
    (DESC "bronze wheel")
    (SYNONYM WHEEL SLUICE WATERWAY)
    (ADJECTIVE BRONZE GREAT ANCIENT CARVED)
    (IN SPRING-GALLERY)
    (FLAGS NDESCBIT)
    (ACTION BRONZE-WHEEL-F)>

;"P6, the ancient half: TURN the wheel to open the old sluice (WHEEL-TURNED).
  CHECK-SPRINGS drains the passage once the pump is running too."
<ROUTINE BRONZE-WHEEL-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A spoked bronze wheel, taller than you, worked into the mouth
of an ancient carved waterway. ">
           <COND (,WHEEL-TURNED
                  <TELL "It has been turned; the old sluice stands open." CR>)
                 (ELSE <TELL "Its sluice is shut." CR>)>)
          (<VERB? TURN PUSH PULL>
           <COND (,WHEEL-TURNED
                  <TELL "The wheel has turned as far as it will go; the old
sluice stands open." CR>
                  <RTRUE>)>
           <SETG WHEEL-TURNED T>
           <TELL "You put your weight against the bronze wheel. For a moment
nothing; then, with a groan like a ship's timbers, it turns, and deep in the
old waterway a stone sluice grinds open. Water begins to run along the channel
-- not toward the pool, but away from it, back into the rock." CR>
           <COND (<NOT <CHECK-SPRINGS>>
                  <TELL CR "But the pool barely stirs. The old waterway cannot
carry it all alone." CR>)>
           <RTRUE>)
          (<VERB? TAKE>
           <TELL "It weighs as much as a small carriage." CR>)>>

;"DEVICEBIT makes TURN ON / TURN OFF work (and SWITCH ON / OFF, section 8);
  the library keeps ONBIT.
  We intercept TURN-ON to add our own text and to check the springs."
<OBJECT PUMP
    (DESC "electric pump")
    (SYNONYM PUMP HOSE SWITCH)
    (ADJECTIVE MODERN ELECTRIC YELLOW BLACK)
    (IN SPRING-GALLERY)
    (FLAGS NDESCBIT DEVICEBIT VOWELBIT)
    (ACTION PUMP-F)>

;"The pump's routine:
    EXAMINE          says whether it is on, from ONBIT.
    TURN-ON (off)    set ONBIT ourselves, print, and ask CHECK-SPRINGS;
                     <RTRUE> so zillib's own 'You switch on...' does not
                     follow. Turning it on when it is already on does not
                     match (the AND fails) and falls through to zillib's
                     'It's already on.'
    TURN-OFF         refused once the passage is drained (so it stays
                     drained); otherwise clear ONBIT.
    TAKE             bolted down."
<ROUTINE PUMP-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A modern site pump, yellow and black, stencilled PROPERTY OF
QUILL & APPRENTICE. Its switch is ">
           <COND (<FSET? ,PUMP ,ONBIT>
                  <TELL "on, and it hums industriously." CR>)
                 (ELSE <TELL "off." CR>)>)
          (<AND <VERB? TURN-ON> <NOT <FSET? ,PUMP ,ONBIT>>>
           <FSET ,PUMP ,ONBIT>
           <TELL "The pump coughs, catches, and settles into an industrious
hum." CR>
           <COND (<NOT <CHECK-SPRINGS>>
                  <TELL CR "The hose twitches, but the pool only stirs: the pump
is pushing the water round in a circle, with nowhere for it to go." CR>)>
           <RTRUE>)
          (<AND <VERB? TURN-OFF> ,PASSAGE-DRAINED>
           <TELL "Best leave it running; you would rather the passage stayed
drained while you are on the far side of it." CR>)
          (<AND <VERB? TURN-OFF> <FSET? ,PUMP ,ONBIT>>
           <FCLEAR ,PUMP ,ONBIT>
           <TELL "The pump shudders and falls silent." CR>)
          (<VERB? TAKE>
           <TELL "It is bolted to the floor, presumably by someone who knew
surveyors." CR>)>>

;"--- 11. Flooded Passage -------------------------------------------------------"

;"The flooded passage. EAST is a conditional exit: it goes to the Mirror
  Gallery only while the global PASSAGE-DRAINED is true; otherwise the
  ELSE string is printed and the player stays."
<ROOM FLOODED-PASSAGE
    (DESC "Flooded Passage")
    (IN ROOMS)
    (WEST TO SPRING-GALLERY)
    (EAST TO MIRROR-GALLERY IF PASSAGE-DRAINED ELSE "The water is chest-deep and
very cold. You decline, on behalf of your notebook.")
    (FLAGS LIGHTBIT)
    (ACTION FLOODED-PASSAGE-F)>

;"What you hear here depends on the puzzle, so instead of a fixed SOUNDS
  property this room answers LISTEN itself, in M-BEG."
<ROUTINE FLOODED-PASSAGE-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <COND (,PASSAGE-DRAINED
                  <TELL "The passage floor is wet stone, still glistening, and
drains gurgle contentedly along its edges. Eastward, a silver light beckons; the
spring gallery is back to the west." CR>)
                 (ELSE
                  <TELL "The passage slopes down into black water, perfectly
still and very cold; your breath steams above it. Forty feet to the east, on
the far side, a faint silver light shows. The spring gallery is back to the
west." CR>)>)
          (<AND <==? .RARG ,M-BEG> <VERB? LISTEN>>
           <COND (,PASSAGE-DRAINED <TELL "Drains, gurgling with satisfaction." CR>)
                 (ELSE <TELL "Nothing. Still water makes no sound at all." CR>)>)>>

;"The water. NARTICLEBIT: 'water', not 'a water'."
<OBJECT FLOOD-WATER
    (DESC "water")
    (SYNONYM WATER POOL FLOOD DRAINS DRAIN)
    (ADJECTIVE BLACK)
    (IN FLOODED-PASSAGE)
    (FLAGS NDESCBIT NARTICLEBIT)
    (ACTION FLOOD-WATER-F)>

;"The flood water: its description follows PASSAGE-DRAINED, and ENTER it
  means walking east (which the exit refuses until it is drained)."
<ROUTINE FLOOD-WATER-F ()
    <COND (<VERB? EXAMINE>
           <COND (,PASSAGE-DRAINED <TELL "Only puddles, and they are leaving." CR>)
                 (ELSE <TELL "Black, still and cold enough to stop the heart of a
less well-paid surveyor." CR>)>)
          (<VERB? DRINK> <TELL "It tastes of iron and a very long time." CR>)
          (<VERB? ENTER> <DO-WALK ,P?EAST>)
          (ELSE <FEATURE-F>)>>

;"--- 12. Mirror Gallery --------------------------------------------------------"

;"The mirror gallery (P7). DOWN is conditional on STAIRS-OPEN, which taking
  the crystal sets. The description is built by MIRROR-GALLERY-F."
<ROOM MIRROR-GALLERY
    (DESC "Mirror Gallery")
    (IN ROOMS)
    (SOUNDS "A high, almost inaudible singing from the silver walls, like a wet
finger on the rim of a glass.")
    (WEST TO FLOODED-PASSAGE)
    (DOWN TO VAULT-ANTECHAMBER IF STAIRS-OPEN ELSE "The floor is solid stone.
Mostly.")
    (FLAGS LIGHTBIT)
    (ACTION MIRROR-GALLERY-F)>

;"M-LOOK only. The description names the mirror's current facing, read
  from COMPASS-NAMES with MIRROR-FACING, then describes the socket in one
  of three states (crystal in it, crystal taken, never grown) and adds the
  stairs once they are open."
<ROUTINE MIRROR-GALLERY-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "A tall, narrow gallery, its walls sheathed in polished silver.
A shaft bored through hundreds of feet of rock lets down a single pencil of
daylight from the world above, which falls onto a great mirror mounted on a
pivot in the middle of the floor. The mirror faces "
                 <GET ,COMPASS-NAMES ,MIRROR-FACING>
                 ". On the far east wall, at head height, is a socket of cut
glass">
           <COND (<IN? ,CRYSTAL ,CRYSTAL-SOCKET>
                  <TELL " in which a crystal blazes with captured daylight">)
                 (,STAIRS-OPEN <TELL ", empty now but still faintly warm">)
                 (ELSE <TELL ", empty and dark">)>
           <TELL ". The way back is west">
           <COND (,STAIRS-OPEN
                  <TELL ", and narrow stairs lead down from the foot of the
mirror">)>
           <TELL "." CR>)>>

;"The mirror on its pivot: the object P7 is solved with."
<OBJECT GREAT-MIRROR
    (DESC "great mirror")
    (SYNONYM MIRROR PIVOT FRAME DISC)
    (ADJECTIVE GREAT SILVERED BRONZE)
    (IN MIRROR-GALLERY)
    (FLAGS NDESCBIT)
    (ACTION GREAT-MIRROR-F)>

;"P7: each TURN swings the mirror a quarter turn (MIRROR-FACING 0-3, north,
  east, south, west; MOD wraps it round). Facing east, onto the crystal
  socket, grows the crystal; the other facings say where the beam lands."
<ROUTINE GREAT-MIRROR-F ()
    <COND (<VERB? EXAMINE>
           <TELL "A disc of silvered glass as tall as a door, in a bronze frame
that turns on a pivot. It faces " <GET ,COMPASS-NAMES ,MIRROR-FACING>
                 ", throwing the daylight that way." CR>)
          (<VERB? TURN PUSH PULL>
           <SETG MIRROR-FACING <MOD <+ ,MIRROR-FACING 1> 4>>
           <TELL "You lean on the frame and the great mirror swings a quarter
turn on its pivot. It now faces " <GET ,COMPASS-NAMES ,MIRROR-FACING> ", and ">
           <COND (<==? ,MIRROR-FACING 0>
                  <TELL "the beam paints a bright, useless oval on the north
wall." CR>)
                 (<==? ,MIRROR-FACING 2>
                  <TELL "the beam splashes across the south wall and the silver
throws it back, dazzled." CR>)
                 (<==? ,MIRROR-FACING 3>
                  <TELL "the beam runs back down the passage toward the
water." CR>)
                 ;"Facing 1: east, where the crystal socket is."
                 (<OR <IN? ,CRYSTAL ,CRYSTAL-SOCKET> ,STAIRS-OPEN>
                  <TELL "the beam strikes the crystal socket on the east
wall." CR>)
                 (ELSE
                  <MOVE ,CRYSTAL ,CRYSTAL-SOCKET>
                  <TELL "the beam strikes the crystal socket on the east wall
full on. For a heartbeat the cut glass simply shines; then light seems to pour
into it and stay there, thickening, until a crystal the size of your fist has
grown in the socket, blazing with captured daylight." CR>)>)
          (<VERB? TAKE>
           <TELL "It is the size of a door and fixed to its pivot." CR>)>>

;"The pencil of daylight: scenery."
<OBJECT LIGHT-SHAFT
    (DESC "shaft of daylight")
    (SYNONYM SHAFT DAYLIGHT LIGHT BEAM PENCIL SUNLIGHT)
    (IN MIRROR-GALLERY)
    (FLAGS NDESCBIT)
    (TEXT "Real daylight, hundreds of feet from the nearest sky. It falls
straight onto the mirror, which sends it wherever it is pointed.")
    (ACTION FEATURE-F)>

;"The glass socket on the east wall: an open container (CONTBIT OPENBIT)
  that holds up to SIZE 5 in all. The crystal appears in it when
  GREAT-MIRROR-F moves it there. No ACTION: zillib's defaults do."
<OBJECT CRYSTAL-SOCKET
    (DESC "crystal socket")
    (SYNONYM SOCKET WALL)
    (ADJECTIVE CUT GLASS CRYSTAL EAST)
    (IN MIRROR-GALLERY)
    (CAPACITY 5)
    (FLAGS NDESCBIT CONTBIT OPENBIT)
    (TEXT "A socket of cut glass, shaped like a cupped hand, set into the east
wall at head height.")>

;"The crystal. No IN: it does not exist until the mirror grows it. (SIZE 1)
  makes it small by zillib's measure (the default is 5); it matters only if
  the player puts it somewhere through zillib's own PUT, since the mirror
  and the pedestal MOVE it directly. LIGHTBIT makes it a light source, as
  its text says (every room here is lit anyway)."
<OBJECT CRYSTAL
    (DESC "glowing crystal")
    (SYNONYM CRYSTAL GEM)
    (ADJECTIVE GLOWING)
    (SIZE 1)
    (FLAGS TAKEBIT LIGHTBIT)
    (TEXT "A crystal the size of your fist, grown from daylight. It is warm,
and it glows -- not brightly, but patiently, like something that intends to go
on doing so for a very long time.")
    (ACTION CRYSTAL-F)>

;"Taking the crystal the first time opens the stairs. TRY-TAKE does the
  library's normal checks and moves it; the T argument keeps it quiet so
  that we can print our own message instead."
<ROUTINE CRYSTAL-F ()
    <COND (<AND <VERB? TAKE> <NOT ,STAIRS-OPEN>>
           <COND (<TRY-TAKE ,CRYSTAL T>
                  <SETG STAIRS-OPEN T>
                  <AWARD-POINTS 5 ,ACH?MIRROR>
                  <TELL "The crystal comes away warm in your hand, still glowing.
At the same moment the floor at the mirror's foot splits along a seam you had
not noticed, and folds down into a flight of narrow stairs, descending." CR>)>
           <RTRUE>)>>


;"============================================================================
  7. CHAPTER THREE: LEGACY OF THE DEEP  --  the prototype vault
 ----------------------------------------------------------------------------
  Rooms: Vault Antechamber, Shifting Room, Resonance Chamber, Final Chamber,
  and (optional) the Messenger's Alcove. Puzzle P8 (shifting room +
  resonance), then the win. The Shifting Room is driven by an INTERRUPT.

  EXITS
    Vault Antechamber  UP Mirror Gallery; EAST Messenger's Alcove; NORTH
                       (PER ENTER-SHIFTING-ROOM) always the Shifting Room,
                       restarting its cycle.
    Messenger's Alcove WEST Vault Antechamber.
    Shifting Room      SOUTH Vault Antechamber; NORTH (PER SHIFT-NORTH-F)
                       the Resonance Chamber, only when the counter shows 13.
    Resonance Chamber  SOUTH Shifting Room; NORTH Final Chamber IF
                       RESONANCE-DONE.
    Final Chamber      SOUTH Resonance Chamber.

  HOW THE CHAPTER PLAYS
    North of the antechamber the Shifting Room's arch walks round the walls
    while a counter climbs the Fibonacci numbers; the shutter behind it is
    down only when the counter shows 13 -- the garden's lesson, patience.
    WAIT four times, then go north. In the Resonance Chamber the crystal
    goes on the pedestal and the Foreman's fork wakes the stones. The
    Final Chamber holds the master blueprint: reading it ends the game.

  ZIL MET FOR THE FIRST TIME IN THIS CHAPTER: QUEUE and DEQUEUE (an
  interrupt), calling CLOCKER, RETURN with a value, the GENERIC property,
  and JIGS-UP.
 ============================================================================"

;"--- 14. Vault Antechamber ----------------------------------------------------"

;"The first room of chapter three. Its NORTH exit is a routine
  (ENTER-SHIFTING-ROOM) so that walking north can also restart the
  Shifting Room's machinery."
<ROOM VAULT-ANTECHAMBER
    (DESC "Vault Antechamber")
    (IN ROOMS)
    (LDESC "The temperature has changed again. After the cold of the shaft and
the wet of the springs, the air here is warm, dry and perfectly still, like the
air inside a sealed letter. The walls are dense with formulas cut in a fine,
sure hand: equations of stress and load that begin sensibly and end somewhere
you cannot follow. Stairs lead up to the mirror gallery. A plain doorway opens
north, and a low alcove east.")
    (SOUNDS "Nothing at all. The silence has a texture, like felt.")
    (UP TO MIRROR-GALLERY)
    (EAST TO MESSENGERS-ALCOVE)
    (NORTH PER ENTER-SHIFTING-ROOM)
    (FLAGS LIGHTBIT)
    (ACTION VAULT-ANTECHAMBER-F)>

;"M-ENTER: the Chapter Three banner, the first time the player arrives."
<ROUTINE VAULT-ANTECHAMBER-F (RARG)
    <COND (<==? .RARG ,M-ENTER> <BEGIN-CHAPTER 3>)>>

;"Entering the Shifting Room starts its cycle afresh, so the puzzle behaves
  the same way every time (and the walkthrough's four WAITs always work) --
  until you have passed through it, after which the room stands still with
  the way north open. DEQUEUE first, so the interrupt can never be queued
  twice.

  <RETURN ,SHIFTING-ROOM> leaves the routine at once with that value: once
  the room is stilled there is nothing to reset. Otherwise the step goes
  back to 1, the interrupt is (re)queued with -1 (every turn until
  dequeued), and the bare ,SHIFTING-ROOM at the end is the routine's value:
  the room zillib's WALK moves the player to."
<ROUTINE ENTER-SHIFTING-ROOM ()
    <COND (,SHIFT-STILLED <RETURN ,SHIFTING-ROOM>)>
    <SETG SHIFT-STEP 1>
    <DEQUEUE ,I-SHIFTING-ROOM>
    <QUEUE ,I-SHIFTING-ROOM -1>
    ,SHIFTING-ROOM>

;"The formula-covered walls: readable scenery, worth a lore point."
<OBJECT FORMULA-WALL
    (DESC "formula wall")
    (SYNONYM FORMULA FORMULAS FORMULAE EQUATION EQUATIONS WALL WALLS)
    (ADJECTIVE FORMULA)
    (IN VAULT-ANTECHAMBER)
    (FLAGS NDESCBIT READBIT)
    (ACTION FORMULA-WALL-F)>

;"Lore (2 points): checking the formula wall."
<ROUTINE FORMULA-WALL-F ()
    <COND (<VERB? EXAMINE READ>
           <AWARD-POINTS 2 ,ACH?LORE-WALL>
           <TELL "You follow one equation from the left-hand wall. It begins as
an ordinary calculation of the load on an arch. By the third line the arch is
carrying the weight of the arch above it; by the ninth it is carrying itself;
by the last it appears to be carrying the mountain. At the foot, in the same
hand: \"Checked. A.Q.\"|
|
You are a professional, so you check it too. It works. You wish it didn't." CR>)
          (ELSE <FEATURE-F>)>>

;"--- 18. Messenger's Alcove (optional: the Messenger) --------------------------"

;"An optional room (no puzzle) east of the antechamber: the Messenger and
  the coded note."
<ROOM MESSENGERS-ALCOVE
    (DESC "Messenger's Alcove")
    (IN ROOMS)
    (LDESC "A small, low alcove with a stone bench, lit by a lamp that burns
steadily on no fuel you can see. It feels like a waiting room: the kind where
the appointment was made a long time ago. The antechamber is back to the
west.")
    (SOUNDS "The lamp makes a tiny sound, like someone not quite breathing.")
    (WEST TO VAULT-ANTECHAMBER)
    (FLAGS LIGHTBIT)>

;"The fuel-less lamp and the bench: scenery."
<OBJECT ALCOVE-LAMP
    (DESC "lamp")
    (SYNONYM LAMP BENCH FLAME WICK)
    (ADJECTIVE STONE)
    (IN MESSENGERS-ALCOVE)
    (FLAGS NDESCBIT)
    (TEXT "The lamp has a wick, a flame and no reservoir. The bench is cold,
and polished by a great deal of waiting.")
    (ACTION FEATURE-F)>

;"The Messenger has nothing special to say, so the shared PERSON-F is the
  whole of the Messenger's ACTION: only the properties differ."
<OBJECT MESSENGER
    (DESC "Messenger")
    (SYNONYM MESSENGER FIGURE CLOAK HOOD)
    (ADJECTIVE CLOAKED HOODED)
    (IN MESSENGERS-ALCOVE)
    (FLAGS PERSONBIT)
    (LDESC "The Messenger sits on the bench, waiting with the patience of
someone who has delivered this message many times.")
    (TEXT "A slight figure in a grey travelling cloak, hood up, face in shadow.
Their boots are dusty with a kind of dust you have never seen, pale as flour,
from somewhere a long way off.")
    (NO-ANSWER "The Messenger says nothing at all, but taps the folded note on
the bench with one gloved finger.")
    (NO-INTEREST "The Messenger shakes their hooded head, very slightly.")
    (ACTION PERSON-F)>

;"The Messenger's note. FDESC is its line in the room until it is first
  picked up. TRYTAKEBIT stops the parser picking it up by itself for READ
  NOTE, so it can be read where it lies."
<OBJECT CODED-NOTE
    (DESC "folded note")
    (SYNONYM NOTE MESSAGE CODE WAX PAPER)
    (ADJECTIVE FOLDED CODED GREY)
    (IN MESSENGERS-ALCOVE)
    (FDESC "A folded note, sealed with grey wax, lies on the bench beside the
Messenger.")
    (FLAGS TAKEBIT READBIT TRYTAKEBIT)
    (ACTION CODED-NOTE-F)>

;"Lore (2 points): the Messenger's note, a Caesar cipher (shift 3) with the
  answer already pencilled in."
<ROUTINE CODED-NOTE-F ()
    <COND (<VERB? EXAMINE READ>
           <AWARD-POINTS 2 ,ACH?LORE-NOTE>
           <TELL "You break the grey seal. The note reads:|
|
    WKH OLJKW LV QHDUOB UHDGB|
|
Beneath it, in a different and rather impatient hand, someone has pencilled
the answer: THE LIGHT IS NEARLY READY.|
|
The Messenger gives a small nod, as if a delivery has finally been signed
for." CR>)>>

;"--- 15. Shifting Room  (P8, part one: the interrupt) --------------------------
  The room's arch travels round the walls a quarter turn per turn, and a
  counter climbs 1, 1, 2, 3, 5, 8, 13. Only at 13 does it stand north with
  the shutter down. Here is the timeline, which the walkthrough depends on:

    turn you arrive  : description shows step 1 (counter 1, 1; arch west);
                       the interrupt runs at the end of that turn -> step 2
    WAIT 1, 2, 3, 4  : steps 3, 4, 5, 6 -> counter 13, arch north, OPEN
    WAIT again       : the cycle starts over at step 1

  Once you have gone north through the open shutter, SHIFT-STILLED is set
  and the room stays as it was then -- arch north, way open -- on every
  later visit.

  <QUEUE ,I-SHIFTING-ROOM -1> (in ENTER-SHIFTING-ROOM) asks zillib's CLOCKER
  to call the routine at the end of every turn; -1 means 'until dequeued'.
  The interrupt dequeues itself as soon as the player is somewhere else."

<ROOM SHIFTING-ROOM
    (DESC "Shifting Room")
    (IN ROOMS)
    (SOUTH TO VAULT-ANTECHAMBER)
    (NORTH PER SHIFT-NORTH-F)
    (FLAGS LIGHTBIT)
    (ACTION SHIFTING-ROOM-F)>

;"The Shifting Room's routine, clause by clause:
    M-LOOK, stilled     the room at rest, the way north open.
    M-LOOK              the moving room: the counter (PRINT-COUNTER), the
                        arch's direction (ARCH-DIRECTION), and whether the
                        shutter is down (only at step 6).
    M-BEG + WAIT        replace WAIT: print our own line and run CLOCKER by
                        hand (see the comment inside), then <RTRUE> so
                        zillib's own WAIT never runs.
    M-BEG + LISTEN      a sound that depends on the state.
  Every other reason and action is false: business as usual."
<ROUTINE SHIFTING-ROOM-F (RARG)
    <COND (<AND <==? .RARG ,M-LOOK> ,SHIFT-STILLED>
           <TELL "A circular room whose walls have, at last, kept still. The
iron-framed arch that travelled round them stands to the north, and the stone
shutter behind it lies sunk in the floor: the way north is open. The brass
counter high on the wall rests at ">
           <PRINT-COUNTER>
           <TELL ", as if the room has finished with you. The plain doorway
south stays obligingly put." CR>)
          (<==? .RARG ,M-LOOK>
           <TELL "A circular room whose walls will not keep still. A single
iron-framed arch travels round them like the hand of a clock, a quarter turn at
a time, and the stone closes seamlessly behind it as it goes. High on the wall a
brass counter shows a column of numbers: ">
           <PRINT-COUNTER>
           <TELL ". The arch now stands to the " <ARCH-DIRECTION> ".">
           <COND (<==? ,SHIFT-STEP 6>
                  <TELL " Behind it the stone shutter has dropped away: the way
north is open.">)
                 (ELSE
                  <TELL " To the north, a stone shutter seals the only other
doorway.">)>
           <TELL " The plain doorway south, by which you came, stays obligingly
put." CR>)
          ;"WAIT is a 'game verb' in zillib: V-WAIT runs the clock itself, and
            the main loop does not. So when we replace WAIT's message here we
            must run the CLOCKER ourselves, or the room would never move."
          (<AND <==? .RARG ,M-BEG> <VERB? WAIT>>
           <COND (,SHIFT-STILLED
                  <TELL "You wait, but nothing moves: the room has stilled, its
arch standing north and the way open." CR>)
                 (ELSE
                  <TELL "You stand still and let the room do the moving." CR>)>
           <CLOCKER>
           <RTRUE>)
          ;"What you hear depends on the room's state, so (like the Flooded
            Passage) it answers LISTEN itself instead of a SOUNDS property."
          (<AND <==? .RARG ,M-BEG> <VERB? LISTEN>>
           <COND (,SHIFT-STILLED
                  <TELL "Nothing now. The grinding has stopped." CR>)
                 (ELSE
                  <TELL "Stone grinding on stone, patiently, like a mill that
has all the time in the world." CR>)>)>>

;"The interrupt routine. Returning true tells CLOCKER that it printed
  something (which also stops a multi-turn WAIT early)."
<ROUTINE I-SHIFTING-ROOM ()
    <COND (<N==? ,HERE ,SHIFTING-ROOM>
           <DEQUEUE ,I-SHIFTING-ROOM>
           <RFALSE>)
          (<==? ,SHIFT-STEP 6>
           <SETG SHIFT-STEP 1>
           <TELL CR "The counter rolls back to 1 with a weary clank, the shutter
grinds up again, and the arch slides back to the west to begin its round once
more." CR>
           <RTRUE>)>
    <SETG SHIFT-STEP <+ ,SHIFT-STEP 1>>
    <TELL CR "With a grinding of stone on stone, the arch slides a quarter turn
round the wall and comes to rest to the " <ARCH-DIRECTION> ". The counter
clicks: " N <GET ,FIBONACCI ,SHIFT-STEP>>
    <COND (<==? ,SHIFT-STEP 6>
           <TELL ". Behind the arch, with a boom you feel in your knees, the
stone shutter drops into the floor. The way north is open." CR>)
          (<==? ,SHIFT-STEP 2>
           <TELL ". The arch faces north, but the shutter behind it stays shut:
the counter, it seems, is not yet satisfied." CR>)
          (ELSE <TELL "." CR>)>
    <RTRUE>>

;"P8, part one: the Shifting Room's north exit opens only at step 6, when
  the counter shows 13 and the arch stands north. Passing sets SHIFT-STILLED
  so the room stops shifting behind you."
<ROUTINE SHIFT-NORTH-F ()
    <COND (<==? ,SHIFT-STEP 6>
           <SETG SHIFT-STILLED T>
           ,RESONANCE-CHAMBER)
          (ELSE
           <TELL "The stone shutter to the north is shut. The counter shows "
                 N <GET ,FIBONACCI ,SHIFT-STEP> ", and the arch stands to the "
                 <ARCH-DIRECTION> "." CR>
           <RFALSE>)>>

;"The brass counter: readable scenery that shows the sequence so far."
<OBJECT BRASS-COUNTER
    (DESC "brass counter")
    (SYNONYM COUNTER NUMBERS COLUMN CASE)
    (ADJECTIVE BRASS GLASS)
    (IN SHIFTING-ROOM)
    (FLAGS NDESCBIT READBIT)
    (ACTION BRASS-COUNTER-F)>

;"The counter shows the sequence so far (PRINT-COUNTER): the clue to wait
  for 13."
<ROUTINE BRASS-COUNTER-F ()
    <COND (<VERB? EXAMINE READ>
           <TELL "A brass counter in a glass case, showing a column of numbers: ">
           <PRINT-COUNTER>
           <TELL ". Each is the sum of the two above it." CR>)
          (ELSE <FEATURE-F>)>>

;"The arch (and the shutter, and the doorway): one object. VOWELBIT gives
  'an iron arch'. ENTER ARCH means NORTH."
<OBJECT MOVING-ARCH
    (DESC "iron arch")
    (SYNONYM ARCH ARCHWAY SHUTTER DOOR DOORWAY)
    (ADJECTIVE IRON STONE)
    (IN SHIFTING-ROOM)
    (FLAGS NDESCBIT VOWELBIT)
    (ACTION MOVING-ARCH-F)>

;"The arch: EXAMINE says where it stands now; ENTER means going north."
<ROUTINE MOVING-ARCH-F ()
    <COND (<VERB? EXAMINE>
           <TELL "The arch stands to the " <ARCH-DIRECTION> ". ">
           <COND (<==? ,SHIFT-STEP 6> <TELL "The north shutter is down." CR>)
                 (ELSE <TELL "The north shutter is shut." CR>)>)
          (<VERB? ENTER> <DO-WALK ,P?NORTH>)
          (ELSE <FEATURE-F>)>>

;"--- 16. Resonance Chamber  (P8, part two) -------------------------------------"

;"The ring of stones (P8, part two). NORTH is conditional on
  RESONANCE-DONE; the description comes from RESONANCE-CHAMBER-F."
<ROOM RESONANCE-CHAMBER
    (DESC "Resonance Chamber")
    (IN ROOMS)
    (SOUTH TO SHIFTING-ROOM)
    (NORTH TO FINAL-CHAMBER IF RESONANCE-DONE ELSE "The north wall is seamless
basalt.")
    (FLAGS LIGHTBIT)
    (ACTION RESONANCE-CHAMBER-F)>

;"M-LOOK: the description, with the crystal on the pedestal and the open
  north wall when they apply. M-BEG + LISTEN: the stones, waiting or
  humming."
<ROUTINE RESONANCE-CHAMBER-F (RARG)
    <COND (<==? .RARG ,M-LOOK>
           <TELL "A perfectly circular chamber under a low dome, so quiet that
you can hear your own pulse. A ring of grey standing stones surrounds a
pedestal of black basalt, each stone cut with a single deep groove at exactly
the same height.">
           <COND (<IN? ,CRYSTAL ,PEDESTAL>
                  <TELL " In the pedestal's cupped top the crystal glows.">)>
           <TELL " The shifting room is back to the south">
           <COND (,RESONANCE-DONE
                  <TELL ". The stones still hum, and the north wall stands open
on a further chamber">)>
           <TELL "." CR>)
          (<AND <==? .RARG ,M-BEG> <VERB? LISTEN>>
           <COND (,RESONANCE-DONE
                  <TELL "The stones, humming a chord you can feel in your
teeth." CR>)
                 (ELSE
                  <TELL "Your own pulse. Then, very faintly, the stones, waiting
to be asked." CR>)>)>>

;"The twelve stones: scenery."
<OBJECT STANDING-STONES
    (DESC "standing stones")
    (SYNONYM STONES STONE RING GROOVE GROOVES)
    (ADJECTIVE GREY STANDING)
    (IN RESONANCE-CHAMBER)
    (FLAGS NDESCBIT PLURALBIT)
    (TEXT "Twelve grey stones, each a little taller than you, each with one deep
groove cut round it like a tuning mark.")
    (ACTION FEATURE-F)>

;"The basalt pedestal: a surface (CONTBIT SURFACEBIT OPENBIT) that holds
  up to SIZE 10. PEDESTAL-F does the placing itself."
<OBJECT PEDESTAL
    (DESC "basalt pedestal")
    (SYNONYM PEDESTAL TOP)
    (ADJECTIVE BLACK BASALT CUPPED)
    (IN RESONANCE-CHAMBER)
    (CAPACITY 10)
    (FLAGS NDESCBIT CONTBIT SURFACEBIT OPENBIT)
    (TEXT "A pedestal of black basalt with a shallow, cupped top, about the size
of a fist.")
    (ACTION PEDESTAL-F)>

;"P8, part two: the crystal goes on the pedestal (PUT CRYSTAL ON or IN
  PEDESTAL). Striking the tuning fork then sings the stones awake.

  PUT CRYSTAL ON PEDESTAL: the pedestal is PRSI, so its routine runs
  before the crystal's and before zillib's own PUT-ON. It MOVEs the crystal
  itself and prints its own message; the TELL's true value stops zillib
  from moving it a second time. Anything else put on the pedestal is left
  to zillib."
<ROUTINE PEDESTAL-F ()
    <COND (<AND <VERB? PUT-ON PUT-IN> <PRSI? ,PEDESTAL> <PRSO? ,CRYSTAL>>
           <MOVE ,CRYSTAL ,PEDESTAL>
           <TELL "You set the crystal in the pedestal's cupped top. It fits
exactly, as if the hollow had been measured for it -- which, you suspect, it
was." CR>)
          (<VERB? TAKE PULL PUSH TURN> <FEATURE-F>)>>

;"--- 17. Final Chamber  (the win) ----------------------------------------------"

;"The last room: one exit, south, and the lectern with the master
  blueprint."
<ROOM FINAL-CHAMBER
    (DESC "Final Chamber")
    (IN ROOMS)
    (LDESC "The last room is small and plain, which after everything else is the
most startling thing about it. Lamplight from nowhere in particular falls on a
reading lectern of oak and brass, and on the lectern lies a great folded sheet:
the master blueprint. The way back is south.")
    (SOUNDS "Paper, very faintly, as if the blueprint were breathing.")
    (SOUTH TO RESONANCE-CHAMBER)
    (FLAGS LIGHTBIT)>

;"The lectern: a surface holding the master blueprint. Because it is a
  surface, the blueprint on it is in reach and in view."
<OBJECT LECTERN
    (DESC "lectern")
    (SYNONYM LECTERN)
    (ADJECTIVE READING OAK)
    (IN FINAL-CHAMBER)
    (CAPACITY 20)
    (FLAGS NDESCBIT CONTBIT SURFACEBIT OPENBIT)
    (TEXT "Oak and brass, at exactly the height of a man who spent his life
leaning over drawings.")
    (ACTION FEATURE-F)>

;"In here you carry one blueprint and another lies on the lectern. When the
  parser finds more than one match it asks each candidate's GENERIC routine
  to choose; this one picks the master blueprint whenever it is a candidate,
  so READ BLUEPRINT means the one you came for.

  zillib passes the table of candidates as TBL (unused here: the answer
  depends only on the room). Returning an object settles the question;
  returning false would let zillib ask 'Which do you mean...?' as usual,
  which is what happens anywhere else."
<ROUTINE BLUEPRINT-GENERIC-F (TBL)
    <COND (<==? ,HERE ,FINAL-CHAMBER> ,MASTER-BLUEPRINT)
          (ELSE <RFALSE>)>>

;"The master blueprint: IN LECTERN, NDESCBIT (the room text names it),
  READBIT, the same GENERIC as the mended blueprint, and the routine that
  ends the game."
<OBJECT MASTER-BLUEPRINT
    (DESC "master blueprint")
    (SYNONYM BLUEPRINT SHEET PLAN)
    (ADJECTIVE MASTER GREAT FOLDED)
    (IN LECTERN)
    (FLAGS NDESCBIT READBIT)
    (GENERIC BLUEPRINT-GENERIC-F)
    (ACTION MASTER-BLUEPRINT-F)>

;"Reading this is the winning move: print the revelation, then JIGS-UP ends
  the game. JIGS-UP prints its own last line, then PRINT-GAME-OVER (our
  replacement in section 3), then the final score.

  The long TELL is the revelation; the || in it are blank lines. JIGS-UP
  never returns: after the score it asks whether to restart, restore, undo
  or quit, and nothing after it would ever run. TAKE is refused (clipped down)."
<ROUTINE MASTER-BLUEPRINT-F ()
    <COND (<VERB? EXAMINE READ>
           <TELL "You unfold the master blueprint across the lectern, and the
first thing you understand is that it is not a plan of this place at all.|
|
This vault -- the lift, the springs, the mirror, the singing stones -- is drawn
small in one corner and labelled in Quill's hand: PROTOTYPE. PROVEN. The rest
of the enormous sheet is given over to something else: LOW MERIDIAN, a city cut
beneath the Saltmarsh Downs, forty miles east, its coordinates written in the
margin to the second of arc. You trace its great dome, its waterways, its lift
shafts falling level below level, its streets laid out to the same sequence as
the flower beds in the garden.|
|
In the deepest level is a sealed gallery, and beside it, in Quill's small and
untroubled hand: \"For the Lanternless. Do not open until the light is
ready.\"|
|
You do not know who the Lanternless are. Neither, you suspect, does anyone
alive.|
|
At the foot of the sheet the stages of the work are listed in columns, with
dates. The first several are ticked. The last tick is nine years old. The next
date is next spring.|
|
You take out your notebook. Under QUILLON HOUSE you write: No irregularities.
Then, after some thought, you add the only honest finding of your career:" CR CR>
           <JIGS-UP "    The architect's madness was a schedule.">)
          (<VERB? TAKE>
           <TELL "It is clipped to the lectern by four brass clips. Read it
where it lies." CR>)>>


;"============================================================================
  8. GRAMMAR  --  the game's own verbs
  ----------------------------------------------------------------------------
  zillib supplies the standard verbs (in its verbs.zil). A SYNTAX line maps
  a sentence pattern to an action routine (V-...). OBJECT is a noun phrase;
  (FIND flag) tells the parser what to guess when the player leaves the
  object out; (HAVE) means it must be held. TOPIC accepts any words at all.
  Object ACTION routines see the action first and can override any of these.

  THE ANATOMY OF A SYNTAX LINE
    <SYNTAX SET OBJECT TO OBJECT = V-SET-TO>
      SET              the verb word (first word of the command).
      OBJECT           a noun phrase: the first becomes PRSO, the second
                       PRSI.
      TO               a preposition, matched literally.
      = V-SET-TO       the action routine. Its name also names the action:
                       V-SET-TO is the action SET-TO, tested with
                       <VERB? SET-TO>, and its number is ,V?SET-TO (as in
                       <PERFORM ,V?SHOW ...>). A second routine after it
                       would be a PRE- routine, run before the objects'
                       ACTIONs (zillib's PUT ... ON has one).
    Options in brackets after an OBJECT:
      (FIND flag)      the flag the parser uses to guess an object the
                       player left out, and to prefer among several. It is
                       a hint, not a rule: other objects can still be named.
      (HAVE)           the object must be held, or the parser refuses.
      (HELD CARRIED ON-GROUND IN-ROOM)
                       where to look first: in the hands, inside something
                       carried, on the floor, in the room.
      (TAKE)           the parser may pick the object up first.
      (MANY)           ALL and lists are allowed.
      (TOUCH)          the object must be within reach.
    TOPIC in place of OBJECT takes any words at all, known or not, and
    leaves their positions in P-TOPIC-START and P-TOPIC-END.
    VERB-SYNONYM gives a verb more words; every SYNTAX line of the verb
    works with each of them.
    Several SYNTAX lines can share one action, as SOUND does below; the
    parser picks the line that best fits the words typed.
 ============================================================================"

;"SOUND: ring the bell, strike the chime, blow the horn, strike the fork.
  VERB-SYNONYM makes every listed word mean the same verb."
<SYNTAX RING OBJECT = V-SOUND>
<SYNTAX RING OBJECT ON OBJECT = V-SOUND>
<SYNTAX RING OBJECT AGAINST OBJECT = V-SOUND>
<SYNTAX RING OBJECT WITH OBJECT = V-SOUND>
<VERB-SYNONYM RING STRIKE SOUND TOLL PLAY TAP BANG BLOW>

;"The V- routines below are the default replies: each runs only when no
  object's ACTION has already answered the command."
<ROUTINE V-SOUND ()
    <COND (<FSET? ,PRSO ,PERSONBIT> <TELL "They would not thank you for it." CR>)
          (ELSE <TELL "You produce a dull, unmusical noise." CR>)>>

;"TURN on its own (zillib only has TURN ON and TURN OFF)."
<SYNTAX TURN OBJECT (TOUCH) = V-TURN>
<VERB-SYNONYM TURN ROTATE>

;"V-TURN: the default for TURN anything. The mirror, the wheel and the
  dials answer TURN in their own routines first."
<ROUTINE V-TURN ()
    <TELL "Nothing obvious happens." CR>>

;"TURN DIAL TO 8 / TURN DIAL TO SPIRAL: the same as SET ... TO ..."
<SYNTAX TURN OBJECT TO OBJECT = V-SET-TO>

;"SWITCH ON / SWITCH OFF. In zillib SWITCH is a VERB-SYNONYM of FLIP (FLIP
  PUMP toggles it), so new SYNTAX lines go on FLIP and SWITCH inherits them.
  They send zillib's own TURN-ON and TURN-OFF actions, so PUMP-F sees the same
  action whichever words were typed. KLUDGEBIT is the trick zillib uses for
  TURN PUMP ON: ON is parsed as a second, ignored object."
<SYNTAX FLIP ON OBJECT (FIND DEVICEBIT) (TOUCH) = V-TURN-ON>
<SYNTAX FLIP OBJECT (FIND DEVICEBIT) (TOUCH) ON OBJECT (FIND KLUDGEBIT) = V-TURN-ON>
<SYNTAX FLIP OFF OBJECT (FIND DEVICEBIT) (TOUCH) = V-TURN-OFF>
<SYNTAX FLIP OBJECT (FIND DEVICEBIT) (TOUCH) OFF OBJECT (FIND KLUDGEBIT) = V-TURN-OFF>

;"SET DIAL TO 8 / SET DIAL TO SPIRAL."
<SYNTAX SET OBJECT = V-SET>
<SYNTAX SET OBJECT TO OBJECT = V-SET-TO>
<VERB-SYNONYM SET ADJUST>

;"The defaults for SET and SET ... TO, reached only when the object named
  is not one of the dials."
<ROUTINE V-SET ()
    <TELL "You can't set that." CR>>

<ROUTINE V-SET-TO ()
    <TELL "You can't set that to anything." CR>>

;"Conversation. SHOW mirrors zillib's GIVE (including SHOW FOREMAN JOURNAL);
  ASK ... ABOUT uses a TOPIC slot, read back with ABOUT? (section 4)."
<SYNTAX SHOW OBJECT (HAVE HELD CARRIED) TO OBJECT (FIND PERSONBIT) = V-SHOW>
<SYNTAX SHOW OBJECT (FIND PERSONBIT) OBJECT (HAVE HELD CARRIED) = V-SSHOW>
<VERB-SYNONYM SHOW DISPLAY>

;"V-SHOW: the default, for showing something to someone who does not
  care (the Foreman's own routine catches the journal and blueprint)."
<ROUTINE V-SHOW ()
    <COND (<FSET? ,PRSI ,PERSONBIT>
           <TELL CT ,PRSI " glances at " T ,PRSO " without interest." CR>)
          (ELSE <TELL "That's not something you can show things to." CR>)>>

;"SHOW FOREMAN JOURNAL names the person first: swap the two objects and
  PERFORM the ordinary SHOW, so objects only need to handle one form."
<ROUTINE V-SSHOW ()
    <PERFORM ,V?SHOW ,PRSI ,PRSO>
    <RTRUE>>

;"ASK person ABOUT anything. The topic is not an object: it is whatever
  words follow ABOUT, read back by ABOUT? (section 4)."
<SYNTAX ASK OBJECT (FIND PERSONBIT) ABOUT TOPIC = V-ASK-ABOUT>
<VERB-SYNONYM ASK QUESTION QUIZ>

;"The default when nobody's routine answered: a person gets silence, and
  asking a thing gets a gentle joke (A ,PRSO prints 'a' or 'an' and its
  name)."
<ROUTINE V-ASK-ABOUT ()
    <COND (<FSET? ,PRSO ,PERSONBIT> <TELL "There is no answer." CR>)
          (ELSE <TELL "Talking to " A ,PRSO ", huh?" CR>)>>

;"KISS (HUG, EMBRACE): PERSON-F answers it for people; V-KISS for the rest."
<SYNTAX KISS OBJECT = V-KISS>
<VERB-SYNONYM KISS HUG EMBRACE>

<ROUTINE V-KISS ()
    <TELL "Not here, not now." CR>>

;"LISTEN: a room's SOUNDS property, unless the room answers it in M-BEG."
<SYNTAX LISTEN = V-LISTEN>
<SYNTAX LISTEN TO OBJECT = V-LISTEN-TO>
<VERB-SYNONYM LISTEN HEAR>

;"V-LISTEN prints the room's SOUNDS property (GETP reads a property; a
  room without one gives 0). V-LISTEN-TO a person gets a polite silence;
  listening to a thing is the same as listening to the room."
<ROUTINE V-LISTEN ("AUX" S)
    <COND (<SET S <GETP ,HERE ,P?SOUNDS>> <TELL .S CR>)
          (ELSE <TELL "You hear nothing unexpected." CR>)>>

;"LISTEN TO someone: a polite silence. LISTEN TO something: the room's
  sounds, by calling V-LISTEN directly."
<ROUTINE V-LISTEN-TO ()
    <COND (<FSET? ,PRSO ,PERSONBIT>
           <TELL CT ,PRSO " has nothing to say just now." CR>)
          (ELSE <V-LISTEN>)>>

;"JOIN: an alternative to PUT LEFT HALF ON RIGHT HALF. In JOIN HALVES the
  word HALVES is treated like a preposition, the same trick zillib uses for
  TAKE INVENTORY."
<SYNTAX JOIN OBJECT = V-JOIN>
<SYNTAX JOIN OBJECT TO OBJECT = V-JOIN>
<SYNTAX JOIN OBJECT WITH OBJECT = V-JOIN>
<SYNTAX JOIN HALVES OBJECT (FIND KLUDGEBIT) = V-JOIN>
<SYNTAX JOIN PIECES OBJECT (FIND KLUDGEBIT) = V-JOIN>
<VERB-SYNONYM JOIN COMBINE ASSEMBLE MEND REASSEMBLE REPAIR>

;"Every form of JOIN goes to JOIN-HALVES (section 4), the same routine PUT
  LEFT HALF ON RIGHT HALF uses, so both phrasings behave the same."
<ROUTINE V-JOIN ()
    <JOIN-HALVES>>
