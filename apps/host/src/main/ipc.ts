import { clipboard, ipcMain, type BrowserWindow } from 'electron';
import { z } from 'zod';
import type { CaptureSourceProvider } from '@luzocast/core';
import { IPC } from '../shared/api';
import type { StreamingController } from './StreamingController';

// Mesmo vindo do nosso renderer, entradas de IPC são validadas (defesa em profundidade).
const StartOptionsSchema = z.object({
  mode: z.enum(['internet', 'lan']),
  sourceId: z.string().min(1).max(256),
  systemAudio: z.boolean(),
}).strict();

export function registerIpc(win: BrowserWindow, controller: StreamingController, capture: CaptureSourceProvider): void {
  const fromOurWindow = (e: Electron.IpcMainInvokeEvent) => e.sender === win.webContents;

  ipcMain.handle(IPC.listSources, (e) => (fromOurWindow(e) ? capture.listSources() : []));
  ipcMain.handle(IPC.start, (e, raw: unknown) => {
    if (!fromOurWindow(e)) throw new Error('origem inválida');
    return controller.start(StartOptionsSchema.parse(raw));
  });
  ipcMain.handle(IPC.stop, (e) => (fromOurWindow(e) ? controller.stop() : undefined));
  ipcMain.handle(IPC.copy, (e, text: unknown) => {
    if (fromOurWindow(e) && typeof text === 'string' && text.length < 2048) clipboard.writeText(text);
  });
}
