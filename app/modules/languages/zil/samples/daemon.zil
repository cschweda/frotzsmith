;"The Burning Candle -- daemon / timed event demo.
 Hand-written for the Frotzsmith sample set.

 WHAT THIS SAMPLE TEACHES
   - A daemon: a routine that runs by itself after every turn. zillib keeps
     a queue of them (zillib/events.zil); MAIN-LOOP calls CLOCKER after each
     command, and CLOCKER runs whatever is queued.
       <QUEUE ,CANDLE-BURN -1>  -- run CANDLE-BURN every turn (-1 = forever)
       <DEQUEUE ,CANDLE-BURN>   -- take it off the queue again
   - What a queued routine returns matters: true means 'I printed something
     the player should see', which also stops a WAIT early. zillib's WAIT
     (Z) normally lets several turns pass at once.
   - A global variable as a countdown, and darkness when the light runs out.

 HOW THE GAME FLOWS
   You are in a dark cellar holding a lit candle, the only light. Each turn
   the candle burns down and says how long it has left. Press Z (wait) five
   times: on the fifth it goes out and the cellar goes dark. No puzzle and
   no ending; nothing more happens after that."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"The Burning Candle|
A ZIL Daemon and Timed Event Demo">

;"Candle burn counter: starts at 5, taken down by one each turn by
  CANDLE-BURN. A GLOBAL keeps its value across turns (a local would not)."
<GLOBAL CANDLE-LIFE 5>

;"CANDLE-BURN -- the daemon, run by CLOCKER after every turn.
  Each turn it takes one off CANDLE-LIFE (SETG sets a global).
    - Light left (CANDLE-LIFE 1 or more): report it, in the singular for the
      last turn. Return true (RTRUE): the player has been told something, so
      a WAIT stops here and each Z is one turn of candle.
    - None left (L? is 'less than'): take the daemon off the queue so it
      never runs again, clear the candle's LIGHTBIT so it gives no light,
      and call NOW-DARK?, zillib's routine for 'the light just went', which
      prints the darkness message."
<ROUTINE CANDLE-BURN ()
    <SETG CANDLE-LIFE <- ,CANDLE-LIFE 1>>
    <COND (<L? ,CANDLE-LIFE 1>
           <DEQUEUE ,CANDLE-BURN>
           <FCLEAR ,CANDLE ,LIGHTBIT>
           <TELL "The candle gutters and goes out, plunging the cellar into darkness." CR>
           <NOW-DARK?>
           <RTRUE>)
          (ELSE
           <TELL "The candle flickers (" N ,CANDLE-LIFE>
           <COND (<1? ,CANDLE-LIFE> <TELL " turn of light remains)." CR>)
                 (ELSE <TELL " turns of light remain)." CR>)>
           <RTRUE>)>>

;"GO runs first: print the opening, put the player in the Cellar (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), start the candle's daemon, describe the room, then start zillib's
  command loop, which never returns. The QUEUE comes before MAIN-LOOP so the
  candle is already burning on the first turn."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A demonstration of the QUEUE daemon mechanism for timed events." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,CELLAR>
    <MOVE ,PLAYER ,HERE>
    ;"Register the candle daemon: -1 means fire every turn indefinitely."
    <QUEUE ,CANDLE-BURN -1>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs, the PLAYER and the event queue
  (QUEUE, DEQUEUE, CLOCKER). The world below comes after it, so it can use
  the library's flags. CANDLE-BURN above names the CANDLE before it is
  defined; ZIL allows that, since names are resolved for the whole file."
<INSERT-FILE "parser">

"Rooms"

;"No LIGHTBIT -- the candle in the player's inventory provides the only light."
<ROOM CELLAR
    (DESC "Damp Cellar")
    (IN ROOMS)
    (LDESC "A damp stone cellar. The dripping of water echoes in the dark.
The only exit is up through the hatch.")>

"Objects"

;"The candle starts lit (LIGHTBIT) in the player's hands (IN PLAYER), so the
  cellar can be seen from the first turn. CANDLE-BURN clears LIGHTBIT when
  it runs out."
<OBJECT CANDLE
    (DESC "wax candle")
    (SYNONYM CANDLE)
    (ADJECTIVE WAX LIT BURNING)
    (IN PLAYER)
    (FDESC "A lit wax candle drips steadily, casting warm light.")
    (FLAGS TAKEBIT LIGHTBIT)>
