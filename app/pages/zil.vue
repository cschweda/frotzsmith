<script setup lang="ts">
import { frotzsmith } from '~~/frotzsmith.config'

const { setLanguage, profile } = useLanguage()
setLanguage('zil')
useHead({
  title: 'Frotzsmith — ZIL IDE',
  link: [{ rel: 'canonical', href: `${frotzsmith.siteUrl}/zil/` }],
  meta: [{ property: 'og:url', content: `${frotzsmith.siteUrl}/zil/` }],
})
</script>

<template>
  <IdeLayout :key="profile.id" />
</template>
