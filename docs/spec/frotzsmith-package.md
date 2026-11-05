# The Frotzsmith Package Format (`.frotzsmith`)

**Version:** 0.1 (draft) · **Date:** 2026-11-04 · **Editor:** the Frotzsmith project (https://github.com/cschweda/frotzsmith)

**Status:** a draft for comment. It may change until Frotzsmith ships the format; from version 1.0 it changes only as §11 allows.

**Licence:** this specification is dedicated to the public domain under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Anyone may read, copy, implement, extend, or publish it, in any application, open or closed, free or paid, without asking and without attribution (attribution is welcome, not required). The Frotzsmith project claims no patent on anything here and will not assert one.

---

## 1. Purpose

A `.frotzsmith` file is **one file that holds a whole interactive-fiction project**: the source of a game in Inform 6 or ZIL, together with the things an author keeps beside it — include files, test scripts, and a Skein of recorded playthroughs. It exists for **moving and keeping** a project: emailing it, archiving it, handing it to another application.

It is **not** a working format. The working format is a folder of plain files that any text editor can open (Frotzsmith's desktop app, coming later, works on such a folder). The Frotzsmith website keeps a project in the browser's own storage and uses a package to export it and to open one. Everything in a package is an ordinary file a person can read without special software.

### 1.1 Design principles

1. **Open and readable.** A package is a standard ZIP archive of plain files. Unzipping it with any tool gives a folder a person can understand.
2. **The source is the truth.** The main file is plain Inform 6 or ZIL text. Nothing else in the package is required to read, edit, or compile the work.
3. **Source only.** A package holds what the author wrote, never what a compiler made from it. A story file can always be rebuilt.
4. **Graceful partial support.** An application that understands only the main file can still open a package (it reads one manifest field and one file). An application may support any subset of the optional parts.
5. **Never lose anything.** Readers keep what they don't understand; writers never drop files or manifest fields they read but didn't change.

### 1.2 Conventions

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are to be read as described in RFC 2119 and RFC 8174 when, and only when, they appear in capitals.

A **writer** is software that creates or updates a package; a **reader** is software that opens one. A **path** is a name inside the archive.

## 2. The container

- A package **MUST** be a ZIP archive as defined by the PKWARE APPNOTE (version 6.3.10 or later), without encryption, spanning, or multiple disks. It **MUST** have exactly one end-of-central-directory record, that record **MUST NOT** carry an archive comment (comment length 0), and the archive **MUST NOT** use ZIP64. A reader **MUST** treat general-purpose bit 0, bit 6 (strong encryption) or bit 13 (masked local headers) as encryption and refuse the package. (Unzippers scan for the end-of-central-directory record differently, and a comment can hold a whole second archive that another tool would show instead.)
- The entries **MUST** tile the archive exactly: the first local header is at byte 0 (no prefix data, such as a self-extractor stub), each entry's data is followed directly by the next local header (or the central directory), with no gaps and no overlap, and the central directory ends exactly where the end-of-central-directory record begins.
- Entries **MUST** be stored (method 0) or deflated (method 8). Readers **MUST** support both. Writers **SHOULD** deflate text. A deflated entry's DEFLATE stream **MUST** end exactly at the end of its compressed data: bytes after the stream's final block are refused.
- Extra fields, in local headers and the central directory, **MUST** be well-formed (a sequence of header-ID, length, data records that exactly fills the field) and **MUST NOT** include an Info-ZIP Unicode Comment (`0x6375`) field, or an Info-ZIP Unicode Path (`0x7075`) field that names anything but the entry itself: some unzippers show that second name instead of the entry's real one. A Unicode Path field is allowed only when its version byte is 1, its name CRC-32 is that of the header's name bytes, and its UTF-8 name is byte-for-byte the entry's own name (Info-ZIP `zip` built with Unicode support, as on most Linux systems, writes such a field for every non-ASCII name). Other extra fields (timestamps, Unix IDs) are allowed and ignored.
- The archive's first entry **MUST** be named `mimetype`, stored (method 0), with no extra field, containing exactly the ASCII bytes `application/vnd.frotzsmith.package+zip` with no line ending. (This lets a reader recognise a package from its first bytes, as EPUB does.)
- Path names **MUST** be UTF-8 and the writer **MUST** set general-purpose bit 11. Paths **MUST** use `/` as the separator, **MUST NOT** begin with `/`, **MUST NOT** contain an empty segment, a `.` segment, or a `..` segment, a backslash, a drive letter (`C:`), NUL, any C0/C1 control character, DEL (U+007F), or a lone (unpaired) surrogate, and **MUST NOT** be longer than 255 bytes per segment or 1,024 bytes in total. So that every path can be unpacked on Windows and macOS and none is deceptive, paths also **MUST NOT** contain:
  - any of `:` `<` `>` `|` `?` `*` `"`;
  - a format character (Unicode category Cf: bidirectional controls such as U+202E, zero-width characters such as U+200B–U+200D and U+2060, the byte-order mark U+FEFF, the soft hyphen U+00AD, tag characters, invisible operators), a line or paragraph separator (Zl, Zp), or a private-use character (Co);
  - the Hangul fillers U+115F, U+1160, U+3164 and U+FFA0, which display as blank space;
  - the slash and backslash look-alikes U+2044, U+2215, U+29F5, U+29F8, U+FF0F and U+FF3C;
  - a segment that ends with `.` or a space, or begins with a space;
  - a segment that is a Windows device name, ignoring case and whatever follows its first `.` (with trailing spaces before it dropped): `CON`, `PRN`, `AUX`, `NUL`, `COM0`–`COM9`, `LPT0`–`LPT9`, `COM¹` `COM²` `COM³`, `LPT¹` `LPT²` `LPT³`, `CONIN$` and `CONOUT$` (so `con.txt`, `notes/AUX.h` and `nul.tar.gz` are all refused).
- Two paths **MUST NOT** be equal ignoring case and compatibility forms (they would collide when unpacked on many systems): two paths collide when they are equal after Unicode NFKC normalization, a full case fold, and NFKC again. The case fold is upper-casing then lower-casing, done twice (one round sends `ẞ` only to `ß`, the second on to `ss`) — in JavaScript, `const f = s => s.toUpperCase().toLowerCase(); f(f(s.normalize('NFKC'))).normalize('NFKC')`. So `A.h` and `a.h`, `ẞ.h`, `ß.h` and `ss.h`, `ſ.h` and `s.h`, `ı.h` and `i.h`, and `ﬀ.h` and `ff.h` collide.
- A file's path **MUST NOT** also be a folder of another entry (a file `a` next to `a/b`, or next to a directory entry `a/`), compared the same way.
- Archives **MUST NOT** contain symbolic links, FIFOs, device files, or any other entry whose Unix file type (the file-type bits, `S_IFMT`, of the upper 16 bits of the external attributes) is not a regular file or a directory, nor an entry with the directory type whose name doesn't end `/`. A reader checks these bits **whatever host the entry says made it** (an extractor or another unzipper may honour them regardless); an entry with no file type recorded (those bits 0, as from MS-DOS hosts) is an ordinary file. Nor may archives contain entries whose stored and uncompressed sizes or CRC-32 disagree with their headers. Empty directory entries (a name ending `/`, no data) are allowed and ignored; a directory entry with data **MUST** be refused. Each local file header **MUST** agree with its central-directory entry, and an entry whose real inflated size differs from its declared size **MUST** be refused.
- The file extension is `.frotzsmith`. The media type is `application/vnd.frotzsmith.package+zip` (not yet registered with IANA; see §13).

## 3. Layout

```
mimetype                       required, first, stored
frotzsmith.json                required: the manifest (§4)
<main file>                    required: the game's source (§5), named in the manifest
*.h                            optional: include files for Inform 6 projects, at any path (§5)
tests/                         optional: test scripts, one per file (§6)
<stem>.skein                   optional: the Skein (§7)
```

`<stem>` is the main file's name without its extension. Readers **MUST** ignore files and folders they don't recognise, and **MUST** keep them (§1.1); writers that update a package **MUST** keep them unless the user asks to remove them.

**Compiled stories MUST NOT be written** into a package, and readers **MUST** ignore any they find: files ending `.z3`, `.z4`, `.z5`, `.z8`, `.ulx`, `.blb`, or `.zblorb`. A reader does not keep them either, and should tell the user it skipped them. An ignored entry is still an entry: it **MUST** obey §2's path rules, it counts toward every limit in §12, and it is not listed in `files`.

## 4. The manifest: `frotzsmith.json`

A UTF-8 JSON object (RFC 8259), with no byte-order mark, at most 1 MiB.

```json
{
  "format": "frotzsmith-package",
  "version": "0.1",
  "generator": "Frotzsmith 0.2.0",
  "created": "2026-11-04T14:05:00Z",
  "modified": "2026-11-09T09:41:12Z",
  "title": "Haunted House",
  "author": "A. Writer",
  "language": "i6",
  "main": "haunted-house.inf",
  "target": "z5",
  "library": "puny",
  "extensions": ["ext/lamp.h"],
  "tests": [
    { "name": "Walk to the cellar", "path": "tests/walk-to-the-cellar.txt" },
    { "name": "Win", "path": "tests/win.txt" }
  ],
  "skein": "haunted-house.skein",
  "files": {
    "haunted-house.inf": "sha256:…",
    "tests/win.txt": "sha256:…"
  }
}
```

| Field | Required | Meaning |
|---|---|---|
| `format` | **MUST** | The string `"frotzsmith-package"`. |
| `version` | **MUST** | The version of this specification the package follows (`"major.minor"`). |
| `main` | **MUST** | The path of the game's source file (§5). |
| `language` | **MUST** | `"i6"` (Inform 6) or `"zil"` (ZIL). |
| `generator` | **SHOULD** | The application and version that last wrote the package. |
| `created`, `modified` | **SHOULD** | RFC 3339 timestamps in UTC. A writer updating a package keeps `created` from it; otherwise it sets `created` to the time of writing. A writer sets `modified` to the time of writing. |
| `title`, `author` | **MAY** | Plain text, for listing the package without opening the work. |
| `target` | **MAY** | The Z-machine version to compile for: `"auto"`, `"z3"`, `"z4"`, `"z5"`, or `"z8"`. Absent means `"auto"`. |
| `library` | **MAY** | Inform 6 only: `"auto"`, `"std"` (the Standard Library), or `"puny"` (PunyInform). Absent means `"auto"`. A reader ignores it for ZIL. |
| `extensions` | **MAY** | An array of the names of the include files the project enables. A name is either one an application supplies itself (bundled) or the path of a `.h` file in the package. |
| `tests` | **MAY** | An array of `{ "name", "path" }`: each test script's display name and its path (§6). The array's order is the display order. |
| `skein` | **MAY** | The path of the Skein file (§7). |
| `files` | **SHOULD** | A map from path to `"sha256:<64 lowercase hex>"` of that file's bytes, for integrity, covering every kept entry except `mimetype` and `frotzsmith.json`. A reader **SHOULD** warn (not refuse) when a file's hash differs. |
| `libraryOverrides` | reserved | Reserved for a later version of this specification. Writers **MUST NOT** use this name for anything else; readers **MUST** keep it like any unknown field. |

Every path the manifest names (`main`, each `tests[].path`, `skein`) **MUST** obey §2's path rules and **MUST** exist in the package. A reader refuses the package if one does not. The manifest is **data only**: a reader never executes a field, never fetches a URL named in one, and never uses a field to decide where on disk to write.

Readers **MUST** ignore unknown fields; writers **MUST** keep unknown fields they read unless they replace the whole manifest knowingly. Extensions **SHOULD** use a field name with the extender's reverse-domain prefix (`"com.example.colors": …`).

## 5. The main file and include files

- The main file **MUST** be UTF-8 text with no NUL byte. For `language: "i6"` its extension **MUST** be `.inf`; for `"zil"`, `.zil`.
- An Inform 6 project's include files are UTF-8 text files ending `.h`, which **MAY** sit at any path in the package. A reader keeps each as an include file of the project. Includes are Inform 6 only: in a project whose `language` is `"zil"`, a `.h` file is an unrecognised file (§3), kept and not an include.
- An include file **MUST NOT** be named like a file of an Inform 6 library the application supplies: a reader that mounts includes next to the library **MUST** refuse a package with an include whose name (its file name, or that name without `.h`), compared ignoring case, is a library file of **any** library it offers — for Frotzsmith, the Standard Library's `English`, `Exits`, `Grammar`, `infglk`, `infix`, `linklpa`, `Parser`, `VerbLib` and `version`, and PunyInform's `ext_cheap_scenery`, `ext_flags`, `ext_menu`, `ext_quote_box`, `ext_talk_menu`, `ext_waittime`, `globals`, `grammar`, `messages`, `parser`, `puny` and `scope`. Such a file could otherwise replace the library for every game. (Deliberately replacing a library file is reserved for a later version, see `libraryOverrides` in §4.)
- Line endings **SHOULD** be LF; readers **MUST** accept CRLF.
- A reader that understands only the main file **MAY** open a package by reading `frotzsmith.json`'s `main` and that file alone; that is a conforming **minimal reader** (§10).

## 6. Test scripts: `tests/`

A **test script** is a list of commands to type into the game, one per file as plain UTF-8 text.

- Each script is a file under `tests/` ending `.txt`. A writer derives the file name `tests/<slug>.txt` from the script's name: NFKD-normalize it, strip combining diacritics and apostrophes (`'` and `’`), lower-case it, replace each run of characters outside ASCII `a`–`z` and `0`–`9` with `-`, and trim leading and trailing `-`; an empty slug becomes `script`. A slug that is a Windows device name (§2: `con`, `aux`, `com1`, …) gets `_` appended (`tests/con_.txt`); the same rule applies to every other name a writer makes up from a stem, such as a main file named from the title (`aux_.inf`) or an include named from its Include name (`nul_.h`). Where two names give the same slug, the writer adds `-2`, `-3`, and so on.
- The manifest's `tests` entry gives the script's display `name` and `path`. For scripts listed in `tests`, the manifest entries (name, path) are authoritative for names and order; readers **MUST NOT** rely on those scripts' file names.
- A `.txt` file under `tests/` that the manifest does not list is still a test script: a reader opens it, naming it by its file name without the extension.
- A package **MUST NOT** hold more than 200 test scripts (listed and unlisted together), or more than 1 MiB of test-script text (UTF-8 bytes) in all. A reader refuses a package beyond either; a writer refuses to write one.

## 7. The Skein: `<stem>.skein`

The Skein is the tree of commands and the game's replies recorded from play, kept so a later run can be compared with it. It is a JSON object (RFC 8259) in UTF-8:

```json
{ "v": 1, "lang": "i6", "storyKey": "…", "tree": { … } }
```

`v` is the version of this file (currently 1). `lang` is `"i6"` or `"zil"`. `storyKey` identifies the story the Skein was recorded against. `tree` is the Skein's nodes: `{ "root": <id>, "nodes": { <id>: <node>, … } }`, where each node is `{ "id", "command", "parentId", "childIds", "status" }` with optional `"blessedOutput"` and `"lastOutput"` strings, and `status` is one of `unblessed`, `match`, `diff`, `stale`, `error`.

- Node ids (and `root`) **MUST** match `^[A-Za-z0-9_-]{1,64}$` and **MUST NOT** begin with `__`.
- The tree **MUST** be a single tree: every node reachable from `root` exactly once, every link resolvable, at most 10,000 nodes and 10,000 levels.
- The document **MUST NOT** nest arrays and objects more than 64 levels deep (the document itself is level 1).
- A reader rebuilds the tree from the fields above only: any other field of a node is dropped.
- Inside a package the Skein belongs to the package's game and language, so Frotzsmith's reader takes only `tree` and doesn't check `v`, `lang` or `storyKey` (the writer always sets them). A standalone `.skein` import, outside a package, is refused when its `lang` is another language's.

A Skein that breaks any of these rules is one the reader cannot make sense of (below).

The manifest's `skein` field is authoritative for where the Skein is. When it is absent, a reader uses `<stem>.skein` if that file is present, matching the name the way §2 compares paths (NFKC + case fold — so `Story.SKEIN` is found for `story.inf`). A writer that writes a Skein **MUST** set `skein`.

A reader that cannot make sense of the file (it does not parse, or its shape is wrong) **MUST NOT** refuse the package: it keeps the file as an unrecognised file (§3) and tells the user it was not opened. A reader **MUST NOT** run a Skein when it opens a package (§12).

## 8. Reserved

This section is intentionally empty, so that section numbers stay in step with the Drafter package format this one follows.

## 9. Reserved

See §8.

## 10. Conformance

- **Minimal reader:** recognises the package (§2's `mimetype`), reads `frotzsmith.json`, opens `main`. Ignores everything else.
- **Full reader:** also opens include files, test scripts, the Skein, and the settings (`target`, `library`, `extensions`), verifies `files` hashes, and keeps everything it doesn't understand.
- **Writer:** produces a package that satisfies §2–§7 for the parts it includes, and when updating a package it read, keeps every file and manifest field it didn't change.

## 11. Versioning

`version` is `major.minor`. A minor version adds optional fields or files; a reader of the same major version **MUST** be able to open a package of a higher minor version (ignoring what it doesn't know). A major version may change required structure; a reader **MUST** refuse a higher major version with a clear message rather than guess. Version 0.x is a draft and may change in any way until 1.0; a reader of 0.x accepts any higher 0.minor, ignoring what it doesn't know, and refuses 1.0 and above.

## 12. Security considerations

Packages come from other people; readers **MUST** treat every byte as untrusted.

- **Nothing runs.** Opening a package only loads text. A reader **MUST NOT** compile, play, replay, or run a Skein or test script as a result of opening one; the user does those, afterwards, on purpose.
- **Archive bombs and size:** readers **MUST** check the following against the central directory's declared sizes before inflating anything, and refuse a package beyond them (each local header **MUST** agree with its central-directory entry): archive at most 32 MiB; at most 2,000 entries; each entry at most 8 MiB uncompressed; at most 32 MiB uncompressed in total; compression ratio per entry at most 200:1. A reader **MUST** also refuse an entry whose real inflated size differs from its declared size. Ignored compiled stories (§3) count toward all of these limits.
- **Container strictness:** readers **MUST** refuse, rather than try to recover, anything §2 rules out — more than one end-of-central-directory record, an archive comment, ZIP64 or multi-disk archives, encryption (bits 0, 6 or 13), prefix data, gaps or overlaps between entries, data after a DEFLATE stream's end, local headers that disagree with the central directory, malformed extra fields and Unicode Comment extra fields or Unicode Path extra fields naming anything but the entry itself, links, FIFOs and device files (from any host), a file that is also another entry's folder, and directory entries with data. A lenient reader that accepts these can be shown a different set of files than a strict one — or than another tool a reviewer uses to check the package.
- **Paths:** readers **MUST** refuse (not repair) any path breaking §2's rules (including DEL, lone surrogates, Windows-reserved names and characters, invisible and look-alike characters, and NFKC + case-fold collisions), and **MUST NOT** follow links when unpacking. Writers **MUST NOT** write those paths, so a package a writer produces always opens: names a writer makes up are made safe (§6), and a file it holds under a name the rules now refuse (kept by an older, looser version) is left out of the package — kept where it is, and named to the user — rather than written or allowed to fail the whole save. Frotzsmith does the same with an uploaded extension named like a library file (§5), and with the second of two uploads that would mount under one Include name.
- **Library files:** an include named like a library file (§5) is refused, so a package can't replace the library for every later game.
- **Display:** when a reader quotes a path or title to the user it **SHOULD** neutralise characters that change how text displays (controls, format, separator, private-use and unassigned characters, blank-looking fillers), cap combining marks, shorten long names, and quote them, so a name can't pose as part of the sentence around it.
- **All or nothing:** on any violation a reader refuses the **whole** package with one sentence saying why. It **MUST NOT** apply part of a package, and **MUST NOT** change the user's existing work when it refuses. A reader **MUST** ask before replacing existing work with a package.
- **Text:** include files, scripts, the Skein, and the manifest are text. Parse JSON with bounded, linear-time code; cap nesting depth (Frotzsmith refuses a manifest nested more than 64 levels deep; a Skein document nested more than 64 levels deep, with a bad node id, or over 10,000 nodes or 10,000 levels is not opened — it is kept, §7); rebuild parsed structures from known fields only rather than keeping the parsed objects; cap what lands in small browser storage (test scripts, §6); never execute or render anything in a package as markup.
- **Integrity:** the `files` hashes detect accidental damage; they are not a signature and prove nothing about who wrote the package. A mismatch is reported, not a reason to refuse.
- **Privacy:** packages may hold unpublished work. Applications **SHOULD NOT** send a package or its contents to a server without the user's explicit action.

## 13. IANA considerations

The media type `application/vnd.frotzsmith.package+zip` is not yet registered. The Frotzsmith project may register it in the vendor tree before version 1.0; until then implementers **MAY** use it as written.

## 14. Change log

- **0.1 (2026-11-04):** first draft, written alongside Frotzsmith's first implementation of the format.
  - Same day, after a security review: no archive comment; no Unicode Path / Comment extra fields; Unix file types checked from any host; no file that is also a folder; no data after a DEFLATE stream; Windows-reserved, invisible and look-alike characters and names refused; collisions compared by NFKC + full case fold; includes named like library files refused (§5); at most 200 test scripts / 1 MiB (§6); Skein node ids, nesting and known-fields-only rebuild (§7).
  - Same day, after review of those changes: the case fold is applied twice (`ẞ`/`ß`/`ss` collide); a Unicode Path field that only repeats the entry's own name is allowed (Info-ZIP on Linux); names a writer makes up get `_` after a Windows device name (§6); a writer leaves out, and names, files it can't write instead of failing (§12).

## 15. Feedback

Open an issue at https://github.com/cschweda/frotzsmith/issues with "Package format" in the title. Implementations in other applications are welcome — tell us and we'll list them here.
