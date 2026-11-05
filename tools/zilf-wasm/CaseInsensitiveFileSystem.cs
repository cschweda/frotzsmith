#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Zilf.Common;

/// <summary>
/// An <see cref="IFileSystem"/> decorator over <see cref="InMemoryFileSystem"/> that
/// resolves reads case-insensitively, the way ZILF finds files on a macOS or Windows
/// disk: <c>&lt;INSERT-FILE "Rooms"&gt;</c> finds <c>rooms.zil</c>, and
/// <c>"LIB/Items"</c> finds <c>lib/items.zil</c>. An exact match always wins. Writes
/// (the <c>/_build</c> outputs) pass straight through.
///
/// It also ends a circular <c>INSERT-FILE</c> (a inserts b inserts a): once a path has
/// been opened for reading more than <see cref="MaxOpensPerPath"/> times, the next open
/// throws an <see cref="IOException"/>, which ZILF reports as a diagnostic.
/// </summary>
internal sealed class CaseInsensitiveFileSystem : IFileSystem
{
    /// <summary>More reads of one file than this in one compile means a loop.</summary>
    internal const int MaxOpensPerPath = 50;

    readonly InMemoryFileSystem inner;
    readonly Func<string, string> displayName;
    readonly Dictionary<string, int> opens = new(StringComparer.Ordinal);

    /// <param name="inner">The file system holding the files.</param>
    /// <param name="displayName">How a path is named in an error (e.g. without <c>/project/</c>).</param>
    public CaseInsensitiveFileSystem(InMemoryFileSystem inner, Func<string, string> displayName)
    {
        this.inner = inner;
        this.displayName = displayName;
    }

    /// <summary>The stored path for <paramref name="path"/>: itself if it exists, else a case-insensitive match, else null.</summary>
    string? Resolve(string path)
    {
        if (inner.Exists(path))
            return path;

        // Ordinal so the result never depends on the culture; the first stored
        // path wins if two differ only by case (the wrapper refuses that anyway).
        return inner.Paths.FirstOrDefault(p => string.Equals(p, path, StringComparison.OrdinalIgnoreCase));
    }

    public bool Exists(string path) => Resolve(path) != null;

    public Stream OpenForReading(string path)
    {
        var resolved = Resolve(path) ?? throw new FileNotFoundException("File not found", path);

        opens.TryGetValue(resolved, out var count);
        if (count >= MaxOpensPerPath)
        {
            throw new IOException(
                $"“{displayName(resolved)}” is inserted too many times — is there a circular INSERT-FILE?");
        }
        opens[resolved] = count + 1;

        return inner.OpenForReading(resolved);
    }

    public Stream OpenForWriting(string path) => inner.OpenForWriting(path);

    public Stream OpenForWritingAndReading(string path) => inner.OpenForWritingAndReading(path);
}
