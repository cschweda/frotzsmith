# Security

frotzsmith compiles and runs interactive fiction entirely in the browser: your source and story files never leave it. A compiled story plays in frotzplay (or, as a choice, Parchment in a same-origin frame), and a shared link carries the source in its fragment, which never reaches a server. The security design is in [docs/06-security.md](docs/06-security.md).

## Reporting a problem

Please report a security problem privately, not in a public issue: use GitHub's [private vulnerability reporting](https://github.com/cschweda/frotzsmith/security/advisories/new) for this repository. If that isn't available, open an issue that says only that you have a security report (no details), and you'll be given a private way to send it.

Say what you found, and how to see it: a source file or share link that shows it is welcome. You'll get an answer within a few days.

## Supported versions

The live site ([frotzsmith.frotzinc.com](https://frotzsmith.frotzinc.com)) and the latest desktop release.
