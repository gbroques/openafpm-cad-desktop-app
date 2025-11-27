const { app: electronApp, BrowserWindow, nativeTheme, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const os = require('node:os');
const fs = require('node:fs');
const http = require('http');
const process = require('process');
const { spawn } = require('child_process');
const portfinder = require('portfinder');
const detectFreeCAD = require('./detectFreeCAD');
const downloadFreeCAD = require('./downloadFreeCAD');

async function tryWithExponentialBackoff(fn, predicate, mainWindow, maxTries = 8) {
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

async function withProgress(mainWindow, max, delay = 100, message = 'Spawning Python child process') {
  let tick = 0;
  const sendProgress = () => {
    const value = tick * delay;
    const percent = Math.round((value / max) * 100);
    mainWindow.webContents.send('progress', {
      message: `${message} ${percent}%`,
      value,
      max,
      type: 'python'
    });
  };
  
  sendProgress();
  tick++;
  const intervalId = setInterval(() => {
    sendProgress();
    tick++;
  }, delay);
  await wait(max);
  sendProgress();
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
    icon: path.join(__dirname, 'icon_256x256.png')
  });
}

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});

function startApi(pythonPath, freecadLibPath, port) {
  const rootPath = path.join(__dirname, '..');
  const sitePackagesPath = path.join(rootPath, 'site-packages');
  // Add both the cloned repos and freecad-to-obj to PYTHONPATH
  const pythonPathEnv = [
    path.join(sitePackagesPath, 'openafpm-cad-core'),
    path.join(sitePackagesPath, 'freecad-to-obj'),
    sitePackagesPath
  ].join(path.delimiter);
  
  const options = { 
    cwd: rootPath, 
    stdio: 'inherit', 
    windowsHide: true,
    env: { 
      ...process.env, 
      FREECAD_LIB: freecadLibPath,
      PYTHONPATH: pythonPathEnv
    }
  };
  console.log(`Starting Python backend:`);
  console.log(`  Python: ${pythonPath}`);
  console.log(`  FREECAD_LIB: ${freecadLibPath}`);
  console.log(`  PYTHONPATH: ${pythonPathEnv}`);
  const transaction = new Transaction();
  const childProcess = spawn(pythonPath, ['-m', 'backend.api', '--port', port.toString()], options);
  childProcess.on('spawn', () => transaction.logStart('spawn', 'backend.api', 'pid', childProcess.pid));
  childProcess.on('error', (error) => transaction.logFailure('error', 'backend.api', 'pid', childProcess.pid, error));
  childProcess.on('exit', () => transaction.logFailure('exit', 'backend.api', 'pid', childProcess.pid));
  return childProcess;
}

const rootPath = path.join(__dirname, '..');
process.noAsar = true;

nativeTheme.themeSource = 'light';

electronApp.whenReady()
  .then(createWindow)
  .then(async (window) => {
    createMenu(window);
    window.loadFile('loading.html');
    
    // Detect FreeCAD installation
    let freecadPaths = await detectFreeCAD(
      rootPath,
      (message, value, max) => {
        window.webContents.send('progress', {
          message,
          value,
          max,
          type: 'freecad'
        });
      }
    );
    
    if (!freecadPaths) {
      // Download FreeCAD
      try {
        await downloadFreeCAD(
          '1.0.2',
          electronApp.getPath('userData'),
          (message, value, max) => {
            window.webContents.send('progress', {
              message,
              value,
              max,
              type: 'freecad'
            });
          }
        );
        
        // Detect again after download
        freecadPaths = await detectFreeCAD(
          rootPath,
          (message, value, max) => {
            window.webContents.send('progress', {
              message,
              value,
              max,
              type: 'freecad'
            });
          }
        );
        
        if (!freecadPaths) {
          throw new Error('Failed to detect FreeCAD after download');
        }
      } catch (error) {
        console.error('FreeCAD download/setup failed:', error);
        window.loadFile('fallback.html', { query: { error: error.message } });
        return;
      }
    }
    
    const port = await portfinder.getPortPromise({ port: 8000, stopPort: 65535 });
    const pythonPath = freecadPaths.python;
    const childProcess = startApi(pythonPath, freecadPaths.freecadLib, port);
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
          label: electronApp.name,
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
                margins: {left: 0, right: 0}
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

