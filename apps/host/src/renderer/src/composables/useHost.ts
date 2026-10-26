import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import type { CaptureSource, SessionStatus } from '@luzocast/core';
import type { NetworkMode } from '../../../shared/api';
import { AlertSound } from '../services/AlertSound';
import { HostStreamingService, type HostViewer } from '../services/HostStreamingService';
import type { StreamProfileId } from '../services/streamProfiles';

export interface StartRequest {
  sourceId: string;
  mode: NetworkMode;
  systemAudio: boolean;
  profile: StreamProfileId;
  uploadKbps?: number;
}

/** Estado reativo da UI do host. Toda a lógica fica no serviço (Facade). */
export function useHost(soundEnabled: Ref<boolean>, service = new HostStreamingService(), alert = new AlertSound(soundEnabled.value)) {
  const status = ref<SessionStatus>('idle');
  const error = ref<string | null>(null);
  const shareUrl = ref<string | null>(null);
  const warning = ref<string | null>(null);
  const viewers = shallowRef<readonly HostViewer[]>([]);
  const sources = shallowRef<CaptureSource[]>([]);

  watch(soundEnabled, (on) => alert.setEnabled(on));

  const offs = [
    window.luzo.onStatus((e) => {
      status.value = e.status;
      if (e.status === 'error' && e.reason) error.value = e.reason;
    }),
    service.on('share-url', (u) => (shareUrl.value = u)),
    service.on('warning', (w) => (warning.value = w)),
    service.on('viewers', (v) => (viewers.value = v)),
    service.on('viewer-request', (v) => {
      alert.play();
      void window.luzo.requestAttention(`${v.displayName} quer assistir à sua transmissão`.slice(0, 120));
    }),
    service.on('stopped', ({ reason }) => {
      shareUrl.value = null;
      if (reason) error.value = reason;
    }),
  ];
  onBeforeUnmount(() => offs.forEach((off) => off()));

  async function loadSources() {
    sources.value = await window.luzo.listSources();
  }

  async function start(req: StartRequest) {
    error.value = null;
    try {
      await service.start(req);
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  return {
    status,
    error,
    shareUrl,
    warning,
    viewers,
    sources,
    loadSources,
    start,
    stop: () => service.stop(),
    admit: (id: string) => service.admit(id),
    reject: (id: string) => service.reject(id),
    kick: (id: string) => service.kick(id),
    getStats: () => service.getStats(),
    copy: (text: string) => window.luzo.copyToClipboard(text),
    testAlert: () => alert.play(),
  };
}
