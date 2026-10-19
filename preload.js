// Expose only capabilities implemented by the desktop runtime.
// No window.db: renderers must use their existing localStorage fallback.
const { contextBridge, ipcRenderer } = require('electron');
const ipc = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const sr = {
  reviewCard: (card, quality) => ipc('sr:reviewCard', card, quality),
  getDueCards: cards => ipc('sr:getDueCards', cards),
  getStats: cards => ipc('sr:getStats', cards),
  sortByPriority: cards => ipc('sr:sortByPriority', cards),
};
const notif = {
  test: () => ipc('notif:test'),
  briefing: () => ipc('notif:briefing'),
  streak: () => ipc('notif:streak'),
  preVerifica: () => ipc('notif:preVerifica'),
};
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  capabilities: { storage: 'localStorage', database: false, backup: false },
  sr, notif,
});
contextBridge.exposeInMainWorld('sr', sr);
contextBridge.exposeInMainWorld('notif', notif);
