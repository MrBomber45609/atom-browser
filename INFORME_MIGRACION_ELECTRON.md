# Informe de Estructura y Migración a Electron

Este documento detalla la estructura actual del proyecto **Atom Browser** (basado en Tauri) y proporciona una guía para su migración a **Electron**.

## 1. Estructura del Proyecto Actual

El proyecto sigue la arquitectura estándar de Tauri v2:

```
atom-browser/
├── src/                    # FRONTEND (Interfaz de Usuario)
│   ├── assets/             # Recursos estáticos (imágenes, iconos)
│   ├── home.html           # Página de inicio personalizada (atom://home)
│   ├── index.html          # Interfaz principal del navegador (UI shell)
│   ├── main.js             # Lógica del frontend y comunicación con backend
│   └── styles.css          # Estilos globales y de componentes
│
├── src-tauri/              # BACKEND (Lógica en Rust -> A migrar a Node.js)
│   ├── icons/              # Iconos de la aplicación
│   ├── scripts/            # Scripts de "Atom Shield" (AdBlocker) para inyección
│   ├── src/                # Código fuente Rust
│   │   ├── ad_blocker.rs   # Lógica de bloqueo de anuncios
│   │   ├── lib.rs          # Gestor de pestañas, ventanas y comandos
│   │   └── main.rs         # Punto de entrada
│   ├── capabilities/       # Permisos de Tauri
│   ├── tauri.conf.json     # Configuración de Tauri (ventanas, permisos)
│   └── Cargo.toml          # Dependencias de Rust
│
├── package.json            # Dependencias de Node.js (Frontend)
└── ... (archivos de config)
```

## 2. Análisis Detallado por Carpeta y Archivo

### A. Carpeta `src/` (Frontend)
**Estado:** Se puede reutilizar casi al 100% en Electron.
**Cambios necesarios:** Reemplazar las llamadas `window.__TAURI__.core.invoke` por `window.electronAPI.invoke` (o similar usando `contextBridge`).

| Archivo | Descripción | Acción para Migración |
| :--- | :--- | :--- |
| `index.html` | Estructura HTML de la "shell" del navegador (barras, controles). | **Conservar**. Ajustar referencias a scripts si es necesario. |
| `home.html` | Página de "Nueva Pestaña". | **Conservar**. Mover o copiar a la nueva estructura de renderer. |
| `styles.css` | Estilos CSS sin preprocesadores. | **Conservar**. |
| `main.js` | Lógica de UI (eventos, gestión de estado visual, actualizaciones). | **Modificar**. Reemplazar `window.__TAURI__` con `ipcRenderer`. |
| `assets/` | Imágenes e iconos. | **Conservar**. |

### B. Carpeta `src-tauri/` (Backend)
**Estado:** Debe ser reescrito completamente en Node.js (Main Process de Electron).

| Archivo/Carpeta | Descripción | Equivalente en Electron |
| :--- | :--- | :--- |
| `tauri.conf.json` | Configuración de ventana (tamaño, bordes, transparencia). | `main.js` (Main Process): config de `BrowserWindow`. |
| `src/lib.rs` | **Lógica Core**: Gestión de pestañas, navegación, fullscreen inmersivo, inyección de scripts. | `main.js`: Usar `WebContentsView` (recomendado moderno) o `BrowserView`. |
| `src/ad_blocker.rs` | Lógica de bloqueo de red y cosmética. | `main.js`: Usar `session.webRequest` (API de red de Electron). |
| `scripts/` | Scripts JS inyectados en las webs (módulos de Atom Shield). | **Conservar**. Leerlos desde `main.js` e inyectarlos con `contents.executeJavaScript`. |

## 3. Dependencias

### Actuales (Tauri)
*   **Frontend (`package.json`):**
    *   `@tauri-apps/api`: Para comunicación con backend. -> **ELIMINAR**.
    *   `@tauri-apps/cli`: Herramienta de build. -> **ELIMINAR**.
*   **Backend (`Cargo.toml`):**
    *   `tauri`: Framework.
    *   `tauri-plugin-shell`: Comandos del sistema.
    *   `webview2-com` / `windows`: Interacción nativa con Windows.
    *   `serde`: Serialización JSON.

### Nuevas Necesarias (Electron)
Deberás instalar estas dependencias en el nuevo proyecto:

```json
"devDependencies": {
  "electron": "^28.0.0" (o superior),
  "electron-builder": "^24.0.0" (para empaquetar)
},
"dependencies": {
  "electron-store": "^8.1.0" (opcional, para persistencia simple)
}
```

## 4. Funcionalidades Clave a Migrar

Esta es la lógica de `lib.rs` que debes reimplementar en el proceso principal de Electron:

1.  **Gestión de Pestañas (`create_tab`, `switch_tab`, `close_tab`):**
    *   En Tauri se usaban múltiples `Webview` hijos.
    *   En Electron, usa `WebContentsView` para gestionar múltiples pestañas dentro de una misma ventana.

2.  **Comunicación (`invoke`):**
    *   Configurar `ipcMain` en el proceso principal para escuchar eventos (`create-tab`, etc.).
    *   Configurar `preload.js` con `contextBridge` para exponer `ipcRenderer` al frontend de forma segura.

3.  **Atom Shield (AdBlocker):**
    *   La inyección de scripts (`inject_shield_early`) se hace en el evento `did-navigate` o usando `preload.js`.
    *   El bloqueo de red (`ad_blocker.rs`) se hace con `session.defaultSession.webRequest.onBeforeRequest`.

4.  **Descargas:**
    *   Interceptar el evento `session.on('will-download', ...)` para gestionar descargas y enviar progreso al frontend.

5.  **Fullscreen Inmersivo:**
    *   La lógica de ocultar la UI y redimensionar las vistas debe replicarse manipulando los límites (`setBounds`) de las `WebContentsView` al entrar/salir de pantalla completa.

## 5. Resumen del Plan de Migración

1.  Inicializar nuevo proyecto: `npm init` y `npm install electron --save-dev`.
2.  Copiar `src/` (frontend) al nuevo proyecto (ej. en carpeta `renderer/`).
3.  Crear `main.js` (Proceso Principal):
    *   Crear la ventana principal (`BrowserWindow`).
    *   Implementar el gestor de vistas (`WebContentsView`) para replicar las pestañas.
    *   Implementar los handlers IPC (`navigate`, `go_back`, etc.).
4.  Crear `preload.js`:
    *   Exponer la API segura para que `renderer/main.js` pueda llamar al backend.
5.  Modificar `renderer/main.js`:
    *   Cambiar `window.__TAURI__...` por la nueva API expuesta en `preload.js`.
6.  Migrar Atom Shield:
    *   Mover la lógica de bloqueo de red a `main.js`.
    *   Copiar la carpeta `scripts/` y configurar la inyección.

Este informe contiene todo lo necesario para que tu equipo entienda qué hay, para qué sirve y cómo moverlo a Electron.
