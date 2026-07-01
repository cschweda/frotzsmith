<script setup lang="ts">
import { frotzsmith } from '~~/frotzsmith.config'

const { setLanguage, profile } = useLanguage()
setLanguage('i6')
useHead({
  title: 'Frotzsmith — Inform 6 IDE',
  link: [{ rel: 'canonical', href: `${frotzsmith.siteUrl}/` }],
  meta: [{ property: 'og:url', content: `${frotzsmith.siteUrl}/` }],
})
</script>

<template>
  <IdeLayout :key="profile.id" />
</template>
