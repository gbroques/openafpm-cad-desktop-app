const { app: electronApp, BrowserWindow, nativeTheme, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const os = require('node:os');
const fs = require('node:fs');
const http = require('http');
const process = require('process');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const portfinder = require('portfinder');

async function tryWithExponentialBackoff(fn, predicate, mainWindow, maxTries = 7) {
  let result = await fn();
  let numTries = 1;
  while (predicate(result) && numTries < maxTries) {
    const timeInMilliseconds = 2 ** numTries * 100;
    await withProgress(mainWindow, timeInMilliseconds);
    result = await fn();
    numTries++;
  }
  return result;
}

async function withProgress(mainWindow, max, delay = 100) {
  let tick = 0;
  mainWindow.webContents.send('progress', {value: tick * delay , max});
  tick++;
  const intervalId = setInterval(() => {
    mainWindow.webContents.send('progress', {value: tick * delay , max});
    tick++;
  }, delay);
  await wait(max);
  mainWindow.webContents.send('progress', {value: tick * delay , max});
  clearInterval(intervalId);
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function formatDateWithoutMilliseconds(date) {
  return date.toISOString().split('.')[0] + 'Z';
}

class Transaction {
  logStart(...args) {
    console.info(formatDateWithoutMilliseconds(new Date()), `[PID ${process.pid}]`, 'START', ...args);
  }
  logSuccess(...args) {
    this.logEnd('info', ...args);
  }
  logFailure(...args) {
    this.logEnd('error', ...args);
  }
  logEnd(level, ...args) {
    console[level](formatDateWithoutMilliseconds(new Date()), `[PID ${process.pid}]`, 'END', ...args);
  }
}

function fetchIndexHtml(url) {
  return new Promise(resolve => {
    const transaction = new Transaction();
    transaction.logStart('GET', url);
    const request = http.get(url, (response) => {
      if (response.statusCode !== 200) {
        transaction.logFailure('GET', url, response.statusCode);
        resolve({ type: 'error', data: response.statusCode.toString() });
        return;
      }
      transaction.logSuccess('GET', url, response.statusCode);
      let data = ''
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({type: 'success', data});
      });
    });
    request.on('error', (error) => {
      transaction.logFailure('GET', url, error.code);
      resolve({type: 'error', data: error});
    })
    request.end();
  });
}

function createWindow() {
  return new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png')
  });
}

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});

function startApi(pythonPath, port) {
  const options = { cwd: __dirname, stdio: 'inherit', windowsHide: true };
  const transaction = new Transaction();
  const childProcess = spawn(pythonPath, ['api.py', port], options);
  childProcess.on('spawn', () => transaction.logStart('spawn', 'api.py', 'pid', childProcess.pid));
  childProcess.on('error', (error) => transaction.logFailure('error', 'api.py', 'pid', childProcess.pid, error));
  childProcess.on('exit', () => transaction.logFailure('exit', 'api.py', 'pid', childProcess.pid));
  return childProcess;
}

const rootPath = path.join(__dirname, '..');
dotenv.config({ path: path.join(rootPath, '.env') });
process.noAsar = true;

nativeTheme.themeSource = 'light';

electronApp.whenReady()
  .then(createWindow)
  .then(async (window) => {
    createMenu(window);
    window.loadFile('loading.html');
    const port = await portfinder.getPortPromise({ port: 8000, stopPort: 65535 });
    const pythonPath = path.join(rootPath, process.env.PYTHON);
    const childProcess = startApi(pythonPath, port);
    const url = `http://127.0.0.1:${port}/index.html`;
    const result = await tryWithExponentialBackoff(
      () => fetchIndexHtml(url),
      (result) => result.type === 'error',
      window
    );
    if (result.type === 'error') {
      const handleRetry = () => {
        fetchIndexHtml(url).then(result => {
          if (result.type === 'success') {
            window.loadURL(url);
          }
        });
      };
      ipcMain.on('retry', handleRetry);
      window.loadFile('fallback.html');
    } else {
      window.loadURL(url);
    }
    electronApp.on('before-quit', () => {
      childProcess.kill();
    });
  });


function createMenu(window) {
  const isMac = process.platform === 'darwin';

  const template = [
    // { role: 'appMenu' }
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }]
      : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' },
              { role: 'delete' },
              { role: 'selectAll' },
              { type: 'separator' },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' },
                  { role: 'stopSpeaking' }
                ]
              }
            ]
          : [
              { role: 'delete' },
              { type: 'separator' },
              { role: 'selectAll' }
            ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Print to PDF',
          click: () => {
            const pdfPath = path.join(os.homedir(), 'Desktop', 'OpenAFPM CAD Desktop App.pdf');
            const options = {
                printBackground: true,
                displayHeaderFooter: true,
                headerTemplate: '<span><span>', // don't show any header
                footerTemplate: '<div style="font-size: 14px; text-align: right; width: 100%; padding: 16px"><span class=pageNumber></span> / <span class=totalPages></span><div>',
                margins: {top: 0, right: 0, bottom: 0, left: 0}
            };
            window.webContents.printToPDF(options).then(data => {
              fs.writeFile(pdfPath, data, (error) => {
                if (error) throw error;
                shell.openExternal('file://' + pdfPath);
              });
            }).catch(error => {
              console.error(`Failed to write PDF to ${pdfPath}: `, error);
            });
          }
        }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [
              { role: 'close' }
            ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://electronjs.org')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

