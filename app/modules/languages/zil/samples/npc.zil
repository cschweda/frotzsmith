;"The Hermit -- a simple NPC demo.
 Hand-written for the Frotzsmith sample set.

 WHAT THIS SAMPLE TEACHES
   - PERSONBIT: the flag that tells zillib an object is a person, so the
     parser treats it as someone (WAKE, GIVE TO, ASK) rather than a thing.
   - An ACTION routine: the code an object runs when a command is aimed at
     it. It answers the verbs it cares about and returns false for the rest,
     which lets the library's default reply take over.
   - NDESCBIT: the hermit is described in the room's own text, so the
     library must not list him again.

 HOW THE GAME FLOWS
   One room, a forest clearing, with the hermit by his fire. EXAMINE HERMIT
   describes him; WAKE HERMIT (zillib's nearest thing to TALK TO) makes him
   speak. GIVE something to him and he waves it away. There is no puzzle and
   no ending: the point is the ACTION routine."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"The Hermit|
A ZIL NPC Demo">

;"GO runs first: print the opening, put the player in the Clearing (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), describe it, then start zillib's command loop, which never returns."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A simple demonstration of a non-player character." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,CLEARING>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs and the PLAYER. The world below
  comes after it, so it can use the library's flags."
<INSERT-FILE "parser">

"Rooms"

;"The only room. Its LDESC mentions the hermit, which is why the hermit
  carries NDESCBIT below: one mention is enough."
<ROOM CLEARING
    (DESC "Forest Clearing")
    (IN ROOMS)
    (LDESC "A quiet clearing ringed with tall pines. An old hermit sits beside
a low campfire, staring into the flames. Shadows dance in the firelight.")
    (FLAGS LIGHTBIT)>

"Characters"

;"The hermit. SYNONYM and ADJECTIVE give the words the player can use (OLD
  MAN, ANCIENT SAGE...). PERSONBIT makes him a person. NDESCBIT keeps the
  library from listing him a second time under the room description.
  No TAKEBIT, so TAKE HERMIT is refused. (ACTION HERMIT-R) names the routine
  that answers commands aimed at him."
<OBJECT HERMIT
    (DESC "hermit")
    (SYNONYM HERMIT MAN SAGE)
    (ADJECTIVE OLD ANCIENT WEATHERED)
    (IN CLEARING)
    (FLAGS PERSONBIT NDESCBIT)
    (ACTION HERMIT-R)>

;"HERMIT-R -- the hermit's ACTION routine. The parser calls it whenever the
  hermit is the object of a command, before the verb's own routine runs.
  <VERB? X> asks 'is the current action X?'. A clause that handles the
  command prints its reply and returns true (RTRUE): that ends the turn.
  Returning false (RFALSE) means 'not mine' and the library carries on with
  its default -- so TAKE HERMIT still gets the usual refusal.
    EXAMINE -- his description.
    WAKE    -- WAKE HERMIT or WAKE UP HERMIT; it stands in for TALK TO.
    GIVE    -- GIVE X TO HERMIT: he refuses any gift."
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
