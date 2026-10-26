import { execFile } from 'node:child_process';
import type { FixActionId, FixResult } from '../../shared/api';

/** Uma correção conhecida (Strategy). O comando é fixo no main; o renderer só manda o id. */
export interface FixStrategy {
  run(): Promise<FixResult>;
}

export type Elevate = (script: string) => Promise<number>;
export type OpenExternal = (url: string) => Promise<void>;

/**
 * Executa `script` num PowerShell elevado (o Windows mostra o UAC) e devolve o exit code.
 * -1 = usuário recusou o UAC ou o PowerShell não abriu.
 */
export const elevatePowerShell: Elevate = (script) =>
  new Promise((resolve) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const outer =
      `try { $p = Start-Process -FilePath powershell.exe -ArgumentList '-NoProfile','-EncodedCommand','${encoded}' ` +
      `-Verb RunAs -Wait -PassThru; exit $p.ExitCode } catch { exit -1 }`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', outer], { windowsHide: true }, (err) => {
      const raw = err ? (typeof err.code === 'number' ? err.code : -1) : 0;
      resolve(raw > 0x7fffffff ? raw - 0x100000000 : raw); // exit -1 chega como 4294967295
    });
  });

const MEDIA_PACK =
  "dism.exe /Online /Add-Capability /CapabilityName:Media.MediaFeaturePack~~~~0.0.1.0 /NoRestart; exit $LASTEXITCODE";
const AUDIO_SERVICE =
  'Set-Service AudioEndpointBuilder -StartupType Automatic; Set-Service Audiosrv -StartupType Automatic; ' +
  'Start-Service AudioEndpointBuilder; Start-Service Audiosrv; exit 0';

export class FixService {
  private readonly strategies: Record<FixActionId, FixStrategy>;

  constructor(elevate: Elevate, openExternal: OpenExternal) {
    const cancelled: FixResult = { ok: false, message: 'Permissão de administrador negada; nada foi alterado.' };
    this.strategies = {
      'install-media-pack': {
        async run() {
          const code = await elevate(MEDIA_PACK);
          if (code === 0) return { ok: true, message: 'Media Feature Pack instalado. Reinicie o LuzoCast.' };
          if (code === 3010) return { ok: true, message: 'Media Feature Pack instalado. Reinicie o computador para concluir.' };
          if (code === -1) return cancelled;
          return {
            ok: false,
            message: `O Windows não conseguiu instalar (código ${code}). Instale por Configurações › Aplicativos › Recursos opcionais › "Media Feature Pack".`,
          };
        },
      },
      'start-audio-service': {
        async run() {
          const code = await elevate(AUDIO_SERVICE);
          return code === 0 ? { ok: true, message: 'Serviço de áudio iniciado.' } : code === -1 ? cancelled : { ok: false, message: `Não foi possível iniciar o serviço (código ${code}).` };
        },
      },
      'open-sound-settings': {
        async run() {
          await openExternal('ms-settings:sound');
          return { ok: true, message: 'Abrimos as configurações de som: escolha um dispositivo de saída e verifique de novo.' };
        },
      },
    };
  }

  run(id: FixActionId): Promise<FixResult> {
    return this.strategies[id].run();
  }
}
