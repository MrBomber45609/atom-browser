# Atom Browser

Un navegador minimalista, ultraligero y sin distracciones. Inspirado en Helium.

## Filosofía

- **Minimalismo** - Solo las funciones esenciales
- **Velocidad** - Arranca en milisegundos
- **Sin ruido** - Nada de funciones que no usas

## Stack

- **Frontend**: HTML + CSS + JavaScript vanilla
- **Backend**: Tauri v2 (Rust)
- **Peso**: ~5MB (vs ~200MB de navegadores tradicionales)

## Características

- [x] Navegación básica (URL + búsqueda)
- [x] Botón atrás
- [x] Botón recargar
- [x] Barra de URL dinámica
- [ ] Botón adelante
- [ ] Barra de progreso
- [ ] Favicon dinámico
- [ ] Historial local

## Desarrollo

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
