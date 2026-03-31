const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (defaultName, data) => ipcRenderer.invoke('save-file', defaultName, data),
  openFile: () => ipcRenderer.invoke('open-file'),
  onAppClosing: (callback) => ipcRenderer.on('app-closing', callback),
  onCheckUnsaved: (callback) => ipcRenderer.on('check-unsaved', callback),
  onSaveAndClose: (callback) => ipcRenderer.on('save-and-close', callback),
  sendUnsavedStatus: (hasChanges) => ipcRenderer.send('unsaved-status', hasChanges),
  sendSaveDone: () => ipcRenderer.send('save-done'),
})
