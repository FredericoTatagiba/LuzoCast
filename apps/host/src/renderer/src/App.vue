<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { LcButton, LcCard, LcLinkCard, LcLogo, LcStatGrid, LcStatusPill, LcViewerList, type PillTone } from '@luzocast/ui';
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
      <LcLogo compact />
      <LcStatusPill :tone="pill.tone" :label="pill.label" />
    </header>

    <p v-if="host.error.value" class="host__error" role="alert">{{ host.error.value }}</p>

    <!-- Antes de transmitir: escolher fonte, opções e verificar prontidão -->
    <div v-if="!isLive" class="host__grid host__grid--setup">
      <LcCard class="area-sources">
        <template #title>O que você quer transmitir?</template>
        <SourcePicker v-model="sourceId" :sources="host.sources.value" />
        <template #actions>
          <LcButton variant="ghost" @click="host.loadSources()">Atualizar lista</LcButton>
        </template>
      </LcCard>

      <LcCard class="area-options">
        <template #title>Opções</template>
        <StreamOptions
          v-model:mode="mode"
          v-model:profile="profile"
          v-model:system-audio="systemAudio"
          v-model:alert-sound="alertSound"
          :capture-is-window="captureIsWindow"
          @test-alert="host.testAlert()"
        />
      </LcCard>

      <!-- Em telas estreitas fica fixo no rodapé, sempre ao alcance -->
      <div class="area-cta host__cta">
        <LcButton size="lg" block :disabled="!sourceId || busy" @click="start">
          {{ busy ? 'Iniciando…' : sourceId ? 'Transmitir' : 'Escolha o que transmitir' }}
        </LcButton>
      </div>

      <ReadinessCard
        class="area-ready"
        :items="readiness.items.value"
        :running="readiness.running.value"
        :summary="readiness.summary.value"
        :busy-action="readiness.busyAction.value"
        :fix-message="readiness.fixMessage.value"
        @run="readiness.run()"
        @fix="readiness.fix($event)"
      />
    </div>

    <!-- Ao vivo: link, espectadores e desempenho -->
    <div v-else class="host__grid host__grid--live">
      <LcCard class="area-link">
        <template #title>Envie este link</template>
        <LcLinkCard v-if="host.shareUrl.value" :url="host.shareUrl.value" :warning="host.warning.value ?? undefined" @copy="host.copy(host.shareUrl.value)" />
        <template #actions>
          <LcButton variant="danger" block :disabled="busy" @click="host.stop()">Encerrar transmissão</LcButton>
        </template>
      </LcCard>

      <LcCard class="area-viewers">
        <template #title>Espectadores ({{ admittedCount }})</template>
        <LcViewerList :viewers="host.viewers.value" @admit="host.admit" @reject="host.reject" @kick="host.kick" />
      </LcCard>

      <LcCard v-if="metrics.items.value.length" class="area-metrics">
        <template #title>Desempenho</template>
        <LcStatGrid :items="metrics.items.value" />
      </LcCard>
    </div>
  </main>
</template>

<style scoped>
/* Mobile-first. Breakpoints: 720px (2 colunas) · 1024px (layout de desktop). */
.host {
  min-height: 100vh;
  max-width: var(--lc-content-max);
  margin: 0 auto;
  padding: var(--lc-gutter);
  display: grid;
  align-content: start;
  gap: var(--lc-space-4);
}
.host__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--lc-space-3);
}
.host__error {
  margin: 0;
  padding: var(--lc-space-3);
  border-radius: var(--lc-radius-sm);
  background: color-mix(in srgb, var(--lc-live) 15%, transparent);
  color: var(--lc-text);
  overflow-wrap: anywhere;
}
.host__grid {
  display: grid;
  gap: var(--lc-space-4);
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}
.host__grid > * {
  min-width: 0;
}
.area-sources { grid-area: sources; }
.area-options { grid-area: options; }
.area-cta { grid-area: cta; }
.area-ready { grid-area: ready; }
.area-link { grid-area: link; }
.area-viewers { grid-area: viewers; }
.area-metrics { grid-area: metrics; }

.host__grid--setup {
  grid-template-areas: 'sources' 'options' 'ready' 'cta';
}
.host__grid--live {
  grid-template-areas: 'link' 'viewers' 'metrics';
}

/* Botão principal fixo no rodapé enquanto a tela for estreita */
.host__cta {
  position: sticky;
  bottom: 0;
  z-index: 1;
  padding: var(--lc-space-3) 0 calc(var(--lc-space-3) + env(safe-area-inset-bottom));
  margin: 0 calc(-1 * var(--lc-gutter)) calc(-1 * var(--lc-gutter));
  padding-inline: var(--lc-gutter);
  background: linear-gradient(to top, var(--lc-bg) 70%, transparent);
}

@media (min-width: 720px) {
  .host__grid--setup {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'sources sources'
      'options ready'
      'cta cta';
  }
  .host__grid--live {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'link link'
      'viewers metrics';
  }
}

@media (min-width: 1024px) {
  .host__grid--setup {
    grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
    grid-template-areas:
      'sources options'
      'sources cta'
      'sources ready';
  }
  .host__cta {
    position: static;
    margin: 0;
    padding: 0;
    background: none;
  }
  .host__grid--live {
    grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
    grid-template-areas:
      'link viewers'
      'metrics viewers';
  }
}
</style>
