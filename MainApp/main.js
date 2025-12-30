const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { execFile } = require('child_process');
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-software-rasterizer');
let mainWindow = null;
const UPDATE_URL = 'https://open-tv.pages.dev/version.json';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000;
function checkForUpdates() {
    fetch(UPDATE_URL)
        .then(res => res.json())
        .then(data => {
            const currentVersion = app.getVersion();
            if (data.version && data.version !== currentVersion) {
                if (mainWindow) {
                    mainWindow.webContents.send('update-available', data);
                }
            }
        })
        .catch(err => {
        });
}
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        frame: false,
        minWidth: 800,
        minHeight: 490,
        backgroundColor: '#000000',
        icon: path.join(__dirname, 'icon.ico'),
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false,
            webgl: true,
            experimentalFeatures: true
        },
        autoHideMenuBar: true
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        setTimeout(checkForUpdates, 3000);
        setInterval(checkForUpdates, CHECK_INTERVAL);
    });
    ipcMain.handle('toggle-always-on-top', () => {
        const currentState = mainWindow.isAlwaysOnTop();
        mainWindow.setAlwaysOnTop(!currentState);
        return !currentState;
    });
    ipcMain.handle('get-always-on-top', () => {
        return mainWindow.isAlwaysOnTop();
    });
    ipcMain.handle('window-minimize', () => {
        mainWindow.minimize();
    });
    ipcMain.handle('window-maximize', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
        return mainWindow.isMaximized();
    });
    ipcMain.handle('window-close', () => {
        mainWindow.close();
    });
    ipcMain.handle('window-is-maximized', () => {
        return mainWindow.isMaximized();
    });
    ipcMain.handle('open-external', async (event, url) => {
        await shell.openExternal(url);
    });
    ipcMain.on('download-update', (event, downloadUrl) => {
        const tempPath = path.join(os.tmpdir(), 'opentv-update.exe');
        const file = fs.createWriteStream(tempPath);
        https.get(downloadUrl, (response) => {
            if (response.statusCode !== 200) {
                event.reply('update-error', `Download failed: Status ${response.statusCode}`);
                return;
            }
            const totalBytes = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;
            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                file.write(chunk);
                if (totalBytes) {
                    const percent = Math.round((downloadedBytes / totalBytes) * 100);
                    try {
                        if (!mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('update-progress', percent);
                        }
                    } catch (e) { }
                }
            });
            response.on('end', () => {
                file.end();
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('update-downloaded', tempPath);
                }
            });
        }).on('error', (err) => {
            fs.unlink(tempPath, () => { });
            event.reply('update-error', err.message);
        });
    });
    ipcMain.on('install-update', (event, filePath) => {
        execFile(filePath, ['/S'], (err) => {
            if (err) {
                shell.openExternal(filePath);
            }
            app.quit();
        });
        setTimeout(() => app.quit(), 1000);
    });
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const { requestHeaders } = details;
        const url = details.url;
        if (url.startsWith('http')) {
            requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            try {
                const u = new URL(url);
                requestHeaders['Referer'] = u.origin + '/';
                requestHeaders['Origin'] = u.origin;
            } catch (e) { }
        }
        callback({ requestHeaders: requestHeaders });
    });
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['x-content-type-options'];
        delete responseHeaders['access-control-allow-origin'];
        callback({
            responseHeaders: responseHeaders,
            statusLine: details.statusLine
        });
    });
}
app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});