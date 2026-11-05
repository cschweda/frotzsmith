;"Two Rooms -- directional exits and a takeable object.
 Hand-written for the Frotzsmith sample set.

 WHAT THIS SAMPLE TEACHES
   - Rooms live IN ROOMS, the library's container for every location.
   - An exit is a property named after its direction: (EAST TO GARDEN).
     Exits are one-way, so each room names its own way back.
   - An OBJECT with TAKEBIT can be picked up, carried and dropped.
   - FDESC: the line a room shows for an object until it is first moved.

 HOW THE GAME FLOWS
   You start in the Hall, where a gold coin lies on the floor. TAKE COIN,
   go EAST to the Garden and WEST back again; INVENTORY shows the coin.
   There is no puzzle and no ending -- it is a map with one thing in it."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"Two Rooms|
A ZIL Rooms and Objects Demo">

;"GO runs first: print the opening, put the player in the Hall (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), describe it, then start zillib's command loop, which never returns."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A simple demonstration of two connected rooms." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,HALL>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs and the PLAYER. The world below
  comes after it, so it can use the library's flags."
<INSERT-FILE "parser">

"Rooms"

;"The Hall. (EAST TO GARDEN) is the whole of the exit: typing EAST (or E)
  moves the player to GARDEN. LIGHTBIT keeps the room lit."
<ROOM HALL
    (DESC "Hall")
    (IN ROOMS)
    (LDESC "A stone hall, its torchlit walls hung with faded tapestries.
A doorway leads east to the garden.")
    (EAST TO GARDEN)
    (FLAGS LIGHTBIT)>

;"The Garden. Exits only go one way, so the way back is its own property:
  (WEST TO HALL)."
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
  once it has been moved, the library lists it in its own plain words."
<OBJECT COIN
    (DESC "gold coin")
    (SYNONYM COIN)
    (ADJECTIVE GOLD SHINY)
    (IN HALL)
    (FDESC "A shiny gold coin glints on the floor.")
    (FLAGS TAKEBIT)>
