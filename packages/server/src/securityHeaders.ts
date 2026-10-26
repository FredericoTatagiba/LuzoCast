/**
 * Cabeçalhos aplicados a toda resposta da porta pública.
 * CSP: a página do viewer só carrega recursos próprios e só conecta no próprio host.
 * Se precisar liberar algo, documente o motivo em docs/security.md.
 */
export function securityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "media-src 'self' blob:",
      "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), display-capture=()',
    'Cache-Control': 'no-store',
  };
}
