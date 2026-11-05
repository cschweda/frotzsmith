;"ZIL skeleton -- a minimal compilable starting point.
 Adapted from the ZILF empty game template (sample/empty/empty.zil).
 Source: ZILF sample/empty/, rev 5262550, GPLv3.

 WHAT THIS SAMPLE TEACHES
   The least a ZIL game needs: a banner, a GO routine that starts play, the
   zillib parser, and one lit room to stand in. Copy it and grow your game
   from here.

 HOW THE GAME FLOWS
   One room, West of House. There is nothing to do yet: LOOK shows the room
   again. Everything else you type gets zillib's stock replies.

 ZIL IN ONE PARAGRAPH (for a newcomer)
   ZIL is the language Infocom wrote Zork in. A program is a list of forms in
   angle brackets: <ROUTINE ...> defines code, <ROOM ...> and <OBJECT ...>
   define the world. A comma reads a global (,HERE), a dot reads a local
   (.X). A string standing alone at the top level is ignored, and a
   semicolon comments out the form after it -- this whole header is a
   string behind a semicolon, so the compiler skips it."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner (Release 1)."
<CONSTANT RELEASEID 1>

;"GAME-BANNER is printed by V-VERSION at startup: the title and subtitle.
  The | character is a line break inside a ZIL string."
<CONSTANT GAME-BANNER
"West of House|
An Interactive Starting Point|
A ZIL Skeleton">

;"GO -- the routine the Z-machine runs first. zillib does not call it for
  you, so it does the start-up work itself, in this order:
    1. print an opening line and the banner (V-VERSION);
    2. put the player somewhere: HERE is zillib's 'current room' global,
       and the PLAYER object has to be moved into that room as well;
    3. describe the room (V-LOOK);
    4. hand over to MAIN-LOOP, zillib's read-a-command, run-it loop, which
       never returns."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "You stand at the threshold of a new adventure." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,WEST-OF-HOUSE>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"INSERT-FILE pastes in zillib, the standard library: the parser, the
  standard verbs (TAKE, DROP, LOOK, INVENTORY...) and the PLAYER object.
  It comes after GO and before the world, so the world can use the flags
  (LIGHTBIT, TAKEBIT...) the library defines."
<INSERT-FILE "parser">

"Rooms"

;"A room is a ROOM form. (IN ROOMS) is what makes it a room: ROOMS is the
  library's container for every location. DESC is the room's name, LDESC its
  long description, and LIGHTBIT means the room is lit -- without it the
  player would be standing in the dark."
<ROOM WEST-OF-HOUSE
    (DESC "West of House")
    (IN ROOMS)
    (LDESC "You are standing in an open field west of a white house, with a boarded
front door. A path winds south into the forest.")
    (FLAGS LIGHTBIT)>
