<script setup lang="ts">
import { frotzsmith } from '~~/frotzsmith.config'

const { setLanguage, profile } = useLanguage()
setLanguage('zil')
useHead({
  title: 'Frotzsmith — ZIL IDE',
  link: [{ rel: 'canonical', href: `${frotzsmith.siteUrl}/zil/` }],
  meta: [{ property: 'og:url', content: `${frotzsmith.siteUrl}/zil/` }],
})

// Pre-warm the ZIL compiler (worker boot + a throwaway skeleton compile) while
// the author writes — the first real compile then behaves like a warm one
// (~5 s) instead of paying ~20 s of cold interpreter warm-up. Scoped to this
// page so Inform 6 users still never download the .NET bundle.
onMounted(() => warmZilCompiler())
</script>

<template>
  <IdeLayout :key="profile.id" />
</template>
