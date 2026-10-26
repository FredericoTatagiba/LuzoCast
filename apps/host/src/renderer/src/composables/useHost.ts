import { onBeforeUnmount, ref, shallowRef } from 'vue';
import type { CaptureSource, SessionStatus } from '@luzocast/core';
import type { NetworkMode } from '../../../shared/api';
import { HostStreamingService, type HostViewer } from '../services/HostStreamingService';

/** Estado reativo da UI do host. Toda a lógica fica no serviço (Facade). */
export function useHost(service = new HostStreamingService()) {
  const status = ref<SessionStatus>('idle');
  const error = ref<string | null>(null);
  const shareUrl = ref<string | null>(null);
  const warning = ref<string | null>(null);
  const viewers = shallowRef<readonly HostViewer[]>([]);
  const sources = shallowRef<CaptureSource[]>([]);

  const offs = [
    window.luzo.onStatus((e) => {
      status.value = e.status;
      if (e.status === 'error' && e.reason) error.value = e.reason;
    }),
    service.on('share-url', (u) => (shareUrl.value = u)),
    service.on('warning', (w) => (warning.value = w)),
    service.on('viewers', (v) => (viewers.value = v)),
    service.on('stopped', ({ reason }) => {
      shareUrl.value = null;
      if (reason) error.value = reason;
    }),
  ];
  onBeforeUnmount(() => offs.forEach((off) => off()));

  async function loadSources() {
    sources.value = await window.luzo.listSources();
  }

  async function start(sourceId: string, mode: NetworkMode, systemAudio: boolean) {
    error.value = null;
    try {
      await service.start({ sourceId, mode, systemAudio });
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
    copy: (text: string) => window.luzo.copyToClipboard(text),
  };
}
