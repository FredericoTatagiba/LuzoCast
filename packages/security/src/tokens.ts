import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 128 bits: token de acesso do link (vai no #fragment). */
export const ACCESS_TOKEN_BYTES = 16;
/** 256 bits: segredo do canal de controle (nunca sai da máquina). */
export const HOST_SECRET_BYTES = 32;

/** Gera um segredo aleatório criptograficamente seguro em base64url. */
export function generateSecret(bytes: number = ACCESS_TOKEN_BYTES): string {
  if (bytes < 16) throw new RangeError('Segredos devem ter ao menos 128 bits');
  return randomBytes(bytes).toString('base64url');
}

/** ID curto e não adivinhável para viewers (não é segredo, mas evita enumeração). */
export function generateId(): string {
  return randomBytes(9).toString('base64url');
}

/**
 * Compara dois segredos em tempo constante.
 * Faz hash antes para igualar comprimentos — `timingSafeEqual` exige buffers do mesmo
 * tamanho e comparar tamanhos diretamente vazaria o comprimento do segredo.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Credencial de uma sessão. Imutável; uma nova sessão gera uma nova credencial,
 * o que invalida automaticamente links antigos.
 */
export class SessionCredentials {
  readonly accessToken = generateSecret(ACCESS_TOKEN_BYTES);
  readonly hostSecret = generateSecret(HOST_SECRET_BYTES);

  verifyAccessToken(candidate: string): boolean {
    return safeEqual(candidate, this.accessToken);
  }

  verifyHostSecret(candidate: string): boolean {
    return safeEqual(candidate, this.hostSecret);
  }

  /** Monta o link compartilhável. O token vai no fragment para não aparecer em logs. */
  shareUrl(baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/#t=${this.accessToken}`;
  }
}
