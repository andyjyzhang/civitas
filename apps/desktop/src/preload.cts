import { contextBridge, ipcRenderer } from 'electron';

// Deliberately expose individual operations, never raw IPC or filesystem access.
contextBridge.exposeInMainWorld('civitas', {
  status: () => ipcRenderer.invoke('civitas:status'),
  login: (email: string, password: string) => ipcRenderer.invoke('civitas:login', email, password),
  link: (token: string, spaceId: string) => ipcRenderer.invoke('civitas:link', token, spaceId),
  enroll: (name: string, spaceId: string) => ipcRenderer.invoke('civitas:enroll', name, spaceId),
  subscribe: (topic: string) => ipcRenderer.invoke('civitas:subscribe', topic),
  retrieve: () => ipcRenderer.invoke('civitas:retrieve'),
  disconnect: () => ipcRenderer.invoke('civitas:disconnect'),
  openWeb: () => ipcRenderer.invoke('civitas:openWeb'),
  configure: () => ipcRenderer.invoke('civitas:configure'),
});
