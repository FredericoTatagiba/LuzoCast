/**
 * Contrato entre main e renderer (exposto pelo preload em `window.luzo`).
 * Arquivo SÓ de tipos e constantes — não importe electron nem node aqui.
 */
import type { CaptureSource, SessionStatus } from '@luzocast/core';

export type NetworkMode = 'internet' | 'lan';

export interface StartOptions {
  mode: NetworkMode;
  sourceId: string;
  systemAudio: boolean;
}

export interface StartResult {
  shareUrl: string;
  /** ws://127.0.0.1:<porta de controle>/ws/host */
  controlUrl: string;
  /** Segredo do canal de controle. Só existe em memória. */
  hostSecret: string;
  /** Aviso a exibir (ex.: modo LAN sem TLS). */
  warning?: string;
}

/** Resultado de um item da verificação de prontidão. */
export type CheckStatus = 'ok' | 'warn' | 'fail';

/**
 * Correções que o app sabe aplicar sozinho (botão no item da verificação).
 * Lista fechada de propósito: o renderer só escolhe o id, o main decide o comando (T11).
 */
export type FixActionId = 'install-media-pack' | 'start-audio-service' | 'open-sound-settings';
export const FIX_ACTION_IDS = ['install-media-pack', 'start-audio-service', 'open-sound-settings'] as const;

export interface FixAction {
  id: FixActionId;
  label: string;
}

export interface FixResult {
  ok: boolean;
  message: string;
}

export interface ReadinessItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Medições que a UI pode reaproveitar (ex.: `uploadKbps` alimenta a qualidade). */
  data?: Record<string, number>;
  /** Correção oferecida quando o item falha. */
  action?: FixAction;
}

/** Uso de recursos do app (todos os processos do Electron). */
export interface MetricsSnapshot {
  /** Memória total do app em MB (soma do working set de todos os processos). */
  appMemoryMB: number;
  /** CPU total do app em % de UM núcleo (pode passar de 100 em multi-core). */
  appCpuPercent: number;
  processes: { type: string; memoryMB: number; cpuPercent: number }[];
  systemFreeMB: number;
  systemTotalMB: number;
}

export interface LuzoApi {
  listSources(): Promise<CaptureSource[]>;
  start(options: StartOptions): Promise<StartResult>;
  stop(): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  /** Chama atenção do usuário (pisca na barra de tarefas + notificação se a janela estiver sem foco). */
  requestAttention(message: string): Promise<void>;
  /** Verificações que dependem do main (rede, cloudflared, memória). */
  runReadinessChecks(): Promise<ReadinessItem[]>;
  getMetrics(): Promise<MetricsSnapshot>;
  /** Aplica uma correção conhecida (pode pedir permissão de administrador). */
  runFix(id: FixActionId): Promise<FixResult>;
  /** Seleciona a tela principal com áudio, para o teste real de captura de áudio. */
  prepareAudioProbe(): Promise<boolean>;
  onStatus(listener: (e: { status: SessionStatus; reason?: string }) => void): () => void;
  onShareUrlChanged(listener: (url: string) => void): () => void;
}

export const IPC = {
  listSources: 'luzo:list-sources',
  start: 'luzo:start',
  stop: 'luzo:stop',
  copy: 'luzo:copy',
  attention: 'luzo:attention',
  readiness: 'luzo:readiness',
  metrics: 'luzo:metrics',
  fix: 'luzo:fix',
  audioProbe: 'luzo:audio-probe',
  status: 'luzo:status',
  shareUrl: 'luzo:share-url',
} as const;
