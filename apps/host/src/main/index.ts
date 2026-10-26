/**
 * Composition Root do host: o ÚNICO lugar que instancia implementações concretas
 * e liga as peças. Se você precisa de `new AlgumaCoisaConcreta()` em outro lugar,
 * provavelmente ela deveria ser injetada a partir daqui.
 */
import { join, resolve } from 'node:path';
import { app } from 'electron';
import cloudConfig from '../../resources/cloud.json';
import cloudflaredManifest from '../../resources/cloudflared.json';
import { AttentionService } from './AttentionService';
import { ElectronCaptureAdapter } from './capture/ElectronCaptureAdapter';
import { registerIpc } from './ipc';
import { MetricsService } from './MetricsService';
import { CloudflaredCheck, InternetCheck, LanAddressCheck, MemoryCheck, UploadSpeedCheck } from './readiness/checks';
import { ReadinessService } from './readiness/ReadinessService';
import { StreamingController } from './StreamingController';
import { allowedControlOrigins, createMainWindow } from './window';
import { IPC } from '../shared/api';

const isDev = !app.isPackaged;

/** Build do viewer: em dev vem de apps/viewer/dist; empacotado, de resources/viewer. */
const viewerStaticDir = isDev ? resolve(__dirname, '../../../viewer/dist') : join(process.resourcesPath, 'viewer');
const cloudflaredPath = isDev
  ? resolve(__dirname, '../../resources/bin/cloudflared.exe')
  : join(process.resourcesPath, 'bin', 'cloudflared.exe');
/** Link personalizado: desligado enquanto `brokerUrl` for null (ver docs/link-personalizado.md). */
const brokerUrl = process.env['LUZOCAST_BROKER_URL'] || cloudConfig.brokerUrl || null;

// Necessário para notificações nativas no Windows mostrarem o nome do app.
app.setAppUserModelId('io.github.fredericotatagiba.luzocast');

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
    brokerUrl,
    allowedControlOrigins: allowedControlOrigins(),
    onStatus: (e) => win.webContents.send(IPC.status, e),
    onShareUrl: (url) => win.webContents.send(IPC.shareUrl, url),
  });

  const readiness = new ReadinessService([
    new InternetCheck(),
    new UploadSpeedCheck(),
    new CloudflaredCheck(cloudflaredPath, cloudflaredManifest),
    new LanAddressCheck(),
    new MemoryCheck(),
  ]);

  registerIpc(win, {
    controller,
    capture,
    attention: new AttentionService(win),
    readiness,
    metrics: new MetricsService(),
  });

  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.on('before-quit', () => void controller.stop());
});

app.on('window-all-closed', () => app.quit());
