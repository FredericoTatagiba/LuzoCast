/**
 * Frame binário do modo retransmissão (host → servidor):
 *
 *   [1 byte: tamanho do viewerId][viewerId ASCII][pedaço de mídia WebM]
 *
 * O servidor só repassa o pedaço ao viewer indicado (servidor → viewer vai sem cabeçalho).
 * Viewers NUNCA enviam binário: o servidor fecha a conexão se tentarem.
 */
import { MAX_RELAY_CHUNK_BYTES } from './messages';

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function encodeRelayFrame(viewerId: string, chunk: Uint8Array): Uint8Array {
  if (!ID_RE.test(viewerId)) throw new Error('viewerId inválido');
  const id = new TextEncoder().encode(viewerId);
  const out = new Uint8Array(1 + id.length + chunk.length);
  out[0] = id.length;
  out.set(id, 1);
  out.set(chunk, 1 + id.length);
  return out;
}

export function decodeRelayFrame(frame: Uint8Array): { viewerId: string; chunk: Uint8Array } | null {
  if (frame.length < 2 || frame.length > MAX_RELAY_CHUNK_BYTES + 65) return null;
  const len = frame[0]!;
  if (len === 0 || frame.length <= 1 + len) return null;
  const viewerId = new TextDecoder().decode(frame.subarray(1, 1 + len));
  if (!ID_RE.test(viewerId)) return null;
  return { viewerId, chunk: frame.subarray(1 + len) };
}
