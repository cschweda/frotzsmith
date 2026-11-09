import { frotzsmith } from '../frotzsmith.config'

/**
 * Who frotzsmith is, for the family shell from @frotzinc/nuxt-base (the header, the About menu and
 * its dialogs), so its top bar matches frotzlens, frotzplay and frotztrace. Built from
 * frotzsmith.config.ts, the one place the identity is written. The licences are the README's.
 */
export default defineAppConfig({
  product: {
    name: frotzsmith.name,
    tagline: 'An Inform 6 and ZIL IDE in your browser',
    homeHref: '/',
    repoUrl: frotzsmith.repoUrl,
    npmUrl: 'https://www.npmjs.com/org/frotzinc',
    familyUrl: frotzsmith.familyUrl,
    licences: [
      { what: 'frotzsmith (this app)', licence: 'GPL-3.0-or-later', href: `${frotzsmith.repoUrl}/blob/main/LICENSE` },
      { what: 'The Inform 6 compiler and Standard Library 6.12.8', licence: 'Artistic License 2.0', href: 'https://github.com/DavidKinder/Inform6' },
      { what: 'PunyInform 6.7', licence: 'MIT', href: 'https://github.com/johanberntsson/PunyInform' },
      { what: 'ZILF, ZAPF and zillib (the ZIL compiler and library)', licence: 'GPL-3.0', href: 'https://foss.heptapod.net/zilf/zilf/' },
      { what: 'The .NET runtime ZILF runs on in the browser', licence: 'MIT', href: 'https://github.com/dotnet/runtime' },
      { what: 'frotzplay (@frotzinc/player, @frotzinc/zmachine) and the other @frotzinc libraries', licence: 'MIT', href: 'https://github.com/cschweda/frotzlens/blob/main/LICENSING.md' },
      { what: 'Parchment and ZVM (ifvms)', licence: 'MIT', href: 'https://github.com/curiousdannii/parchment' },
      { what: 'OpenDyslexic (the player’s dyslexia-friendly font)', licence: 'SIL Open Font License 1.1', href: 'https://github.com/antijingoist/opendyslexic/blob/main/OFL.txt' },
      { what: 'Lucide (the icons)', licence: 'ISC', href: 'https://lucide.dev/license' },
      { what: 'Nuxt, Nuxt UI and Vue', licence: 'MIT', href: 'https://github.com/nuxt/nuxt/blob/main/LICENSE' },
    ],
    // Report a problem / Suggest a feature can send by email (netlify/functions/report.mjs, Resend).
    // Not in the desktop build: it has no site of its own to post to, so it offers GitHub only.
    reportEndpoint: __FROTZSMITH_DESKTOP__ ? undefined : '/api/report',
  },
})
