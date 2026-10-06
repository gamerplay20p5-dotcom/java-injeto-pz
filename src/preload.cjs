const { contextBridge, ipcRenderer } = require('electron');

// Cada opera\u00e7\u00e3o tem um canal fechado; o renderer n\u00e3o recebe ipcRenderer, Node ou comandos arbitr\u00e1rios.
const methods = ['getState', 'scan', 'saveSettings', 'chooseFolder', 'chooseJar', 'review', 'apply', 'remove',
  'reviewInjection', 'inject', 'restore', 'hardware', 'startOptimizer', 'stopOptimizer', 'backgroundProcesses', 'closeBackground', 'createShortcut',
  'login', 'logout', 'openWorkshop', 'openFolder', 'exportDiagnostics', 'copyText',
  'checkUpdate', 'downloadUpdate', 'cancelUpdate', 'installUpdate'];
const api = Object.fromEntries(methods.map(name => [name, async (...args) => {
  const result = await ipcRenderer.invoke(`organic:${name}`, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}]));
api.subscribe = callback => {
  const listener = (_event, state) => callback(state);
  ipcRenderer.on('organic:state', listener);
  return () => ipcRenderer.removeListener('organic:state', listener);
};
api.subscribeUpdate = callback => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on('organic:update', listener);
  return () => ipcRenderer.removeListener('organic:update', listener);
};
contextBridge.exposeInMainWorld('organic', api);
