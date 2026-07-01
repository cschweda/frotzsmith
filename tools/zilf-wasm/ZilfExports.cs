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
internal partial class ZilfJsonContext : JsonSerializerContext { }

internal sealed class CompileResult
{
    public bool success { get; init; }
    public string? storyBase64 { get; init; }
    public List<string> diagnostics { get; init; } = new();
}

/// <summary>
/// WASM exports for the ZILF compiler spike.
/// Returns JSON: { "success": bool, "storyBase64": string|null, "diagnostics": string[] }
/// </summary>
public partial class ZilfExports
{
    [JSExport]
    internal static string Compile(string source, int version)
    {
        var diagnostics = new List<string>();
        var logger = new ListDiagnosticLogger(diagnostics);

        try
        {
            var fileSystem = new InMemoryFileSystem();

            // Prepend VERSION directive
            var fullSource = $"<VERSION {version}>\n{source}";
            fileSystem.SetText("/game.zil", fullSource);

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
                    fileSystem.SetBytes("/zillib/" + filename, ms.ToArray());
                }
            }

            var frontEnd = new FrontEnd
            {
                FileSystem = fileSystem,
                Logger = logger
            };
            frontEnd.IncludePaths.Add("/zillib");

            var compResult = frontEnd.Compile("/game.zil", "/_build/game.zap", false);
            if (!compResult.Success)
            {
                return Serialize(false, null, diagnostics);
            }

            var assembler = new ZapfAssembler { FileSystem = fileSystem };
            var asmResult = assembler.Assemble("/_build/game.zap", "/_build/game.z#");

            if (!asmResult.Success)
            {
                diagnostics.Add("Assembler failed");
                return Serialize(false, null, diagnostics);
            }

            // Find the story file (e.g. /_build/game.z5 or /_build/game.z3)
            var storyPath = fileSystem.Paths
                .FirstOrDefault(p => Regex.IsMatch(p, @"\.z\d$", RegexOptions.IgnoreCase));

            if (storyPath == null)
            {
                diagnostics.Add("No .zN story file found in output");
                return Serialize(false, null, diagnostics);
            }

            var storyBytes = fileSystem.GetBytes(storyPath);
            return Serialize(true, Convert.ToBase64String(storyBytes), diagnostics);
        }
        catch (Exception ex)
        {
            diagnostics.Add($"Exception: {ex.GetType().Name}: {ex.Message}");
            return Serialize(false, null, diagnostics);
        }
    }

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
