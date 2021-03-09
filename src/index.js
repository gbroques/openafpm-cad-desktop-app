const { app, BrowserWindow } = require('electron');

const server = require('./server');

server.listen(3000, () =>
  console.log('Visit http://127.0.0.1:3000')
);

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false
    }
  })

  win.loadURL('http://127.0.0.1:3000')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
