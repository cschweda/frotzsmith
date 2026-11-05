#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Zilf.Common;
using Zilf.Compiler;
using Zilf.Diagnostics;
using Zapf;

// Source-generated JSON context: trim-safe, no reflection required.
[JsonSerializable(typeof(string[]))]
[JsonSerializable(typeof(CompileResult))]
[JsonSerializable(typeof(List<string>))]
[JsonSerializable(typeof(Dictionary<string, string>))]
internal partial class ZilfJsonContext : JsonSerializerContext { }

internal sealed class CompileResult
{
    public bool success { get; init; }
    public string? storyBase64 { get; init; }
    public List<string> diagnostics { get; init; } = new();
}

/// <summary>
/// WASM exports for the ZILF compiler.
/// Both compile exports return JSON: { "success": bool, "storyBase64": string|null, "diagnostics": string[] }
/// </summary>
public partial class ZilfExports
{
    const string ProjectDir = "/project";
    const string ProjectPrefix = ProjectDir + "/";
    const string LibraryDir = "/zillib";

    /// <summary>Compiles one source file. Kept for the warm-up, tests and samples.</summary>
    [JSExport]
    internal static string Compile(string source, int version) =>
        CompileFiles(new Dictionary<string, string> { ["game.zil"] = source }, "game.zil", version);

    /// <summary>
    /// Compiles a set of files. <paramref name="filesJson"/> is a JSON object
    /// <c>{ "&lt;relative path&gt;": "&lt;text&gt;" }</c> that includes the main file.
    /// Each file is placed at <c>/project/&lt;path&gt;</c>; <c>INSERT-FILE</c> searches
    /// the main file's folder, then <c>/project</c>, then <c>/zillib</c>, ignoring case.
    /// </summary>
    [JSExport]
    internal static string CompileProject(string filesJson, string mainPath, int version)
    {
        Dictionary<string, string>? files;
        try
        {
            files = JsonSerializer.Deserialize(filesJson, ZilfJsonContext.Default.DictionaryStringString);
        }
        catch (JsonException ex)
        {
            return Serialize(false, null, new List<string> { $"The file set could not be read: {ex.Message}" });
        }
        if (files == null)
            return Serialize(false, null, new List<string> { "The file set is empty." });

        return CompileFiles(files, mainPath, version);
    }

    static string CompileFiles(Dictionary<string, string> files, string mainPath, int version)
    {
        var diagnostics = new List<string>();

        // Refuse bad paths before touching the compiler.
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in files.Keys)
        {
            var problem = PathProblem(key);
            if (problem == null && !seen.Add(key))
                problem = "another file has the same name in a different case";
            if (problem != null)
                return Serialize(false, null, new List<string> { $"“{key}” can’t be compiled: {problem}." });
        }
        if (!files.ContainsKey(mainPath))
            return Serialize(false, null, new List<string> { $"The main file “{mainPath}” is not in the file set." });

        var logger = new ListDiagnosticLogger(diagnostics);

