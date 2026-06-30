using System.Threading;
using System.Threading.Tasks;

// Minimal entry point: keep the WASM runtime alive so JS can call into C# exports.
await Task.Delay(Timeout.Infinite);
