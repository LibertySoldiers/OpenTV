const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
    getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    offUpdateAvailable: () => ipcRenderer.removeAllListeners('update-available'),
    onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    downloadUpdate: (url) => ipcRenderer.send('download-update', url),
    installUpdate: (path) => ipcRenderer.send('install-update', path),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, percent) => callback(percent)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, path) => callback(path)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, err) => callback(err))
});