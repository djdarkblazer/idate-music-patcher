const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('patcher', {
  browsePath: () => ipcRenderer.invoke('browse-path'),
  checkUpdates: (targetPath) => ipcRenderer.invoke('check-updates', targetPath),
  patchFiles: (updates, targetPath) => ipcRenderer.invoke('patch-files', updates, targetPath),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  onFileCompleted: (callback) => ipcRenderer.on('file-completed', (_, data) => callback(data))
});