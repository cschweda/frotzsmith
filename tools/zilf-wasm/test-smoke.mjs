// test-smoke.mjs — smoke-check the productionized public/zilf/<bundle>/ bundle
// Run: node tools/zilf-wasm/test-smoke.mjs  (from repo root)
// The bundle directory comes from frotzsmith.config.ts (versions.zilfBundle);
// set ZILF_BUNDLE=<dir> to smoke-check another bundle under public/zilf/.
import { readdir, readFile } from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const configText = await readFile(path.join(repoRoot, 'frotzsmith.config.ts'), 'utf8');
const bundleMatch = /zilfBundle:\s*'([^']+)'/.exec(configText);
const bundle = process.env.ZILF_BUNDLE || bundleMatch?.[1];
if (!bundle) {
    console.error('ERROR: frotzsmith.config.ts has no versions.zilfBundle');
    process.exit(1);
}
const frameworkDir = path.join(repoRoot, 'public/zilf', bundle, '_framework');
console.log(`Bundle: public/zilf/${bundle}/_framework`);

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

function check(name, ok, detail) {
    if (ok) {
        console.log(`  OK   ${name}`);
    } else {
        console.error(`  FAIL ${name}`, detail ?? '');
        allPassed = false;
    }
}

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

// ---- Single-file Compile: main-file line numbers are exact ----
// The wrapper's <VERSION n> prefix must not shift lines: line 3 reports line 3.
console.log('\nTesting single-file line numbers (Compile)...');
{
    const r = JSON.parse(exports.ZilfExports.Compile(`; line 1\n; line 2\n<ROUTINE GO () <UNDEFINED-FUNCTION>>\n`, 5));
    const d = r.diagnostics.find(x => x.includes('UNDEFINED-FUNCTION')) ?? '';
    check('Compile error on line 3 reports game.zil:3:', !r.success && d.startsWith('game.zil:3:'), r.diagnostics);
}

// ---- CompileProject: a set of files ----
const hasProject = typeof exports.ZilfExports.CompileProject === 'function';
check('CompileProject is exported', hasProject, Object.keys(exports.ZilfExports));

function project(files, main = 'story.zil', version = 5) {
    if (!hasProject) return { success: false, storyBase64: null, diagnostics: ['CompileProject missing'] };
    return JSON.parse(exports.ZilfExports.CompileProject(JSON.stringify(files), main, version));
}

const STORY_HEAD = `<CONSTANT RELEASEID 1>
<CONSTANT GAME-BANNER "Multi-file Smoke">`;
const STORY_GO = `<ROUTINE GO ()
    <SETG HERE ,WEST-OF-HOUSE>
    <MOVE ,PLAYER ,HERE>
    <V-LOOK>
    <MAIN-LOOP>>
<INSERT-FILE "parser">`;
const ROOMS = `; rooms.zil
<ROOM WEST-OF-HOUSE
    (DESC "West of House")
    (IN ROOMS)
    (FLAGS LIGHTBIT)>
`;
const ITEMS = `; lib/items.zil
<OBJECT LAMP
    (DESC "brass lamp")
    (IN WEST-OF-HOUSE)
    (SYNONYM LAMP)>
`;

console.log('\nTesting multi-file project (CompileProject)...');
{
    const r = project({
        'story.zil': `${STORY_HEAD}\n<INSERT-FILE "rooms">\n<INSERT-FILE "lib/items">\n${STORY_GO}\n`,
        'rooms.zil': ROOMS,
        'lib/items.zil': ITEMS,
        'unused.zil': '<THIS IS NOT VALID',
    });
    const bytes = r.storyBase64 ? Buffer.from(r.storyBase64, 'base64') : Buffer.alloc(0);
    check('multi-file game compiles to z5', r.success && bytes[0] === 5 && bytes.length > 64, r.diagnostics);
}

console.log('\nTesting INSERT-FILE name case...');
{
    const r = project({
        'story.zil': `${STORY_HEAD}\n<INSERT-FILE "Rooms">\n<INSERT-FILE "LIB/Items">\n${STORY_GO}\n`,
        'rooms.zil': ROOMS,
        'lib/items.zil': ITEMS,
    });
    check('<INSERT-FILE "Rooms"> finds rooms.zil (and "LIB/Items" finds lib/items.zil)', r.success, r.diagnostics);
}

