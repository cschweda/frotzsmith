"The Burning Candle -- daemon / timed event demo.
Demonstrates the QUEUE mechanism from zillib/events.zil for per-turn events.
A burning candle counts down 5 turns then goes out, plunging the room into
darkness. The daemon fires automatically after each player action via CLOCKER.
Hand-written for the Frotzsmith sample set.

Key forms:
  <QUEUE ,CANDLE-BURN -1>  -- register a routine to run every turn
  <DEQUEUE ,CANDLE-BURN>   -- remove the routine from the queue
  CLOCKER (called by MAIN-LOOP) advances the queue each turn.

Try: press Z (wait) five times to watch the candle burn down."

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"The Burning Candle|
A ZIL Daemon and Timed Event Demo">

;"Candle burn counter: starts at 5, decremented each turn by CANDLE-BURN."
<GLOBAL CANDLE-LIFE 5>

;"CANDLE-BURN -- the daemon routine, called every turn via QUEUE.
  Each turn: decrement CANDLE-LIFE.
  When it reaches 0: dequeue self, clear LIGHTBIT, trigger NOW-DARK?."
<ROUTINE CANDLE-BURN ()
    <SETG CANDLE-LIFE <- ,CANDLE-LIFE 1>>
    <COND (<L? ,CANDLE-LIFE 1>
           <DEQUEUE ,CANDLE-BURN>
           <FCLEAR ,CANDLE ,LIGHTBIT>
           <TELL "The candle gutters and goes out, plunging the cellar into darkness." CR>
           <NOW-DARK?>
           <RTRUE>)
          (ELSE
           <TELL "The candle flickers (" N ,CANDLE-LIFE " turns of light remain)." CR>
           <RFALSE>)>>

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

<INSERT-FILE "parser">

"Rooms"

;"No LIGHTBIT -- the candle in the player's inventory provides the only light."
<ROOM CELLAR
    (DESC "Damp Cellar")
    (IN ROOMS)
    (LDESC "A damp stone cellar. The dripping of water echoes in the dark.
The only exit is up through the hatch.")>

"Objects"

;"The candle starts lit (LIGHTBIT set) in the player's inventory.
  SEARCH-FOR-LIGHT finds it there and illuminates the room."
<OBJECT CANDLE
    (DESC "wax candle")
    (SYNONYM CANDLE)
    (ADJECTIVE WAX LIT BURNING)
    (IN PLAYER)
    (FDESC "A lit wax candle drips steadily, casting warm light.")
    (FLAGS TAKEBIT LIGHTBIT)>
