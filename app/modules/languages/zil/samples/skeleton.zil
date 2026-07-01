;"ZIL skeleton — a minimal compilable starting point.
 Adapted from the ZILF empty game template (sample/empty/empty.zil).
 Source: ZILF sample/empty/, rev 5262550, GPLv3."

; NOTE: <VERSION> is NOT included here — it is injected by the Compile() API.

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"West of House|
An Interactive Starting Point|
A ZIL Skeleton">

<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "You stand at the threshold of a new adventure." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,WEST-OF-HOUSE>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

<INSERT-FILE "parser">

"Rooms"

<ROOM WEST-OF-HOUSE
    (DESC "West of House")
    (IN ROOMS)
    (LDESC "You are standing in an open field west of a white house, with a boarded
front door. A path winds south into the forest.")
    (FLAGS LIGHTBIT)>
