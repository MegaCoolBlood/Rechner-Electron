const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const width = 700;
  const height = 700;

  // Position the window near the current cursor location and keep it on-screen.
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x: workX, y: workY, width: workW, height: workH } = display.workArea;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const targetX = clamp(cursor.x - Math.floor(width / 2), workX, workX + workW - width);
  const targetY = clamp(cursor.y - Math.floor(height / 2), workY, workY + workH - height);

  mainWindow = new BrowserWindow({
    width,
    height,
    x: targetX,
    y: targetY,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: false, // Custom titlebar
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // DevTools nicht automatisch öffnen (Debug entfernt)

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.on('ready', createWindow);

// Optimize app startup
if (process.env.NODE_ENV !== 'development') {
  // In production, pre-warm app
  setImmediate(() => {
    // Empty - just helps optimize timing
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.on('minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('close', () => {
  if (mainWindow) mainWindow.close();
});

