import { Notification, type BrowserWindow } from 'electron';

/**
 * Chama a atenção do host quando alguém pede para entrar.
 * - Janela em foco: nada a fazer aqui (o renderer já toca o som e destaca o pedido).
 * - Janela sem foco/minimizada: pisca na barra de tarefas e mostra notificação nativa;
 *   clicar na notificação traz a janela para frente.
 */
export class AttentionService {
  constructor(private readonly win: BrowserWindow) {
    win.on('focus', () => win.flashFrame(false));
  }

  async request(message: string): Promise<void> {
    if (this.win.isFocused()) return;
    this.win.flashFrame(true);
    if (!Notification.isSupported()) return;
    // Texto do viewer vai como texto puro: notificações do Windows não interpretam HTML.
    const n = new Notification({ title: 'LuzoCast', body: message, silent: true });
    n.on('click', () => {
      if (this.win.isMinimized()) this.win.restore();
      this.win.show();
      this.win.focus();
    });
    n.show();
  }
}
