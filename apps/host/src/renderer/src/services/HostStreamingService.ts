import { TypedEventEmitter } from '@luzocast/core';
import { AdaptiveQualityStrategy, WebRtcTransport, type MediaTransport, type QualityStrategy, type TransportStats } from '@luzocast/transport';
import type { StartOptions } from '../../../shared/api';
import { ControlClient } from './ControlClient';
import { STREAM_PROFILES, type StreamProfileId } from './streamProfiles';

export interface HostViewer {
  id: string;
  displayName: string;
  status: 'pending' | 'admitted';
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
      // O handler no main entrega a fonte escolhida + áudio loopback; nada de picker aqui.
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: profile.fps, max: profile.fps } },
        audio: options.systemAudio,
      });
      this.stream.getVideoTracks()[0]?.addEventListener('ended', () => void this.stop('captura encerrada'));
      this.stream.getVideoTracks().forEach((t) => (t.contentHint = profile.contentHint));

      this.quality = this.createQuality({ uploadKbps: uploadKbps ?? 10_000, targetFps: profile.fps });
      const control = new ControlClient();
      this.control = control;
      this.transport = new WebRtcTransport(
        { offer: (viewerId, sdp) => control.send({ type: 'offer', viewerId, sdp }), ice: (viewerId, candidate) => control.send({ type: 'ice', viewerId, candidate }) },
        undefined,
        { onViewerFailed: (id) => this.kick(id) },
        { degradationPreference: profile.degradationPreference },
      );
      this.wire(control);
      await control.connect(result.controlUrl, result.hostSecret);
      this.emit('share-url', result.shareUrl);
      this.emit('warning', result.warning ?? null);
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
      this.viewers.delete(viewerId);
      this.emitViewers();
      void this.rebalance();
    });
    control.on('closed', () => {
      if (this.control === control) void this.stop('canal de controle caiu');
    });
  }

  private async rebalance(): Promise<void> {
    if (this.transport && this.quality) await this.transport.applyQuality(this.quality.profileFor(this.transport.viewerCount));
  }

  private emitViewers(): void {
    this.emit('viewers', [...this.viewers.values()]);
  }
}
