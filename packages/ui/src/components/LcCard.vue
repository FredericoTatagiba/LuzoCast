<script setup lang="ts">
/** Superfície base para agrupar conteúdo. Slots: default, `title`, `actions`. */
withDefaults(defineProps<{ centered?: boolean }>(), { centered: false });
</script>

<template>
  <section class="lc-card" :class="{ 'lc-card--centered': centered }">
    <header v-if="$slots.title" class="lc-card__title"><slot name="title" /></header>
    <div class="lc-card__body"><slot /></div>
    <footer v-if="$slots.actions" class="lc-card__actions"><slot name="actions" /></footer>
  </section>
</template>

<style scoped>
.lc-card {
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius);
  padding: var(--lc-space-4);
  box-shadow: var(--lc-shadow);
}
@media (min-width: 768px) {
  .lc-card {
    padding: var(--lc-space-6);
  }
}
.lc-card--centered {
  text-align: center;
}
.lc-card__title {
  margin-bottom: var(--lc-space-3);
  font-weight: 700;
  font-size: 1.05rem;
}
.lc-card__body {
  color: var(--lc-text-muted);
  line-height: 1.5;
}
.lc-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lc-space-2);
  margin-top: var(--lc-space-4);
}
.lc-card--centered .lc-card__actions {
  justify-content: center;
}
</style>
