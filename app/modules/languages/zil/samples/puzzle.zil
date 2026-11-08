;"The Locked Chest -- a lock-and-key container puzzle.
 Hand-written for the frotzsmith sample set.

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
   there is no ending beyond holding it.

 THE PUZZLE AS A CHAIN OF STATES (the flags on the chest)
     start          LOCKEDBIT set, OPENBIT clear   OPEN -> 'You'll have to
                                                   unlock it first.'
     UNLOCK ... WITH KEY  (CHEST-R clears LOCKEDBIT)
     unlocked       both clear                     OPEN works
     OPEN CHEST     (zillib sets OPENBIT)
     open           OPENBIT set                    the jewel can be seen
                                                   and taken
   The whole puzzle is two flags; the library already knows what each one
   means for OPEN, CLOSE, LOOK IN and TAKE.

 THE INFORM 6 EQUIVALENT
   The Inform 6 sample 'locked-chest' is the same puzzle. There the chest
   is 'container openable lockable locked' and names its key with
   'with_key', and the library does the unlocking. zillib has no with_key:
   its UNLOCK only ever says no, so the chest's ACTION routine below decides
   which key fits. That is more code, but it also means any lock can do
   anything at all when it opens.

 READING ZIL (a quick key)
   <...> is a form (a call or definition), (...) a list (one property in an
   OBJECT). ,NAME is a global value, .NAME a local one. ;'string' is a
   comment (single quotes here stand in for double quotes)."

;"NOTE: there is no <VERSION> form here on purpose. frotzsmith adds it when
  it compiles, from the story version picked in the toolbar (z3 for this one)."

;"RELEASEID is the release number zillib prints in the banner. CONSTANT
  names a value that never changes."
<CONSTANT RELEASEID 1>

;"GAME-BANNER: the title lines V-VERSION prints at startup (| is a line break)."
<CONSTANT GAME-BANNER
"The Locked Chest|
A ZIL Lock-and-Key Puzzle">

;"GO runs first: print the opening, put the player in the Storeroom (HERE is
  zillib's current-room global, and the PLAYER object must be moved there
  too), describe it, then start zillib's command loop, which never returns.
  ROUTINE defines code; () is GO's (empty) argument list. TELL prints (CR
  is a line break), SETG sets a global, MOVE puts one object inside another."
<ROUTINE GO ()
    <CRLF> <CRLF>
    <TELL "A demonstration of a lock-and-key container puzzle." CR CR>
    <V-VERSION> <CRLF>
    <SETG HERE ,STOREROOM>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>

;"zillib: the parser, the standard verbs and the PLAYER. The world below
  comes after it, so it can use the library's flags.

  zillib's SYNTAX lines for the verbs this puzzle uses (in its verbs.zil):
    OPEN OBJECT (FIND OPENABLEBIT)
    UNLOCK OBJECT (FIND LOCKEDBIT) WITH OBJECT (FIND TOOLBIT)
                                                (HAVE HELD CARRIED)
  A SYNTAX line says which sentence shapes a verb accepts. (FIND flag) is
  the flag the parser uses to guess an object the player left out -- so
  once the key is in hand, plain UNLOCK CHEST supplies '(with the iron
  key)' by itself, because it is the only TOOLBIT object about -- and to
  prefer the right one when a word is ambiguous. It is a hint, not a lock:
  naming some other object still parses, and the verb or the object then
  says no. (HAVE) means the second object must be held, so UNLOCK CHEST
  WITH KEY before taking the key gets the parser's 'You aren't holding the
  iron key.'"
<INSERT-FILE "parser">

"Rooms"

;"The only room. Its LDESC mentions the chest but not the key: the key has
  its own FDESC (below), which disappears once the key is taken. Putting the
  key in the room text too would leave it hanging there after you take it.
  ROOM, IN ROOMS, DESC, LDESC and LIGHTBIT: a lit location with a title and
  a description, as in every sample. No exits: every direction is refused."
<ROOM STOREROOM
    (DESC "Storeroom")
    (IN ROOMS)
    (LDESC "A dusty storeroom. A heavy wooden chest sits in the corner.")
    (FLAGS LIGHTBIT)>

"Objects"

