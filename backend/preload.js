const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    retry: () => ipcRenderer.send('retry'),
    webUtils
});
