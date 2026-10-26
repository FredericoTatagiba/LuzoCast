<script setup lang="ts">
import { LcButton, LcCard, LcChecklist, type ChecklistItem } from '@luzocast/ui';

defineProps<{
  items: readonly ChecklistItem[];
  running: boolean;
  summary: { tone: 'ok' | 'warn' | 'fail'; text: string } | null;
  busyAction?: string | null;
  fixMessage?: { ok: boolean; text: string } | null;
}>();
defineEmits<{ run: []; fix: [id: string] }>();
</script>

<template>
  <LcCard>
    <template #title>Está tudo pronto?</template>
    <p v-if="!items.length" class="ready__intro">
      Verifica internet, upload, túnel, rede local, memória, áudio do PC, encoder de vídeo e conexão P2P.
    </p>
    <LcChecklist v-else :items="items" :busy-action="busyAction" @action="$emit('fix', $event)" />
    <p v-if="fixMessage" class="ready__fix" :class="fixMessage.ok ? 'is-ok' : 'is-fail'" role="status">{{ fixMessage.text }}</p>
    <p v-if="summary" class="ready__summary" :class="`is-${summary.tone}`">{{ summary.text }}</p>
    <template #actions>
      <LcButton variant="ghost" block :disabled="running" @click="$emit('run')">
        {{ running ? 'Verificando…' : items.length ? 'Verificar de novo' : 'Verificar se está tudo pronto' }}
      </LcButton>
    </template>
  </LcCard>
</template>

<style scoped>
.ready__intro {
  margin: 0;
}
.ready__fix {
  margin: var(--lc-space-3) 0 0;
}
.ready__fix.is-ok {
  color: var(--lc-ok);
}
.ready__fix.is-fail {
  color: var(--lc-live);
}
.ready__summary {
  margin: var(--lc-space-3) 0 0;
  font-weight: 700;
}
.ready__summary.is-ok {
  color: var(--lc-ok);
}
.ready__summary.is-warn {
  color: var(--lc-warn);
}
.ready__summary.is-fail {
  color: var(--lc-live);
}
</style>
