<script setup lang="ts">
/**
 * Exibe um MediaStream ocupando o espaço disponível, mantendo proporção.
 * Navegadores bloqueiam autoplay com som: começa mudo e oferece "Ativar som".
 */
import { ref, watch, onBeforeUnmount } from 'vue';

const props = withDefaults(defineProps<{ stream: MediaStream | null; startMuted?: boolean }>(), { startMuted: true });
const video = ref<HTMLVideoElement | null>(null);
const muted = ref(props.startMuted);

watch(
  [() => props.stream, video],
  ([stream, el]) => {
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  },
  { immediate: true },
);

function unmute() {
  muted.value = false;
  void video.value?.play().catch(() => undefined);
}

function fullscreen() {
  void video.value?.parentElement?.requestFullscreen?.().catch(() => undefined);
}

onBeforeUnmount(() => {
  if (video.value) video.value.srcObject = null;
});
</script>

<template>
  <div class="lc-stage">
    <video ref="video" class="lc-stage__video" :muted="muted" autoplay playsinline />
    <div class="lc-stage__controls">
      <button v-if="muted" type="button" class="lc-stage__btn" @click="unmute">🔊 Ativar som</button>
      <button type="button" class="lc-stage__btn" aria-label="Tela cheia" @click="fullscreen">⛶</button>
    </div>
  </div>
</template>

<style scoped>
.lc-stage {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: var(--lc-radius);
  overflow: hidden;
  display: grid;
  place-items: center;
}
.lc-stage:fullscreen {
  border-radius: 0;
}
.lc-stage__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.lc-stage__controls {
  position: absolute;
  right: var(--lc-space-3);
  bottom: var(--lc-space-3);
  display: flex;
  gap: var(--lc-space-2);
}
.lc-stage__btn {
  min-height: var(--lc-tap);
  min-width: var(--lc-tap);
  padding: 0 var(--lc-space-3);
  border: 0;
  border-radius: var(--lc-radius-sm);
  background: rgb(0 0 0 / 0.6);
  color: #fff;
  font: 600 0.9rem var(--lc-font);
  cursor: pointer;
  backdrop-filter: blur(6px);
}
</style>
