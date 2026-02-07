# 📂 Lista de Archivos a Modificar para Mejoras

Este documento lista únicamente los archivos que requieren cambios para implementar las mejoras propuestas (Gestor de Descargas Avanzado, Privacidad y Rendimiento).

## 1. Gestor de Descargas y Popup (Solución Z-Order)
*   **`vite.config.js`** (Nuevo): Para compilar la ventana popup.
*   **`src/popup.html`** (Nuevo/Modificar): Estructura visual de la ventana flotante.
*   **`src/styles.css`**: Estilos "Chrome Dark" para el popup.
*   **`src/main.js`**: Lógica para enviar datos al popup y posicionarlo.
*   **`src-tauri/tauri.conf.json`**: Configuración de la ventana transparente.
*   **`src-tauri/src/lib.rs`**: Comandos de backend para posicionamiento (`content_position`).

## 2. Privacidad (Favicons Locales)
*   **`src-tauri/Cargo.toml`**: Añadir dependencia `reqwest` y `base64`.
*   **`src-tauri/src/lib.rs`**: Añadir función `get_favicon` en Rust.
*   **`src/main.js`**: Cambiar la URL de Google por la llamada `invoke('get_favicon')`.

## 3. Rendimiento (Historial Virtualizado)
*   **`src/main.js`**: Modificar función `renderHistory()` para usar paginación/limite.

## 4. Backend y Navegación
*   **`src-tauri/src/lib.rs`**: (Opcional) Implementar `load_url` nativo si se desea reemplazar `eval`.

---
**Total de archivos afectados:** ~7 archivos.
