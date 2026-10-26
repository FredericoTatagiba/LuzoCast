/**
 * Protocolo de sinalização do LuzoCast — FONTE DA VERDADE.
 * Documentação humana: docs/signaling-protocol.md (mantenha os dois em sincronia).
 *
 * Para adicionar uma mensagem:
 *  1. crie o schema aqui e inclua na união do canal/direção correta;
 *  2. trate no servidor (packages/server) e no cliente (host ou viewer);
 *  3. atualize a tabela no documento; suba PROTOCOL_VERSION se quebrar compatibilidade.
 */
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 32 * 1024;

const sdp = z.string().min(1).max(24 * 1024);
const viewerId = z.string().min(1).max(64);
const candidate = z
  .object({
    candidate: z.string().max(1024),
    sdpMid: z.string().max(64).nullable().optional(),
    sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
    usernameFragment: z.string().max(256).nullable().optional(),
  })
  .strict();
const displayName = z
  .string()
  .trim()
  .min(1)
  .max(32)
  // sem caracteres de controle; a UI ainda escapa o texto (nunca use v-html)
  .regex(/^[^\p{Cc}]+$/u);

// ───────────────────────── Canal público: viewer → servidor
export const ViewerToServer = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), v: z.literal(PROTOCOL_VERSION), token: z.string().min(1).max(128), displayName }).strict(),
  z.object({ type: z.literal('answer'), sdp }).strict(),
  z.object({ type: z.literal('ice'), candidate }).strict(),
  z.object({ type: z.literal('leave') }).strict(),
]);
export type ViewerToServer = z.infer<typeof ViewerToServer>;

// ───────────────────────── Canal público: servidor → viewer
export const RejectReason = z.enum(['invalid-token', 'host-declined', 'room-full', 'rate-limited']);
export type RejectReason = z.infer<typeof RejectReason>;

export const ServerToViewer = z.discriminatedUnion('type', [
  z.object({ type: z.literal('waiting'), viewerId }),
  z.object({ type: z.literal('admitted') }),
  z.object({ type: z.literal('rejected'), reason: RejectReason }),
  z.object({ type: z.literal('offer'), sdp }),
  z.object({ type: z.literal('ice'), candidate }),
  z.object({ type: z.literal('kicked') }),
  z.object({ type: z.literal('ended') }),
]);
export type ServerToViewer = z.infer<typeof ServerToViewer>;

// ───────────────────────── Canal de controle: host → servidor
export const HostToServer = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth'), v: z.literal(PROTOCOL_VERSION), secret: z.string().min(1).max(128) }).strict(),
  z.object({ type: z.literal('admit'), viewerId }).strict(),
  z.object({ type: z.literal('reject'), viewerId }).strict(),
  z.object({ type: z.literal('kick'), viewerId }).strict(),
  z.object({ type: z.literal('offer'), viewerId, sdp }).strict(),
  z.object({ type: z.literal('ice'), viewerId, candidate }).strict(),
  z.object({ type: z.literal('end') }).strict(),
]);
export type HostToServer = z.infer<typeof HostToServer>;

// ───────────────────────── Canal de controle: servidor → host
export const ServerToHost = z.discriminatedUnion('type', [
  z.object({ type: z.literal('auth-ok') }),
  z.object({ type: z.literal('viewer-request'), viewerId, displayName }),
  z.object({ type: z.literal('viewer-answer'), viewerId, sdp }),
  z.object({ type: z.literal('viewer-ice'), viewerId, candidate }),
  z.object({ type: z.literal('viewer-left'), viewerId }),
]);
export type ServerToHost = z.infer<typeof ServerToHost>;

export type IceCandidate = z.infer<typeof candidate>;
