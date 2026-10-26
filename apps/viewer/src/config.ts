/** URL do canal público. Mesmo host da página por padrão (servida pelo servidor local). */
export function signalingUrl(): string {
  const override = import.meta.env.VITE_SIGNALING_URL as string | undefined;
  if (override) return override;
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}/ws/viewer`;
}

/** Lê o token do fragment (`#t=...`). O fragment nunca é enviado ao servidor HTTP. */
export function readTokenFromHash(hash: string = location.hash): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const token = params.get('t');
  return token && token.length <= 128 ? token : null;
}

const NAME_KEY = 'luzocast:name';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage indisponível: tudo bem */
  }
}
