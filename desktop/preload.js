const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('imageTraceDesktop', {
  startBackend: () => ipcRenderer.invoke('backend:start'),
  stopBackend: () => ipcRenderer.invoke('backend:stop'),
  getBackendInfo: () => ipcRenderer.invoke('backend:info'),
  openDataDir: () => ipcRenderer.invoke('backend:openDataDir'),
});
