;"Two Rooms -- directional exits and a takeable object.
 Hand-written for the frotzsmith sample set.

 WHAT THIS SAMPLE TEACHES
   - Rooms live IN ROOMS, the library's container for every location.
   - An exit is a property named after its direction: (EAST TO GARDEN).
     Exits are one-way, so each room names its own way back.
   - An OBJECT with TAKEBIT can be picked up, carried and dropped.
   - FDESC: the line a room shows for an object until it is first moved.

 HOW THE GAME FLOWS
   You start in the Hall, where a gold coin lies on the floor. TAKE COIN,
   go EAST to the Garden and WEST back again; INVENTORY shows the coin.
   There is no puzzle and no ending -- it is a map with one thing in it.

 THE MAP
       Hall  <---- east / west ---->  Garden
     (start, coin)

 THE INFORM 6 EQUIVALENT
   The Inform 6 sample 'puny-two-rooms' builds the same kind of map. An
   Inform exit is a property too (e_to Garden), an Inform room is an Object
   that 'has light', and Inform's 'initial' property plays the part of
   FDESC here.

 READING ZIL (a quick key, explained again where each first appears)
   <...> is a form: a call or a definition. (...) is a list: inside a ROOM or
   OBJECT, one property. ,NAME reads a global value, .NAME a local one. A
   semicolon in front of a string, like the one at the top of this file,
   turns the string into a comment. Inside these comments single quotes
   stand in for double quotes, which would end the comment."

;"NOTE: there is no <VERSION> form here on purpose. frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one).
  A stand-alone ZILF project would start with a VERSION form naming ZIP."

;"RELEASEID is the release number zillib prints in the banner. CONSTANT
  names a value that never changes."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"Two Rooms|
A ZIL Rooms and Objects Demo">

;"GO runs first: print the opening, put the player in the Hall (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), describe it, then start zillib's command loop, which never returns.

  Line by line:
    <CRLF>              a line break.
    <TELL ... CR CR>    print the string, then two line breaks (CR).
    <V-VERSION>         zillib's VERSION verb: GAME-BANNER and the release.
    <SETG HERE ,HALL>   SETG sets a global; HERE is the room zillib thinks
                        the player is in. ,HALL is the room defined below:
                        a ZIL file may use a name before defining it.
    <MOVE ,PLAYER ,HERE>
                        MOVE puts the PLAYER object (zillib's) inside the
                        Hall. What the player can see and touch is worked
                        out from where the PLAYER object really is, so this
                        must agree with HERE.
    <V-LOOK>            describe the room, as the LOOK verb does.
    <MAIN-LOOP>         zillib's endless read-parse-perform loop."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A simple demonstration of two connected rooms." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,HALL>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs and the PLAYER. The world below
  comes after it, so it can use the library's flags.

  Everything the player does in this game is zillib's own work: TAKE, DROP,
  INVENTORY, LOOK, EAST, WEST, EXAMINE. The game only describes the world;
  the library supplies the behaviour. INSERT-FILE reads parser.zil, which
  in turn reads zillib's other files (verbs, events, scope...)."
<INSERT-FILE "parser">

"Rooms"

;"(A bare string such as Rooms just above does nothing: it is a heading.)

  The Hall. (EAST TO GARDEN) is the whole of the exit: typing EAST (or E)
  moves the player to GARDEN. LIGHTBIT keeps the room lit.

  Property by property:
    HALL            the program's name for the room (,HALL in GO).
    (DESC ...)      the room's title, printed above its description and in
                    the status line.
    (IN ROOMS)      every room starts inside ROOMS, zillib's container of
                    locations. That is how the library knows it is a room.
    (LDESC ...)     the description LOOK prints. Its line break in the
                    source becomes a space when printed.
    (EAST TO GARDEN)
                    an exit. The property name is the direction (zillib
                    knows NORTH, SOUTH, EAST, WEST, NE, NW, SE, SW, UP,
                    DOWN, IN and OUT, and the short forms N, S, E, W, U, D);
                    TO names the room it leads to. zillib's WALK verb looks
                    the direction up on the current room and, if there is
                    an exit, moves the player there and describes the new
                    room. A direction with no exit property gets 'You
                    can't go that way.'
    (FLAGS LIGHTBIT) the room is lit, so the player can see in it. A room
                    without LIGHTBIT is dark unless something lit is there
                    (the 'Dark Cellar' sample).

  The LDESC mentions the doorway but not the coin: the coin describes
  itself (its FDESC, below), so that line can disappear once it is taken."
<ROOM HALL
    (DESC "Hall")
    (IN ROOMS)
    (LDESC "A stone hall, its torchlit walls hung with faded tapestries.
A doorway leads east to the garden.")
    (EAST TO GARDEN)
    (FLAGS LIGHTBIT)>

;"The Garden. Exits only go one way, so the way back is its own property:
  (WEST TO HALL). Leave it out and the player could walk east into the
  Garden and never get back: nothing in ZIL adds return exits for you.
  Anything other than WEST here is refused with zillib's stock message."
<ROOM GARDEN
    (DESC "Garden")
    (IN ROOMS)
    (LDESC "A small walled garden, bright with afternoon sun. A doorway
to the west leads back to the hall.")
    (WEST TO HALL)
    (FLAGS LIGHTBIT)>

"Objects"

;"The coin. SYNONYM lists the nouns the player can call it and ADJECTIVE
  the words that may come before them, so TAKE COIN, TAKE GOLD COIN and
  TAKE SHINY COIN all work. (IN HALL) is where it starts. TAKEBIT lets it
  be picked up. FDESC is how the Hall describes it until it is first taken;
  once it has been moved, the library lists it in its own plain words.

  Property by property:
    COIN            the program's name (,COIN). The player never types it;
                    they type the words in SYNONYM and ADJECTIVE.
    (DESC ...)      the object's short name, used whenever the library
                    names it: in the INVENTORY list ('a gold coin'), in
                    'There is a gold coin here.', in 'Which do you mean...'.
                    zillib adds 'a' or 'the' itself, so DESC has no
                    article.
    (SYNONYM COIN)  the nouns that mean this object. Several are allowed:
                    (SYNONYM COIN MONEY) would make TAKE MONEY work too.
    (ADJECTIVE GOLD SHINY)
                    words that may come before a noun. GOLD alone is not a
                    name for the coin, but GOLD COIN is.
    (IN HALL)       its starting place. Without an IN the object would
                    begin nowhere, out of play, until a MOVE put it
                    somewhere.
    (FDESC ...)     the 'first description': the line the room prints for
                    the object until the object has been touched. zillib
                    sets the object's TOUCHBIT when it is taken; from then
                    on the room says 'There is a gold coin here.' instead,
                    which is right for a coin that has been dropped
                    somewhere else.
    (FLAGS TAKEBIT) TAKEBIT means it can be picked up. Without it TAKE COIN
                    would get zillib's refusal and the coin would stay put.

  There is no ACTION routine: the coin does nothing special, so every verb
  aimed at it gets zillib's ordinary behaviour."
<OBJECT COIN
    (DESC "gold coin")
    (SYNONYM COIN)
    (ADJECTIVE GOLD SHINY)
    (IN HALL)
    (FDESC "A shiny gold coin glints on the floor.")
    (FLAGS TAKEBIT)>
