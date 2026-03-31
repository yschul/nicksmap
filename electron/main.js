const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'

// 자동 업데이트 설정
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.logger = require('electron').app ? console : null

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'MindMap Pro',
  })

  // 메뉴 설정
  const menu = Menu.buildFromTemplate([
    {
      label: '파일',
      submenu: [
        { label: '새 마인드맵', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('new-map') },
        { label: '저장', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('save-map') },
        { type: 'separator' },
        { label: '종료', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'CmdOrCtrl+Shift+Z', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: '보기',
      submenu: [
        { label: '확대', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '축소', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '원래 크기', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '전체 화면', accelerator: 'F11', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '개발자 도구', accelerator: 'F12', role: 'toggleDevTools' },
      ],
    },
    {
      label: '도움말',
      submenu: [
        { label: 'MindMap Pro 정보', click: () => {
          const { dialog } = require('electron')
          dialog.showMessageBox(win, {
            type: 'info',
            title: 'MindMap Pro',
            message: 'MindMap Pro v1.2.1',
            detail: '협업 마인드맵 도구\n\n© 2024 MindMap Pro',
          })
        }},
      ],
    },
  ])
  Menu.setApplicationMenu(menu)

  // 창 닫을 때 세션 정리 (자동 로그아웃)
  win.on('close', () => {
    win.webContents.send('app-closing')
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// IPC: 파일 저장 다이얼로그
ipcMain.handle('save-file', async (_event, defaultName, data) => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showSaveDialog(win, {
    title: '마인드맵 저장',
    defaultPath: defaultName,
    filters: [
      { name: 'MindMap JSON', extensions: ['json'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
  })

  if (result.canceled || !result.filePath) return { success: false }

  try {
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true, filePath: result.filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// IPC: 파일 열기 다이얼로그
ipcMain.handle('open-file', async () => {
  const win = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(win, {
    title: '마인드맵 열기',
    filters: [
      { name: 'MindMap JSON', extensions: ['json'] },
      { name: '모든 파일', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) return { success: false }

  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8')
    return { success: true, data: JSON.parse(content), filePath: result.filePaths[0] }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

app.whenReady().then(() => {
  createWindow()

  // 개발 모드에서는 업데이트 체크 안 함
  if (!isDev) {
    // 앱 시작 후 3초 뒤 업데이트 확인
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {})
    }, 3000)
  }
})

// 자동 업데이트 이벤트
autoUpdater.on('update-available', (info) => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return

  dialog.showMessageBox(win, {
    type: 'info',
    title: '업데이트 알림',
    message: `새 버전 (v${info.version})이 있습니다.`,
    detail: '지금 다운로드하시겠습니까?',
    buttons: ['다운로드', '나중에'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.downloadUpdate()
      win.webContents.send('update-status', '업데이트 다운로드 중...')
    }
  })
})

autoUpdater.on('update-not-available', () => {
  // 최신 버전 사용 중 - 조용히 넘어감
})

autoUpdater.on('download-progress', (progress) => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    const percent = Math.round(progress.percent)
    win.setTitle(`MindMap Pro - 업데이트 다운로드 중 ${percent}%`)
  }
})

autoUpdater.on('update-downloaded', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    win.setTitle('MindMap Pro')
  }

  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 준비 완료',
    message: '업데이트가 다운로드되었습니다.',
    detail: '앱을 재시작하면 업데이트가 적용됩니다.',
    buttons: ['지금 재시작', '나중에'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) {
      autoUpdater.quitAndInstall()
    }
  })
})

autoUpdater.on('error', (err) => {
  console.error('Auto-update error:', err)
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    win.setTitle('MindMap Pro')
    dialog.showMessageBox(win, {
      type: 'error',
      title: '업데이트 오류',
      message: '업데이트 다운로드에 실패했습니다.',
      detail: err.message || String(err),
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
