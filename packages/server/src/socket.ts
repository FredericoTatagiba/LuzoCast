/**
 * Abstração mínima de um WebSocket (ISP). O `ws` real satisfaz esta interface;
 * nos testes usamos um fake em memória.
 */
export interface MessageSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'message', listener: (data: unknown) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
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
