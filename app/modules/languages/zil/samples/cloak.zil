;"Cloak of Darkness -- the canonical IF demonstration game in ZIL.
 Adapted from ZILF sample/cloak/cloak.zil (Roger Firth's original design,
 ZIL conversion by Tara McGrew, Jayson Smith, and Josh Lawrence).
 Source: ZILF sample/cloak/, rev 5262550, GPLv3.
 Adaptation: removed the VERSION directive (injected by Compile() API).

 WHAT THIS SAMPLE TEACHES
   Cloak of Darkness is the 'hello world' of interactive fiction: the same
   tiny game has been written in nearly every IF language, so it is the
   easiest way to compare them. In ZIL it shows:
   - three rooms and exits, including one that only prints a refusal (SORRY);
   - a room whose light is switched on and off by the game (the bar);
   - a room ACTION routine with M-BEG (runs before every command there)
     and M-FLASH (adds a line to the room description);
   - scoring with zillib's achievements, and a custom game-over banner;
   - ending the game with JIGS-UP.

 HOW THE GAME FLOWS
   You arrive in the Foyer wearing a black velvet cloak. The Bar (south) is
   dark while you wear the cloak: the cloak swallows the light. Go WEST to
   the Cloakroom and PUT CLOAK ON HOOK (1 point); the bar is now lit. Go
   EAST, then SOUTH, and READ MESSAGE in the sawdust (1 point) to win.
   Fumbling about in the dark bar first tramples the message: read it then,
   and you lose.

 THE MAP
                 (north: refused, the weather)
                              |
     Cloakroom ---- west/east ---- Foyer (start)
     (the hook)                     |
                               south/north
                                    |
                                   Bar (dark until the cloak is hung;
                                        the message in the sawdust)

 THE GAME'S STATE -- two things, and who touches them
     BAR's LIGHTBIT   set by CLOAK-R when the cloak is hung or dropped in
                      the Cloakroom, cleared by CLOAK-R when it is taken
                      back; read by BAR-R (and by zillib, to decide whether
                      the bar can be seen).
     DISTURBED        a GLOBAL number, raised by BAR-R for every blind
                      action in the dark bar (2 for walking the wrong way,
                      1 for anything else); read by MESSAGE-R and by
                      PRINT-GAME-OVER. More than 1 and the message is
                      trampled.

 SCORING (MAX-SCORE 2)
     PUTTING-ON-HOOK  1 point  HOOK-R, on PUT CLOAK ON HOOK
     WINNING          1 point  MESSAGE-R, when the message is read intact

 WALKTHROUGH (the Solution: zil-cloak.walkthrough.txt)
     WEST                 into the Cloakroom
     PUT CLOAK ON HOOK    1 point; the bar is lit from now on
     EAST, SOUTH          the bar, lit: the message is visible
     READ MESSAGE         1 point, and the game ends: 'You have won'

 THE INFORM 6 EQUIVALENT
   There is no Inform 6 copy among Frotzsmith's samples, but Cloak of
   Darkness has been written in Inform 6 (and nearly everything else);
   Roger Firth's comparison pages put them side by side. There the bar's
   darkness is a 'light' attribute changed in the cloak's after routine,
   and the room's before routine plays the part of M-BEG here.

 READING ZIL (a quick key, explained again where each first appears)
   <...> is a form (a call or definition), (...) a list (one property in an
   OBJECT or ROOM). ,NAME is a global value, .NAME a local one. ;'string' is
   a comment (single quotes here stand in for double quotes, which would end
   the comment)."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner (Release 2).
  CONSTANT names a value that never changes."
<CONSTANT RELEASEID 2>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"Cloak of Darkness|
A basic IF demonstration.|
Original game by Roger Firth|
ZIL conversion by Tara McGrew, Jayson Smith, and Josh Lawrence">

