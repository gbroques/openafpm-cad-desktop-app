const { app: electronApp, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const portfinder = require('portfinder');

async function poll(fn, predicate, milliseconds, maxTries = 10) {
  let result = await fn();
  let numTries = 1;
  while (predicate(result) && numTries < maxTries) {
    await wait(milliseconds);
    result = await fn();
    numTries++;
  }
  return result;
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function fetchIndexHtml(url) {
  return new Promise(resolve => {
    console.log('START', 'GET', url);
    const request = http.get(url, (response) => {
      console.log('END', 'GET', url, response.statusCode);
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
      console.log('END', 'GET', url, error.code);
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
      nodeIntegration: false
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
    const port = await portfinder.getPortPromise({ port: 8000, stopPort: 65535 });
    const pythonPath = path.join(rootPath, process.env.PYTHON);
    const childProcess = startApi(pythonPath, port);
    const url = `http://127.0.0.1:${port}/index.html`;
    await poll(() => fetchIndexHtml(url), (result) => result.type === 'error', 250);
    window.loadURL(url);
    electronApp.on('before-quit', () => {
      childProcess.kill();
    });
  });
