const path = require('path');
const { app, BrowserWindow, powerMonitor } = require("electron");

const IDLE_MINUTES = 15;
const IDLE_THRESHOLD_SEC = IDLE_MINUTES * 60;
const POLL_INTERVAL_MS = 30 * 1000;

let mainWindow = null;
let idleTimeoutEmitted = false;

function startIdleMonitoring(win) {
  if (!win || win.isDestroyed()) return;

  const interval = setInterval(() => {
    if (mainWindow && mainWindow.isDestroyed()) {
      clearInterval(interval);
      return;
    }
    let idleSec = 0;
    try {
      idleSec = powerMonitor.getSystemIdleTime();
    } catch (e) {
      console.warn('getSystemIdleTime failed:', e.message);
    }
    if (idleSec >= IDLE_THRESHOLD_SEC) {
      if (!idleTimeoutEmitted) {
        idleTimeoutEmitted = true;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('idle-timeout');
        }
      }
    } else {
      if (idleTimeoutEmitted) {
        idleTimeoutEmitted = false;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('user-activity');
        }
      }
    }
  }, POLL_INTERVAL_MS);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow = win;
  win.on('closed', () => { mainWindow = null; });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, 'app', 'build', 'index.html'));
  }
  startIdleMonitoring(win);
}

app.whenReady()
  .then(() => { createWindow(); })
  .catch((err) => { console.error('Electron app.whenReady failed:', err); });