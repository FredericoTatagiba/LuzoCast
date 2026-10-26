<script setup lang="ts">
/** Grade de telas/janelas para escolher o que transmitir. */
import type { CaptureSource } from '@luzocast/core';

defineProps<{ sources: readonly CaptureSource[]; modelValue: string | null }>();
defineEmits<{ 'update:modelValue': [id: string] }>();
</script>

<template>
  <div class="picker" role="radiogroup" aria-label="O que transmitir">
    <button
      v-for="s in sources"
      :key="s.id"
      type="button"
      role="radio"
      class="picker__item"
      :class="{ 'is-selected': s.id === modelValue }"
      :aria-checked="s.id === modelValue"
      @click="$emit('update:modelValue', s.id)"
    >
      <img v-if="s.thumbnail" :src="s.thumbnail" alt="" class="picker__thumb" />
      <span class="picker__name">{{ s.kind === 'screen' ? '🖥️' : '🪟' }} {{ s.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--lc-space-3);
}
.picker__item {
  display: grid;
  gap: var(--lc-space-2);
  padding: var(--lc-space-2);
  border: 2px solid var(--lc-border);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-surface-2);
  color: var(--lc-text);
  text-align: left;
  cursor: pointer;
}
.picker__item.is-selected {
  border-color: var(--lc-accent);
}
.picker__thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 4px;
  background: #000;
}
.picker__name {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
