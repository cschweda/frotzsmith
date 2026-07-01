"The Locked Chest -- a lock-and-key container puzzle.
Demonstrates OPENABLEBIT, LOCKEDBIT, TOOLBIT, and a custom action handler
for UNLOCK that wires the key to the chest.
Hand-written for the Frotzsmith sample set.

Puzzle flow: TAKE KEY, then UNLOCK CHEST WITH KEY,
             then OPEN CHEST, then TAKE JEWEL"

<CONSTANT RELEASEID 1>

<CONSTANT GAME-BANNER
"The Locked Chest|
A ZIL Lock-and-Key Puzzle">

<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A demonstration of a lock-and-key container puzzle." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,STOREROOM>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

<INSERT-FILE "parser">

"Rooms"

<ROOM STOREROOM
    (DESC "Storeroom")
    (IN ROOMS)
    (LDESC "A dusty storeroom. A heavy wooden chest sits in the corner.
A small iron key hangs on a hook beside the door.")
    (FLAGS LIGHTBIT)>

"Objects"

;"The chest starts locked (LOCKEDBIT set, OPENBIT clear).
  V-OPEN refuses to open it while LOCKEDBIT is set.
  CHEST-R intercepts UNLOCK and removes LOCKEDBIT when the right key is used."
<OBJECT CHEST
    (DESC "wooden chest")
    (SYNONYM CHEST BOX)
    (ADJECTIVE WOODEN HEAVY)
    (IN STOREROOM)
    (FLAGS CONTBIT OPENABLEBIT LOCKEDBIT)
    (ACTION CHEST-R)>

;"CHEST-R handles UNLOCK (custom) and EXAMINE.
  On UNLOCK: if PRSI is the iron key, clear LOCKEDBIT so OPEN works.
  On EXAMINE: describe the chest and its current lock state."
<ROUTINE CHEST-R ()
    <COND (<VERB? UNLOCK>
           <COND (<PRSI? ,IRON-KEY>
                  <FCLEAR ,CHEST ,LOCKEDBIT>
                  <TELL "You turn the iron key in the lock. There is a satisfying
click, and the chest is now unlocked." CR>
                  <RTRUE>)
                 (ELSE <RFALSE>)>)
          (<VERB? EXAMINE>
           <TELL "A stout wooden chest with a rusted iron lock.">
           <COND (<FSET? ,CHEST ,LOCKEDBIT>
                  <TELL " It is locked." CR>)
                 (<FSET? ,CHEST ,OPENBIT>
                  <TELL " It is open." CR>)
                 (ELSE
                  <TELL " It is closed but unlocked." CR>)>
           <RTRUE>)
          (ELSE <RFALSE>)>>

;"The jewel starts inside the locked chest."
<OBJECT JEWEL
    (DESC "ruby jewel")
    (SYNONYM JEWEL GEM RUBY)
    (ADJECTIVE RUBY RED GLEAMING)
    (IN CHEST)
    (FLAGS TAKEBIT VOWELBIT)>

;"IRON-KEY needs TOOLBIT so the UNLOCK syntax selects it as the unlocking tool.
  TAKEBIT lets the player pick it up first."
<OBJECT IRON-KEY
    (DESC "iron key")
    (SYNONYM KEY)
    (ADJECTIVE IRON SMALL)
    (IN STOREROOM)
    (FDESC "A small iron key hangs on a hook beside the door.")
    (FLAGS TAKEBIT TOOLBIT)>
