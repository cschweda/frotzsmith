<script setup lang="ts">
const { canPlay } = useIde()
</script>

<template>
  <div class="frotz-grid flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
    <UIcon name="i-lucide-gamepad-2" class="size-10 text-primary" />
    <p class="text-lg font-semibold">
      {{ canPlay ? 'Press Play to start the game' : 'Compile to play' }}
    </p>
    <p class="text-muted max-w-sm text-sm">
      {{
        canPlay
          ? 'Inline play (Parchment) is being wired up.'
          : 'A clean compile enables the Play button.'
      }}
    </p>
  </div>
</template>
