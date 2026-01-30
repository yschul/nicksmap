const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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
            message: 'MindMap Pro v1.0.0',
            detail: '협업 마인드맵 도구\n\n© 2024 MindMap Pro',
          })
        }},
      ],
    },
  ])
  Menu.setApplicationMenu(menu)

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

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
