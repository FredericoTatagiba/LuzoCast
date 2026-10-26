import { describeAudioError } from './audioProbe';
import { TypedEventEmitter } from '@luzocast/core';
import { AdaptiveQualityStrategy, MseTransport, WebRtcTransport, type MediaTransport, type QualityStrategy, type TransportStats } from '@luzocast/transport';
import type { StartOptions } from '../../../shared/api';
import { ControlClient } from './ControlClient';
import { STREAM_PROFILES, type StreamProfileId } from './streamProfiles';

export interface HostViewer {
  id: string;
  displayName: string;
  status: 'pending' | 'admitted';
  /** Caminho da mídia: direto (P2P) ou retransmitido pelo túnel (fallback). */
  route?: 'p2p' | 'relay';
}

export interface HostServiceEvents extends Record<string, unknown> {
  viewers: readonly HostViewer[];
  /** Novo pedido de entrada (a UI decide como alertar). */
  'viewer-request': HostViewer;
  'share-url': string;
  warning: string | null;
  stopped: { reason?: string };
}

export interface HostStartOptions extends StartOptions {
  profile: StreamProfileId;
  /** Upload medido na verificação de prontidão; sem medição usa 10 Mbps (conservador). */
  uploadKbps?: number;
}

/** Fábrica de política de qualidade (injetável para testes ou outras políticas). */
export type QualityFactory = (opts: { uploadKbps: number; targetFps: number }) => QualityStrategy;

const defaultQuality: QualityFactory = (o) => new AdaptiveQualityStrategy(o);

/**
 * Facade do lado do host: a UI chama start/stop/admit/reject/kick e escuta eventos.
 * Esconde canal de controle, captura (getDisplayMedia) e transporte de mídia.
 */
export class HostStreamingService extends TypedEventEmitter<HostServiceEvents> {
  private control: ControlClient | null = null;
  private transport: MediaTransport | null = null;
  /** Fallback quando o P2P falha: mídia pelo túnel (ADR-0004). */
  private relay: MediaTransport | null = null;
  private stream: MediaStream | null = null;
  private quality: QualityStrategy | null = null;
  private readonly viewers = new Map<string, HostViewer>();

  constructor(
    private readonly api = window.luzo,
    private readonly createQuality: QualityFactory = defaultQuality,
  ) {
    super();
    api.onShareUrlChanged((url) => this.emit('share-url', url));
  }

