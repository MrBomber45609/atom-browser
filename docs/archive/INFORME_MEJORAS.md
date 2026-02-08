# Informe de Mejoras y Análisis: Atom Browser

Este informe analiza el estado actual del proyecto "Atom Browser" y propone mejoras concretas para optimización, consistencia y funcionalidad, asignando tareas específicas por archivo.

## 1. Análisis de Estructura y Archivos

### 🖥️ Backend (Rust - `src-tauri/`)

#### `src-tauri/src/lib.rs`
**Función:** Es el "cerebro" del navegador. Gestiona el ciclo de vida de las pestañas (`AppHandle`, `Webview`), el estado compartido (`TabState`), y la inyección de seguridad (Atom Shield).
**Estado Actual:**
- Contiene todo el script de bloqueo de anuncios (Atom Shield v25) como un string gigante hardcodeado.
- Define la altura de la interfaz (`barra_altura`) en múltiples lugares.
- Gestiona la creación de ventanas y redimensionamiento básico.

**🚀 Mejoras Propuestas (Para Equipo Backend):**
1.  **Refactorización del Script de Seguridad:**
    -   *Tarea:* Extraer el string `ATOM_SHIELD_SCRIPT` a un archivo externo (ej. `src-tauri/scripts/atom_shield.js`).
    -   *Código:* Usar `include_str!("../scripts/atom_shield.js")` en Rust para cargarlo al compilar. Facilita la edición sin recompilar todo el backend para cambios de JS.
2.  **Consolidación de Constantes:**
    -   *Tarea:* Definir `const BARRA_ALTURA: f64 = 72.0;` a nivel de módulo.
    -   *Beneficio:* Evita desajustes visuales si se cambia el diseño en el futuro.
3.  **Fusión de Lógica Atom Shield (V9 vs V25):**
    -   *Tarea:* La versión actual (v25) tiene excelentes interceptores de red, pero la versión "V9 Mock Masters" (archivo de texto externo) tiene mejores "Mocks" para engañar a herramientas de analítica (Hotjar, Drift, Crisp) y un "Cazador de Tamaños IAB" (heurística visual).
    -   *Acción:* Integrar los mocks adicionales y la lógica `isBannerSize` de V9 dentro del script v25.

#### `src-tauri/src/main.rs`
**Función:** Punto de entrada.
**Estado Actual:** Simple y correcto. Llama a `lib.rs`.
**🚀 Mejoras Propuestas:**
-   *Mantenimiento:* Mantenerlo limpio. No añadir lógica aquí.

---

### 🎨 Frontend (Interfaz - `src/`)

#### `src/main.js`
**Función:** Lógica de la interfaz de usuario (barra de direcciones, historial, pestañas visuales).
**Estado Actual:**
- Gestiona el estado local (`tabs` Map).
- Comunicación con backend via `invoke`.
- Lógica de UI (Dropdowns, Overlays).

**🚀 Mejoras Propuestas (Para Equipo Frontend):**
1.  **Optimización de Historial:**
    -   *Tarea:* La escritura en `localStorage` ocurre en cada carga de URL. Para uso intensivo, considerar debounce o guardar en batch (lotes) si el historial crece mucho.
2.  **Gestión de Eventos:**
    -   *Tarea:* Verificar que los overlays (Historial/Marcadores) se limpien o gestionen eficientemente el DOM al renderizar listas largas (virtualización si pasa de 1000 items, aunque ahora está limitado a 100).
3.  **Feedback Visual de Carga:**
    -   *Tarea:* La barra de progreso es "falsa" (animación CSS). Integrar eventos reales de progreso si Tauri v2 los expone en el futuro, o ajustar los tiempos de `stopLoading` para que se sientan más naturales.

#### `src/styles.css`
**Función:** Estilos visuales.
**Estado Actual:** Diseño moderno, variables CSS bien definidas, tema oscuro consistente.
**🚀 Mejoras Propuestas:**
-   **Consistencia:** Asegurar que `title-bar` (32px) + `control-bar` (40px) sumen siempre exactamente lo que espera el Rust (`72px`).
-   **Z-Index:** Revisar capas. `overlay` tiene 2000, `dropdown` 1001. Correcto.

---

## 2. Plan de Acción Detallado (Asignación)

### 👨‍💻 Tarea 1: Arquitectura de Seguridad (Prioridad Alta)
**Responsable:** Backend Dev
**Archivos:** `src-tauri/src/lib.rs`, Nuevo `src-tauri/resources/atom_shield.js`
**Instrucciones:**
1. Crear carpeta `src-tauri/resources`.
2. Mover el contenido de `ATOM_SHIELD_SCRIPT` a un nuevo archivo JS.
3. Actualizar `lib.rs` para leer ese archivo.
4. **CRÍTICO:** Copiar las funciones de "Mock Objects" (líneas 12-193 del archivo `ATOM_SHIELD_V9_FULL_CODE.txt`) y pegarlas en el nuevo archivo JS, reemplazando o aumentando los mocks existentes de la v25.
5. Copiar la lógica "Cazador de Tamaños IAB" (sección D del V9) y añadirla al `setInterval` del V25.

### 👨‍💻 Tarea 2: Consistencia Visual (Prioridad Media)
**Responsable:** Frontend Dev
**Archivos:** `src/styles.css`, `src-tauri/src/lib.rs`
**Instrucciones:**
1. Verificar pixel-perfect height.
2. Si se decide cambiar la altura de la barra, actualizar la constante en Rust.

### 👨‍💻 Tarea 3: Optimización del Bloqueador (Prioridad Alta)
**Responsable:** Fullstack Dev
**Archivos:** `atom_shield.js` (nuevo)
**Instrucciones:**
1. Revisar los selectores CSS inyectados. La lista v25 es enorme.
2. Comprobar impacto en rendimiento (FPS al cargar páginas pesadas).
3. Si es lento, dividir los selectores CSS en bloques críticos y secundarios, o cargar CSS asíncronamente (aunque esto puede causar "flicker" de anuncios).

---

Este informe sirve como hoja de ruta para la siguiente fase de desarrollo del Atom Browser.
