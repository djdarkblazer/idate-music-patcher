const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('patcher', {
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  patchFiles: (updates) => ipcRenderer.invoke('patch-files', updates),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  onFileCompleted: (callback) => ipcRenderer.on('file-completed', (_, data) => callback(data))
});