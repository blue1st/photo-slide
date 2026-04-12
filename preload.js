const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('open-directory'),
  readImages: (dirPath) => ipcRenderer.invoke('read-images', dirPath),
  getTags: (filePath) => ipcRenderer.invoke('get-tags', filePath),
  setTags: (data) => ipcRenderer.invoke('set-tags', data),
  getAllTags: (imagePaths) => ipcRenderer.invoke('get-all-tags', { imagePaths }),
  renameFile: (data) => ipcRenderer.invoke('rename-file', data),
});
