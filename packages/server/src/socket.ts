/**
 * Abstração mínima de um WebSocket (ISP). O `ws` real satisfaz esta interface;
 * nos testes usamos um fake em memória.
 */
export interface MessageSocket {
  send(data: string | Uint8Array): void;
  close(code?: number, reason?: string): void;
  /** `isBinary` vem do `ws`; fakes de teste podem omitir (texto). */
  on(event: 'message', listener: (data: unknown, isBinary?: boolean) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  /** Bytes ainda não enviados (usado para descartar viewers lentos no modo retransmissão). */
  readonly bufferedAmount?: number;
}

/** Códigos de fechamento usados pelo servidor. */
export const CloseCode = {
  normal: 1000,
  policyViolation: 1008,
  tryAgainLater: 1013,
} as const;

export function toText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (Array.isArray(data)) return Buffer.concat(data as Buffer[]).toString('utf8');
  return String(data);
}

export function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return Buffer.concat(data as Buffer[]);
  return new Uint8Array();
}
