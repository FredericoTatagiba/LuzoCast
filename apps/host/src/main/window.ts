import { join, resolve } from 'node:path';
import { BrowserWindow, shell } from 'electron';

/**
 * Janela principal com hardening (docs/security.md, T11):
 * sandbox, contextIsolation, sem nodeIntegration, sem navegação, sem popups.
 */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 360,
    minHeight: 560,
    title: 'LuzoCast',
    backgroundColor: '#0f121a',
    // Empacotado, o ícone vem do .exe (build/icon.ico); em dev, do PNG.
    ...(process.env['ELECTRON_RENDERER_URL'] ? { icon: resolve(__dirname, '../../build/icon.png') } : {}),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Nunca navegar para fora da UI do app; links externos abrem no navegador do sistema.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  // Só a captura de tela é permitida; câmera, mic, geolocalização etc. são negadas.
  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'display-capture' || permission === 'media');
  });

  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));

  return win;
}

/** Origens que podem abrir o canal de controle (defesa extra; o segredo é a proteção real). */
export function allowedControlOrigins(): string[] {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  // páginas carregadas via file:// enviam Origin "null" ou "file://"
  return devUrl ? [new URL(devUrl).origin] : ['file://', 'null'];
}
