import type { ChecklistItem } from '@luzocast/ui';

/** Traduz o erro do getDisplayMedia (áudio loopback) em algo acionável, com o nome técnico. */
export function describeAudioError(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : 'Erro';
  const msg = err instanceof Error && err.message ? `: ${err.message}` : '';
  const hint: Record<string, string> = {
    NotReadableError: 'O Windows não liberou o áudio (outro programa usa o som em modo exclusivo ou o driver travou).',
    NotFoundError: 'Nenhum dispositivo de saída de som ativo (caixa de som/fone desconectado?).',
    AbortError: 'A captura de áudio foi interrompida pelo Windows.',
    NotAllowedError: 'A captura foi bloqueada.',
  };
  return `${hint[name] ?? 'Não foi possível capturar o áudio do PC.'} (${name}${msg})`;
}

/**
 * Teste REAL: captura a tela principal com áudio do sistema por um instante.
 * É exatamente o caminho usado na transmissão, então pega qualquer causa (driver, serviço,
 * dispositivo, Windows N) — inclusive as que as verificações do main não conhecem.
 */
export async function checkSystemAudio(): Promise<ChecklistItem> {
  const base = { id: 'system-audio', label: 'Áudio do PC (captura)' } as const;
  const openSettings = { id: 'open-sound-settings', label: 'Abrir configurações de som' };
  try {
    const outputs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
    if (outputs.length === 0) {
      return { ...base, status: 'fail', detail: 'Nenhum dispositivo de saída de som encontrado.', action: openSettings };
    }
    if (!(await window.luzo.prepareAudioProbe())) {
      return { ...base, status: 'warn', detail: 'Não foi possível testar agora (transmissão em andamento?).' };
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: true });
    const ok = stream.getAudioTracks().some((t) => t.readyState === 'live');
    stream.getTracks().forEach((t) => t.stop());
    return ok
      ? { ...base, status: 'ok', detail: 'O som do PC será transmitido.' }
      : { ...base, status: 'fail', detail: 'O Windows não entregou a faixa de áudio.', action: openSettings };
  } catch (err) {
    return { ...base, status: 'fail', detail: describeAudioError(err), action: openSettings };
  }
}
