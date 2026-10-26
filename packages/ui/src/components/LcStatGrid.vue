<script setup lang="ts">
/** Grade de números curtos (RAM, CPU, fps...). `tone` destaca valores problemáticos. */
export interface StatItem {
  label: string;
  value: string;
  tone?: 'normal' | 'warn' | 'bad';
  hint?: string;
}

defineProps<{ items: readonly StatItem[] }>();
</script>

<template>
  <dl class="lc-stats">
    <div v-for="s in items" :key="s.label" class="lc-stats__item" :class="`is-${s.tone ?? 'normal'}`" :title="s.hint">
      <dt>{{ s.label }}</dt>
      <dd>{{ s.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.lc-stats {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--lc-space-2);
}
.lc-stats__item {
  padding: var(--lc-space-2) var(--lc-space-3);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-surface-2);
}
.lc-stats__item dt {
  font-size: 0.75rem;
  color: var(--lc-text-muted);
}
.lc-stats__item dd {
  margin: 2px 0 0;
  font: 700 1rem var(--lc-font-mono);
  color: var(--lc-text);
}
.is-warn dd {
  color: var(--lc-warn);
}
.is-bad dd {
  color: var(--lc-live);
}
</style>
