<script setup lang="ts">
const { setLanguage, profile } = useLanguage()
setLanguage('zil')
useHead({ title: 'Frotzsmith — ZIL IDE' })
</script>

<template>
  <IdeLayout :key="profile.id" />
</template>
