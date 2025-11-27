const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onProgress: (callback) => ipcRenderer.on('progress', (event, value) => callback(value)),
    webUtils
});
