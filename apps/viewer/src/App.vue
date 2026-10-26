<script setup lang="ts">
import { computed } from 'vue';
import { LcButton, LcCard, LcLogo, LcStatusPill, LcVideoStage } from '@luzocast/ui';
import JoinForm from './components/JoinForm.vue';
import { useViewerSession } from './composables/useViewerSession';
import { loadName, readTokenFromHash, saveName, signalingUrl } from './config';

const token = readTokenFromHash();
const session = token ? useViewerSession(signalingUrl(), token) : null;

const messages = {
  waiting: { title: 'Aguardando aprovação', body: 'O host precisa aceitar sua entrada. Mantenha esta página aberta.' },
  admitted: { title: 'Aprovado!', body: 'Conectando ao vídeo…' },
  fallback: {
    title: 'Tentando outra rota…',
    body: 'A conexão direta não funcionou na sua rede. Estamos passando o vídeo por um caminho alternativo (pode ter alguns segundos de atraso).',
  },
  failed: {
    title: 'Não foi possível receber o vídeo',
    body: 'Nem a conexão direta nem o caminho alternativo funcionaram. Tente outra rede (por exemplo, os dados móveis) ou peça um novo link ao host.',
  },
  unsupported: {
    title: 'Seu navegador não suporta o modo alternativo',
    body: 'A conexão direta falhou e este navegador (geralmente iPhone/Safari) não consegue tocar o vídeo pelo caminho alternativo. Tente pelo Chrome no Android ou no computador, ou use outra rede.',
  },
  rejected: { title: 'Entrada não permitida', body: 'O link é inválido, expirou ou o host recusou.' },
  kicked: { title: 'Você foi removido', body: 'O host encerrou seu acesso a esta transmissão.' },
  ended: { title: 'Transmissão encerrada', body: 'Obrigado por assistir!' },
  disconnected: { title: 'Conexão perdida', body: 'Verifique sua internet ou peça um novo link ao host.' },
} as const;

const message = computed(() => {
  const p = session?.phase.value;
  return p && p in messages ? messages[p as keyof typeof messages] : null;
});

function join(name: string) {
  saveName(name);
  session?.join(name);
}
</script>

<template>
  <main class="viewer" :class="{ 'viewer--watching': session?.phase.value === 'connected' }">
    <header class="viewer__bar">
      <LcLogo class="viewer__brand" compact :size="24" />
      <LcStatusPill v-if="session?.phase.value === 'connected'" tone="live" :label="session.route.value === 'relay' ? 'AO VIVO · via túnel' : 'AO VIVO'" />
      <LcButton v-if="session?.phase.value === 'connected'" variant="ghost" @click="session.leave()">Sair</LcButton>
    </header>

    <section v-if="session?.phase.value === 'connected'" class="viewer__stage">
      <LcVideoStage :stream="session.stream.value" :src="session.src.value" @element="session.attachVideo" />
    </section>

    <section v-else class="viewer__center">
      <LcCard v-if="!session" centered>
        <template #title>Link incompleto</template>
        Peça ao host para enviar o link completo da transmissão.
      </LcCard>

      <JoinForm
        v-else-if="session.phase.value === 'idle' || session.phase.value === 'connecting'"
        :initial-name="loadName()"
        :busy="session.phase.value === 'connecting'"
        @join="join"
      />

      <LcCard v-else-if="message" centered>
        <template #title>{{ message.title }}</template>
        {{ message.body }}
      </LcCard>
    </section>
  </main>
</template>

<style scoped>
/* Mobile-first; no modo "assistindo" o vídeo ocupa toda a altura útil. */
.viewer {
  height: 100dvh;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--lc-space-3);
  padding: var(--lc-gutter);
  padding-bottom: max(var(--lc-gutter), env(safe-area-inset-bottom));
}
.viewer__bar {
  display: flex;
  align-items: center;
  gap: var(--lc-space-3);
  min-width: 0;
}
.viewer__brand {
  margin-right: auto;
}
.viewer__center {
  display: grid;
  place-items: center;
  overflow-y: auto;
}
.viewer__center > * {
  width: min(440px, 100%);
}
.viewer__stage {
  min-height: 0;
  display: grid;
}
/* Celular deitado: menos borda, mais vídeo */
@media (orientation: landscape) and (max-height: 500px) {
  .viewer--watching {
    padding: var(--lc-space-2);
    gap: var(--lc-space-2);
  }
}
</style>
