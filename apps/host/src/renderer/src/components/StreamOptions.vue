<script setup lang="ts">
/** Opções da transmissão. Componente controlado: todo estado vem via v-model. */
import type { NetworkMode } from '../../../shared/api';
import { STREAM_PROFILES, type StreamProfileId } from '../services/streamProfiles';

defineProps<{ captureIsWindow: boolean }>();
const mode = defineModel<NetworkMode>('mode', { required: true });
const profile = defineModel<StreamProfileId>('profile', { required: true });
const systemAudio = defineModel<boolean>('systemAudio', { required: true });
const alertSound = defineModel<boolean>('alertSound', { required: true });
defineEmits<{ 'test-alert': [] }>();
</script>

<template>
  <div class="opts">
    <fieldset class="opts__group">
      <legend>Quem vai assistir</legend>
      <label><input v-model="mode" type="radio" value="internet" /> Qualquer lugar (link pela internet)</label>
      <label><input v-model="mode" type="radio" value="lan" /> Só quem está na minha rede</label>
    </fieldset>

    <fieldset class="opts__group">
      <legend>O que você vai transmitir</legend>
      <label v-for="p in STREAM_PROFILES" :key="p.id" class="opts__profile">
        <input v-model="profile" type="radio" :value="p.id" />
        <span>
          {{ p.label }}
          <small>{{ p.description }}</small>
        </span>
      </label>
    </fieldset>

    <fieldset class="opts__group">
      <legend>Som</legend>
      <label><input v-model="systemAudio" type="checkbox" /> Transmitir o áudio do PC</label>
      <p v-if="systemAudio && captureIsWindow" class="opts__note">
        No Windows, o áudio transmitido é o de <strong>todo o PC</strong>, não só desta janela
        (Discord, notificações e o próprio alerta do LuzoCast também vão).
      </p>
      <label class="opts__inline">
        <span><input v-model="alertSound" type="checkbox" /> Tocar alerta quando alguém pedir para entrar</span>
        <button type="button" class="opts__link" @click="$emit('test-alert')">testar</button>
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.opts {
  display: grid;
  gap: var(--lc-space-4);
}
.opts__group {
  display: grid;
  gap: var(--lc-space-1);
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--lc-text);
}
.opts__group legend {
  margin-bottom: var(--lc-space-1);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--lc-text-muted);
}
.opts__group label {
  display: flex;
  gap: var(--lc-space-2);
  align-items: center;
  min-height: var(--lc-tap);
}
.opts__profile {
  align-items: flex-start !important;
  padding-top: var(--lc-space-2);
}
.opts__profile small {
  display: block;
  color: var(--lc-text-muted);
}
.opts__note {
  margin: 0;
  padding: var(--lc-space-2) var(--lc-space-3);
  border-left: 3px solid var(--lc-warn);
  background: var(--lc-surface-2);
  font-size: 0.85rem;
  color: var(--lc-text-muted);
}
.opts__inline {
  justify-content: space-between;
}
.opts__link {
  border: 0;
  background: none;
  color: var(--lc-accent);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
  min-height: var(--lc-tap);
}
</style>
