const { app: electronApp, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const process = require('process');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const portfinder = require('portfinder');

async function tryWithExponentialBackoff(fn, predicate, maxTries = 8) {
  let result = await fn();
  let numTries = 1;
  while (predicate(result) && numTries < maxTries) {
    const timeInMilliseconds = 2 ** numTries * 100;
    await wait(timeInMilliseconds);
    result = await fn();
    numTries++;
  }
  return result;
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function formatDateWithoutMilliseconds(date) {
  return date.toISOString().split('.')[0] + 'Z';
}

class Transaction {
  constructor() {
    this.start = new Date();
  }
  logStart(...args) {
    console.log(formatDateWithoutMilliseconds(this.start), `[PID ${process.pid}]`, 'START', ...args)
  }
  logEnd(...args) {
    console.log(formatDateWithoutMilliseconds(new Date()), `[PID ${process.pid}]`, 'END  ', ...args)
  }
}

function fetchIndexHtml(url) {
  
  return new Promise(resolve => {
    const transaction = new Transaction();
    transaction.logStart('GET', url);
    const request = http.get(url, (response) => {
      transaction.logEnd('GET', url, response.statusCode);
      if (response.statusCode !== 200) {
        console.log('resolve !== 200')
        resolve({ type: 'error', data: response.statusCode.toString() });
        return;
      }
      let data = ''
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({type: 'success', data});
      });
    });
    request.on('error', (error) => {
      transaction.logEnd('GET', url, error.code);
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
  const childProcess = spawn(pythonPath, ['api.py', port], options);
  childProcess.on('spawn', () => console.log('api.py spawn'));
  childProcess.on('error', (err) => console.error('api.py error', err));
  childProcess.on('exit', (code) => console.log('api.py exit', code));
  return childProcess;
}

const rootPath = path.join(__dirname, '..');
dotenv.config({ path: path.join(rootPath, '.env') });
process.noAsar = true;

nativeTheme.themeSource = 'light';

electronApp.whenReady()
  .then(createWindow)
  .then(async (window) => {
    window.loadFile('loading.html');
    const port = await portfinder.getPortPromise({ port: 8000, stopPort: 65535 });
    const pythonPath = path.join(rootPath, process.env.PYTHON);
    const childProcess = startApi(pythonPath, port);
    const url = `http://127.0.0.1:${port}/index.html`;
    const result = await tryWithExponentialBackoff(() => fetchIndexHtml(url), (result) => result.type === 'error');
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
