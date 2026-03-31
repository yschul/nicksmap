interface ElectronAPI {
  saveFile: (defaultName: string, data: object) => Promise<{ success: boolean; filePath?: string; error?: string }>
  openFile: () => Promise<{ success: boolean; data?: object; filePath?: string; error?: string }>
  onAppClosing: (callback: () => void) => void
  onCheckUnsaved: (callback: () => void) => void
  onSaveAndClose: (callback: () => void) => void
  sendUnsavedStatus: (hasChanges: boolean) => void
  sendSaveDone: () => void
}

interface Window {
  electronAPI?: ElectronAPI
}
