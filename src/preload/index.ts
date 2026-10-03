import { contextBridge, ipcRenderer } from "electron";
import { BOOT_CHANNEL, type BootData, type VentamasApi } from "@shared/api";

// Único puente entre la interfaz y el proceso principal. La interfaz no recibe acceso
// a Node ni a Electron: solo puede llamar a operaciones por su canal, y el proceso
// principal decide cuáles existen.
const boot = ipcRenderer.sendSync(BOOT_CHANNEL) as BootData;

const api: VentamasApi = {
  boot,
  invoke: (channel, ...args) => {
    if (typeof channel !== "string" || !/^[a-z]+:[a-z-]+$/.test(channel)) {
      return Promise.reject(new TypeError("Canal no válido."));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
};

contextBridge.exposeInMainWorld("ventamas", api);
