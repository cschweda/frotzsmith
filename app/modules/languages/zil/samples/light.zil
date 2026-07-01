"The Dark Cellar -- light and darkness demo.
Demonstrates a dark room, a switchable light source (DEVICEBIT), and the
NOW-LIT? / NOW-DARK? routines that handle light-state transition messages.
Adapted from zillib/tests/test-light.zil (ZILF project, rev 5262550, GPLv3).
Adaptation: converted from test harness to a playable single-file game.

Try: TURN ON LANTERN, then TURN OFF LANTERN"

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"The Dark Cellar|
A ZIL Light and Darkness Demo">

<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A demonstration of light, darkness, and a switchable light source." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,CELLAR>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

<INSERT-FILE "parser">

"Rooms"

;"No LIGHTBIT -- this room is dark without a light source."
<ROOM CELLAR
    (DESC "Dark Cellar")
    (IN ROOMS)
    (LDESC "A low stone cellar smelling of old earth and damp stone.
A ladder leads back up through the hatch to the north.")>

"Objects"

;"The lantern is a DEVICEBIT object so the library recognises TURN ON / TURN OFF.
  The custom action handler LANTERN-R intercepts those verbs to manage LIGHTBIT
  and call NOW-LIT? / NOW-DARK? for the light-transition messages."
<OBJECT LANTERN
    (DESC "brass lantern")
    (SYNONYM LANTERN LAMP LIGHT)
    (ADJECTIVE BRASS OLD)
    (IN PLAYER)
    (FLAGS TAKEBIT DEVICEBIT)
    (ACTION LANTERN-R)>

;"LANTERN-R manages the lantern's LIGHTBIT.
  TURN ON:  sets LIGHTBIT, calls NOW-LIT? (prints can-see message + look).
  TURN OFF: clears LIGHTBIT, calls NOW-DARK? (prints plunged-into-darkness).
  EXAMINE:  describes the lantern and its on/off state."
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
