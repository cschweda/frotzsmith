! ============================================================================
!  ordinals.h  —  print an ordinal number: 1st, 2nd, 3rd, 4th, 11th, 21st, ...
! ----------------------------------------------------------------------------
!  A tiny, self-contained routine that works under both the Standard Library
!  and PunyInform (it touches no library internals).
!
!    Include "ordinals";
!    PrintOrdinal(21);   ! -> 21st
! ============================================================================

[ PrintOrdinal n  d;
    print n;
    d = n % 100;
    if (d >= 11 && d <= 13) { print "th"; return; }
    switch (n % 10) {
        1: print "st";
        2: print "nd";
        3: print "rd";
        default: print "th";
    }
];
