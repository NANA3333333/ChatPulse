const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatpulseDesktop', {
    isDesktop: true,
    platform: process.platform,
    runSystemAction: (action, payload = {}) => ipcRenderer.invoke('chatpulse:system-action', { action, payload })
});
