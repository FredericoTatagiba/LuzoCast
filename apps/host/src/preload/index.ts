/**
 * Preload: ponte mínima e tipada entre renderer (sandbox) e main.
 * Expor aqui SOMENTE o necessário — cada função nova é superfície de ataque (T11).
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type LuzoApi } from '../shared/api';

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: LuzoApi = {
  listSources: () => ipcRenderer.invoke(IPC.listSources),
  start: (options) => ipcRenderer.invoke(IPC.start, options),
  stop: () => ipcRenderer.invoke(IPC.stop),
  copyToClipboard: (text) => ipcRenderer.invoke(IPC.copy, text),
  onStatus: (l) => subscribe(IPC.status, l),
  onShareUrlChanged: (l) => subscribe(IPC.shareUrl, l),
};

contextBridge.exposeInMainWorld('luzo', api);
