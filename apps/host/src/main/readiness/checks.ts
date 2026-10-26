import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { freemem, networkInterfaces } from 'node:os';
import { pickLanAddress } from '@luzocast/tunnel';
import type { CheckResult, ReadinessCheck } from './ReadinessCheck';

/** cloudflared presente e com o hash esperado (necessário só para o modo Internet). */
export class CloudflaredCheck implements ReadinessCheck {
  readonly id = 'cloudflared';
  readonly label = 'Túnel para internet (cloudflared)';

  constructor(
    private readonly binaryPath: string,
    private readonly expected: { version: string; sha256: string },
  ) {}

  async run(): Promise<CheckResult> {
    if (!existsSync(this.binaryPath)) {
      return { status: 'warn', detail: 'Não instalado: só o modo "Somente rede local" vai funcionar.' };
    }
    const hash = createHash('sha256').update(await readFile(this.binaryPath)).digest('hex');
    return hash === this.expected.sha256
      ? { status: 'ok', detail: `Versão ${this.expected.version} verificada.` }
      : { status: 'fail', detail: 'Arquivo não confere com o hash oficial. Reinstale o LuzoCast.' };
  }
}

/** Acesso à internet (e à Cloudflare, que hospeda o túnel). */
export class InternetCheck implements ReadinessCheck {
  readonly id = 'internet';
  readonly label = 'Conexão com a internet';

  async run(): Promise<CheckResult> {
    const started = Date.now();
    const res = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { status: 'fail', detail: `Resposta inesperada (HTTP ${res.status}).` };
    const ms = Date.now() - started;
    return { status: ms > 1500 ? 'warn' : 'ok', detail: `Online · latência ~${ms} ms.`, data: { latencyMs: ms } };
  }
}

/**
 * Mede o upload enviando 4 MB ao endpoint público de teste da Cloudflare.
 * O resultado alimenta a qualidade adaptativa (quantos viewers cabem com boa imagem).
 */
export class UploadSpeedCheck implements ReadinessCheck {
  readonly id = 'upload';
  readonly label = 'Velocidade de upload';
  private static readonly BYTES = 4 * 1024 * 1024;

  async run(): Promise<CheckResult> {
    const body = new Uint8Array(UploadSpeedCheck.BYTES);
    const started = performance.now();
    const res = await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body, signal: AbortSignal.timeout(20_000) });
    await res.arrayBuffer();
    const seconds = (performance.now() - started) / 1000;
    const kbps = Math.round((UploadSpeedCheck.BYTES * 8) / 1000 / seconds);
    const mbps = (kbps / 1000).toFixed(1);
    // ~4 Mbps por viewer em 1080p30; ~6 Mbps em 1080p60 (perfil Jogo)
    const viewers1080 = Math.max(0, Math.floor((kbps * 0.8) / 4000));
    if (kbps < 1500) return { status: 'fail', detail: `${mbps} Mbps — insuficiente para transmitir com qualidade.`, data: { uploadKbps: kbps } };
    if (kbps < 6000) return { status: 'warn', detail: `${mbps} Mbps — dá para ~${Math.max(1, viewers1080)} pessoa(s) em boa qualidade.`, data: { uploadKbps: kbps } };
    return { status: 'ok', detail: `${mbps} Mbps — ~${viewers1080} pessoas em 1080p.`, data: { uploadKbps: kbps } };
  }
}

/** Endereço usado no modo "Somente rede local". */
export class LanAddressCheck implements ReadinessCheck {
  readonly id = 'lan';
  readonly label = 'Rede local';

  async run(): Promise<CheckResult> {
    const ip = pickLanAddress(networkInterfaces());
    return ip
      ? { status: 'ok', detail: `Endereço na rede local: ${ip}` }
      : { status: 'warn', detail: 'Nenhuma rede local encontrada (Wi-Fi/cabo desconectado?).' };
  }
}

/** RAM livre: abaixo de ~1,5 GB, jogo + transmissão começam a disputar memória. */
export class MemoryCheck implements ReadinessCheck {
  readonly id = 'memory';
  readonly label = 'Memória disponível';

  async run(): Promise<CheckResult> {
    const freeMB = Math.round(freemem() / 1024 / 1024);
    if (freeMB < 800) return { status: 'fail', detail: `${freeMB} MB livres — feche programas antes de transmitir.`, data: { freeMB } };
    if (freeMB < 1500) return { status: 'warn', detail: `${freeMB} MB livres — pode faltar memória ao transmitir jogos.`, data: { freeMB } };
    return { status: 'ok', detail: `${(freeMB / 1024).toFixed(1)} GB livres.`, data: { freeMB } };
  }
}
