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

export interface LuzoApi {
  listSources(): Promise<CaptureSource[]>;
  start(options: StartOptions): Promise<StartResult>;
  stop(): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  onStatus(listener: (e: { status: SessionStatus; reason?: string }) => void): () => void;
  onShareUrlChanged(listener: (url: string) => void): () => void;
}

export const IPC = {
  listSources: 'luzo:list-sources',
  start: 'luzo:start',
  stop: 'luzo:stop',
  copy: 'luzo:copy',
  status: 'luzo:status',
  shareUrl: 'luzo:share-url',
} as const;
