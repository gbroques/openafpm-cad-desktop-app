const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    retry: () => ipcRenderer.send('retry')
});
