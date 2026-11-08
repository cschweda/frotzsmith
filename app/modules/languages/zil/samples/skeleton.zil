;"ZIL skeleton -- a minimal compilable starting point.
 Adapted from the ZILF empty game template (sample/empty/empty.zil).
 Source: ZILF sample/empty/, rev 5262550, GPLv3.

 WHAT THIS SAMPLE TEACHES
   The least a ZIL game needs: a banner, a GO routine that starts play, the
   zillib parser, and one lit room to stand in. Copy it and grow your game
   from here.

 HOW THE GAME FLOWS
   One room, West of House. There is nothing to do yet: LOOK shows the room
   again. Everything else you type gets zillib's stock replies (TAKE HOUSE,
   JUMP, INVENTORY, SAVE, QUIT... all work, because zillib supplies them).

 THE INFORM 6 EQUIVALENT
   The Inform 6 sample 'std-skeleton' is the same idea in the other language.
   Where this file has GO, Inform has Initialise(); where this file has
   INSERT-FILE parser, Inform has Include Parser and Include VerbLib; a ROOM
   with LIGHTBIT is an Inform Object that 'has light'.

 ZIL IN ONE PARAGRAPH (for a newcomer)
   ZIL is the language Infocom wrote Zork in. A program is a list of forms in
   angle brackets: <ROUTINE ...> defines code, <ROOM ...> and <OBJECT ...>
   define the world. A comma reads a global (,HERE), a dot reads a local
   (.X). A string standing alone at the top level is ignored, and a
   semicolon comments out the form after it -- this whole header is a
   string behind a semicolon, so the compiler skips it.

 ZIL SYNTAX, A LITTLE SLOWER
   - A FORM is anything in angle brackets: <NAME arg arg ...>. The first
     word says what to do and the rest are its arguments, so <TELL 'Hi' CR>
     means 'call TELL with the string and CR'. Forms nest: <MOVE ,PLAYER
     ,HERE> passes two values, each of which is itself read from a global.
     (In this comment single quotes stand in for double quotes, because a
     double quote would end the comment early.)
   - A LIST is anything in round brackets: (DESC 'West of House'). Inside a
     ROOM or OBJECT each list is one property, its name first.
   - An ATOM is a bare name like GO, HERE or LIGHTBIT. Names may contain
     hyphens and question marks (WEST-OF-HOUSE, FSET?). Upper case is the
     custom, from Infocom's day.
   - ,NAME is the global value of NAME (a GLOBAL, CONSTANT, object or room).
     .NAME is the local value (a routine argument or AUX variable). Mixing
     them up is the classic ZIL mistake: .HERE would look for a local
     called HERE, which does not exist.
   - ;anything removes the next whole thing from the program. Here it is
     always ;'a string' (written with real double quotes in the file), but
     ;<FORM ...> also works and is handy for switching code off.
   - Text between double quotes is a string. Inside a string a vertical bar
     | is a line break, and a real line break in the source is read as a
     single space (or dropped, right after a |), so long text can be
     wrapped freely."

;"NOTE: there is no <VERSION> form here on purpose. frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one).
  In a stand-alone ZILF project the first form of the file would be a
  VERSION form naming the format: ZIP for z3, XZIP for z5. z3 is the
  format of the original Zork games: small, plain text, a status line the
  interpreter draws by itself."

;"RELEASEID is the release number zillib prints in the banner (Release 1).
  CONSTANT gives a name to a value that never changes; the compiler also
  writes RELEASEID into the story file's header, where interpreters and the
  banner read it. Bump it each time you hand out a new version of a game."
<CONSTANT RELEASEID 1>

