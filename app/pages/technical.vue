<script setup lang="ts">
import { frotzsmith } from '~~/frotzsmith.config'

useHead({
  title: 'Technical Details — Frotzsmith',
  link: [{ rel: 'canonical', href: `${frotzsmith.siteUrl}/technical/` }],
  meta: [{ property: 'og:url', content: `${frotzsmith.siteUrl}/technical/` }],
})

const colorMode = useColorMode()
function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`

// Format limits driven by the config (single source of truth).
const z = frotzsmith.zmachine
const versionRows = (['z3', 'z4', 'z5', 'z8'] as const).map(v => ({
  v,
  size: kb(z.sizeCaps[v] ?? 0),
  objects: (z.objectCaps[v] ?? 0).toLocaleString('en-US'),
}))
const dynMaxKb = kb(z.dynamicMemoryMax)

// Measured through this exact inform6.wasm build (400-room generated games).
const measured = [
  { lib: 'Standard', target: 'z8', game: '825 objects · 3,205 lines', size: '144.5 KB', dyn: '39.7 / 64 KB', ok: true, note: '~42 ms' },
  { lib: 'Standard', target: 'z5', game: '825 objects', size: '120.5 KB', dyn: '39.7 / 64 KB', ok: true, note: '' },
  { lib: 'Standard', target: 'z3', game: 'any', size: '—', dyn: '—', ok: false, note: 'needs > 29 common properties' },
  { lib: 'PunyInform', target: 'z3', game: '210 objects', size: '33.5 KB', dyn: '10.7 / 64 KB', ok: true, note: '' },
  { lib: 'PunyInform', target: 'z3', game: '310 objects', size: '—', dyn: '—', ok: false, note: '> 255 objects' },
  { lib: 'PunyInform', target: 'z5', game: '610 objects', size: '54.0 KB', dyn: '27.5 / 64 KB', ok: true, note: '' },
]

const resources = [
  {
    group: 'Inform 6',
    items: [
      { label: 'Inform home (inform-fiction.org)', href: 'https://www.inform-fiction.org/' },
      { label: "Inform Designer's Manual (DM4)", href: 'https://www.inform-fiction.org/manual/html/index.html' },
      { label: "Inform Beginner's Guide & manuals", href: 'https://www.inform-fiction.org/manual/index.html' },
      { label: 'Inform 6 compiler (source)', href: 'https://github.com/DavidKinder/Inform6' },
      { label: 'Library extensions archive', href: 'https://www.inform-fiction.org/extensions/index.html' },
      { label: '"Roger Firth" I6 tutorials', href: 'https://www.firthworks.com/roger/' },
    ],
  },
  {
    group: 'Libraries',
    items: [
      { label: 'Standard Library (inform6lib)', href: 'https://gitlab.com/DavidGriffith/inform6lib' },
      { label: 'PunyInform', href: 'https://github.com/johanberntsson/PunyInform' },
      { label: 'PunyInform manual', href: 'https://github.com/johanberntsson/PunyInform/blob/master/doc/manual.md' },
    ],
  },
  {
    group: 'ZIL / ZILF',
    items: [
      { label: 'ZILF compiler (Heptapod)', href: 'https://foss.heptapod.net/zilf/zilf/' },
      { label: 'ZILF (GitHub mirror)', href: 'https://github.com/taradinoc/zilf' },
      { label: 'zilf.io — ZIL in the browser', href: 'https://zilf.io/' },
    ],
  },
  {
    group: 'Z-machine & play',
    items: [
      { label: 'Awesome Z-machine (curated list)', href: 'https://github.com/cschweda/awesome-z-machine' },
      { label: 'Z-Machine Standards 1.1', href: 'https://inform-fiction.org/zmachine/standards/z1point1/index.html' },
      { label: 'Parchment', href: 'https://github.com/curiousdannii/parchment' },
      { label: 'ifvms / ZVM', href: 'https://github.com/curiousdannii/ifvms.js' },
      { label: 'The Z-Machine (Wikipedia)', href: 'https://en.wikipedia.org/wiki/Z-machine' },
    ],
  },
  {
    group: 'Community',
    items: [
      { label: 'intfiction.org forum', href: 'https://intfiction.org/' },
      { label: 'IFDB', href: 'https://ifdb.org/' },
      { label: 'IFWiki', href: 'https://www.ifwiki.org/' },
      { label: 'IF Archive', href: 'https://www.ifarchive.org/' },
    ],
  },
]
</script>

<template>
  <div class="bg-default text-default min-h-screen">
    <!-- Top bar -->
    <header
      class="border-default bg-default/80 sticky top-0 z-10 flex items-center gap-3 border-b px-5 py-3 backdrop-blur"
    >
      <NuxtLink to="/" class="text-muted hover:text-default flex items-center gap-2 text-sm font-semibold">
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        Back to the IDE
      </NuxtLink>
      <span class="text-muted/40">/</span>
      <span class="font-bold">Technical Details</span>
      <UButton
        class="ml-auto"
        color="neutral"
        variant="ghost"
        :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
        :aria-label="`Switch to ${colorMode.value === 'dark' ? 'light' : 'dark'} mode`"
        @click="toggleTheme"
      />
    </header>

    <main class="mx-auto max-w-4xl space-y-12 px-6 py-10">
      <section class="space-y-3">
        <h1 class="text-3xl font-bold tracking-tight">Technical Details</h1>
        <p class="text-muted max-w-2xl">
          Frotzsmith compiles and runs <strong class="text-default">Inform 6</strong> and
          <strong class="text-default">ZIL</strong> entirely in the browser — no server touches your source
          or story file. Both emit Z-machine story files, so the play, auto-map, and test-script layers are
          shared. This page documents the toolchain and, more importantly, the hard limits, with numbers
          measured through this exact build. Written for people who already know what a Z-machine is.
        </p>
      </section>

      <!-- Why Inform 6 -->
      <section class="space-y-4">
        <h2 class="text-primary text-xl font-bold">Why Inform 6, not Inform 7?</h2>
        <p class="text-muted max-w-2xl text-sm">
          Inform 7's natural-language syntax is a real strength for writers — but if you think in code, it
          can feel indirect and verbose: an English-shaped layer between you and the machine. Inform 6 is a
          proper programming language — objects, properties, routines, C-style control flow. You say exactly
          what you mean and the compiler does exactly that. Frotzsmith exists for that way of working: a
          coder-first I6 IDE, which the browser was missing.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <h3 class="text-muted text-xs font-semibold uppercase tracking-wide">Inform 7 — natural language</h3>
            <pre tabindex="0" class="bg-elevated border-default overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed"><code>The Cottage is a room.
"A cosy one-room cottage."
The brass lamp is in the Cottage.
The description is "Small and dented."</code></pre>
          </div>
          <div class="space-y-2">
            <h3 class="text-muted text-xs font-semibold uppercase tracking-wide">Inform 6 — a programming language</h3>
            <pre tabindex="0" class="bg-elevated border-default overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed"><code>Object Cottage "Cottage"
  with description "A cosy one-room cottage.",
  has  light;
Object -> lamp "brass lamp"
  with description "Small and dented.";</code></pre>
          </div>
        </div>
        <p class="text-muted max-w-2xl text-sm">
          Both compile to the same Z-machine — in fact Inform 7 historically compiled <em>through</em> Inform 6.
          I6 is the mature, direct substrate: full control over the parser, objects, and memory with none of the
          natural-language indirection. This isn't a knock on I7 — it's excellent for its audience — just a
          different tool for a different kind of brain.
        </p>
      </section>

      <!-- Pipeline -->
      <section class="space-y-3">
        <h2 class="text-primary text-xl font-bold">Pipeline</h2>
        <pre tabindex="0" class="bg-elevated border-default overflow-x-auto rounded-lg border p-4 text-xs leading-relaxed"><code>.inf source
  └─▶ inform6.wasm  (Inform {{ frotzsmith.versions.inform6 }} via Emscripten)
        └─▶ Z-code  (.z3 / .z5 / .z8 bytes, in memory)
              └─▶ Blob URL  (tagged #game.zN)
                    └─▶ Parchment &lt;iframe&gt;  (?story=)
                          └─▶ ZVM  (pure-JS Z-machine)</code></pre>
        <p class="text-muted text-sm">Entirely client-side; works offline after first load.</p>
      </section>

      <!-- Compiler -->
      <section class="space-y-3">
        <h2 class="text-primary text-xl font-bold">The compiler</h2>
        <ul class="text-muted list-disc space-y-1.5 pl-5 text-sm">
          <li>Upstream <span class="text-default">DavidKinder/Inform6 v{{ frotzsmith.versions.inform6 }}</span> (Artistic 2.0), unmodified, built to WebAssembly with Emscripten — verified <span class="text-default">byte-identical to a native build</span> for both libraries.</li>
          <li>Flags: <code class="frotz-code">-O2 -sMODULARIZE -sEXPORT_ES6 -sALLOW_MEMORY_GROWTH -sSTACK_SIZE=8MB -sEXIT_RUNTIME -sFORCE_FILESYSTEM -sEXPORTED_RUNTIME_METHODS=FS,callMain</code></li>
          <li><span class="text-default">Re-instantiated per compile</span> — the compiler's <code class="frotz-code">main()</code> is not safe to re-run in a single instance.</li>
          <li>MEMFS is case-sensitive, so capitalized aliases (<code class="frotz-code">Parser.h</code>, <code class="frotz-code">VerbLib.h</code>, <code class="frotz-code">Grammar.h</code>, <code class="frotz-code">English.h</code>) are mounted beside the lowercase originals.</li>
          <li>Invoked as <code class="frotz-code">+include_path=&lt;lib&gt; -s -Cu -v&lt;N&gt; story.inf story.zN</code>; <code class="frotz-code">-s</code> emits the full statistics shown in the results log, and <code class="frotz-code">-Cu</code> reads the source as UTF-8 (the editor's encoding), so accented text survives the compile.</li>
        </ul>
      </section>

      <!-- Libraries -->
      <section class="space-y-3">
        <h2 class="text-primary text-xl font-bold">Libraries &amp; detection</h2>
        <ul class="text-muted list-disc space-y-1.5 pl-5 text-sm">
          <li><span class="text-default">Standard Library v{{ frotzsmith.versions.stdlib }}</span> (Parser / VerbLib / Grammar) and <span class="text-default">PunyInform v{{ frotzsmith.versions.punyinform }}</span> (globals.h + puny.h) are bundled and auto-imported.</li>
          <li>Library is fuzzily detected from the source: PunyInform markers (<code class="frotz-code">Include "puny.h"/"globals.h"</code>, <code class="frotz-code">$ZCODE_*</code>, <code class="frotz-code">INITIAL_LOCATION_VALUE</code>, <code class="frotz-code">OPTIONAL_*</code>) select PunyInform; otherwise Standard. Either can be forced.</li>
        </ul>
      </section>

      <!-- ZIL / ZILF -->
      <section class="space-y-4">
        <h2 class="text-primary text-xl font-bold">ZIL &amp; the ZILF toolchain <span class="text-warning text-sm font-semibold align-middle">alpha</span></h2>
        <p class="text-muted max-w-2xl text-sm">
          <span class="text-default">ZIL</span> (Zork Implementation Language) is Infocom's original MDL/Lisp-like
          authoring language — angle-bracket forms like <code class="frotz-code">&lt;ROUTINE&gt;</code> and
          <code class="frotz-code">&lt;OBJECT&gt;</code>. The modern <a href="https://foss.heptapod.net/zilf/zilf/" target="_blank" rel="noopener noreferrer" class="text-primary underline">ZILF</a>
          toolchain (ZILF + ZAPF, C# / .NET 10) reimplements it, and Frotzsmith runs that compiler in the browser at
          <NuxtLink to="/zil/" class="text-primary underline">/zil/</NuxtLink>. Because ZIL emits ordinary Z-code,
          play, the auto-map, test scripts, and the transcript all work for it unchanged.
        </p>
        <pre tabindex="0" class="bg-elevated border-default overflow-x-auto rounded-lg border p-4 text-xs leading-relaxed"><code>.zil source
  └─▶ ZILF front end   (ZIL → ZAP assembly)
        └─▶ ZAPF        (ZAP → Z-code, .z3 / .z5 / .z8)
              └─▶ same Blob URL → Parchment → ZVM  (as Inform 6)</code></pre>
        <ul class="text-muted list-disc space-y-1.5 pl-5 text-sm">
          <li>ZILF + ZAPF are <span class="text-default">C# / .NET 10</span>, built offline to <span class="text-default">.NET WebAssembly</span> (a different runtime from the Emscripten <code class="frotz-code">inform6.wasm</code>) and committed like the I6 compiler. Pinned at ZILF rev <code class="frotz-code">{{ frotzsmith.versions.zilf }}</code>.</li>
          <li>The <code class="frotz-code">zillib</code> standard library is <span class="text-default">embedded in the bundle</span>, so a single <code class="frotz-code">.zil</code> file compiles with no local library files.</li>
          <li>Story version comes from the <code class="frotz-code">&lt;VERSION&gt;</code> directive, driven by the target menu — <span class="text-default">z3 / z5 / z8</span>.</li>
          <li>The compiler runs in a <span class="text-default">Web Worker</span>, so the ~5&nbsp;s compile doesn't block the UI (a main-thread fallback covers environments where the worker can't boot — the historical hang was <a href="https://github.com/dotnet/runtime/issues/114918" target="_blank" rel="noopener noreferrer" class="text-primary underline">dotnet/runtime#114918</a>: dotnet.js treats a worker with an assigned <code class="frotz-code">onmessage</code> as a managed-pthread deputy; registering via <code class="frotz-code">addEventListener</code> avoids it). The <span class="text-default">~7.5&nbsp;MB gzipped</span> .NET bundle downloads and <span class="text-default">pre-warms in the background when this page's IDE opens</span> — a throwaway skeleton compile absorbs the ~20&nbsp;s cold interpreter warm-up, so the first real compile behaves like a warm one (~5&nbsp;s). Inform 6 users never download it.</li>
          <li>Diagnostics (<code class="frotz-code">&lt;file&gt;:&lt;line&gt;: error ZIL0122: …</code>) parse into the same clickable, jump-to-line format as Inform 6 errors.</li>
        </ul>
      </section>

      <!-- Z-machine limits -->
      <section class="space-y-4">
        <h2 class="text-primary text-xl font-bold">Z-machine limits — the hard ones</h2>
        <p class="text-muted text-sm">
          These are the <span class="text-default">Z-machine format's</span> limits, not Frotzsmith's — they
          bind any z-code interpreter.
        </p>
        <div tabindex="0" class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full text-sm">
            <thead class="bg-elevated text-muted text-left">
              <tr>
                <th class="px-4 py-2 font-semibold">Version</th>
                <th class="px-4 py-2 font-semibold">Max story size</th>
                <th class="px-4 py-2 font-semibold">Max objects</th>
                <th class="px-4 py-2 font-semibold">Dynamic memory</th>
              </tr>
            </thead>
            <tbody class="font-mono">
              <tr v-for="r in versionRows" :key="r.v" class="border-default border-t">
                <td class="px-4 py-2 font-semibold">.{{ r.v }}</td>
                <td class="px-4 py-2">{{ r.size }}</td>
                <td class="px-4 py-2">{{ r.objects }}</td>
                <td class="px-4 py-2">{{ dynMaxKb }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="bg-elevated border-primary space-y-2 rounded-lg border-l-4 p-4 text-sm">
          <p>
            <span class="text-primary font-semibold">Dynamic ("readable") memory is capped at {{ dynMaxKb }} for every version</span>
            — globals, the object tree, properties, and arrays that mutate at runtime. This is the limit
            you hit first; total file size rarely binds before it. The IDE footer shows live
            <code class="frotz-code">dyn X / {{ dynMaxKb }}</code> and turns red near the ceiling.
          </p>
          <p>
            <span class="text-default font-semibold">The Standard Library cannot target z3.</span> It declares
            more than z3's 29 common properties (<em>"compile as Advanced game to get 32 more"</em>), so z3 is
            offered only for PunyInform — which is built for it. Hence the target menu: Standard → z5 / z8;
            PunyInform → z3 / z4 / z5 / z8.
          </p>
        </div>
      </section>

      <!-- Measured -->
      <section class="space-y-4">
        <h2 class="text-primary text-xl font-bold">Measured — this toolchain</h2>
        <p class="text-muted text-sm">Generated 400-room games compiled through <code class="frotz-code">inform6.wasm</code>:</p>
        <div tabindex="0" class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full text-sm">
            <thead class="bg-elevated text-muted text-left">
              <tr>
                <th class="px-4 py-2 font-semibold">Library</th>
                <th class="px-4 py-2 font-semibold">Target</th>
                <th class="px-4 py-2 font-semibold">Game</th>
                <th class="px-4 py-2 font-semibold">Story</th>
                <th class="px-4 py-2 font-semibold">Dyn mem</th>
                <th class="px-4 py-2 font-semibold">Result</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in measured" :key="i" class="border-default border-t">
                <td class="px-4 py-2">{{ m.lib }}</td>
                <td class="px-4 py-2 font-mono">.{{ m.target }}</td>
                <td class="text-muted px-4 py-2">{{ m.game }}</td>
                <td class="px-4 py-2 font-mono">{{ m.size }}</td>
                <td class="px-4 py-2 font-mono">{{ m.dyn }}</td>
                <td class="px-4 py-2">
                  <span :class="m.ok ? 'text-success' : 'text-error'" class="font-mono font-semibold">{{ m.ok ? '✓' : '✗' }}</span>
                  <span v-if="m.note" class="text-muted ml-1.5 text-xs">{{ m.note }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-muted text-sm">
          A few thousand lines compiles in tens of milliseconds with headroom to spare, and
          <span class="text-default">PunyInform uses roughly a third of the dynamic memory per object</span> —
          for object-dense games it is the way to stay under {{ dynMaxKb }}.
        </p>
      </section>

      <!-- Stretching the budget -->
      <section class="space-y-3">
        <h2 class="text-primary text-xl font-bold">Stretching the {{ dynMaxKb }} budget</h2>
        <ul class="text-muted list-disc space-y-1.5 pl-5 text-sm">
          <li>Target <code class="frotz-code">z8</code> for the most static headroom (the dynamic ceiling is unchanged, but you avoid the size cap).</li>
          <li>PunyInform: <code class="frotz-code">$ZCODE_COMPACT_GLOBALS</code>, <code class="frotz-code">$OMIT_UNUSED_ROUTINES</code>, <code class="frotz-code">$ZCODE_LESS_DICT_DATA</code>.</li>
          <li>Standard: <code class="frotz-code">Abbreviate</code> for text, keep arrays static where possible, minimize globals.</li>
        </ul>
      </section>

      <!-- Interpreter -->
      <section class="space-y-3">
        <h2 class="text-primary text-xl font-bold">The interpreter</h2>
        <ul class="text-muted list-disc space-y-1.5 pl-5 text-sm">
          <li><span class="text-default">Parchment</span> with the <span class="text-default">ifvms ZVM</span> engine — pure JavaScript, JIT (AST-compiling). MIT.</li>
          <li>Z-machine <span class="text-default">v3 / v4 / v5 / v8</span> (no v6 graphical). Quetzal save/restore, undo, status line, full Unicode, sound, output streams, single-key input.</li>
          <li>The story is handed in as a same-origin <span class="text-default">Blob URL with a <code class="frotz-code">#game.zN</code> fragment</span> so Parchment's extension-based format detection selects the Z-machine; <code class="frotz-code">fetch</code> ignores the fragment.</li>
          <li><span class="text-default">No WASM interpreter.</span> bocfel (Emglken) was built and works, but ZVM is pure-JS, ~30× smaller, and the Z-machine is I/O-bound — no perceptible speed gain. WASM would only matter for Glulx.</li>
        </ul>
      </section>

      <!-- Not supported -->
      <section class="space-y-3">
        <h2 class="text-primary text-xl font-bold">Not supported (by design)</h2>
        <ul class="text-muted list-disc space-y-1.5 pl-5 text-sm">
          <li>Glulx / Inform 7 — Frotzsmith targets the Z-machine only, from Inform 6 or ZIL.</li>
          <li>Z-machine v6 (graphics).</li>
          <li>Multi-file projects — one source file per project (Inform 6: one <code class="frotz-code">.inf</code> plus <code class="frotz-code">Include</code>d <code class="frotz-code">.h</code> extensions; ZIL: one <code class="frotz-code">.zil</code> against the embedded <code class="frotz-code">zillib</code>).</li>
        </ul>
        <p class="text-muted text-sm">
          Your source file (<code class="frotz-code">.inf</code> or <code class="frotz-code">.zil</code>) is the canonical
          artifact; localStorage never replaces the file you export. What it does hold, namespaced per language
          under <code class="frotz-code">frotzsmith:&lt;lang&gt;:*</code>: the crash-recovery snapshot
          (<code class="frotz-code">…:recovery</code>), your named test scripts (<code class="frotz-code">…:scripts</code>),
          uploaded extensions (<code class="frotz-code">…:extensions</code>), and UI preferences
          (open tabs, library/target choice).
        </p>
      </section>

      <!-- Resources -->
      <section class="space-y-4">
        <h2 class="text-primary text-xl font-bold">Resources</h2>
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="r in resources" :key="r.group" class="space-y-2">
            <h3 class="text-muted text-xs font-semibold tracking-wide uppercase">{{ r.group }}</h3>
            <ul class="space-y-1.5 text-sm">
              <li v-for="l in r.items" :key="l.href">
                <a :href="l.href" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">{{ l.label }}</a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <section class="border-default space-y-2 border-t pt-6">
        <p class="font-mono text-sm">
          Inform {{ frotzsmith.versions.inform6 }} · Standard Library {{ frotzsmith.versions.stdlib }} ·
          PunyInform {{ frotzsmith.versions.punyinform }} · ZILF {{ frotzsmith.versions.zilf }} · Parchment + ifvms ZVM
        </p>
        <p class="text-muted text-xs">
          <a :href="frotzsmith.repoUrl" target="_blank" rel="noopener noreferrer" class="hover:text-default">{{ frotzsmith.repoUrl }}</a>
        </p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.frotz-code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.8em;
  padding: 0.1em 0.4em;
  border-radius: 0.3em;
  background: var(--ui-bg-elevated, rgba(127, 127, 127, 0.15));
  white-space: nowrap;
}
</style>
