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
   TURN OFF LANTERN and the dark comes back. No puzzle and no ending.

 HOW zillib DECIDES WHETHER YOU CAN SEE
   One rule: the player can see if the room has LIGHTBIT, or if any object
   the player could see by its own light -- in the room, carried, or inside
   an open container -- has LIGHTBIT. zillib's SEARCH-FOR-LIGHT applies the
   rule and answers with the light source (or false). The answer is kept in
   the global HERE-LIT, so the parser does not recompute it every turn; the
   game's job is to tell zillib when the light may have changed, by calling
   NOW-LIT? or NOW-DARK?. While HERE-LIT is false, LOOK says 'It is pitch
   black. You can't see a thing.', EXAMINE and READ say 'It's too dark to
   see anything here.' (even EXAMINE LANTERN: that check runs before the
   lantern's own routine), and
   the parser can still find what the player is carrying (but not what is
   lying in the room) -- which is why TURN ON LANTERN works in the dark.

 THE INFORM 6 EQUIVALENT
   The Inform 6 samples 'dark-cellar' and 'switchable-lamp' cover the same
   ground. In Inform the lantern would be 'switchable' and gain or lose the
   'light' attribute in its after routine; the library notices the change of
   light by itself at the end of the turn. zillib asks the game to say so,
   which is what NOW-LIT? and NOW-DARK? are for.

 READING ZIL (a quick key)
   <...> is a form (a call or definition), (...) a list (one property in an
   OBJECT). ,NAME is a global value, .NAME a local one. ;'string' is a
   comment (single quotes here stand in for double quotes)."

;"NOTE: there is no <VERSION> form here on purpose. frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner. CONSTANT
  names a value that never changes."
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
  pitch-black room as if it were lit.

  <SETG HERE-LIT <SEARCH-FOR-LIGHT>> shows ZIL's nesting: the inner form
  runs first and its result (here false: the lantern is off and the cellar
  unlit) becomes the value SETG stores. The order of the lines matters:
  SEARCH-FOR-LIGHT looks around the PLAYER, so it must come after the MOVE.
  The other forms: ROUTINE defines code, () is GO's empty argument list,
  TELL and CRLF print, SETG sets a global, MOVE puts one object in another."
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
  comes after it, so it can use the library's flags.

  zillib's pieces this sample leans on: the flags LIGHTBIT, DEVICEBIT and
  TAKEBIT; the TURN ON / TURN OFF verbs (their SYNTAX lines look for a
  DEVICEBIT object, and zillib's own versions only set or clear ONBIT);
  SEARCH-FOR-LIGHT, NOW-LIT?, NOW-DARK? and the HERE-LIT global; and the
  darkness messages."
<INSERT-FILE "parser">

"Rooms"

;"No LIGHTBIT -- this room is dark without a light source. Its LDESC is only
  shown while the player can see.

  In the dark, LOOK prints neither the room's name nor its LDESC, only
  zillib's 'It is pitch black. You can't see a thing.' (the status line
  says Darkness). Give the room (FLAGS LIGHTBIT) and the lantern would make
  no difference at all.

  It has no exits. The LDESC's ladder and hatch are only words: the sample
  is about light, not movement."
<ROOM CELLAR
    (DESC "Dark Cellar")
    (IN ROOMS)
    (LDESC "A low stone cellar smelling of old earth and damp stone.
A ladder leads back up through the hatch to the north.")>

"Objects"

;"The lantern starts in the player's hands (IN PLAYER), switched off: no
  LIGHTBIT yet. DEVICEBIT lets TURN ON / TURN OFF be aimed at it; zillib's
  own versions of those verbs only set ONBIT, which says nothing about light,
  so LANTERN-R takes them over.

  Property by property:
    (DESC 'brass lantern')        its name in messages.
    (SYNONYM LANTERN LAMP LIGHT)  nouns: TURN ON LAMP works too.
    (ADJECTIVE BRASS OLD)         OLD LANTERN, BRASS LAMP...
    (IN PLAYER)                   it starts carried. PLAYER is zillib's
                                  object for the player; anything IN it is
                                  inventory.
    TAKEBIT                       it can be dropped and picked up again.
    DEVICEBIT                     a switchable thing: TURN ON, TURN OFF and
                                  FLIP apply to it. Without DEVICEBIT,
                                  zillib would answer 'That's not something
                                  you can switch on and off.' -- though
                                  here LANTERN-R answers first anyway.
    (ACTION LANTERN-R)            the routine below.
  LIGHTBIT is absent at the start: an object with LIGHTBIT gives light.
  Add it to the FLAGS and the game would start lit."
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
    EXAMINE  -- says whether it is lit, read from the flag with FSET?.

  The ZIL pieces, one at a time:
    <ROUTINE LANTERN-R () ...>  an ACTION routine: no arguments, because
                the parser has already set the globals it needs (PRSA, the
                action; PRSO, the object -- the lantern).
    <COND (test body...) ...>   if / else-if. The first clause whose test is
                true runs; (ELSE ...) catches everything else.
    <VERB? TURN-ON>  true when the action is TURN-ON. TURN ON LANTERN and
                TURN LANTERN ON are different sentences that zillib's
                SYNTAX lines turn into this one action. (FLIP LANTERN, or
                SWITCH LANTERN, is zillib's FLIP action, which performs
                TURN-ON or TURN-OFF depending on ONBIT -- and since this
                lantern never sets ONBIT, FLIP always means TURN-ON here.)
    <FSET ,LANTERN ,LIGHTBIT>   set a flag on an object. FCLEAR clears it;
                <FSET? obj flag> asks whether it is set. Note the commas:
                both the object and the flag are global names.
    <NOW-LIT?>  zillib: if the player could not see, but now can, set
                HERE-LIT, print the message and LOOK. If the player could
                already see, it does nothing -- so it is safe to call
                whenever the light MIGHT have changed.
    <NOW-DARK?> the reverse: if the player could see, and now cannot, clear
                HERE-LIT and print 'You are plunged into darkness.'
    <RTRUE>     'handled': zillib's own V-TURN-ON never runs, so the
                generic 'You switch on the brass lantern.' is not printed
                after our message.
    <RFALSE>    'not mine': TAKE, DROP and the rest get zillib's default.

  Why the order inside each clause matters: the flag changes FIRST and the
  NOW- routine comes after, because NOW-LIT? looks for a light -- if it
  ran before the FSET it would find none and do nothing.

  A simplification to know about: this lantern never sets ONBIT and does not
  check whether it is already lit, so TURN ON LANTERN twice prints the
  flare-up line twice. A fuller game would test <FSET? ,LANTERN ,LIGHTBIT>
  first and answer 'It's already on.'"
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
