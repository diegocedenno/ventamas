# 0001 — Electron para la aplicación de escritorio

Fecha: 3 de octubre de 2026 · Estado: aceptada

## Contexto

La primera versión de Ventamas corre en una sola computadora con Windows, se instala con un clic y guarda los
datos en ese equipo ([PRD](../PRD.md), apartado 10). El PRD dejaba abierta la elección entre Electron y Tauri y
pedía una prueba en la fase 0.

## Decisión

Ventamas usa **Electron** (44), con la interfaz en React y TypeScript compilada por electron-vite, y el instalador
generado por electron-builder (NSIS, de un clic y por usuario, sin permisos de administrador).

## Por qué

- **Es el stack del autor.** El proceso principal es Node.js; no hay que escribir ni mantener código en Rust.
- **Impresión.** Electron imprime en silencio en cualquier impresora instalada en Windows, que es lo que necesita
  el recibo térmico de la fase 1.
- **Un solo motor.** La aplicación lleva su propio Chromium, así que se ve igual en todos los equipos y no depende
  de la versión de WebView2 que tenga cada Windows.
- **El entorno ya lo permite.** Tauri necesita Rust y las herramientas de compilación de Visual Studio, que no
  están instaladas en el equipo de desarrollo. Instalarlas solo para comparar no se justificaba.

## Lo que se midió

Aplicación empaquetada de la fase 0, en el equipo de desarrollo (Windows 11, 16 GB de memoria, disco sólido):

| Medida | Resultado |
|---|---|
| Instalador | 98 MB |
| Instalada | 321 MB |
| Código propio dentro del paquete | 0,3 MB |
| Arranque hasta ventana visible | 0,75 s la primera vez; 0,5 s las siguientes |
| Memoria | unos 340 MB sumando los cuatro procesos |

## Lo que no se midió

- **Tauri no se probó.** La comparación del PRD queda incompleta: no hay cifras de Tauri en este equipo.
- **No se probó en un equipo modesto.** El requisito es Windows 10 con 4 GB de memoria y disco mecánico; las cifras
  de arriba son de un equipo mucho más rápido. El arranque en frío desde disco mecánico será más lento.

## Consecuencias

- El instalador pesa cerca de 100 MB y la aplicación usa más memoria que una equivalente en Tauri. Es el costo
  aceptado a cambio de simplicidad de desarrollo.
- Requisito mínimo: Windows 10 de 64 bits.
- La interfaz no tiene acceso a Node: corre aislada (`contextIsolation`, `sandbox`) y habla con el proceso
  principal solo por las funciones declaradas en `src/shared/api.ts`.
- Si un equipo modesto real resulta demasiado lento, esta decisión se revisa. La interfaz (React) y la lógica
  compartida (`src/shared`) no dependen de Electron y se podrían llevar a Tauri.
