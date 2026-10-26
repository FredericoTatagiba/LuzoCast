<script setup lang="ts">
/** Lista de verificações com status (ok / aviso / falha). Usada na verificação de prontidão. */
export interface ChecklistItem {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail' | 'pending';
  detail?: string;
}

defineProps<{ items: readonly ChecklistItem[] }>();

const icon = { ok: '✓', warn: '!', fail: '✕', pending: '…' } as const;
</script>

<template>
  <ul class="lc-check">
    <li v-for="item in items" :key="item.id" class="lc-check__item" :class="`is-${item.status}`">
      <span class="lc-check__icon" aria-hidden="true">{{ icon[item.status] }}</span>
      <span class="lc-check__text">
        <strong>{{ item.label }}</strong>
        <small v-if="item.detail">{{ item.detail }}</small>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.lc-check {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--lc-space-2);
}
.lc-check__item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: var(--lc-space-3);
  align-items: start;
  padding: var(--lc-space-2) var(--lc-space-3);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-surface-2);
}
.lc-check__icon {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-weight: 800;
  background: var(--lc-border);
  color: var(--lc-text);
}
.is-ok .lc-check__icon {
  background: var(--lc-ok);
  color: #06210f;
}
.is-warn .lc-check__icon {
  background: var(--lc-warn);
  color: #2a1700;
}
.is-fail .lc-check__icon {
  background: var(--lc-live);
  color: #fff;
}
.is-pending .lc-check__icon {
  animation: lc-blink 1s ease-in-out infinite;
}
.lc-check__text {
  display: grid;
  gap: 2px;
  min-width: 0;
  color: var(--lc-text);
}
.lc-check__text small {
  color: var(--lc-text-muted);
  line-height: 1.4;
}
@keyframes lc-blink {
  50% {
    opacity: 0.4;
  }
}
</style>
