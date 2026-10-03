/// <reference types="vite/client" />
import type { VentamasApi } from "@shared/api";

declare global {
  interface Window {
    ventamas: VentamasApi;
  }
}
