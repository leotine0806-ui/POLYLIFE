const { app, BrowserWindow, shell, ipcMain, Notification, dialog } = require('electron');
const path = require('node:path');
const { loadConfig } = require('./config');
const { createAppServer } = require('./src/server');
const sr = require('./src/spaced-repetition');

// Keep development data separate from the installed application's Chromium profile.
if (!app.isPackaged) app.setPath('userData', path.join(app.getPath('appData'), 'Polylife-dev'));
let server;
let origin;
function registerIPC() {
  const handle = (channel, callback) => ipcMain.handle(channel, (event, ...args) => {
    if (new URL(event.senderFrame.url).origin !== origin) throw new Error('Origine IPC non autorizzata');
    return callback(...args);
  });
  for (const method of ['reviewCard', 'getDueCards', 'getStats', 'sortByPriority']) {
    handle(`sr:${method}`, (...args) => sr[method](...args));
  }
  handle('notif:test', () => {
    if (!Notification.isSupported()) return false;
    new Notification({ title: 'Polylife', body: 'Le notifiche funzionano.' }).show();
    return true;
  });
  const notifications = require('./src/notifications');
  handle('notif:briefing', notifications.briefingMattutino);
  handle('notif:streak', notifications.streakCheckSerale);
  handle('notif:preVerifica', notifications.alertPreVerifica);
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'Polylife', icon: path.join(__dirname, 'src/icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    backgroundColor: '#0a0a0f', show: false,
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    const target = new URL(url);
    if (target.origin === origin) win.loadURL(url);
    else if (['https:', 'http:'].includes(target.protocol)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();
  });
  win.setMenuBarVisibility(false);
  win.loadURL(origin);
}
app.whenReady().then(async () => {
  const config = loadConfig();
  origin = `http://localhost:${config.port}`;
  server = createAppServer(config);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '127.0.0.1', resolve);
  });
  registerIPC();
  require('./src/notifications').start();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(error => {
  dialog.showErrorBox('Polylife: avvio non riuscito', error.code === 'EADDRINUSE'
    ? 'La porta è già occupata. Chiudi l’altra istanza o configura PORT nel file .env.'
    : error.message);
  app.quit();
});
app.on('before-quit', () => {
  require('./src/notifications').stop();
  if (server) server.close();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
