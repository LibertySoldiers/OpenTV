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
    downloadUpdate: (url, checksum) => ipcRenderer.send('download-update', url, checksum),
    installUpdate: () => ipcRenderer.send('install-update'),
    saveFavorites: (favorites) => ipcRenderer.invoke('save-favorites', favorites),
    loadFavorites: () => ipcRenderer.invoke('load-favorites'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    selectM3UFile: () => ipcRenderer.invoke('select-m3u-file'),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, percent) => callback(percent)),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, path) => callback(path)),
    onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, err) => callback(err)),
    openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', (_event, settings) => callback(settings))
});