;"Scoring. USE-SCORING? turns on zillib's score (and the SCORE verb); it is
  set before the library is inserted, because the library checks it as it is
  compiled. MAX-SCORE is the most points there are: one for each
  achievement below.

  <SETG USE-SCORING? T> at the top level sets a compile-time global: T is
  true. zillib looks at it while it is being read in and, if it is set,
  includes its scoring file -- the SCORE and FULLSCORE (FULL) verbs, the
  '[Your score has gone up by 1 point.]' notices, AWARD-POINTS, and the
  score line at the end of the game. Set it after INSERT-FILE and none of
  that would be compiled in. MAX-SCORE is required once scoring is on;
  without it the compile stops with an error."
<SETG USE-SCORING? T>
<CONSTANT MAX-SCORE 2>

;"GO runs first: the opening text, the status line (INIT-STATUS-LINE, so the
  room name and score show at the top), the banner, then put the player in
  the Foyer (HERE is zillib's current-room global, and the PLAYER object must
  be moved there too), describe it, and start zillib's command loop.

  About INIT-STATUS-LINE: on z3, the format this sample compiles to, the
  interpreter draws the status line itself (room name, score and moves)
  and INIT-STATUS-LINE compiles to nothing. On z4 and later, zillib has to
  make room for the status line at the top of the screen, and this is the
  call that does it. Calling it always keeps the game correct whichever
  version is picked in the toolbar.

  The rest: ROUTINE defines code, () is GO's empty argument list, CRLF and
  TELL print (CR is a line break), SETG sets a global, MOVE puts one object
  inside another, V-LOOK describes the room, MAIN-LOOP runs the game."

<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "Hurrying through the rainswept November night, you're glad to see the
bright lights of the Opera House. It's surprising that there aren't more
people about but, hey, what do you expect in a cheap demo game...?" CR CR>
    <INIT-STATUS-LINE>
    <V-VERSION> <CRLF>
    <SETG HERE ,FOYER>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"DELAY-DEFINITION tells the library: do not define your own
  PRINT-GAME-OVER yet -- the game will supply one (REPLACE-DEFINITION, after
  the message, below). It has to come before the library is inserted.

  How replaceable library pieces work: zillib wraps the pieces a game may
  want to change in DEFAULT-DEFINITION. When the compiler meets one, it uses
  the game's replacement if one has already been given, and its own default
  otherwise. A REPLACE-DEFINITION written BEFORE the INSERT-FILE would need
  nothing else. This game wants its replacement further down, next to
  MESSAGE-R, whose rule it shares -- and a replacement that turns up after
  the default has been used is an error. DELAY-DEFINITION solves that: it
  tells zillib to skip its default and leave the slot for later."
<DELAY-DEFINITION PRINT-GAME-OVER>

;"zillib: the parser, the standard verbs, the PLAYER and the score.

  The library verbs this game relies on: WALK (the exits), LOOK, PUT ... ON
  (hanging the cloak), DROP, TAKE, EXAMINE and READ; JIGS-UP (ending the
  game); and the scoring module switched on above."
<INSERT-FILE "parser">

;"The two ways to score, one point each. AWARD-POINTS 1 ,ACH?NAME awards one
  of them; an achievement only ever counts once, and FULL lists the ones
  you have earned with these descriptions.

  SCORING-ACHIEVEMENTS is a zillib definition (it runs while compiling):
  each (NAME 'description') line creates a constant ACH?NAME that the code
  hands to AWARD-POINTS, and a row in a table where zillib remembers whether
  that achievement has been granted. That is why hanging the cloak twice
  still scores only once. The descriptions are what FULLSCORE prints under
  'Your score includes:'."

<SCORING-ACHIEVEMENTS
    (PUTTING-ON-HOOK "for putting the cloak away")
    (WINNING "for not trampling the message")>

"Objects"

