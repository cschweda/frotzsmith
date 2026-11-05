;"The Locked Chest -- a lock-and-key container puzzle.
 Hand-written for the Frotzsmith sample set.

 WHAT THIS SAMPLE TEACHES
   - A container: CONTBIT lets an object hold others; OPENABLEBIT lets the
     player OPEN and CLOSE it; LOCKEDBIT keeps it shut until it is unlocked.
   - An ACTION routine that takes over one verb (UNLOCK) and wires a
     particular key to a particular lock, by clearing LOCKEDBIT itself.
   - TOOLBIT: marks the key as the kind of thing UNLOCK ... WITH expects.
   - FDESC, and VOWELBIT (for 'an iron key' rather than 'a iron key').

 HOW THE GAME FLOWS
   One room, a storeroom, with a locked chest and a key on a hook.
     TAKE KEY, UNLOCK CHEST WITH KEY, OPEN CHEST, TAKE JEWEL.
   OPEN CHEST before unlocking it is refused. The jewel is the reward;
   there is no ending beyond holding it."

;"NOTE: there is no <VERSION> form here on purpose. Frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"The Locked Chest|
A ZIL Lock-and-Key Puzzle">

;"GO runs first: print the opening, put the player in the Storeroom (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), describe it, then start zillib's command loop, which never returns."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A demonstration of a lock-and-key container puzzle." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,STOREROOM>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs and the PLAYER. The world below
  comes after it, so it can use the library's flags."
<INSERT-FILE "parser">

"Rooms"

;"The only room. Its LDESC mentions the chest but not the key: the key has
  its own FDESC (below), which disappears once the key is taken. Putting the
  key in the room text too would leave it hanging there after you take it."
<ROOM STOREROOM
    (DESC "Storeroom")
    (IN ROOMS)
    (LDESC "A dusty storeroom. A heavy wooden chest sits in the corner.")
    (FLAGS LIGHTBIT)>

"Objects"

;"The chest. CONTBIT makes it a container, OPENABLEBIT lets OPEN and CLOSE
  work on it, and LOCKEDBIT starts it locked: zillib's OPEN refuses a locked
  container by itself. There is no OPENBIT, so it starts closed, and no
  TAKEBIT, so it stays put. CHEST-R handles the unlocking."
<OBJECT CHEST
    (DESC "wooden chest")
    (SYNONYM CHEST BOX)
    (ADJECTIVE WOODEN HEAVY)
    (IN STOREROOM)
    (FLAGS CONTBIT OPENABLEBIT LOCKEDBIT)
    (ACTION CHEST-R)>

;"CHEST-R -- the chest's ACTION routine, run before the verb's own routine
  whenever the chest is in the command.
    UNLOCK  -- zillib's own UNLOCK only says no, so the chest decides. PRSI
               is the second object of the command (the WITH thing);
               <PRSI? ,IRON-KEY> asks 'is it the iron key?'. If so, clear
               LOCKEDBIT (FCLEAR) and say so. Any other key gets RFALSE, and
               the library's refusal.
    EXAMINE -- a description that reports the lock's current state, read
               from the flags with FSET?.
  Everything else returns RFALSE: OPEN, CLOSE and LOOK IN are left to the
  library, which already understands containers."
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

;"The jewel. (IN CHEST) puts it inside the chest, so it is hidden until the
  chest is opened; then OPEN CHEST lists it and TAKE JEWEL works."
<OBJECT JEWEL
    (DESC "ruby jewel")
    (SYNONYM JEWEL GEM RUBY)
    (ADJECTIVE RUBY RED GLEAMING)
    (IN CHEST)
    (FLAGS TAKEBIT)>

;"The key. TOOLBIT is the flag zillib's UNLOCK ... WITH syntax looks for in
  its WITH slot, so the parser takes this key as the tool. TAKEBIT lets it be
  carried. VOWELBIT makes the library write 'an iron key'. FDESC is its line
  in the room description until it is first taken."
<OBJECT IRON-KEY
    (DESC "iron key")
    (SYNONYM KEY)
    (ADJECTIVE IRON SMALL)
    (IN STOREROOM)
    (FDESC "A small iron key hangs on a hook beside the door.")
    (FLAGS TAKEBIT TOOLBIT VOWELBIT)>
