const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Controles de Ventana
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // Invocador Genérico (Para que no tengas que cambiar mucho tu main.js antiguo)
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),

    // Escuchar eventos (como cambios de URL o descargas)
    on: (channel, callback) => {
        // Filtramos para evitar fugas de memoria, usando una nueva función cada vez
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);

        // Retornamos una función para limpiar el listener si fuera necesario (opcional)
        return () => ipcRenderer.removeListener(channel, subscription);
    },

    // Eliminar listeners (útil para limpiezas)
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});