# Migración progresiva a React + Vite

La aplicación actual permanece intacta en `main` mientras se construye una nueva versión en paralelo.

## Objetivo de la fase 1

- Base React + Vite.
- Conexión al mismo proyecto Supabase.
- Login y sesión persistente.
- Roles `coach`, `player` y `administrator`.
- Shell de navegación móvil/escritorio.
- Rutas de Inicio, Entrenos, Calendario, Bienestar, Plantilla, Estadísticas, Competición, Plan de juego y Rendimiento.
- Carga diferida de páginas para evitar que módulos no visibles trabajen en segundo plano.

## Principios

1. No usar parches sobre el DOM.
2. No usar `MutationObserver` para construir interfaz.
3. Cada módulo será un componente/página independiente.
4. Supabase se consumirá desde servicios/hooks explícitos.
5. La app antigua seguirá siendo la versión de producción hasta validar la nueva.
