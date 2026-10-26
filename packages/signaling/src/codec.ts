import type { ZodType } from 'zod';
import { MAX_MESSAGE_BYTES } from './messages';

export type DecodeResult<T> = { ok: true; value: T } | { ok: false; error: 'too-large' | 'invalid-json' | 'invalid-schema' };

/**
 * Decodifica e valida uma mensagem recebida. Nunca lança: quem chama decide
 * o que fazer com mensagem inválida (o servidor fecha a conexão com 1008).
 */
export function decode<T>(schema: ZodType<T>, raw: string): DecodeResult<T> {
  if (raw.length > MAX_MESSAGE_BYTES) return { ok: false, error: 'too-large' };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  const parsed = schema.safeParse(data);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: 'invalid-schema' };
}

/** Serializa uma mensagem já tipada. */
export function encode<T>(message: T): string {
  return JSON.stringify(message);
}
