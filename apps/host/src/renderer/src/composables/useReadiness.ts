import { computed, ref, shallowRef } from 'vue';
import type { ChecklistItem } from '@luzocast/ui';
import { checkHardwareEncoder, checkStun } from '@luzocast/transport';

/**
 * "Está tudo pronto?" — junta as verificações do main (rede, upload, cloudflared, RAM)
 * com as do navegador (encoder por GPU, STUN). Roda tudo em paralelo.
 */
export function useReadiness() {
  const items = shallowRef<ChecklistItem[]>([]);
  const running = ref(false);
  const uploadKbps = ref<number | undefined>(undefined);

  const summary = computed(() => {
    if (running.value || items.value.length === 0) return null;
    if (items.value.some((i) => i.status === 'fail')) return { tone: 'fail' as const, text: 'Há problemas que impedem transmitir bem.' };
    if (items.value.some((i) => i.status === 'warn')) return { tone: 'warn' as const, text: 'Dá para transmitir, com ressalvas.' };
    return { tone: 'ok' as const, text: 'Tudo pronto para transmitir!' };
  });

  async function run() {
    running.value = true;
    items.value = [
      { id: 'pending', label: 'Verificando rede, upload, encoder e túnel…', status: 'pending' },
    ];
    try {
      const [main, encoder, stun] = await Promise.all([window.luzo.runReadinessChecks(), checkHardwareEncoder(), checkStun()]);
      uploadKbps.value = main.find((i) => i.id === 'upload')?.data?.['uploadKbps'];
      items.value = [...main, encoder, stun];
    } catch (err) {
      items.value = [{ id: 'error', label: 'Falha ao verificar', status: 'fail', detail: err instanceof Error ? err.message : String(err) }];
    } finally {
      running.value = false;
    }
  }

  return { items, running, summary, uploadKbps, run };
}
