<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { LcButton, LcCard, LcLinkCard, LcStatGrid, LcStatusPill, LcViewerList, type PillTone } from '@luzocast/ui';
import type { NetworkMode } from '../../shared/api';
import ReadinessCard from './components/ReadinessCard.vue';
import SourcePicker from './components/SourcePicker.vue';
import StreamOptions from './components/StreamOptions.vue';
import { useHost } from './composables/useHost';
import { useLiveMetrics } from './composables/useLiveMetrics';
import { usePersistentRef } from './composables/usePersistentRef';
import { useReadiness } from './composables/useReadiness';
import type { StreamProfileId } from './services/streamProfiles';

// Preferências lembradas entre aberturas do app
const mode = usePersistentRef<NetworkMode>('mode', 'internet');
const profile = usePersistentRef<StreamProfileId>('profile', 'game');
const systemAudio = usePersistentRef('systemAudio', true);
const alertSound = usePersistentRef('alertSound', true);

const host = useHost(alertSound);
const readiness = useReadiness();
const sourceId = ref<string | null>(null);

const isLive = computed(() => host.status.value === 'live');
const busy = computed(() => host.status.value === 'starting' || host.status.value === 'stopping');
const metrics = useLiveMetrics(isLive, host.getStats);
const captureIsWindow = computed(() => host.sources.value.find((s) => s.id === sourceId.value)?.kind === 'window');
const admittedCount = computed(() => host.viewers.value.filter((v) => v.status === 'admitted').length);

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
  if (!sourceId.value) return;
  void host.start({
    sourceId: sourceId.value,
    mode: mode.value,
    systemAudio: systemAudio.value,
    profile: profile.value,
    uploadKbps: readiness.uploadKbps.value,
  });
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

      <div class="host__side">
        <LcCard>
          <template #title>Opções</template>
          <StreamOptions
            v-model:mode="mode"
            v-model:profile="profile"
            v-model:system-audio="systemAudio"
            v-model:alert-sound="alertSound"
            :capture-is-window="captureIsWindow"
            @test-alert="host.testAlert()"
          />
          <template #actions>
            <LcButton size="lg" block :disabled="!sourceId || busy" @click="start">
              {{ busy ? 'Iniciando…' : 'Transmitir' }}
            </LcButton>
          </template>
        </LcCard>

        <ReadinessCard
          :items="readiness.items.value"
          :running="readiness.running.value"
          :summary="readiness.summary.value"
          @run="readiness.run()"
        />
      </div>
    </div>

    <div v-else class="host__grid">
      <div class="host__main">
        <LcCard>
          <template #title>Envie este link</template>
          <LcLinkCard v-if="host.shareUrl.value" :url="host.shareUrl.value" :warning="host.warning.value ?? undefined" @copy="host.copy(host.shareUrl.value)" />
          <template #actions>
            <LcButton variant="danger" block :disabled="busy" @click="host.stop()">Encerrar transmissão</LcButton>
          </template>
        </LcCard>

        <LcCard v-if="metrics.items.value.length">
          <template #title>Desempenho</template>
          <LcStatGrid :items="metrics.items.value" />
        </LcCard>
      </div>

      <LcCard>
        <template #title>Espectadores ({{ admittedCount }})</template>
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
    grid-template-columns: 3fr 2fr;
    align-items: start;
  }
}
.host__side,
.host__main {
  display: grid;
  gap: var(--lc-space-4);
}
</style>