        try
        {
            var memory = new InMemoryFileSystem();

            foreach (var (key, text) in files)
            {
                // <VERSION n> goes on the main file only, on its first line with
                // a space (no newline), so the file's line numbers are unchanged.
                var content = key == mainPath ? $"<VERSION {version}> {text}" : text;
                memory.SetText(ProjectPrefix + key, content);
            }

            // Load zillib from embedded resources (named "zillib_<filename>")
            var asm = typeof(ZilfExports).Assembly;
            foreach (var resName in asm.GetManifestResourceNames())
            {
                if (resName.StartsWith("zillib_"))
                {
                    var filename = resName["zillib_".Length..]; // e.g. "parser.zil"
                    using var s = asm.GetManifestResourceStream(resName)!;
                    using var ms = new System.IO.MemoryStream();
                    s.CopyTo(ms);
                    memory.SetBytes(LibraryDir + "/" + filename, ms.ToArray());
                }
            }

            var frontEnd = new FrontEnd
            {
                FileSystem = new CaseInsensitiveFileSystem(memory, StripProject),
                Logger = logger
            };
            // Search order as ZILF on disk (Cli/PathResolution.AddImplicitIncludePaths):
            // the main file's own folder first, then the project root, then zillib.
            // Every INSERT-FILE, even one inside a file in another folder, uses this
            // same list; ZILF never resolves relative to the inserting file.
            var mainDir = MainDirectory(mainPath);
            if (mainDir != null)
                frontEnd.IncludePaths.Add(ProjectPrefix + mainDir);
            frontEnd.IncludePaths.Add(ProjectDir);
            frontEnd.IncludePaths.Add(LibraryDir);

            var compResult = frontEnd.Compile(ProjectPrefix + mainPath, "/_build/game.zap", false);
            if (!compResult.Success)
            {
                return Serialize(false, null, Clean(diagnostics));
            }

            var assembler = new ZapfAssembler { FileSystem = memory };
            var asmResult = assembler.Assemble("/_build/game.zap", "/_build/game.z#");

            if (!asmResult.Success)
            {
                diagnostics.Add("Assembler failed");
                return Serialize(false, null, Clean(diagnostics));
            }

            // Find the story file (e.g. /_build/game.z5 or /_build/game.z3)
            var storyPath = memory.Paths
                .FirstOrDefault(p => p.StartsWith("/_build/", StringComparison.Ordinal) &&
                                     Regex.IsMatch(p, @"\.z\d$", RegexOptions.IgnoreCase));

            if (storyPath == null)
            {
                diagnostics.Add("No .zN story file found in output");
                return Serialize(false, null, Clean(diagnostics));
            }

            var storyBytes = memory.GetBytes(storyPath);
            return Serialize(true, Convert.ToBase64String(storyBytes), Clean(diagnostics));
        }
        catch (Exception ex)
        {
            diagnostics.Add($"Exception: {ex.GetType().Name}: {ex.Message}");
            return Serialize(false, null, Clean(diagnostics));
        }
    }

    /// <summary>Why <paramref name="key"/> can't be a project file, or null if it can.</summary>
    static string? PathProblem(string key)
    {
        if (key.Length == 0) return "the path is empty";
        if (key.Any(char.IsControl)) return "the path contains a control character";
        if (key.Contains('\\')) return "the path contains a backslash";
        if (key.StartsWith('/')) return "the path starts with /";
        if (key.Length >= 2 && key[1] == ':' && char.IsAsciiLetter(key[0])) return "the path starts with a drive letter";
        foreach (var segment in key.Split('/'))
        {
            if (segment.Length == 0) return "the path has an empty segment";
            if (segment is "." or "..") return $"the path has a \"{segment}\" segment";
        }
        if (!key.EndsWith(".zil", StringComparison.OrdinalIgnoreCase)) return "only .zil files can be compiled";
        return null;
    }

    /// <summary>The folder of <paramref name="mainPath"/> (<c>src/game.zil</c> → <c>src</c>), or null at the root.</summary>
    static string? MainDirectory(string mainPath)
    {
        var slash = mainPath.LastIndexOf('/');
        return slash > 0 ? mainPath[..slash] : null;
    }

    /// <summary>A path as the author knows it: <c>/project/rooms.zil</c> → <c>rooms.zil</c>.</summary>
    static string StripProject(string path) =>
        path.StartsWith(ProjectPrefix, StringComparison.Ordinal) ? path[ProjectPrefix.Length..] : path;

    /// <summary>Strips <c>/project/</c> from the start of every diagnostic; <c>/zillib/…</c> names stay.</summary>
    static List<string> Clean(List<string> diagnostics) => diagnostics.ConvertAll(StripProject);

    /// <summary>Lists all embedded resource names — useful for debugging resource name issues.</summary>
    [JSExport]
    internal static string ListResources()
    {
        var names = typeof(ZilfExports).Assembly.GetManifestResourceNames();
        return JsonSerializer.Serialize(names, ZilfJsonContext.Default.StringArray);
    }

    static string Serialize(bool success, string? storyBase64, List<string> diagnostics) =>
        JsonSerializer.Serialize(
            new CompileResult { success = success, storyBase64 = storyBase64, diagnostics = diagnostics },
            ZilfJsonContext.Default.CompileResult);
}

sealed class ListDiagnosticLogger : IDiagnosticLogger
{
    readonly List<string> _list;
    public ListDiagnosticLogger(List<string> list) => _list = list;
    public void Log(Diagnostic d) => _list.Add(d.ToString() ?? d.Code);
}
