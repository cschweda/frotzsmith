! ============================================================================
!  Exits.h  --  Frotzsmith helper  (Inform 6 Standard Library only)
! ----------------------------------------------------------------------------
!  Defines the `LookRoutine` entry point so every room automatically lists its
!  obvious exits after the description -- no need to type EXITS. It walks the
!  Standard Library `Compass` object (n_obj, s_obj, ... each carrying a
!  `door_dir` property that names n_to, s_to, ...), the same technique the
!  "List Exits" sample documents in full.
!
!  PunyInform has no Compass object, so this is Standard-Library-only. Include
!  it after VerbLib and before Grammar:   Include "Exits";
!
!  `LookRoutine` is a library entry point called at the end of every room
!  description (see verblib.h). Returning false lets the library carry on
!  normally (and run any extension LookRoutines).
! ============================================================================

[ LookRoutine i shown;
    ! Nothing to show in the dark.
    if (location == thedark) rfalse;
    objectloop (i in Compass)
        if (location provides i.door_dir && metaclass(location.(i.door_dir)) ~= nothing) {
            if (shown) print ", "; else print "^Obvious exits: ";
            LanguageDirection(i.door_dir);   ! prints "north", "east", ...
            shown = true;
        }
    if (shown) print ".^";
    rfalse;
];