;"(A bare string such as Objects just above does nothing: it is a heading.)

  The cloak. It starts on the player and is worn (WEARBIT says it can be
  worn, WORNBIT that it is). LDESC is how the room describes it if it is
  dropped. CLOAK-R ties the cloak to the light in the bar.

  Property by property:
    (DESC 'cloak')        its name in the library's messages.
    (SYNONYM CLOAK)       the one noun; the ADJECTIVE list adds HANDSOME,
                          VELVET, SATIN and BLACK, so BLACK CLOAK works.
    (IN PLAYER)           it starts in the player's inventory.
    (LDESC ...)           for an object (not a room), LDESC is the line the
                          room description prints for it while it lies
                          there: drop the cloak in the Cloakroom and LOOK
                          says 'Your cloak is in a rumpled pile on the
                          floor.' instead of 'There is a cloak here.'
    TAKEBIT               it can be taken (back).
    WEARBIT               it is something that can be worn: WEAR applies.
    WORNBIT               it is being worn right now. INVENTORY adds
                          '(worn)'; zillib clears the flag when the cloak is
                          dropped or put on the hook.
    (ACTION CLOAK-R)      the routine below."
<OBJECT CLOAK
    (DESC "cloak")
    (SYNONYM CLOAK)
    (ADJECTIVE HANDSOME VELVET SATIN BLACK)
    (IN PLAYER)
    (LDESC "Your cloak is in a rumpled pile on the floor.")
    (FLAGS TAKEBIT WEARBIT WORNBIT)
    (ACTION CLOAK-R)>

;"CLOAK-R -- the cloak's ACTION routine. The whole puzzle is here: the bar is
  lit exactly when the cloak is NOT being carried.
    EXAMINE      -- its description.
    DROP, PUT-ON -- in the Cloakroom, light the bar (FSET ,BAR ,LIGHTBIT) and
                    return false so the library still does the dropping or
                    hanging. Anywhere else, refuse.
    TAKE         -- darken the bar again, then let the library take it.
  (==? is 'equals'; ,HERE is the room the player is in.)

  The ZIL pieces, one at a time:
    <COND (test body...) ...>
                  if / else-if: the first clause whose test is true runs.
                  The value of the COND is the value of the last form in
                  that clause, and since the COND is the last form of the
                  routine, that value is what the routine returns to the
                  parser. True means 'handled, stop'; false means 'carry
                  on'.
    <VERB? DROP PUT-ON>
                  true when the action is DROP or PUT-ON (either one).
    <TELL ... CR> as the last form of a clause
                  TELL counts as true, so a clause that ends with a TELL
                  answers 'handled' without an explicit RTRUE. That is how
                  EXAMINE and the 'not the best place' refusal stop zillib's
                  own verb from running too.
    <FSET ,BAR ,LIGHTBIT> / <FCLEAR ,BAR ,LIGHTBIT>
                  set / clear a flag. Here the flag is on a ROOM: a room
                  with LIGHTBIT is lit. Rooms are objects too, so every
                  flag operation works on them.
    <RFALSE>      return false: 'let zillib do the rest'. The cloak does
                  not move itself; zillib's DROP and PUT-ON do that after
                  CLOAK-R has adjusted the light.
  If no clause matches (any other verb), the COND gives false and zillib
  carries on as usual: WEAR CLOAK, for example, is all zillib's."
