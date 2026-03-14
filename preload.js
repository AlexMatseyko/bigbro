const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onIdleTimeout: (callback) => {
    ipcRenderer.on('idle-timeout', () => callback());
  },
  onUserActivity: (callback) => {
    ipcRenderer.on('user-activity', () => callback());
  }
});
