# Changelog

## [0.3.0] - 2026-02-05

### Added
- **Sistema de pestañas completo**
  - Crear nuevas tabs con botón + o Ctrl+T
  - Cerrar tabs con × o Ctrl+W
  - Cambiar entre tabs haciendo clic
  - Cada tab tiene su propio historial de navegación
  - Favicon dinámico por cada tab
  - Título de tab basado en el hostname

### Changed
- Arquitectura Rust refactorizada con TabManager
- Altura de toolbar aumentada para acomodar tabs

## [0.2.0] - 2026-02-05

### Added
- Botón adelante (go_forward)
- Barra de progreso durante carga
- Favicon dinámico del sitio actual
- Historial local (últimas 100 URLs)

### Fixed
- URL ahora se actualiza correctamente tras navegar
- Animación de carga funciona correctamente

---

## [0.1.0] - 2026-02-05

### Added
- Navegación básica con URL y búsqueda Google
- Botones atrás y recargar
- Barra de URL con actualización dinámica
- Interfaz oscura minimalista
