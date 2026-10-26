<script setup lang="ts">
/** Botão base. Variantes: primary (ação principal), ghost (secundária), danger (destrutiva). */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger';
    size?: 'md' | 'lg';
    block?: boolean;
    disabled?: boolean;
    type?: 'button' | 'submit';
  }>(),
  { variant: 'primary', size: 'md', block: false, disabled: false, type: 'button' },
);
defineEmits<{ click: [MouseEvent] }>();
</script>

<template>
  <button
    :type="type"
    class="lc-btn"
    :class="[`lc-btn--${variant}`, `lc-btn--${size}`, { 'lc-btn--block': block }]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.lc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--lc-space-2);
  min-height: var(--lc-tap);
  padding: 0 var(--lc-space-4);
  border: 1px solid transparent;
  border-radius: var(--lc-radius-sm);
  font: 600 0.95rem/1 var(--lc-font);
  cursor: pointer;
  transition: transform 0.08s, background 0.15s, opacity 0.15s;
}
.lc-btn:active:not(:disabled) {
  transform: scale(0.98);
}
.lc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.lc-btn--lg {
  min-height: 56px;
  padding: 0 var(--lc-space-8);
  font-size: 1.05rem;
}
.lc-btn--block {
  width: 100%;
}
.lc-btn--primary {
  background: var(--lc-accent);
  color: var(--lc-accent-text);
}
.lc-btn--ghost {
  background: transparent;
  border-color: var(--lc-border);
  color: var(--lc-text);
}
.lc-btn--ghost:hover:not(:disabled) {
  background: var(--lc-surface-2);
}
.lc-btn--danger {
  background: transparent;
  border-color: var(--lc-live);
  color: var(--lc-live);
}
</style>
