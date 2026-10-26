<script setup lang="ts">
/** Mostra o link compartilhável com botão de copiar. A cópia em si fica com o pai (via emit). */
import { ref } from 'vue';
import LcButton from './LcButton.vue';

defineProps<{ url: string; warning?: string }>();
const emit = defineEmits<{ copy: [] }>();
const copied = ref(false);

function onCopy() {
  emit('copy');
  copied.value = true;
  setTimeout(() => (copied.value = false), 1800);
}
</script>

<template>
  <div class="lc-link">
    <code class="lc-link__url" :title="url">{{ url }}</code>
    <LcButton :variant="copied ? 'ghost' : 'primary'" @click="onCopy">{{ copied ? 'Copiado ✓' : 'Copiar link' }}</LcButton>
    <p v-if="warning" class="lc-link__warn">⚠️ {{ warning }}</p>
  </div>
</template>

<style scoped>
.lc-link {
  display: grid;
  gap: var(--lc-space-2);
  grid-template-columns: 1fr;
}
@media (min-width: 480px) {
  .lc-link {
    grid-template-columns: 1fr auto;
    align-items: center;
  }
}
.lc-link__url {
  min-width: 0;
  padding: var(--lc-space-3);
  background: var(--lc-surface-2);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-sm);
  font: 0.85rem/1.3 var(--lc-font-mono);
  color: var(--lc-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: all;
}
.lc-link__warn {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.85rem;
  color: var(--lc-warn);
}
</style>
