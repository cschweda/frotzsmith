;"The Dark Cellar -- light and darkness demo.
 Adapted from zillib/tests/test-light.zil (ZILF project, rev 5262550, GPLv3).
 Adaptation: converted from test harness to a playable single-file game.

 WHAT THIS SAMPLE TEACHES
   - A dark room: a ROOM without LIGHTBIT. zillib lets you see in it only
     while something lit (an object with LIGHTBIT) is here or carried.
   - A light source you switch: DEVICEBIT makes TURN ON and TURN OFF apply
     to the lantern, and its ACTION routine sets or clears LIGHTBIT.
   - NOW-LIT? and NOW-DARK?: the zillib routines to call after the light
     changes. They notice the change, print the standard message (and, on
     the way to light, describe the room you can now see).
   - HERE-LIT: zillib's 'can the player see here?' global, set up at start.

 HOW THE GAME FLOWS
   You start in the dark cellar holding an unlit lantern: it is pitch black.
   TURN ON LANTERN and the room appears. EXAMINE LANTERN says it is burning.
   TURN OFF LANTERN and the dark comes back. No puzzle and no ending."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"The Dark Cellar|
A ZIL Light and Darkness Demo">

;"GO runs first: print the opening, put the player in the Cellar (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), describe it, then start zillib's command loop, which never returns.

  HERE-LIT is zillib's record of whether the player can see. It starts out
  true and zillib only recomputes it when something changes (a move, a light
  switched), so a game that STARTS in the dark sets it itself, with zillib's
  SEARCH-FOR-LIGHT. Without that line the opening LOOK would describe a
  pitch-black room as if it were lit."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A demonstration of light, darkness, and a switchable light source." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,CELLAR>
    <MOVE ,PLAYER ,HERE>
    <SETG HERE-LIT <SEARCH-FOR-LIGHT>>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs and the PLAYER. The world below
  comes after it, so it can use the library's flags."
<INSERT-FILE "parser">

"Rooms"

;"No LIGHTBIT -- this room is dark without a light source. Its LDESC is only
  shown while the player can see."
<ROOM CELLAR
    (DESC "Dark Cellar")
    (IN ROOMS)
    (LDESC "A low stone cellar smelling of old earth and damp stone.
A ladder leads back up through the hatch to the north.")>

"Objects"

;"The lantern starts in the player's hands (IN PLAYER), switched off: no
  LIGHTBIT yet. DEVICEBIT lets TURN ON / TURN OFF be aimed at it; zillib's
  own versions of those verbs only set ONBIT, which says nothing about light,
  so LANTERN-R takes them over."
<OBJECT LANTERN
    (DESC "brass lantern")
    (SYNONYM LANTERN LAMP LIGHT)
    (ADJECTIVE BRASS OLD)
    (IN PLAYER)
    (FLAGS TAKEBIT DEVICEBIT)
    (ACTION LANTERN-R)>

;"LANTERN-R -- the lantern's ACTION routine. Each clause handles one verb and
  returns true (RTRUE) to end the turn; anything else returns false and is
  left to the library.
    TURN-ON  -- set LIGHTBIT (FSET): the lantern is now a light. Then
                NOW-LIT? tells zillib the light has changed; it prints
                'You can see your surroundings now.' and describes the room.
    TURN-OFF -- clear LIGHTBIT (FCLEAR), then NOW-DARK?, which prints
                zillib's 'plunged into darkness' message.
    EXAMINE  -- says whether it is lit, read from the flag with FSET?."
<ROUTINE LANTERN-R ()
    <COND (<VERB? TURN-ON>
           <FSET ,LANTERN ,LIGHTBIT>
           <TELL "The lantern flares to life with a warm yellow glow." CR>
           <NOW-LIT?>
           <RTRUE>)
          (<VERB? TURN-OFF>
           <FCLEAR ,LANTERN ,LIGHTBIT>
           <TELL "The lantern dims and goes dark." CR>
           <NOW-DARK?>
           <RTRUE>)
          (<VERB? EXAMINE>
           <TELL "A battered brass lantern.">
           <COND (<FSET? ,LANTERN ,LIGHTBIT>
                  <TELL " It is burning brightly." CR>)
                 (ELSE
                  <TELL " It is dark and cold." CR>)>
           <RTRUE>)
          (ELSE <RFALSE>)>>
