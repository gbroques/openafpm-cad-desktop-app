const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    retry: () => ipcRenderer.send('retry'),
    onProgress: (callback) => ipcRenderer.on('progress', (event, value) => callback(value)),
    webUtils
});
