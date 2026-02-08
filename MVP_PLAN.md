# Plan de MVP: Atom Browser "Daily Usable"

> **Objetivo**: Cerrar el ciclo de desarrollo básico. Analizar → Decidir → Cerrar.

## 🎯 Fase 1 — “Daily usable” (OBLIGATORIA)
En este orden estricto. No se toca nada más hasta completar esto.

1.  **Persistencia de sesión**
    *   `session.fromPartition('persist:atom')`
    *   Objetivo: Loguearse una vez y que no se pierda al reiniciar.

2.  **Manejo de Ventanas (`target="_blank"`)**
    *   `setWindowOpenHandler`
    *   Objetivo: Abrir enlaces externos en nueva pestaña del navegador, no en ventanas perdidas o ignoradas.

3.  **Descargas**
    *   `will-download` handler
    *   Objetivo: Hacer que el navegador descargue archivos. Crítico para usabilidad.

4.  **Estabilidad del Historial**
    *   `renderHistory()` debug
    *   Objetivo: Evitar crashes al consultar el historial.

5.  **Estabilidad General**
    *   Evitar crashes tontos.
    *   Objetivo: Atom Browser YA ES USABLE.

## 🟡 Fase 2 — YouTube (OPCIONAL)
*Sin presión.*
- Mejorar timing de adblock si es posible.
- Si no, se queda “aceptable”.
- No condiciona el proyecto.

## ❌ Decisiones Cerradas (NO HACER)
- ❌ No forkear Chromium.
- ❌ No perseguir compatibilidad total con Google.
- ❌ No añadir features fuera de la lista "Qué SÍ va a hacer".

## Estado Final
Al completar la Fase 1:
✅ Se termina un MVP coherente.
✅ Se arreglan los 5 puntos críticos.
✅ Se asume YouTube como trade-off.
**Se programa.**
