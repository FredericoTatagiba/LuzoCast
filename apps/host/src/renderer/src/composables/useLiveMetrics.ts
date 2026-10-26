import { onBeforeUnmount, shallowRef, watch, type Ref } from 'vue';
import type { StatItem } from '@luzocast/ui';
import type { TransportStats } from '@luzocast/transport';

/**
 * Enquanto está ao vivo, consulta a cada 3 s o uso de RAM/CPU do app e o diagnóstico
 * do encoder, e devolve tudo pronto para o `LcStatGrid`.
 */
export function useLiveMetrics(active: Ref<boolean>, getStats: () => Promise<TransportStats | null>, intervalMs = 3000) {
  const items = shallowRef<StatItem[]>([]);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function sample() {
    const [m, s] = await Promise.all([window.luzo.getMetrics(), getStats().catch(() => null)]);
    const next: StatItem[] = [
      {
        label: 'RAM do LuzoCast',
        value: `${m.appMemoryMB} MB`,
        tone: m.appMemoryMB > 1200 ? 'warn' : 'normal',
        hint: m.processes.map((p) => `${p.type}: ${p.memoryMB} MB`).join('\n'),
      },
      { label: 'CPU do LuzoCast', value: `${m.appCpuPercent}%`, tone: m.appCpuPercent > 150 ? 'warn' : 'normal', hint: '% de um núcleo; pode passar de 100%' },
      { label: 'RAM livre no PC', value: `${(m.systemFreeMB / 1024).toFixed(1)} GB`, tone: m.systemFreeMB < 1500 ? 'warn' : 'normal' },
    ];
    if (s) {
      next.push(
        {
          label: 'Encoder',
          value: s.hardwareEncoder === false ? 'Software' : s.hardwareEncoder ? 'GPU' : '—',
          tone: s.hardwareEncoder === false ? 'bad' : 'normal',
          hint: s.encoderImplementation ?? undefined,
        },
        {
          label: 'Gargalo',
          value: { none: 'Nenhum', cpu: 'CPU', bandwidth: 'Upload', other: 'Outro' }[s.qualityLimitation],
          tone: s.qualityLimitation === 'none' ? 'normal' : 'warn',
        },
        { label: 'Entrega', value: s.frameHeight ? `${s.frameHeight}p · ${Math.round(s.framesPerSecond ?? 0)} fps` : '—' },
      );
    }
    items.value = next;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  watch(
    active,
    (on) => {
      stop();
      if (!on) return void (items.value = []);
      void sample();
      timer = setInterval(() => void sample(), intervalMs);
    },
    { immediate: true },
  );
  onBeforeUnmount(stop);

  return { items };
}
