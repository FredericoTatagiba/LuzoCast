<script setup lang="ts">
import { computed } from 'vue';
import { LcButton, LcCard, LcStatusPill, LcVideoStage } from '@luzocast/ui';
import JoinForm from './components/JoinForm.vue';
import { useViewerSession } from './composables/useViewerSession';
import { loadName, readTokenFromHash, saveName, signalingUrl } from './config';

const token = readTokenFromHash();
const session = token ? useViewerSession(signalingUrl(), token) : null;

const messages = {
  waiting: { title: 'Aguardando aprovação', body: 'O host precisa aceitar sua entrada. Mantenha esta página aberta.' },
  admitted: { title: 'Aprovado!', body: 'Conectando ao vídeo…' },
  failed: {
    title: 'Não foi possível receber o vídeo',
    body: 'Sua rede e a do host não conseguiram se conectar diretamente (comum em redes corporativas e algumas operadoras). Tente outra rede, como os dados móveis.',
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
      <strong class="viewer__brand">LuzoCast</strong>
      <LcStatusPill v-if="session?.phase.value === 'connected'" tone="live" label="AO VIVO" />
      <LcButton v-if="session?.phase.value === 'connected'" variant="ghost" @click="session.leave()">Sair</LcButton>
    </header>

    <section v-if="session?.phase.value === 'connected'" class="viewer__stage">
      <LcVideoStage :stream="session.stream.value" />
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
.viewer {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
  padding: var(--lc-space-3);
  padding-bottom: max(var(--lc-space-3), env(safe-area-inset-bottom));
  gap: var(--lc-space-3);
}
@media (min-width: 768px) {
  .viewer {
    padding: var(--lc-space-6);
  }
}
.viewer__bar {
  display: flex;
  align-items: center;
  gap: var(--lc-space-3);
}
.viewer__brand {
  margin-right: auto;
  color: var(--lc-accent);
  letter-spacing: 0.02em;
}
.viewer__center {
  display: grid;
  place-items: center;
}
.viewer__center > * {
  width: min(420px, 100%);
}
.viewer__stage {
  min-height: 0;
  height: calc(100dvh - 100px);
}
</style>
