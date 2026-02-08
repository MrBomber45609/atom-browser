const { app, BrowserWindow, BrowserView, ipcMain, session, Menu, MenuItem } = require('electron');
const path = require('path');
const AtomShield = require('./atom-shield');

// =========================================================================
// STEALTH: Ocultar que somos Electron/automatizado
// =========================================================================
// Este flag elimina window.navigator.webdriver y la barra "Chrome is being
// controlled by automated test software". Es lo UNICO util del plugin stealth.
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Limpiar el User-Agent global para que Google no detecte "Electron"
app.userAgentFallback = USER_AGENT;

let mainWindow;
let views = new Map();
let activeTabId = null;
const atomShield = new AtomShield();

const TOP_OFFSET = 72;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 400,
        minHeight: 400,
        frame: false,
        backgroundColor: '#0a0a0b',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webviewTag: false,
            backgroundThrottling: false,
            partition: 'persist:atom'
        }
    });

    const ses = session.fromPartition('persist:atom');
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Interceptar ventanas nuevas (target="_blank") en la UI principal
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const tabId = createTab(url);
        mainWindow.webContents.send('tab-created-backend', { id: tabId, url });
        return { action: 'deny' };
    });

    // ATOM SHIELD: inicializar motor de filtros + bloqueo de red
    try {
        await atomShield.init();
        atomShield.enableNetworkBlocking(ses);
        console.log("Atom Shield: ACTIVO");
    } catch (e) {
        console.error("Atom Shield init error:", e);
    }

    // Limpiar headers que delatan a Electron en peticiones a Google
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
        const headers = { ...details.requestHeaders };
        // Eliminar cualquier referencia a Electron en los headers
        if (headers['User-Agent']) {
            headers['User-Agent'] = USER_AGENT;
        }
        // Client Hints: Google los usa para detectar navegadores embebidos
        headers['sec-ch-ua'] = '"Chromium";v="120", "Not:A-Brand";v="8", "Google Chrome";v="120"';
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = '"Windows"';
        callback({ requestHeaders: headers });
    });

    // Permisos
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowedPermissions = ['media', 'fullscreen', 'autoplay'];
        callback(allowedPermissions.includes(permission));
    });

    // Gestor de Descargas
    ses.on('will-download', (event, item, webContents) => {
        const downloadId = Date.now().toString();
        const filename = item.getFilename();

        // Emitir inicio de descarga
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-started', {
                id: downloadId,
                filename: filename,
                path: item.getSavePath()
            });
        }

        item.on('updated', (event, state) => {
            if (state === 'interrupted') {
                console.log('Download is interrupted but can be resumed');
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    console.log('Download is paused');
                } else {
                    if (!mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('download-progress', {
                            id: downloadId,
                            current: item.getReceivedBytes(),
                            total: item.getTotalBytes()
                        });
                    }
                }
            }
        });

        item.once('done', (event, state) => {
            if (!mainWindow.isDestroyed()) {
                mainWindow.webContents.send('download-finished', {
                    id: downloadId,
                    success: state === 'completed'
                });
            }
        });
    });

    mainWindow.on('resize', () => {
        if (activeTabId) {
            const view = views.get(activeTabId);
            if (view) updateViewBounds(view);
        }
    });

    // No auto-create tab here - renderer will detect empty tabs and create one
}

function updateViewBounds(view) {
    const { width, height } = mainWindow.getContentBounds();
    view.setBounds({ x: 0, y: TOP_OFFSET, width: width, height: height - TOP_OFFSET });
}