;"The chest. CONTBIT makes it a container, OPENABLEBIT lets OPEN and CLOSE
  work on it, and LOCKEDBIT starts it locked: zillib's OPEN refuses a locked
  container by itself. There is no OPENBIT, so it starts closed, and no
  TAKEBIT, so it stays put. CHEST-R handles the unlocking.

  The flags one at a time, and what happens without each:
    CONTBIT      it can contain things (the jewel is IN CHEST). zillib only
                 lets the player see inside a container that is open, so a
                 closed chest hides its contents from both LOOK and the
                 parser: before it is opened, TAKE JEWEL finds no jewel.
                 Without CONTBIT, PUT X IN CHEST would be refused.
    OPENABLEBIT  OPEN and CLOSE apply. Without it, OPEN CHEST would get
                 'That's not something you can open.'
    LOCKEDBIT    zillib's OPEN checks this flag first and answers 'You'll
                 have to unlock it first.' Nothing else is needed to make
                 the chest locked; unlocking is just clearing the flag.
    OPENBIT      (absent at the start) the container is open. zillib's OPEN
                 sets it and CLOSE clears it.
  (ACTION CHEST-R) names the routine that sees every command about the
  chest before the library's verb does."
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
  library, which already understands containers.

  The ZIL pieces, one at a time:
    <COND (test body...) ...>
              if / else-if: the first clause whose test is true runs, and
              ELSE as a test is always true. A COND can sit inside another
              COND's clause, as the UNLOCK one does.
    <VERB? UNLOCK>
              true when the parser's action (PRSA) is UNLOCK.
    <PRSI? ,IRON-KEY>
              true when the indirect object PRSI is the iron key. Its
              partner <PRSO? X> tests the direct object. In UNLOCK CHEST
              WITH KEY the chest is PRSO and the key is PRSI.
    <FCLEAR ,CHEST ,LOCKEDBIT>
              clear a flag on an object. FSET sets one; <FSET? obj flag>
              asks whether it is set. Flags are the cheapest way to keep
              per-object state, and the library reads the standard ones.
    <TELL ... CR> then <RTRUE>
              print the reply and tell the parser 'handled'. Returning true
              stops zillib before its own V-UNLOCK, which would otherwise
              add 'That's not something you can unlock.'
    <RFALSE>  'not handled': zillib carries on to its default.

  The EXAMINE clause prints the description without a CR, then one of three
  endings, so the text always matches the state:
    locked -> ' It is locked.'   open -> ' It is open.'
    neither -> ' It is closed but unlocked.'
  The order of the tests matters: a chest can never be open AND locked, but
  checking LOCKEDBIT first keeps the answer right even if a later change
  made that possible.

  A detail worth knowing: zillib's own EXAMINE would also say whether the
  chest is open or closed and list its contents. Because CHEST-R answers
  EXAMINE itself, those lines do not appear; LOOK IN CHEST (left to the
  library) lists the jewel instead."
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
  chest is opened; then OPEN CHEST lists it and TAKE JEWEL works.
  zillib's OPEN prints 'You open the wooden chest.' and then describes what
  is inside, which is how the player first learns of the jewel. TAKEBIT
  lets it be taken; RUBY appears both as a noun and as an adjective, so
  TAKE RUBY and TAKE RUBY JEWEL both work."
<OBJECT JEWEL
    (DESC "ruby jewel")
    (SYNONYM JEWEL GEM RUBY)
    (ADJECTIVE RUBY RED GLEAMING)
    (IN CHEST)
    (FLAGS TAKEBIT)>

;"The key. TOOLBIT is the flag zillib's UNLOCK ... WITH syntax looks for in
  its WITH slot, so the parser takes this key as the tool. TAKEBIT lets it be
  carried. VOWELBIT makes the library write 'an iron key'. FDESC is its line
  in the room description until it is first taken.

  In more detail:
    TOOLBIT   the FIND flag of UNLOCK's WITH slot (see the SYNTAX lines
              above INSERT-FILE). It lets UNLOCK CHEST, with no WITH at all,
              find this key for itself once it is held.
    TAKEBIT   the key must be carried to be used: UNLOCK's WITH slot says
              HAVE.
    VOWELBIT  zillib writes 'a' before a name unless this flag says 'an'.
              It does not look at the spelling, so a name starting with a
              vowel sound needs the flag.
    FDESC     'A small iron key hangs on a hook beside the door.' is shown
              in the room description until the key is taken (zillib then
              sets the key's TOUCHBIT and the FDESC is never used again).
              There is no hook object: the hook exists only in that line,
              so it vanishes with it."
<OBJECT IRON-KEY
    (DESC "iron key")
    (SYNONYM KEY)
    (ADJECTIVE IRON SMALL)
    (IN STOREROOM)
    (FDESC "A small iron key hangs on a hook beside the door.")
    (FLAGS TAKEBIT TOOLBIT VOWELBIT)>
