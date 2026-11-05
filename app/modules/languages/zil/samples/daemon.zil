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
   no ending; nothing more happens after that.

 THE TIMELINE, TURN BY TURN (the walkthrough is five Zs)
     start     CANDLE-LIFE 5, the candle lit, the cellar visible
     Z  1      CANDLE-BURN: 5 -> 4   'The candle flickers (4 turns of light
                                      remain).'
     Z  2      4 -> 3                '(3 turns of light remain)'
     Z  3      3 -> 2                '(2 turns of light remain)'
     Z  4      2 -> 1                '(1 turn of light remains)'
     Z  5      1 -> 0                the candle goes out, the daemon is
                                      dequeued, the cellar goes dark
   Any command that takes game time counts the same as a Z: LOOK, EXAMINE
   CANDLE, DROP CANDLE. 'Game verbs' that take no time in the story --
   INVENTORY, SAVE, VERSION -- do not burn the candle.

 HOW A TURN ENDS IN zillib (where the daemon runs)
   MAIN-LOOP: read and parse a command -> PERFORM it -> if it was not a game
   verb, run the room's M-END and then CLOCKER -> repeat. CLOCKER adds one
   to MOVES (the turn counter) and calls every queued routine that is due.
   WAIT is itself a game verb: zillib's V-WAIT prints 'Time passes.' and
   then runs M-END and CLOCKER itself, up to four times, stopping early when
   a queued routine returns true.

 THE INFORM 6 EQUIVALENT
   The Inform 6 sample 'timed-candle' is the same game. There a daemon is a
   property of an object, started with StartDaemon(candle) and stopped with
   StopDaemon(candle). In ZIL a daemon is just a routine handed to QUEUE,
   with no object attached; DEQUEUE plays the part of StopDaemon.

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
"The Burning Candle|
A ZIL Daemon and Timed Event Demo">

;"Candle burn counter: starts at 5, taken down by one each turn by
  CANDLE-BURN. A GLOBAL keeps its value across turns (a local would not).

  <GLOBAL NAME value> creates a variable that lives for the whole game and
  is saved with it (SAVE and RESTORE bring it back). Read it as
  ,CANDLE-LIFE, change it with SETG. A local variable, by contrast, belongs
  to one call of one routine and is gone when the routine returns -- no use
  for a number that must survive from one turn to the next."
<GLOBAL CANDLE-LIFE 5>

;"CANDLE-BURN -- the daemon, run by CLOCKER after every turn.
  Each turn it takes one off CANDLE-LIFE (SETG sets a global).
    - Light left (CANDLE-LIFE 1 or more): report it, in the singular for the
      last turn. Return true (RTRUE): the player has been told something, so
      a WAIT stops here and each Z is one turn of candle.
    - None left (L? is 'less than'): take the daemon off the queue so it
      never runs again, clear the candle's LIGHTBIT so it gives no light,
      and call NOW-DARK?, zillib's routine for 'the light just went', which
      prints the darkness message.

  The ZIL pieces, one at a time:
    <ROUTINE CANDLE-BURN () ...>
                  a queued routine takes no arguments; CLOCKER calls it with
                  none.
    <SETG CANDLE-LIFE <- ,CANDLE-LIFE 1>>
                  arithmetic is written as forms too: <- a b> is a minus b,
                  and the forms <+ ...> <* ...> </ ...> and <MOD ...> do the
                  rest. The inner form runs first; SETG stores its result.
    <COND (test body...) (ELSE body...)>
                  if / else. The first clause whose test is true runs.
    <L? ,CANDLE-LIFE 1>
                  'less than': true once the counter has reached 0. Its
                  relatives are G? (greater), L=? and G=?, ==? (equal) and
                  N==? (not equal). The question mark is ZIL's mark for
                  'this asks a yes/no question'.
    <DEQUEUE ,CANDLE-BURN>
                  remove the routine from zillib's queue. Without it the
                  daemon would go on running every turn, counting down into
                  negative numbers and saying the candle goes out each time.
    <FCLEAR ,CANDLE ,LIGHTBIT>
                  clear the flag that makes the candle a light. FSET would
                  set it again; <FSET? obj flag> tests it.
    <NOW-DARK?>   zillib: if the player could see and no longer can, clear
                  HERE-LIT and print 'You are plunged into darkness.' The
                  flag must be cleared FIRST, or zillib would still find the
                  candle's light and say nothing.
    <TELL 'The candle flickers (' N ,CANDLE-LIFE>
                  TELL prints a run of items: a string as it is, and after N
                  the value of a number. No CR yet: the sentence continues in
                  the next TELL.
    <1? ,CANDLE-LIFE>
                  'is it exactly 1?' -- a shorthand like 0? for 'is it 0?'.
                  It picks 'turn ... remains' over 'turns ... remain'.
    <RTRUE>       the value CLOCKER sees. True means 'I printed something':
                  it tells a multi-turn WAIT to stop so the player can read
                  it. Return false from a daemon that prints nothing that
                  turn, or every WAIT would stop after one turn."
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
  candle is already burning on the first turn.

  <QUEUE ,CANDLE-BURN -1> -- the first argument is the routine itself
  (,CANDLE-BURN is the routine's address, not a call: no angle brackets
  round it), the second is when it fires: a positive number N means 'once,
  at the end of the Nth turn from now', and -1 means 'at the end of every
  turn until dequeued'. A candle that only went out after five turns, with
  no countdown messages, could be <QUEUE ,CANDLE-OUT 5> instead.

  The other forms: CRLF and TELL print, SETG sets a global, MOVE puts the
  PLAYER object into the room, V-LOOK describes it, and MAIN-LOOP runs the
  game from then on."
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

;"No LIGHTBIT -- the candle in the player's inventory provides the only light.

  zillib's rule: the player can see when the room has LIGHTBIT or anything
  in sight (including what is carried) has it. At the start the candle has
  it, so the opening LOOK shows the cellar. When CANDLE-BURN clears the
  candle's flag, nothing is left, and LOOK becomes 'It is pitch black.'
  ROOM, IN ROOMS, DESC and LDESC are as in every sample: a location, its
  title and its description. No exits: the hatch is only words."
<ROOM CELLAR
    (DESC "Damp Cellar")
    (IN ROOMS)
    (LDESC "A damp stone cellar. The dripping of water echoes in the dark.
The only exit is up through the hatch.")>

"Objects"

;"The candle starts lit (LIGHTBIT) in the player's hands (IN PLAYER), so the
  cellar can be seen from the first turn. CANDLE-BURN clears LIGHTBIT when
  it runs out.

  Property by property: DESC is its name in messages; SYNONYM and ADJECTIVE
  are the words the player may use (WAX CANDLE, LIT CANDLE...); IN PLAYER
  makes it inventory from the start; TAKEBIT lets it be dropped and taken
  again; LIGHTBIT makes it a light. FDESC would be its line in the room
  description if it were lying in the room untouched -- since it starts in
  the player's hands, that line is never actually seen.

  The candle has no ACTION routine: it does nothing when handled. All of
  its behaviour lives in the daemon, which acts on it from outside."
<OBJECT CANDLE
    (DESC "wax candle")
    (SYNONYM CANDLE)
    (ADJECTIVE WAX LIT BURNING)
    (IN PLAYER)
    (FDESC "A lit wax candle drips steadily, casting warm light.")
    (FLAGS TAKEBIT LIGHTBIT)>
