/**
 * Som curto de "alguém quer entrar", gerado com Web Audio (sem arquivo de áudio: nada a
 * empacotar e nada a liberar na CSP).
 *
 * ⚠️ Com "áudio do sistema" ligado, o loopback do Windows captura TUDO o que toca no PC —
 * inclusive este alerta. Os espectadores também ouvem o "plim". Ver docs/performance.md.
 */
export class AlertSound {
  private ctx: AudioContext | null = null;

  constructor(private enabled = true) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  play(): void {
    if (!this.enabled) return;
    this.ctx ??= new AudioContext();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Duas notas ascendentes (Mi5 → Lá5), envelope curto para não assustar.
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.14;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }
}
