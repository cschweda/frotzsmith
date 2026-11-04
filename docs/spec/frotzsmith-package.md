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

- A package **MUST** be a ZIP archive as defined by the PKWARE APPNOTE (version 6.3.10 or later), without encryption, spanning, or multiple disks. It **MUST** have exactly one end-of-central-directory record and **MUST NOT** use ZIP64. A reader **MUST** treat general-purpose bit 0, bit 6 (strong encryption) or bit 13 (masked local headers) as encryption and refuse the package.
- The entries **MUST** tile the archive exactly: the first local header is at byte 0 (no prefix data, such as a self-extractor stub), each entry's data is followed directly by the next local header (or the central directory), with no gaps and no overlap, and the central directory ends exactly where the end-of-central-directory record begins.
- Entries **MUST** be stored (method 0) or deflated (method 8). Readers **MUST** support both. Writers **SHOULD** deflate text.
- The archive's first entry **MUST** be named `mimetype`, stored (method 0), with no extra field, containing exactly the ASCII bytes `application/vnd.frotzsmith.package+zip` with no line ending. (This lets a reader recognise a package from its first bytes, as EPUB does.)
- Path names **MUST** be UTF-8 and the writer **MUST** set general-purpose bit 11. Paths **MUST** use `/` as the separator, **MUST NOT** begin with `/`, **MUST NOT** contain an empty segment, a `.` segment, or a `..` segment, a backslash, a drive letter (`C:`), NUL, any C0/C1 control character, DEL (U+007F), or a lone (unpaired) surrogate, and **MUST NOT** be longer than 255 bytes per segment or 1,024 bytes in total. Two paths **MUST NOT** be equal ignoring case (they would collide when unpacked on many systems): two paths collide when they are equal after Unicode NFC normalization followed by the default lowercase mapping (in JavaScript, `s.normalize('NFC').toLowerCase()`).
- Archives **MUST NOT** contain symbolic links, FIFOs, device files, or any other entry whose Unix file type (external attributes) is not a regular file or a directory, nor entries whose stored and uncompressed sizes or CRC-32 disagree with their headers. Empty directory entries (a name ending `/`, no data) are allowed and ignored; a directory entry with data **MUST** be refused. Each local file header **MUST** agree with its central-directory entry, and an entry whose real inflated size differs from its declared size **MUST** be refused.
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
- Line endings **SHOULD** be LF; readers **MUST** accept CRLF.
- A reader that understands only the main file **MAY** open a package by reading `frotzsmith.json`'s `main` and that file alone; that is a conforming **minimal reader** (§10).

## 6. Test scripts: `tests/`

A **test script** is a list of commands to type into the game, one per file as plain UTF-8 text.

- Each script is a file under `tests/` ending `.txt`. A writer derives the file name `tests/<slug>.txt` from the script's name: NFKD-normalize it, strip combining diacritics and apostrophes (`'` and `’`), lower-case it, replace each run of characters outside ASCII `a`–`z` and `0`–`9` with `-`, and trim leading and trailing `-`; an empty slug becomes `script`. Where two names give the same slug, the writer adds `-2`, `-3`, and so on.
- The manifest's `tests` entry gives the script's display `name` and `path`. For scripts listed in `tests`, the manifest entries (name, path) are authoritative for names and order; readers **MUST NOT** rely on those scripts' file names.
- A `.txt` file under `tests/` that the manifest does not list is still a test script: a reader opens it, naming it by its file name without the extension.

## 7. The Skein: `<stem>.skein`

The Skein is the tree of commands and the game's replies recorded from play, kept so a later run can be compared with it. It is a JSON object (RFC 8259) in UTF-8:

```json
{ "v": 1, "lang": "i6", "storyKey": "…", "tree": { … } }
```

`v` is the version of this file (currently 1). `lang` is `"i6"` or `"zil"`. `storyKey` identifies the story the Skein was recorded against. `tree` is the Skein's nodes.

The manifest's `skein` field is authoritative for where the Skein is. When it is absent, a reader uses `<stem>.skein` if that file is present. A writer that writes a Skein **MUST** set `skein`.

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
- **Container strictness:** readers **MUST** refuse, rather than try to recover, anything §2 rules out — more than one end-of-central-directory record, ZIP64 or multi-disk archives, encryption (bits 0, 6 or 13), prefix data, gaps or overlaps between entries, local headers that disagree with the central directory, links, FIFOs and device files, and directory entries with data. A lenient reader that accepts these can be shown a different set of files than a strict one.
- **Paths:** readers **MUST** refuse (not repair) any path breaking §2's rules (including DEL and lone surrogates, and NFC + lowercase collisions), and **MUST NOT** follow links when unpacking.
- **All or nothing:** on any violation a reader refuses the **whole** package with one sentence saying why. It **MUST NOT** apply part of a package, and **MUST NOT** change the user's existing work when it refuses. A reader **MUST** ask before replacing existing work with a package.
- **Text:** include files, scripts, the Skein, and the manifest are text. Parse JSON with bounded, linear-time code; cap nesting depth (Frotzsmith refuses a manifest nested more than 64 levels deep, and a Skein over 10,000 nodes or 10,000 levels is not opened — it is kept, §7); never execute or render anything in a package as markup.
- **Integrity:** the `files` hashes detect accidental damage; they are not a signature and prove nothing about who wrote the package. A mismatch is reported, not a reason to refuse.
- **Privacy:** packages may hold unpublished work. Applications **SHOULD NOT** send a package or its contents to a server without the user's explicit action.

## 13. IANA considerations

The media type `application/vnd.frotzsmith.package+zip` is not yet registered. The Frotzsmith project may register it in the vendor tree before version 1.0; until then implementers **MAY** use it as written.

## 14. Change log

- **0.1 (2026-11-04):** first draft, written alongside Frotzsmith's first implementation of the format.

## 15. Feedback

Open an issue at https://github.com/cschweda/frotzsmith/issues with "Package format" in the title. Implementations in other applications are welcome — tell us and we'll list them here.