function attachContextMenu(view) {
    view.webContents.on('context-menu', (event, params) => {
        const menu = new Menu();
        menu.append(new MenuItem({ label: 'Atrás', enabled: view.webContents.canGoBack(), click: () => view.webContents.goBack() }));
        menu.append(new MenuItem({ label: 'Adelante', enabled: view.webContents.canGoForward(), click: () => view.webContents.goForward() }));
        menu.append(new MenuItem({ label: 'Recargar', click: () => view.webContents.reload() }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
            label: atomShield.isEnabled() ? 'Atom Shield: ON' : 'Atom Shield: OFF',
            click: () => {
                const newState = atomShield.toggle();
                const ses = session.fromPartition('persist:atom');
                if (newState) {
                    atomShield.enableNetworkBlocking(ses);
                } else {
                    atomShield.disableNetworkBlocking(ses);
                }
                mainWindow.webContents.send('adblock-state', newState);
            }
        }));
        menu.append(new MenuItem({ label: 'Inspeccionar', click: () => view.webContents.inspectElement(params.x, params.y) }));
        menu.popup({ window: mainWindow });
    });
}

function createTab(url) {
    const tabId = Date.now().toString();
    const view = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Required for preload with electron modules
            preload: path.join(__dirname, 'shield-preload.js'),
            backgroundThrottling: false,
            plugins: true,
            partition: 'persist:atom'
        }
    });

    view.webContents.setUserAgent(USER_AGENT);
    view.setBackgroundColor('#ffffff');

    views.set(tabId, view);

    // Attach Atom Shield content script injection
    atomShield.attachToView(view);

    let targetUrl = url;
    if (!url || url.startsWith('atom://')) {
        targetUrl = `file://${path.join(__dirname, 'home.html')}`;
        view.setBackgroundColor('#0a0a0b');
    } else if (!url.startsWith('http') && !url.startsWith('file:')) {
        targetUrl = 'https://www.google.com';
    }

    view.webContents.loadURL(targetUrl).catch(e => console.log('Error carga:', e));

    // Interceptar ventanas nuevas (target="_blank") en las pestañas
    view.webContents.setWindowOpenHandler(({ url }) => {
        const tabId = createTab(url);
        mainWindow.webContents.send('tab-created-backend', { id: tabId, url });
        return { action: 'deny' };
    });

    const handleUrlUpdate = (e, newUrl) => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('url-changed', { id: tabId, url: newUrl });
    };
    view.webContents.on('did-navigate', handleUrlUpdate);
    view.webContents.on('did-navigate-in-page', handleUrlUpdate);

    attachContextMenu(view);
    setActiveTab(tabId);
    return tabId;
}

ipcMain.handle('create_tab', (e, args) => createTab(args?.url));
ipcMain.handle('switch_tab', (e, { tabId }) => setActiveTab(tabId));
ipcMain.handle('close_tab', (e, { tabId }) => {
    const view = views.get(tabId);
    if (view) {
        if (activeTabId === tabId) {
            mainWindow.setBrowserView(null);
            activeTabId = null;
        }
        view.webContents.destroy();
        views.delete(tabId);
    }
});
ipcMain.handle('navigate', (e, { url }) => { if (activeTabId) views.get(activeTabId).webContents.loadURL(url); });
ipcMain.handle('reload', () => { if (activeTabId) views.get(activeTabId).webContents.reload(); });
ipcMain.handle('go_back', () => { if (activeTabId) views.get(activeTabId).webContents.goBack(); });
ipcMain.handle('go_forward', () => { if (activeTabId) views.get(activeTabId).webContents.goForward(); });

// Toggle adblock desde frontend
ipcMain.handle('toggle-adblock', () => {
    const newState = atomShield.toggle();
    const ses = session.fromPartition('persist:atom');
    if (newState) {
        atomShield.enableNetworkBlocking(ses);
    } else {
        atomShield.disableNetworkBlocking(ses);
    }
    return newState;
});

ipcMain.handle('get-adblock-state', () => {
    return atomShield.isEnabled();
});

function setActiveTab(tabId) {
    const view = views.get(tabId);
    if (view) {
        activeTabId = tabId;
        mainWindow.setBrowserView(view);
        updateViewBounds(view);
        view.webContents.focus();
    }
}

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close', () => app.quit());

app.whenReady().then(createWindow);
