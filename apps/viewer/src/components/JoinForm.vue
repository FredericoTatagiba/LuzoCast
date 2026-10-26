<script setup lang="ts">
import { ref } from 'vue';
import { LcButton, LcCard } from '@luzocast/ui';

const props = defineProps<{ initialName: string; busy: boolean }>();
const emit = defineEmits<{ join: [name: string] }>();
const name = ref(props.initialName);

function submit() {
  const n = name.value.trim();
  if (n) emit('join', n);
}
</script>

<template>
  <LcCard>
    <template #title>Entrar na transmissão</template>
    <form class="join" @submit.prevent="submit">
      <label class="join__label" for="lc-name">Como você quer aparecer?</label>
      <input id="lc-name" v-model="name" class="join__input" maxlength="32" autocomplete="nickname" required autofocus />
      <LcButton type="submit" block :disabled="busy || !name.trim()">{{ busy ? 'Conectando…' : 'Entrar' }}</LcButton>
    </form>
  </LcCard>
</template>

<style scoped>
.join {
  display: grid;
  gap: var(--lc-space-3);
}
.join__label {
  color: var(--lc-text);
}
.join__input {
  min-height: var(--lc-tap);
  padding: 0 var(--lc-space-3);
  border: 1px solid var(--lc-border);
  border-radius: var(--lc-radius-sm);
  background: var(--lc-surface-2);
  color: var(--lc-text);
  font: 1rem var(--lc-font);
}
</style>