console.log('\nTesting an error in an extra file...');
{
    const r = project({
        'story.zil': `${STORY_HEAD}\n<INSERT-FILE "rooms">\n${STORY_GO}\n`,
        'rooms.zil': `${ROOMS.trimEnd()}\n<UNDEFINED-FUNCTION>\n`,
    });
    check('error on line 6 of rooms.zil reports rooms.zil:6:', !r.success && r.diagnostics.some(x => x.startsWith('rooms.zil:6: error')), r.diagnostics);
    const r4 = project({
        'story.zil': `${STORY_HEAD}\n<INSERT-FILE "rooms">\n${STORY_GO}\n`,
        'rooms.zil': `; one\n; two\n; three\n<UNDEFINED-FUNCTION>\n${ROOMS}`,
    });
    check('error on line 4 of rooms.zil reports rooms.zil:4:', !r4.success && r4.diagnostics.some(x => x.startsWith('rooms.zil:4: error')), r4.diagnostics);
    check('no diagnostic names /project/', !r4.diagnostics.some(x => x.includes('/project/')), r4.diagnostics);
}

console.log('\nTesting exact main-file line numbers...');
{
    const r = project({
        'story.zil': `; line 1\n; line 2\n<UNDEFINED-FUNCTION>\n${STORY_HEAD}\n<INSERT-FILE "rooms">\n${STORY_GO}\n`,
        'rooms.zil': ROOMS,
    });
    check('error on line 3 of story.zil reports story.zil:3:', !r.success && r.diagnostics.some(x => x.startsWith('story.zil:3: error')), r.diagnostics);
    // A compile-time (routine) error on line 1 of the main file: the line the <VERSION n> prefix shares.
    const r1 = project({
        'story.zil': `<ROUTINE GO () <UNDEFINED-FUNCTION>>\n`,
    });
    check('routine error on line 1 of story.zil reports story.zil:1:', !r1.success && r1.diagnostics.some(x => x.startsWith('story.zil:1: error')), r1.diagnostics);
}

console.log('\nTesting path refusal...');
for (const bad of ['../x.zil', '/abs.zil', 'a\\b.zil', 'nul\0.zil', 'notes.txt', '', 'a/./b.zil', 'a//b.zil']) {
    const r = project({ 'story.zil': `${STORY_HEAD}\n${STORY_GO}\n`, [bad]: '; x' });
    const named = r.diagnostics.length === 1 && r.diagnostics[0].includes(`“${bad}”`);
    check(`key ${JSON.stringify(bad)} is refused with one diagnostic naming it`, !r.success && named, r.diagnostics);
}
{
    const r = project({ 'story.zil': `${STORY_HEAD}\n${STORY_GO}\n` }, 'missing.zil');
    check('a main path not in the file set is refused', !r.success && r.diagnostics.length === 1 && r.diagnostics[0].includes('missing.zil'), r.diagnostics);
}

console.log('\nTesting circular INSERT-FILE (a <-> b)...');
{
    const t0 = Date.now();
    const r = project({
        'story.zil': `${STORY_HEAD}\n<INSERT-FILE "a">\n${STORY_GO}\n`,
        'a.zil': '<INSERT-FILE "b">\n',
        'b.zil': '<INSERT-FILE "a">\n',
    });
    const ms = Date.now() - t0;
    const named = r.diagnostics.some(x => x.includes('is inserted too many times — is there a circular INSERT-FILE?'));
    check(`circular INSERT-FILE ends with a diagnostic (${ms}ms)`, !r.success && named, r.diagnostics.slice(0, 3));
    const r2 = project({ 'story.zil': `${STORY_HEAD}\n<INSERT-FILE "rooms">\n${STORY_GO}\n`, 'rooms.zil': ROOMS }, 'story.zil', 3);
    check('the runtime still compiles after the circular case', r2.success, r2.diagnostics);
}

console.log('\nTesting one file inserted twice...');
{
    const r = project({
        'story.zil': `${STORY_HEAD}\n<INSERT-FILE "rooms">\n<INSERT-FILE "rooms">\n${STORY_GO}\n`,
        'rooms.zil': ROOMS,
    });
    console.log('  inserted twice →', r.success ? 'success' : 'failure', r.diagnostics.slice(0, 3));
    // ZILF evaluates the file again, so its ROOM is defined twice: MDL0214 at rooms.zil:2.
    check('inserting rooms.zil twice fails with "already defined" at rooms.zil:2',
        !r.success && r.diagnostics.some(x => x.startsWith('rooms.zil:2: error MDL0214:')), r.diagnostics);
}

console.log('\n' + (allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'));
process.exit(allPassed ? 0 : 1);
