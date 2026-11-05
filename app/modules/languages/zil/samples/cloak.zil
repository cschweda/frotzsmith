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
   and you lose."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner (Release 2)."
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
  achievement below."
<SETG USE-SCORING? T>
<CONSTANT MAX-SCORE 2>

;"GO runs first: the opening text, the status line (INIT-STATUS-LINE, so the
  room name and score show at the top), the banner, then put the player in
  the Foyer (HERE is zillib's current-room global, and the PLAYER object must
  be moved there too), describe it, and start zillib's command loop."

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
  the message, below). It has to come before the library is inserted."
<DELAY-DEFINITION PRINT-GAME-OVER>

;"zillib: the parser, the standard verbs, the PLAYER and the score."
<INSERT-FILE "parser">

;"The two ways to score, one point each. AWARD-POINTS 1 ,ACH?NAME awards one
  of them; an achievement only ever counts once, and FULL lists the ones
  you have earned with these descriptions."

<SCORING-ACHIEVEMENTS
    (PUTTING-ON-HOOK "for putting the cloak away")
    (WINNING "for not trampling the message")>

"Objects"

;"The cloak. It starts on the player and is worn (WEARBIT says it can be
  worn, WORNBIT that it is). LDESC is how the room describes it if it is
  dropped. CLOAK-R ties the cloak to the light in the bar."
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
  (==? is 'equals'; ,HERE is the room the player is in.)"
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
  goes nowhere: it only prints its message."
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
  is hung up. BAR-R runs before each command here."
<ROOM BAR
    (DESC "Foyer Bar")
    (IN ROOMS)
    (LDESC "The bar, much rougher than you'd have guessed after the opulence
of the foyer to the north, is completely empty.")
    (NORTH TO FOYER)
    (ACTION BAR-R)>

;"How much the player has blundered about in the dark bar. More than 1 and
  the message is too trampled to read (MESSAGE-R)."
<GLOBAL DISTURBED 0>

;"BAR-R -- the bar's room ACTION. zillib calls a room's ACTION at several
  moments, telling it which in RARG; M-BEG is 'a command is about to run
  here'. Returning false lets the command go ahead; anything else stops it.
    - Lit, or a game verb (SAVE, SCORE...), or LOOK: let it go ahead.
    - Walking in the dark: north (the way out) is allowed; any other
      direction costs 2 DISTURBED and is stopped.
    - Anything else in the dark costs 1 DISTURBED and is stopped."
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
  FLOOR works too. FDESC is the room's line for it."
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
  is legible: one more point, and a win."
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
  MESSAGE-R used."
<REPLACE-DEFINITION PRINT-GAME-OVER
    <ROUTINE PRINT-GAME-OVER ()
        <TELL "    ****  You have ">
        <COND (<G? ,DISTURBED 1> <TELL "lost">)
              (ELSE <TELL "won">)>
        <TELL "  ****" CR>>>

;"The Cloakroom, where the cloak is hung. CLOAKROOM-R adds a line to its
  description while the cloak is on the hook."
<ROOM CLOAKROOM
    (DESC "Cloakroom")
    (IN ROOMS)
    (LDESC "The walls of this small room were clearly once lined with hooks,
though now only one remains. The exit is a door to the east.")
    (EAST TO FOYER)
    (FLAGS LIGHTBIT)
    (ACTION CLOAKROOM-R)>

;"CLOAKROOM-R -- M-FLASH is the moment zillib asks a room for anything to
  add after its description: here, the cloak on its hook."
<ROUTINE CLOAKROOM-R (RARG)
    <COND (<==? .RARG ,M-FLASH>
           <COND (<IN? ,CLOAK ,HOOK> <TELL CR "Your cloak is hanging on the hook." CR>)>)>>

;"The hook. CONTBIT plus SURFACEBIT make it something you put things ON
  (PUT CLOAK ON HOOK). NDESCBIT: the room text already mentions it."
<OBJECT HOOK
    (DESC "small brass hook")
    (IN CLOAKROOM)
    (SYNONYM HOOK PEG)
    (ADJECTIVE SMALL BRASS)
    (FLAGS NDESCBIT CONTBIT SURFACEBIT)
    (ACTION HOOK-R)>

;"HOOK-R -- EXAMINE says whether the cloak hangs there. Hanging the cloak
  (PUT-ON with the cloak as PRSO) awards the hook point, then returns false
  so the library does the hanging and CLOAK-R lights the bar."
<ROUTINE HOOK-R ()
    <COND (<VERB? EXAMINE>
           <TELL "It's just a small brass hook, ">
           <COND (<IN? ,CLOAK ,HOOK> <TELL "with a cloak hanging on it." CR>)
                 (ELSE <TELL "screwed to the wall." CR>)>)
          (<AND <VERB? PUT-ON> <PRSO? ,CLOAK>>
           <AWARD-POINTS 1 ,ACH?PUTTING-ON-HOOK>
           <RFALSE>)>>
