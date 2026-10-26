/**
 * Composition Root do host: o ÚNICO lugar que instancia implementações concretas
 * e liga as peças. Se você precisa de `new AlgumaCoisaConcreta()` em outro lugar,
 * provavelmente ela deveria ser injetada a partir daqui.
 */
import { join, resolve } from 'node:path';
import { app } from 'electron';
import { ElectronCaptureAdapter } from './capture/ElectronCaptureAdapter';
import { registerIpc } from './ipc';
import { StreamingController } from './StreamingController';
import { allowedControlOrigins, createMainWindow } from './window';
import { IPC } from '../shared/api';

const isDev = !app.isPackaged;

/** Build do viewer: em dev vem de apps/viewer/dist; empacotado, de resources/viewer. */
const viewerStaticDir = isDev ? resolve(__dirname, '../../../viewer/dist') : join(process.resourcesPath, 'viewer');
const cloudflaredPath = isDev
  ? resolve(__dirname, '../../resources/bin/cloudflared.exe')
  : join(process.resourcesPath, 'bin', 'cloudflared.exe');

// Uma instância só: duas instâncias brigariam pela captura e pelo túnel.
if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  const win = createMainWindow();
  const capture = new ElectronCaptureAdapter();
  capture.install(win.webContents.session);

  const controller = new StreamingController({
    capture,
    viewerStaticDir,
    cloudflaredPath,
    allowedControlOrigins: allowedControlOrigins(),
    onStatus: (e) => win.webContents.send(IPC.status, e),
    onShareUrl: (url) => win.webContents.send(IPC.shareUrl, url),
  });

  registerIpc(win, controller, capture);

  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.on('before-quit', () => void controller.stop());
});

app.on('window-all-closed', () => app.quit());
