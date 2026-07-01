;"The Hermit — a simple NPC demo.
 Demonstrates PERSONBIT, object action handlers, and canned NPC responses.
 The hermit responds to EXAMINE and WAKE UP (a natural 'talk to' equivalent).
 Hand-written for the Frotzsmith sample set."

; NOTE: <VERSION> is NOT included here — it is injected by the Compile() API.

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"The Hermit|
A ZIL NPC Demo">

<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A simple demonstration of a non-player character." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,CLEARING>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

<INSERT-FILE "parser">

"Rooms"

<ROOM CLEARING
    (DESC "Forest Clearing")
    (IN ROOMS)
    (LDESC "A quiet clearing ringed with tall pines. An old hermit sits beside
a low campfire, staring into the flames. Shadows dance in the firelight.")
    (FLAGS LIGHTBIT)>

"Characters"

<OBJECT HERMIT
    (DESC "hermit")
    (SYNONYM HERMIT MAN SAGE)
    (ADJECTIVE OLD ANCIENT WEATHERED)
    (IN CLEARING)
    (FLAGS PERSONBIT NDESCBIT)
    (ACTION HERMIT-R)>

;"HERMIT-R — action handler for the hermit.
  EXAMINE gives a description.
  WAKE (i.e. WAKE UP HERMIT) prompts the hermit to speak.
  Everything else falls through to the library default."
<ROUTINE HERMIT-R ()
    <COND (<VERB? EXAMINE>
           <TELL "An ancient, weathered man with a long grey beard and eyes
that have seen too much. He stares into the fire as if reading the flames." CR>
           <RTRUE>)
          (<VERB? WAKE>
           <TELL "The hermit stirs and fixes you with a keen gaze.
\"Seek the passage to the west, traveller,\" he murmurs,
and turns back to the fire." CR>
           <RTRUE>)
          (<VERB? GIVE>
           <TELL "The hermit waves the gift away without looking up." CR>
           <RTRUE>)
          (ELSE <RFALSE>)>>