;"GAME-BANNER is printed by V-VERSION at startup: the title and subtitle.
  The | character is a line break inside a ZIL string. V-VERSION then adds
  zillib's own line: Release 1 / Serial number (the build date) / the ZILF
  version. Typing VERSION during play prints the same block again."
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
       never returns.

  Reading the routine line by line:
    <ROUTINE GO () ...>  ROUTINE defines code. GO is its name; () is its
                         argument list, empty here. It must be: in z3 and z5
                         the start routine is jumped into rather than
                         called, so it can have no arguments and no local
                         variables.
                         Everything after the list is the body, run in
                         order.
    <CRLF>               prints a line break (carriage return, line feed).
    <TELL ... CR CR>     prints. TELL takes a run of items: a string is
                         printed as it is, CR is a line break. Other items
                         TELL understands (D for an object's name, N for a
                         number, A and T for 'a lamp' and 'the lamp') turn
                         up in the other samples.
    <V-VERSION>          calls zillib's routine for the VERSION verb, which
                         prints GAME-BANNER and the release line.
    <SETG HERE ,WEST-OF-HOUSE>
                         SETG sets a global variable. HERE is zillib's
                         record of the room the player is in; the parser,
                         LOOK and the exits all read it.
    <MOVE ,PLAYER ,HERE> MOVE puts an object inside another: here the
                         PLAYER object (defined by zillib) into the room.
                         HERE says where the player is for the library's
                         bookkeeping; the PLAYER's real location is what
                         decides what can be seen and touched. Both must
                         agree, so a game always sets both.
    <V-LOOK>             zillib's LOOK: the room name, its description and
                         a list of anything lying about.
    <MAIN-LOOP>          from here on zillib runs the game: prompt, read a
                         command, parse it, perform it, run the clock,
                         repeat. It never returns, so nothing after it would
                         ever run."
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
  (LIGHTBIT, TAKEBIT...) the library defines.

  What zillib gives a game for nothing:
    - the parser: it reads what the player types, matches the words against
      every object's SYNONYM and ADJECTIVE words and every SYNTAX line, and
      sets PRSA (the action), PRSO (the direct object) and PRSI (the
      indirect object) before anything is performed;
    - some sixty verbs, each a V- routine (V-LOOK, V-TAKE, V-WALK...),
      with the stock replies you see when no object has anything special to
      say;
    - the standard flags and properties (LIGHTBIT, TAKEBIT, DESC, LDESC...);
    - the PLAYER object, the ROOMS container every room lives in, the event
      queue (QUEUE, CLOCKER) and, when switched on, scoring.
  Without this line the game would not compile: V-VERSION, V-LOOK,
  MAIN-LOOP, PLAYER, ROOMS and LIGHTBIT would all be unknown names."
<INSERT-FILE "parser">

"Rooms"

;"The bare string just above is a section heading. A string standing alone
  at the top level does nothing, so files use them as headings.

  A room is a ROOM form. (IN ROOMS) is what makes it a room: ROOMS is the
  library's container for every location. DESC is the room's name, LDESC its
  long description, and LIGHTBIT means the room is lit -- without it the
  player would be standing in the dark.

  Reading it property by property:
    WEST-OF-HOUSE   the room's name inside the program: GO refers to it as
                    ,WEST-OF-HOUSE. The player never sees this name.
    (DESC ...)      the short name, printed as the heading of the room
                    description (in bold from z4 up) and shown in the status
                    line.
    (IN ROOMS)      where the object starts. Every room starts IN ROOMS;
                    zillib relies on that to tell rooms from things.
    (LDESC ...)     the long description that LOOK prints under the name.
    (FLAGS ...)     the flags the room starts with. LIGHTBIT is the only one
                    a plain room needs. There are no exits: a direction such
                    as NORTH here gets zillib's 'You can't go that way.'

  To grow the game: add a second ROOM with its own (IN ROOMS), then give
  this one an exit property such as (NORTH TO THAT-ROOM). The 'Two Rooms'
  sample shows exactly that."
<ROOM WEST-OF-HOUSE
    (DESC "West of House")
    (IN ROOMS)
    (LDESC "You are standing in an open field west of a white house, with a boarded
front door. A path winds south into the forest.")
    (FLAGS LIGHTBIT)>
