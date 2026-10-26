<script setup lang="ts">
/**
 * Marca do LuzoCast: play que se abre em feixe de luz (mesmo desenho de apps/host/build/icon.svg).
 * `wordmark` mostra o nome ao lado; em telas estreitas o nome some via `compact`.
 */
withDefaults(defineProps<{ size?: number; wordmark?: boolean; compact?: boolean }>(), {
  size: 28,
  wordmark: true,
  compact: false,
});
</script>

<template>
  <span class="lc-logo" :class="{ 'lc-logo--compact': compact }">
    <svg :width="size" :height="size" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M22 20 L22 80 L60 50 Z" fill="var(--lc-accent)" stroke="var(--lc-accent)" stroke-width="6" stroke-linejoin="round" />
      <g fill="none" stroke="var(--lc-accent-2)" stroke-width="10" stroke-linecap="round">
        <path d="M70 50 H88" />
        <path d="M68 33 L82 23" />
        <path d="M68 67 L82 77" />
      </g>
    </svg>
    <span v-if="wordmark" class="lc-logo__name">Luzo<strong>Cast</strong></span>
  </span>
</template>

<style scoped>
.lc-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-space-2);
  color: var(--lc-text);
  font: 500 1.15rem/1 var(--lc-font);
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.lc-logo__name strong {
  font-weight: 800;
  color: var(--lc-accent);
}
@media (max-width: 380px) {
  .lc-logo--compact .lc-logo__name {
    display: none;
  }
}
</style>
