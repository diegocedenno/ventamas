import { contextBridge, ipcRenderer } from "electron";
import { CHANNELS, type BootData, type VentamasApi } from "@shared/api";

// Único puente entre la interfaz y el proceso principal. La interfaz no recibe acceso
// a Node ni a Electron: solo estas funciones.
const boot = ipcRenderer.sendSync(CHANNELS.boot) as BootData;

const api: VentamasApi = {
  boot,
  settings: {
    set: (key, value) => ipcRenderer.invoke(CHANNELS.setSetting, key, value),
  },
  app: {
    openDataDir: () => ipcRenderer.invoke(CHANNELS.openDataDir),
  },
};

contextBridge.exposeInMainWorld("ventamas", api);
