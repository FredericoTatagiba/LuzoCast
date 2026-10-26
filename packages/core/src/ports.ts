/**
 * Portas (interfaces) que o domínio expõe e que adaptadores de plataforma implementam.
 * Mantê-las aqui permite que pacotes dependam da abstração, não da implementação (DIP).
 */

/** Uma tela ou janela que pode ser capturada. */
export interface CaptureSource {
  readonly id: string;
  readonly name: string;
  readonly kind: 'screen' | 'window';
  /** Miniatura em data URL (PNG) para a UI de seleção. */
  readonly thumbnail?: string;
}

/**
 * Adapter de captura por plataforma (Windows/Electron hoje; macOS no futuro).
 * Lista fontes e define qual será usada na próxima chamada de `getDisplayMedia`.
 */
export interface CaptureSourceProvider {
  listSources(): Promise<CaptureSource[]>;
  select(sourceId: string, options: { systemAudio: boolean }): void;
}

/** Endereço público pelo qual os viewers alcançam o servidor local. */
export interface PublicEndpoint {
  /** Base HTTPS/HTTP, sem barra final. Ex.: `https://abc.trycloudflare.com`. */
  readonly baseUrl: string;
  /** `true` quando há TLS de ponta a ponta até o navegador. */
  readonly secure: boolean;
  /** `true` quando as conexões chegam por um proxy confiável (habilita `cf-connecting-ip`). */
  readonly behindTrustedProxy: boolean;
}
