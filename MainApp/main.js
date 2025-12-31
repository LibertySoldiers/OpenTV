const { app, BrowserWindow, session, ipcMain, shell, dialog } = require('electron');
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
app.commandLine.appendSwitch('disable-http-cache'); // Désactive le cache disque Chromium
app.commandLine.appendSwitch('disk-cache-size', '1'); // Force la taille du cache à 1 octet

let mainWindow = null;
let settingsWindow = null;
const UPDATE_URL = 'https://open-tv.pages.dev/version.json';
const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

// Purge du cache physique résiduel (GPU, Shaders, etc.) pour confidentialité totale
const cachePath = path.join(app.getPath('userData'), 'Cache');
const codeCachePath = path.join(app.getPath('userData'), 'Code Cache');
const gpuCachePath = path.join(app.getPath('userData'), 'GPUCache');

[cachePath, codeCachePath, gpuCachePath].forEach(p => {
    if (fs.existsSync(p)) {
        try {
            fs.rmSync(p, { recursive: true, force: true });
        } catch (e) {
            console.error('Impossible de supprimer le cache résiduel:', e);
        }
    }
});

function checkForUpdates() {
    fetch(UPDATE_URL)
        .then(res => res.json())
        .then(data => {
            const currentVersion = app.getVersion();
            if (data.version && data.version.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0) {
                if (mainWindow) {
                    mainWindow.webContents.send('update-available', data);
                }
            }
        })
        .catch(err => {
            console.error('Update check failed:', err);
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
            webSecurity: true,
            allowRunningInsecureContent: false,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false,
            webgl: true,
            experimentalFeatures: false,
            sandbox: true,
            partition: 'memory' // Utilise une session en mémoire vive uniquement (pas d'écriture disque)
        },
        autoHideMenuBar: true
    });

    // Optionnel : Désactiver l'ouverture des outils de développement (F12 / Ctrl+Maj+I)
    // Pour le développement, vous pouvez laisser commenter la ligne ci-dessous :
    // mainWindow.webContents.on('devtools-opened', () => { mainWindow.webContents.closeDevTools(); });

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

    ipcMain.handle('window-minimize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.minimize();
    });

    ipcMain.handle('window-maximize', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            if (win.isMaximized()) {
                win.unmaximize();
            } else {
                win.maximize();
            }
            return win.isMaximized();
        }
        return false;
    });

    ipcMain.handle('window-close', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) win.close();
    });

    ipcMain.handle('window-is-maximized', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        return win ? win.isMaximized() : false;
    });

    ipcMain.handle('open-external', async (event, url) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            await shell.openExternal(url);
        }
    });

    // --- GESTION DES FAVORIS (PERSISTANCE OPTION B) ---
    const favoritesPath = path.join(app.getPath('userData'), 'favorites.json');

    ipcMain.handle('save-favorites', (event, favorites) => {
        try {
            fs.writeFileSync(favoritesPath, JSON.stringify(favorites));
            return true;
        } catch (err) {
            console.error('Erreur sauvegarde favoris:', err);
            return false;
        }
    });

    ipcMain.handle('load-favorites', () => {
        try {
            if (fs.existsSync(favoritesPath)) {
                const data = fs.readFileSync(favoritesPath, 'utf8').trim();
                return data ? JSON.parse(data) : [];
            }
        } catch (err) {
            console.error('Erreur chargement favoris:', err);
        }
        return [];
    });

    const settingsPath = path.join(app.getPath('userData'), 'settings.json');

    ipcMain.handle('save-settings', (event, newSettings) => {
        try {
            let settings = {};
            if (fs.existsSync(settingsPath)) {
                const data = fs.readFileSync(settingsPath, 'utf8').trim();
                if (data) settings = JSON.parse(data);
            }
            settings = { ...settings, ...newSettings };
            fs.writeFileSync(settingsPath, JSON.stringify(settings));

            // Notifier la fenêtre principale
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('settings-updated', settings);
            }
            return true;
        } catch (err) {
            console.error('Erreur sauvegarde réglages:', err);
            return false;
        }
    });

    ipcMain.on('open-settings-window', () => {
        if (settingsWindow) {
            settingsWindow.focus();
            return;
        }

        settingsWindow = new BrowserWindow({
            width: 580,
            height: 720,
            frame: false,
            parent: mainWindow,
            modal: false,
            backgroundColor: '#0a0a0c',
            icon: path.join(__dirname, 'icon.ico'),
            autoHideMenuBar: true,
            resizable: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js'),
                sandbox: true,
                partition: 'memory'
            }
        });

        settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

        settingsWindow.on('closed', () => {
            settingsWindow = null;
        });
    });

    ipcMain.handle('load-settings', () => {
        try {
            if (fs.existsSync(settingsPath)) {
                const data = fs.readFileSync(settingsPath, 'utf8').trim();
                return data ? JSON.parse(data) : {};
            }
        } catch (err) {
            console.error('Erreur chargement réglages:', err);
        }
        return {};
    });

    ipcMain.handle('select-m3u-file', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [{ name: 'M3U Playlists', extensions: ['m3u', 'm3u8', 'txt'] }]
        });

        if (!result.canceled && result.filePaths.length > 0) {
            try {
                const content = fs.readFileSync(result.filePaths[0], 'utf8');
                return { name: path.basename(result.filePaths[0]), content: content };
            } catch (err) {
                console.error('Erreur lecture fichier M3U:', err);
                return null;
            }
        }
        return null;
    });

    let lastDownloadedUpdate = null;

    ipcMain.on('download-update', (event, downloadUrl) => {
        if (!downloadUrl.startsWith('https://open-tv.pages.dev/')) {
            event.reply('update-error', 'Source non autorisée');
            return;
        }

        const tempPath = path.join(os.tmpdir(), 'opentv-update.exe');
        lastDownloadedUpdate = tempPath;
        const file = fs.createWriteStream(tempPath);

        https.get(downloadUrl, (response) => {
            if (response.statusCode !== 200) {
                event.reply('update-error', `Download failed: ${response.statusCode}`);
                return;
            }

            const totalBytes = parseInt(response.headers['content-length'], 10);
            let downloadedBytes = 0;

            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                file.write(chunk);
                if (totalBytes) {
                    const percent = Math.round((downloadedBytes / totalBytes) * 100);
                    if (!mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('update-progress', percent);
                    }
                }
            });

            response.on('end', () => {
                file.end();
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('update-downloaded');
                }
            });
        }).on('error', (err) => {
            fs.unlink(tempPath, () => { });
            event.reply('update-error', err.message);
        });
    });

    ipcMain.on('install-update', () => {
        if (!lastDownloadedUpdate) return;
        execFile(lastDownloadedUpdate, ['/S'], (err) => {
            if (err) shell.openExternal(lastDownloadedUpdate);
            app.quit();
        });
        setTimeout(() => app.quit(), 1000);
    });

    // 1. Bloquer strictement toute navigation vers l'extérieur
    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://') && !url.includes('index.html')) {
            event.preventDefault();
            console.warn('Navigation bloquée par sécurité:', url);
        }
    });

    // 2. Bloquer strictement toute ouverture de nouvelle fenêtre (pop-up)
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    // 3. Refuser toutes les permissions système
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(false);
    });

    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const { requestHeaders } = details;
        if (details.url.startsWith('http')) {
            requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            try {
                const u = new URL(details.url);
                requestHeaders['Referer'] = u.origin + '/';
                requestHeaders['Origin'] = u.origin;
            } catch (e) { }
        }
        callback({ requestHeaders });
    });

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD'];
        responseHeaders['Access-Control-Allow-Headers'] = ['*'];
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['content-security-policy-report-only'];
        delete responseHeaders['x-frame-options'];
        callback({ responseHeaders, statusLine: details.statusLine });
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});