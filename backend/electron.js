const { app: electronApp, BrowserWindow, nativeTheme, shell, Menu } = require('electron');
const path = require('path');
const os = require('node:os');
const fs = require('node:fs');
const process = require('process');
const { spawn } = require('child_process');
const portfinder = require('portfinder');
const detectFreeCAD = require('./detectFreeCAD');
const downloadFreeCAD = require('./downloadFreeCAD');

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
  return new Promise((resolve, reject) => {
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
      stdio: ['ignore', 'inherit', 'pipe'], // pipe stderr to detect readiness
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
    
    // Listen for "Uvicorn running" in stderr to know when backend is ready
    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(data); // Still show stderr output
      
      if (output.includes('Uvicorn running')) {
        transaction.logSuccess('ready', 'backend.api', 'pid', childProcess.pid);
        resolve(childProcess);
      }
    });
    
    childProcess.on('error', (error) => {
      transaction.logFailure('error', 'backend.api', 'pid', childProcess.pid, error);
      reject(error);
    });
    
    childProcess.on('exit', (code) => {
      transaction.logFailure('exit', 'backend.api', 'pid', childProcess.pid, 'code', code);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error('Backend startup timeout after 10s'));
    }, 10000);
  });
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
    let freecadPaths = await detectFreeCAD(rootPath);
    
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
              max
            });
          }
        );
        
        // Detect again after download
        freecadPaths = await detectFreeCAD(rootPath);
        
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
    
    let childProcess;
    try {
      childProcess = await startApi(pythonPath, freecadPaths.freecadLib, port);
    } catch (error) {
      console.error('Failed to start Python backend:', error);
      window.loadFile('fallback.html', { query: { error: error.message } });
      return;
    }
    
    const url = `http://127.0.0.1:${port}/index.html`;
    // Backend is ready, load UI directly
    window.loadURL(url);
    
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

