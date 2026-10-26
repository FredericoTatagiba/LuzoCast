<script setup lang="ts">
/** Indicador de status. `live` pulsa — no host, deve ficar SEMPRE visível (docs/security.md T9). */
export type PillTone = 'live' | 'ok' | 'warn' | 'muted';
withDefaults(defineProps<{ tone?: PillTone; label: string }>(), { tone: 'muted' });
</script>

<template>
  <span class="lc-pill" :class="`lc-pill--${tone}`" role="status">
    <span class="lc-pill__dot" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<style scoped>
.lc-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--lc-space-2);
  padding: var(--lc-space-1) var(--lc-space-3);
  border-radius: 999px;
  background: var(--lc-surface-2);
  font: 600 0.8rem/1.4 var(--lc-font);
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.lc-pill__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--lc-text-muted);
}
.lc-pill--live {
  color: var(--lc-live);
}
.lc-pill--live .lc-pill__dot {
  background: var(--lc-live);
  animation: lc-pulse 1.4s ease-in-out infinite;
}
.lc-pill--ok .lc-pill__dot {
  background: var(--lc-ok);
}
.lc-pill--warn .lc-pill__dot {
  background: var(--lc-warn);
}
@keyframes lc-pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
