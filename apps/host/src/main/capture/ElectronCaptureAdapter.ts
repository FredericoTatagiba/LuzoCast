import { desktopCapturer, type DesktopCapturerSource, type Session } from 'electron';
import type { CaptureSource, CaptureSourceProvider } from '@luzocast/core';

/**
 * Adapter: traduz a API de captura do Electron para a porta `CaptureSourceProvider`.
 * Fluxo: UI lista fontes → usuário escolhe → `select()` → renderer chama
 * `getDisplayMedia()` → o handler instalado aqui entrega a fonte escolhida (+ áudio loopback).
 *
 * Para macOS: criar outro adapter (o loopback de áudio lá depende de ScreenCaptureKit).
 */
export class ElectronCaptureAdapter implements CaptureSourceProvider {
  private sources = new Map<string, DesktopCapturerSource>();
  private selected: { source: DesktopCapturerSource; systemAudio: boolean } | null = null;

  async listSources(): Promise<CaptureSource[]> {
    const list = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
    this.sources = new Map(list.map((s) => [s.id, s]));
    return list.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: s.thumbnail.toDataURL(),
    }));
  }

  select(sourceId: string, options: { systemAudio: boolean }): void {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error('Fonte de captura desconhecida; liste as fontes novamente');
    this.selected = { source, systemAudio: options.systemAudio };
  }

  /** Instala o handler de `getDisplayMedia` na sessão do renderer. */
  install(session: Session): void {
    session.setDisplayMediaRequestHandler((_request, callback) => {
      const sel = this.selected;
      if (!sel) return callback({});
      // 'loopback' = áudio do sistema (Windows). Sem áudio → só vídeo.
      callback(sel.systemAudio ? { video: sel.source, audio: 'loopback' } : { video: sel.source });
    });
  }
}
