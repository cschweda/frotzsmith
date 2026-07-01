;"Two Rooms — directional exits and a takeable object.
 Demonstrates rooms, the IN ROOMS pseudo-room, directional connections,
 and a simple TAKEBIT object. Hand-written for the Frotzsmith sample set."

; NOTE: <VERSION> is NOT included here — it is injected by the Compile() API.

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"Two Rooms|
A ZIL Rooms and Objects Demo">

<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A simple demonstration of two connected rooms." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,HALL>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

<INSERT-FILE "parser">

"Rooms"

<ROOM HALL
    (DESC "Hall")
    (IN ROOMS)
    (LDESC "A stone hall, its torchlit walls hung with faded tapestries.
A doorway leads east to the garden.")
    (EAST TO GARDEN)
    (FLAGS LIGHTBIT)>

<ROOM GARDEN
    (DESC "Garden")
    (IN ROOMS)
    (LDESC "A small walled garden, bright with afternoon sun. A doorway
to the west leads back to the hall.")
    (WEST TO HALL)
    (FLAGS LIGHTBIT)>

"Objects"

<OBJECT COIN
    (DESC "gold coin")
    (SYNONYM COIN)
    (ADJECTIVE GOLD SHINY)
    (IN HALL)
    (FDESC "A shiny gold coin glints on the floor.")
    (FLAGS TAKEBIT)>