<ROUTINE CLOAK-R ()
    <COND (<VERB? EXAMINE>
           <TELL "A handsome cloak, of velvet trimmed with satin, and slightly
spattered with raindrops. Its blackness is so deep that it almost seems to suck
light from the room." CR>)
          (<VERB? DROP PUT-ON>
           <COND (<==? ,HERE ,CLOAKROOM>
                  <FSET ,BAR ,LIGHTBIT>
                  <RFALSE>)
                 (ELSE <TELL "This isn't the best place to leave a smart cloak
lying around." CR>)>)
          (<VERB? TAKE>
           <FCLEAR ,BAR ,LIGHTBIT>
           <RFALSE>)>>

;"The Foyer, where the game starts. (NORTH SORRY \"...\") is an exit that
  goes nowhere: it only prints its message.

  The exits, the three kinds this file uses:
    (SOUTH TO BAR)        an ordinary exit: SOUTH (or S) moves the player
                          to the BAR room and describes it.
    (WEST TO CLOAKROOM)   the same, westward.
    (NORTH SORRY '...')   a refusal: zillib prints the message and the
                          player stays put. Better than the stock 'You
                          can't go that way.' for a direction the room
                          description mentions.
  Exits are one-way: the Bar and the Cloakroom each have their own exit
  back. LIGHTBIT: the Foyer is always lit."
<ROOM FOYER
    (DESC "Foyer of the Opera House")
    (IN ROOMS)
    (LDESC "You are standing in a spacious hall, splendidly decorated in red
and gold, with glittering chandeliers overhead. The entrance from
the street is to the north, and there are doorways south and west.")
    (SOUTH TO BAR)
    (WEST TO CLOAKROOM)
    (NORTH SORRY "You've only just arrived, and besides, the weather outside
seems to be getting worse.")
    (FLAGS LIGHTBIT)>

;"The Bar. No LIGHTBIT to begin with: CLOAK-R gives it light once the cloak
  is hung up. BAR-R runs before each command here.

  While the bar is dark, zillib describes it only as 'It is pitch black.
  You can't see a thing.': no name, no LDESC, no message in the sawdust.
  (ACTION BAR-R) on a ROOM is the room's routine, called at several
  moments of every turn spent here (see BAR-R)."
<ROOM BAR
    (DESC "Foyer Bar")
    (IN ROOMS)
    (LDESC "The bar, much rougher than you'd have guessed after the opulence
of the foyer to the north, is completely empty.")
    (NORTH TO FOYER)
    (ACTION BAR-R)>

;"How much the player has blundered about in the dark bar. More than 1 and
  the message is too trampled to read (MESSAGE-R).
  <GLOBAL NAME value> makes a variable that lasts the whole game (and is
  saved with it); read it as ,DISTURBED and change it with SETG."
<GLOBAL DISTURBED 0>

;"BAR-R -- the bar's room ACTION. zillib calls a room's ACTION at several
  moments, telling it which in RARG; M-BEG is 'a command is about to run
  here'. Returning false lets the command go ahead; anything else stops it.
    - Lit, or a game verb (SAVE, SCORE...), or LOOK: let it go ahead.
    - Walking in the dark: north (the way out) is allowed; any other
      direction costs 2 DISTURBED and is stopped.
    - Anything else in the dark costs 1 DISTURBED and is stopped.

  The ZIL pieces, one at a time:
    <ROUTINE BAR-R (RARG) ...>
                  unlike an object's ACTION, a room's ACTION takes one
                  argument: the reason it is being called. RARG is just the
                  name this routine gives that argument, and .RARG (with a
                  DOT, because it is a local) reads it. zillib passes:
                    M-BEG    before a command runs here (can stop it)
                    M-END    after a command has run here
                    M-ENTER  as the player arrives
                    M-LOOK   when the room is to be described (a room that
                             prints its own description returns true and
                             its LDESC is skipped)
                    M-FLASH  just after the description
                  BAR-R only answers M-BEG. For every other reason the
                  outer COND finds no true clause and the routine returns
                  false, which means 'do the usual': the LDESC is printed,
                  nothing extra happens on arrival, and so on.
    <==? .RARG ,M-BEG>
                  'is the reason M-BEG?' M-BEG is a constant zillib
                  defines, hence the comma.
    <OR a b c>    true as soon as one of them is true.
    <GAME-VERB?>  a zillib test that is true for the out-of-story verbs
                  (SAVE, RESTORE, QUIT, SCORE, INVENTORY, WAIT, VERSION...),
                  so the dark never stops the player saving the game.
    <VERB? WALK>  the action for every movement command. For a direction,
                  the parser puts the direction itself in PRSO: P?NORTH is
                  the NORTH exit property, which is how <N==? ,PRSO
                  ,P?NORTH> asks 'any direction but north?'. N==? is 'not
                  equal'.
    <SETG DISTURBED <+ ,DISTURBED 2>>
                  add 2 to the global: <+ a b> is a plus b, and SETG stores
                  the result.
    ;'Let the action proceed'
                  a comment inside the routine: the compiler drops it, so
                  the clause is just <RFALSE>.
  In the WALK clause, walking NORTH makes the inner COND find nothing and
  give false, so BAR-R returns false and zillib's WALK takes the player out.
  A wrong direction prints the warning, and the TELL's true value stops the
  move."
<ROUTINE BAR-R (RARG)
    <COND (<==? .RARG ,M-BEG>
           <COND (<OR <FSET? ,BAR ,LIGHTBIT>
                      <GAME-VERB?>
                      <VERB? LOOK>>
                  ;"Let the action proceed"
                  <RFALSE>)
                 (<VERB? WALK>
                  <COND (<N==? ,PRSO ,P?NORTH>
                         <SETG DISTURBED <+ ,DISTURBED 2>>
                         <TELL "Blundering around in the dark isn't a good idea!" CR>)>)
                 (ELSE
                  <SETG DISTURBED <+ ,DISTURBED 1>>
                  <TELL "In the dark? You could easily disturb something!" CR>)>)>>

;"The message in the sawdust. SYNONYM includes FLOOR and SAWDUST so READ
  FLOOR works too. FDESC is the room's line for it.

  Notice what it lacks: no TAKEBIT, so it cannot be picked up (zillib's
  refusal), and no READBIT. zillib's READ syntax only uses READBIT as a hint
  for guessing; a command aimed at the message reaches MESSAGE-R, which
  answers READ itself. Without MESSAGE-R, zillib's READ would reply 'That's
  not something you can read.' The FDESC is shown every time the lit bar is
  described, since nothing ever touches the message."
<OBJECT MESSAGE
    (DESC "message")
    (SYNONYM MESSAGE FLOOR SAWDUST DUST)
    (ADJECTIVE SCRAWLED)
    (IN BAR)
    (FDESC "There seems to be some sort of message scrawled in the sawdust on the floor.")
    (ACTION MESSAGE-R)>

;"MESSAGE-R -- reading the message ends the game either way. JIGS-UP prints
  its text and finishes the game (zillib then prints the game-over banner
  and the score, and offers RESTART, RESTORE or QUIT). Too much DISTURBED
  (G? is 'greater than') and it is trampled: a loss. Otherwise the message
  is legible: one more point, and a win.

  The order inside the winning clause matters: AWARD-POINTS comes first,
  so the final score that JIGS-UP prints already includes the point.
  JIGS-UP never returns: after its prompt the player can only restart,
  restore or quit (or UNDO, on versions that have it), so nothing after it
  in a routine would run. The losing text ends in '...' and the game is
  over: the player never learns what the message said. It reads 'You have
  won' only through PRINT-GAME-OVER, below."
<ROUTINE MESSAGE-R ()
    <COND (<VERB? EXAMINE READ>
           <COND (<G? ,DISTURBED 1>
                  <JIGS-UP "The message has been carelessly trampled, making it
difficult to read. You can just distinguish the words...">)
                 (ELSE
                  <AWARD-POINTS 1 ,ACH?WINNING>
                  <JIGS-UP "The message, neatly marked in the sawdust, reads...">)>)>>

;"The game's own PRINT-GAME-OVER, filling in the DELAY-DEFINITION above.
  zillib prints it when the game ends: won, or lost, after the same rule
  MESSAGE-R used.

  JIGS-UP calls PRINT-GAME-OVER right after its own text, so the player
  reads '...reads...' and then '****  You have won  ****'. The test is
  the same G? ,DISTURBED 1 as in MESSAGE-R, so the banner always agrees
  with the ending. REPLACE-DEFINITION's first argument names the slot, and
  the rest is ordinary code put in its place."
<REPLACE-DEFINITION PRINT-GAME-OVER
    <ROUTINE PRINT-GAME-OVER ()
        <TELL "    ****  You have ">
        <COND (<G? ,DISTURBED 1> <TELL "lost">)
              (ELSE <TELL "won">)>
        <TELL "  ****" CR>>>

;"The Cloakroom, where the cloak is hung. CLOAKROOM-R adds a line to its
  description while the cloak is on the hook. (EAST TO FOYER) is the way
  back; LIGHTBIT keeps it lit."
<ROOM CLOAKROOM
    (DESC "Cloakroom")
    (IN ROOMS)
    (LDESC "The walls of this small room were clearly once lined with hooks,
though now only one remains. The exit is a door to the east.")
    (EAST TO FOYER)
    (FLAGS LIGHTBIT)
    (ACTION CLOAKROOM-R)>

;"CLOAKROOM-R -- M-FLASH is the moment zillib asks a room for anything to
  add after its description: here, the cloak on its hook.
  zillib sends M-FLASH even in BRIEF mode (when a visited room's LDESC is
  skipped), so it is the place for things the player must always be told.
  <IN? ,CLOAK ,HOOK> asks 'is the cloak directly inside the hook?' -- for
  zillib, a thing on a surface is IN it. TELL CR first prints a line break,
  so the line stands apart from the description. Every other reason
  (M-BEG, M-LOOK...) makes the COND false: nothing special."
<ROUTINE CLOAKROOM-R (RARG)
    <COND (<==? .RARG ,M-FLASH>
           <COND (<IN? ,CLOAK ,HOOK> <TELL CR "Your cloak is hanging on the hook." CR>)>)>>

;"The hook. CONTBIT plus SURFACEBIT make it something you put things ON
  (PUT CLOAK ON HOOK). NDESCBIT: the room text already mentions it.
  zillib's PUT ... ON refuses anything that is not both CONTBIT and
  SURFACEBIT: 'That's not something you can put things on.' Without
  NDESCBIT the room would also list 'There is a small brass hook here.'
  Note that the properties can come in any order: IN is after DESC here."
<OBJECT HOOK
    (DESC "small brass hook")
    (IN CLOAKROOM)
    (SYNONYM HOOK PEG)
    (ADJECTIVE SMALL BRASS)
    (FLAGS NDESCBIT CONTBIT SURFACEBIT)
    (ACTION HOOK-R)>

;"HOOK-R -- EXAMINE says whether the cloak hangs there. Hanging the cloak
  (PUT-ON with the cloak as PRSO) awards the hook point, then returns false
  so the library does the hanging and CLOAK-R lights the bar.

  Who runs, in order, for PUT CLOAK ON HOOK in the Cloakroom (zillib's
  PERFORM stops at the first one that returns true; the player's and the
  room's own routines go first and have nothing to say here):
    1. PRE-PUT-ON   zillib's check that the cloak is held.
    2. HOOK-R       the hook is PRSI, the second object, and PRSI's routine
                    runs before PRSO's: award the point, return false.
    3. CLOAK-R      PUT-ON in the Cloakroom: light the bar, return false.
    4. V-PUT-ON     zillib moves the cloak onto the hook, clears WORNBIT
                    and prints the success message.
  <AND a b> is true only if both are; <PRSO? ,CLOAK> asks whether the
  direct object is the cloak, so PUT anything-else ON HOOK scores nothing."
<ROUTINE HOOK-R ()
    <COND (<VERB? EXAMINE>
           <TELL "It's just a small brass hook, ">
           <COND (<IN? ,CLOAK ,HOOK> <TELL "with a cloak hanging on it." CR>)
                 (ELSE <TELL "screwed to the wall." CR>)>)
          (<AND <VERB? PUT-ON> <PRSO? ,CLOAK>>
           <AWARD-POINTS 1 ,ACH?PUTTING-ON-HOOK>
           <RFALSE>)>>
