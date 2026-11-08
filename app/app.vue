<script setup lang="ts">
// Root component. Nuxt UI's <UApp> provides app-level context (toasts, tooltips, locale) and must
// wrap the page tree. The family About dialogs (@frotzinc/nuxt-base) are mounted once, here, so the
// header's About menu and the footer's About button open them on every page.
import changelog from '../CHANGELOG.md?raw'
</script>

<template>
  <UApp>
    <NuxtPage />
    <AboutDialogs :changelog="changelog" />
  </UApp>
</template>
