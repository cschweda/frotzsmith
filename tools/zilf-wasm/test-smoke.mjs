// test-smoke.mjs — smoke-check the productionized public/zilf/ bundle
// Run: node tools/zilf-wasm/test-smoke.mjs  (from repo root)
import { readdir } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const frameworkDir = path.join(repoRoot, 'public/zilf/_framework');

// Find dotnet.js (fingerprinting disabled, so plain dotnet.js expected)
const files = await readdir(frameworkDir);
const dotnetJs = files.includes('dotnet.js')
    ? 'dotnet.js'
    : files.find(f => f.match(/^dotnet\.[a-z0-9]+\.js$/) && !f.includes('native') && !f.includes('runtime'));
if (!dotnetJs) {
    console.error('ERROR: could not find dotnet.js in', frameworkDir);
    console.error('Files:', files.filter(f => f.endsWith('.js')));
    process.exit(1);
}
console.log(`Loading: ${dotnetJs}`);

const dotnetUrl = pathToFileURL(path.join(frameworkDir, dotnetJs)).href;
const { dotnet } = await import(dotnetUrl);

const { getAssemblyExports, getConfig } = await dotnet
    .withApplicationArguments()
    .create();

const config = getConfig();
console.log('mainAssemblyName:', config.mainAssemblyName);

const exports = await getAssemblyExports(config.mainAssemblyName);

// Verify zillib resources embedded correctly
const resources = JSON.parse(exports.ZilfExports.ListResources());
const zillib = resources.filter(n => n.startsWith('zillib_'));
console.log(`zillib embedded resources: ${zillib.length} files`);
if (zillib.length === 0) {
    console.warn('WARNING: no zillib_ resources found!');
    console.warn('All resources:', resources.slice(0, 20));
}

// Minimal ZIL game (VERSION injected by Compile)
const ZIL_GAME = `
<CONSTANT RELEASEID 1>
<CONSTANT GAME-BANNER "Smoke Test">
<ROOM WEST-OF-HOUSE
    (DESC "West of House")
    (IN ROOMS)
    (FLAGS LIGHTBIT)>
<ROUTINE GO ()
    <SETG HERE ,WEST-OF-HOUSE>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>
<INSERT-FILE "parser">
`;

const ZIL_BROKEN = `<ROUTINE GO () <UNDEFINED-FUNCTION>>`;

let allPassed = true;

// ---- Test z5 ----
console.log('\nTesting z5...');
const t5start = Date.now();
const r5 = JSON.parse(exports.ZilfExports.Compile(ZIL_GAME, 5));
const t5ms = Date.now() - t5start;

if (r5.success) {
    const bytes5 = Buffer.from(r5.storyBase64, 'base64');
    const ok = bytes5[0] === 5 && bytes5.length > 64;
    console.log(`z5 ${ok ? 'OK' : 'FAIL'}: ${bytes5.length} bytes, header[0]=${bytes5[0]}, compile=${t5ms}ms`);
    if (!ok) { console.error('  z5 FAILED header check'); allPassed = false; }
} else {
    console.error('z5 FAILED:', r5.diagnostics);
    allPassed = false;
}

// ---- Test z3 ----
console.log('\nTesting z3...');
const t3start = Date.now();
const r3 = JSON.parse(exports.ZilfExports.Compile(ZIL_GAME, 3));
const t3ms = Date.now() - t3start;

if (r3.success) {
    const bytes3 = Buffer.from(r3.storyBase64, 'base64');
    const ok = bytes3[0] === 3 && bytes3.length > 64;
    console.log(`z3 ${ok ? 'OK' : 'FAIL'}: ${bytes3.length} bytes, header[0]=${bytes3[0]}, compile=${t3ms}ms`);
    if (!ok) { console.error('  z3 FAILED header check'); allPassed = false; }
} else {
    console.error('z3 FAILED:', r3.diagnostics);
    allPassed = false;
}

// ---- Test broken ZIL → expect failure with diagnostics ----
console.log('\nTesting broken ZIL (expect failure)...');
const rBad = JSON.parse(exports.ZilfExports.Compile(ZIL_BROKEN, 5));
if (!rBad.success) {
    console.log('Broken ZIL correctly failed, diagnostics:', rBad.diagnostics.slice(0, 3));
} else {
    console.error('UNEXPECTED SUCCESS on broken ZIL');
    allPassed = false;
}

console.log('\n' + (allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'));
process.exit(allPassed ? 0 : 1);
