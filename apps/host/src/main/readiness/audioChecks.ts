import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CheckResult, ReadinessCheck } from './ReadinessCheck';

/** Portas para o SO (injetadas → testável sem Windows). */
export type FileExists = (path: string) => boolean;
export type RunCommand = (file: string, args: string[]) => Promise<string>;

export const nodeFileExists: FileExists = existsSync;
export const nodeRunCommand: RunCommand = (file, args) =>
  new Promise((resolve) => execFile(file, args, { windowsHide: true, timeout: 5000 }, (_err, stdout) => resolve(String(stdout ?? ''))));

/**
 * Windows "N"/"KN" vem sem o Media Feature Pack (Media Foundation). Sem ele o Chromium
 * perde o encoder H.264 por hardware e partes da pilha de mídia — a captura de áudio pode falhar.
 * Detecção: `mfplat.dll` ausente em System32.
 */
export class WindowsMediaCheck implements ReadinessCheck {
  readonly id = 'media-pack';
  readonly label = 'Componentes de mídia do Windows';

  constructor(
    private readonly exists: FileExists = nodeFileExists,
    private readonly systemRoot = process.env['SystemRoot'] ?? 'C:\\Windows',
  ) {}

  async run(): Promise<CheckResult> {
    if (this.exists(join(this.systemRoot, 'System32', 'mfplat.dll'))) return { status: 'ok', detail: 'Media Foundation presente.' };
    return {
      status: 'fail',
      detail: 'Este Windows é uma edição "N" sem o Media Feature Pack: o áudio e o vídeo podem não funcionar.',
      action: { id: 'install-media-pack', label: 'Instalar Media Feature Pack' },
    };
  }
}

/** Serviço "Áudio do Windows" (Audiosrv) precisa estar rodando para capturar o som do PC. */
export class AudioServiceCheck implements ReadinessCheck {
  readonly id = 'audio-service';
  readonly label = 'Serviço de áudio do Windows';

  constructor(private readonly run$: RunCommand = nodeRunCommand) {}

  async run(): Promise<CheckResult> {
    const out = await this.run$('sc.exe', ['query', 'Audiosrv']);
    // A palavra RUNNING e o código 4 não são traduzidos pelo Windows.
    if (/:\s*4\s+RUNNING/i.test(out)) return { status: 'ok', detail: 'Rodando.' };
    return {
      status: 'fail',
      detail: 'O serviço "Áudio do Windows" está parado: sem ele não há som para transmitir.',
      action: { id: 'start-audio-service', label: 'Iniciar serviço de áudio' },
    };
  }
}
