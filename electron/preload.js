const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (defaultName, data) => ipcRenderer.invoke('save-file', defaultName, data),
  openFile: () => ipcRenderer.invoke('open-file'),
  onAppClosing: (callback) => ipcRenderer.on('app-closing', callback),
})
