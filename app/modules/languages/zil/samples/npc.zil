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
   speak. TAKE HERMIT gets the library's refusal. There is no puzzle and
   no ending: the point is the ACTION routine. (HERMIT-R also refuses gifts,
   but the player carries nothing here, so that clause only shows the
   pattern for a game that has things to give.)

 THE INFORM 6 EQUIVALENT
   The Inform 6 sample 'hermit' is the same scene. There the hermit 'has
   animate' (ZIL: PERSONBIT) and answers conversation in a 'life' routine;
   ZIL has a single ACTION routine per object that sees every verb, so the
   one routine below does the work of Inform's 'before' and 'life' together.

 HOW A COMMAND REACHES THE HERMIT
   The parser turns WAKE HERMIT into an action (PRSA = WAKE) and a direct
   object (PRSO = the HERMIT object). zillib's PERFORM then offers the
   action to a list of handlers in a fixed order and stops at the first one
   that returns true:
     1. the player's own ACTION   2. the room's ACTION (with M-BEG)
     3. the verb's PRE- routine    4. PRSI's ACTION (the second object)
     5. PRSO's ACTION              6. the verb's V- routine (the default)
   (zillib also checks container routines between these; this game has
   none.) HERMIT-R is step 4 or 5 whenever the hermit is in the command.
   Return true and the turn is over; return false and the next step runs,
   ending at zillib's stock reply.

 READING ZIL (a quick key)
   <...> is a form (a call or definition), (...) a list (one property in an
   OBJECT). ,NAME is a global value, .NAME a local one. ;'string' is a
   comment (single quotes here stand in for double quotes)."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner. CONSTANT
  names a value that never changes."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"The Hermit|
A ZIL NPC Demo">

;"GO runs first: print the opening, put the player in the Clearing (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), describe it, then start zillib's command loop, which never returns.
  ROUTINE defines code; () is GO's (empty) argument list. CRLF and TELL
  print (CR inside TELL is a line break), SETG sets a global, MOVE puts one
  object inside another."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A simple demonstration of a non-player character." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,CLEARING>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs and the PLAYER. The world below
  comes after it, so it can use the library's flags.

  zillib's verbs that matter here, and what they do on their own:
    EXAMINE X       prints X's TEXT or LDESC property, or 'You see nothing
                    special about the hermit.' when it has neither.
    WAKE X          its SYNTAX line looks for a PERSONBIT object; for a
                    person the default reply is 'I don't think the hermit
                    would appreciate that.'
    GIVE X TO Y     the default reply is 'The hermit doesn't take the ...'
    TAKE X          refuses a person with that same 'I don't think the
                    hermit would appreciate that.'
  HERMIT-R replaces the first three for the hermit and leaves TAKE alone."
<INSERT-FILE "parser">

"Rooms"

;"The only room. Its LDESC mentions the hermit, which is why the hermit
  carries NDESCBIT below: one mention is enough.

  ROOM defines a location. (IN ROOMS) makes it one of zillib's rooms, DESC
  is its title, LDESC the text LOOK prints, and LIGHTBIT makes it lit so the
  player can see. It has no exits, so every direction is refused."
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
  that answers commands aimed at him.

  Property by property:
    (DESC 'hermit')   his name in the library's messages ('the hermit').
    (SYNONYM ...)     nouns that mean him: HERMIT, MAN, SAGE.
    (ADJECTIVE ...)   words that may come before those nouns, so OLD MAN
                      and WEATHERED HERMIT both work.
    (IN CLEARING)     where he starts. Nothing ever moves him.
    PERSONBIT         a person. zillib's SYNTAX lines for WAKE, GIVE ... TO
                      and TELL ... ABOUT look for this flag when guessing who
                      the player means, the library refuses to pick him
                      up, and the room description lists people separately
                      from things.
    NDESCBIT          'no description': the library's list of what is in
                      the room skips him. Without it the player would read
                      the LDESC (which already has the hermit) and then
                      'The hermit is here.' as well.
    (ACTION HERMIT-R) the routine the parser calls when he is the object of
                      a command. An object with no ACTION gets the
                      library's default for everything.

  Note what is NOT here: no TAKEBIT, so zillib refuses TAKE HERMIT by
  itself; no FEMALEBIT, so the library calls the hermit 'him'."
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
    GIVE    -- GIVE X TO HERMIT: he refuses any gift.

  The ZIL pieces, one at a time:
    <ROUTINE HERMIT-R () ...>
              an action routine takes no arguments: everything it needs is
              in globals the parser has already set. PRSA is the action,
              PRSO the direct object, PRSI the indirect object.
    <COND (test body...) (test body...) ...>
              ZIL's if / else-if chain. Each clause is a list: its first
              item is the test, the rest is what runs when the test is
              true. The clauses are tried top to bottom and only the first
              true one runs. A clause whose test is ELSE always runs. The
              COND gives back the value of the last thing its clause did,
              and the routine gives back the value of its last form -- here
              the COND -- so the clause's last form is the routine's answer
              to the parser.
    <VERB? EXAMINE>
              true when PRSA is the EXAMINE action. <VERB? A B> would be
              true for either. It is a zillib macro for comparing PRSA with
              the action constants V?EXAMINE, V?WAKE...
    <TELL '...' CR>
              print the text, then a line break. Inside the string, a
              backslash before a double quote prints the quote instead of
              ending the string (that is how the hermit's words get their
              quotation marks), and a line break in the source prints as a
              space.
    <RTRUE> / <RFALSE>
              return true / false from the routine at once. True tells
              PERFORM 'handled, stop here'; false tells it 'carry on to the
              next handler'.

  Why GIVE works even though the hermit is the SECOND object: in GIVE COIN
  TO HERMIT the coin is PRSO and the hermit is PRSI, and PERFORM calls
  PRSI's ACTION too (before PRSO's). So HERMIT-R sees GIVE whichever end of
  the sentence he is on. (The player carries nothing in this game, and
  GIVE's SYNTAX line says the thing given must be held (HAVE), so the
  parser itself answers 'You aren't holding ...' before HERMIT-R is ever
  reached. The clause is here to show the pattern.)

  What happens without HERMIT-R: EXAMINE HERMIT would say there is nothing
  special about him, WAKE HERMIT would get zillib's stock reply, and he
  would be scenery with a name."
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
