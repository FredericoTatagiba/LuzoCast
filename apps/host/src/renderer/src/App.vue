<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { LcButton, LcCard, LcLinkCard, LcStatusPill, LcViewerList, type PillTone } from '@luzocast/ui';
import type { NetworkMode } from '../../shared/api';
import SourcePicker from './components/SourcePicker.vue';
import { useHost } from './composables/useHost';

const host = useHost();
const sourceId = ref<string | null>(null);
const mode = ref<NetworkMode>('internet');
const systemAudio = ref(true);

const isLive = computed(() => host.status.value === 'live');
const busy = computed(() => host.status.value === 'starting' || host.status.value === 'stopping');
const pill = computed<{ tone: PillTone; label: string }>(() => {
  switch (host.status.value) {
    case 'live':
      return { tone: 'live', label: 'AO VIVO' };
    case 'starting':
      return { tone: 'warn', label: 'Iniciando…' };
    case 'error':
      return { tone: 'warn', label: 'Erro' };
    default:
      return { tone: 'muted', label: 'Offline' };
  }
});

onMounted(() => void host.loadSources());

function start() {
  if (sourceId.value) void host.start(sourceId.value, mode.value, systemAudio.value);
}
</script>

<template>
  <main class="host">
    <header class="host__bar">
      <strong class="host__brand">LuzoCast</strong>
      <LcStatusPill :tone="pill.tone" :label="pill.label" />
    </header>

    <p v-if="host.error.value" class="host__error" role="alert">{{ host.error.value }}</p>

    <div v-if="!isLive" class="host__grid">
      <LcCard class="host__sources">
        <template #title>O que você quer transmitir?</template>
        <SourcePicker v-model="sourceId" :sources="host.sources.value" />
        <template #actions>
          <LcButton variant="ghost" @click="host.loadSources()">Atualizar lista</LcButton>
        </template>
      </LcCard>

      <LcCard>
        <template #title>Opções</template>
        <fieldset class="host__options">
          <label><input v-model="mode" type="radio" value="internet" /> Internet (link público)</label>
          <label><input v-model="mode" type="radio" value="lan" /> Somente rede local</label>
          <label><input v-model="systemAudio" type="checkbox" /> Incluir áudio do sistema</label>
        </fieldset>
        <template #actions>
          <LcButton size="lg" block :disabled="!sourceId || busy" @click="start">
            {{ busy ? 'Iniciando…' : 'Transmitir' }}
          </LcButton>
        </template>
      </LcCard>
    </div>

    <div v-else class="host__grid">
      <LcCard>
        <template #title>Envie este link</template>
        <LcLinkCard v-if="host.shareUrl.value" :url="host.shareUrl.value" :warning="host.warning.value ?? undefined" @copy="host.copy(host.shareUrl.value)" />
        <template #actions>
          <LcButton variant="danger" block :disabled="busy" @click="host.stop()">Encerrar transmissão</LcButton>
        </template>
      </LcCard>

      <LcCard>
        <template #title>Espectadores ({{ host.viewers.value.filter((v) => v.status === 'admitted').length }})</template>
        <LcViewerList :viewers="host.viewers.value" @admit="host.admit" @reject="host.reject" @kick="host.kick" />
      </LcCard>
    </div>
  </main>
</template>

<style scoped>
.host {
  min-height: 100vh;
  padding: var(--lc-space-4);
  display: grid;
  align-content: start;
  gap: var(--lc-space-4);
}
@media (min-width: 768px) {
  .host {
    padding: var(--lc-space-6);
  }
}
.host__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.host__brand {
  color: var(--lc-accent);
  font-size: 1.2rem;
}
.host__error {
  margin: 0;
  padding: var(--lc-space-3);
  border-radius: var(--lc-radius-sm);
  background: color-mix(in srgb, var(--lc-live) 15%, transparent);
  color: var(--lc-text);
}
.host__grid {
  display: grid;
  gap: var(--lc-space-4);
  grid-template-columns: 1fr;
}
@media (min-width: 900px) {
  .host__grid {
    grid-template-columns: 2fr 1fr;
    align-items: start;
  }
}
.host__options {
  display: grid;
  gap: var(--lc-space-3);
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--lc-text);
}
.host__options label {
  display: flex;
  gap: var(--lc-space-2);
  align-items: center;
  min-height: var(--lc-tap);
}
</style>
