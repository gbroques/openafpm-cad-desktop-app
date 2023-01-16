const { app: electronApp, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');
const api = require('./api');

nativeTheme.themeSource = 'light';
const server = api.listen();

function createWindow() {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'icon.png')
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`Server running at ${url}.`);
  window.loadURL(url);
}

electronApp.whenReady().then(createWindow);

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});

electronApp.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