  async start(options: HostStartOptions): Promise<void> {
    const { profile: profileId, uploadKbps, ...mainOptions } = options;
    const profile = STREAM_PROFILES[profileId];
    const result = await this.api.start(mainOptions);
    try {
      this.stream = await this.capture(profile.fps, options.systemAudio);
      this.stream.getVideoTracks()[0]?.addEventListener('ended', () => void this.stop('captura encerrada'));
      this.stream.getVideoTracks().forEach((t) => (t.contentHint = profile.contentHint));

      this.quality = this.createQuality({ uploadKbps: uploadKbps ?? 10_000, targetFps: profile.fps });
      const control = new ControlClient();
      this.control = control;
      this.transport = new WebRtcTransport(
        { offer: (viewerId, sdp) => control.send({ type: 'offer', viewerId, sdp }), ice: (viewerId, candidate) => control.send({ type: 'ice', viewerId, candidate }) },
        undefined,
        { onViewerFailed: (id) => void this.fallbackToRelay(id) },
        { degradationPreference: profile.degradationPreference },
      );
      this.relay = new MseTransport({
        start: (viewerId, mime) => control.send({ type: 'relay-start', viewerId, mime }),
        chunk: (viewerId, data) => control.sendRelayChunk(viewerId, data),
      });
      this.wire(control);
      await control.connect(result.controlUrl, result.hostSecret);
      this.emit('share-url', result.shareUrl);
      this.emit('warning', [result.warning, this.captureWarning].filter(Boolean).join(' ') || null);
    } catch (err) {
      await this.stop(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /** Aprova o viewer e já inicia a negociação WebRTC (o offer sai do transporte). */
  admit(id: string): void {
    const v = this.viewers.get(id);
    if (!v || v.status !== 'pending' || !this.stream || !this.transport || !this.control) return;
    this.control.send({ type: 'admit', viewerId: id });
    v.status = 'admitted';
    v.route = 'p2p';
    this.emitViewers();
    void this.transport.addViewer(id, this.stream).then(() => this.rebalance());
  }

  reject(id: string): void {
    this.control?.send({ type: 'reject', viewerId: id });
  }

  kick(id: string): void {
    this.control?.send({ type: 'kick', viewerId: id });
  }

  /** Diagnóstico do encode (hardware/software, gargalo, fps). `null` sem viewers. */
  getStats(): Promise<TransportStats | null> {
    return this.transport?.getStats() ?? Promise.resolve(null);
  }

  async stop(reason?: string): Promise<void> {
    this.control?.send({ type: 'end' });
    this.control?.close();
    this.control = null;
    this.transport?.close();
    this.transport = null;
    this.relay?.close();
    this.relay = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.quality = null;
    this.viewers.clear();
    this.emitViewers();
    await this.api.stop();
    this.emit('stopped', reason ? { reason } : {});
  }

  private wire(control: ControlClient): void {
    control.on('viewer-request', ({ viewerId, displayName }) => {
      const viewer: HostViewer = { id: viewerId, displayName, status: 'pending' };
      this.viewers.set(viewerId, viewer);
      this.emitViewers();
      this.emit('viewer-request', viewer);
    });
    control.on('viewer-answer', ({ viewerId, sdp }) => void this.transport?.handleSignal(viewerId, { type: 'answer', sdp }));
    control.on('viewer-ice', ({ viewerId, candidate }) => void this.transport?.handleSignal(viewerId, { type: 'ice', candidate }));
    control.on('viewer-left', ({ viewerId }) => {
      this.transport?.removeViewer(viewerId);
      this.relay?.removeViewer(viewerId);
      this.viewers.delete(viewerId);
      this.emitViewers();
      void this.rebalance();
    });
    control.on('closed', () => {
      if (this.control === control) void this.stop('canal de controle caiu');
    });
  }

  private captureWarning: string | null = null;

  /**
   * Captura tela + áudio do sistema. Se o áudio falhar (sem dispositivo de saída ativo,
   * driver ocupado em modo exclusivo, serviço de áudio parado...), tenta de novo só com
   * vídeo em vez de abortar a transmissão — e avisa o usuário.
   */
  private async capture(fps: number, systemAudio: boolean): Promise<MediaStream> {
    const video = { frameRate: { ideal: fps, max: fps } };
    this.captureWarning = null;
    if (!systemAudio) return navigator.mediaDevices.getDisplayMedia({ video, audio: false });
    try {
      return await navigator.mediaDevices.getDisplayMedia({ video, audio: true });
    } catch (err) {
      console.warn('[luzocast] captura com áudio falhou; tentando só vídeo', err);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video, audio: false });
      this.captureWarning = `${describeAudioError(err)} Transmitindo só o vídeo — use "Verificar se está tudo pronto" para corrigir.`;
      return stream;
    }
  }

  /** P2P não conectou: passa o viewer para o modo retransmissão pelo túnel. */
  private async fallbackToRelay(viewerId: string): Promise<void> {
    const v = this.viewers.get(viewerId);
    if (!v || v.route === 'relay' || !this.relay || !this.stream) return;
    this.transport?.removeViewer(viewerId);
    v.route = 'relay';
    this.emitViewers();
    try {
      await this.relay.addViewer(viewerId, this.stream);
      await this.rebalance();
    } catch (err) {
      console.warn('[luzocast] retransmissão indisponível', err);
      this.kick(viewerId);
    }
  }

  private async rebalance(): Promise<void> {
    if (!this.quality) return;
    // o upload é dividido entre todos os viewers, P2P ou retransmitidos
    const total = (this.transport?.viewerCount ?? 0) + (this.relay?.viewerCount ?? 0);
    const profile = this.quality.profileFor(total);
    await Promise.all([this.transport?.applyQuality(profile), this.relay?.applyQuality(profile)]);
  }

  private emitViewers(): void {
    this.emit('viewers', [...this.viewers.values()]);
  }
}
