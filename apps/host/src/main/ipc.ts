import { clipboard, ipcMain, type BrowserWindow } from 'electron';
import { z } from 'zod';
import type { CaptureSourceProvider } from '@luzocast/core';
import { FIX_ACTION_IDS, IPC } from '../shared/api';
import type { ElectronCaptureAdapter } from './capture/ElectronCaptureAdapter';
import type { FixService } from './fixes/FixService';
import type { AttentionService } from './AttentionService';
import type { MetricsService } from './MetricsService';
import type { ReadinessService } from './readiness/ReadinessService';
import type { StreamingController } from './StreamingController';

// Mesmo vindo do nosso renderer, entradas de IPC são validadas (defesa em profundidade).
const StartOptionsSchema = z.object({
  mode: z.enum(['internet', 'lan']),
  sourceId: z.string().min(1).max(256),
  systemAudio: z.boolean(),
}).strict();

const FixActionSchema = z.enum(FIX_ACTION_IDS);
const AttentionMessage = z.string().min(1).max(120);

export interface IpcDeps {
  controller: StreamingController;
  capture: CaptureSourceProvider & Pick<ElectronCaptureAdapter, 'selectPrimaryScreen'>;
  attention: AttentionService;
  readiness: ReadinessService;
  metrics: MetricsService;
  fixes: FixService;
}

export function registerIpc(win: BrowserWindow, deps: IpcDeps): void {
  const fromOurWindow = (e: Electron.IpcMainInvokeEvent) => e.sender === win.webContents;
  const guard = (e: Electron.IpcMainInvokeEvent) => {
    if (!fromOurWindow(e)) throw new Error('origem inválida');
  };

  ipcMain.handle(IPC.listSources, (e) => (guard(e), deps.capture.listSources()));
  ipcMain.handle(IPC.start, (e, raw: unknown) => (guard(e), deps.controller.start(StartOptionsSchema.parse(raw))));
  ipcMain.handle(IPC.stop, (e) => (guard(e), deps.controller.stop()));
  ipcMain.handle(IPC.copy, (e, text: unknown) => {
    guard(e);
    if (typeof text === 'string' && text.length < 2048) clipboard.writeText(text);
  });
  ipcMain.handle(IPC.attention, (e, raw: unknown) => (guard(e), deps.attention.request(AttentionMessage.parse(raw))));
  ipcMain.handle(IPC.readiness, (e) => (guard(e), deps.readiness.runAll()));
  ipcMain.handle(IPC.metrics, (e) => (guard(e), deps.metrics.snapshot()));
  ipcMain.handle(IPC.fix, (e, raw: unknown) => (guard(e), deps.fixes.run(FixActionSchema.parse(raw))));
  ipcMain.handle(IPC.audioProbe, (e) => {
    guard(e);
    if (deps.controller.status === 'live' || deps.controller.status === 'starting') return false; // não troca a fonte no meio de uma transmissão
    return deps.capture.selectPrimaryScreen({ systemAudio: true });
  });
}
