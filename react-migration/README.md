# VolleyCoach Hub · React migration

Nueva versión en React + Vite construida en paralelo a la aplicación actual. La app de producción en `main` no se sustituye durante esta migración.

## Bloque 1 implementado

- Supabase Auth con el mismo usuario y contraseña de la app actual.
- Sesión persistente y restauración automática al volver a abrir la app.
- Carga de identidad y roles `administrator`, `coach` y `player`.
- Equipo y temporada activa obtenidos desde Supabase.
- Nuevo Inicio React con próxima actividad y accesos rápidos.
- Navegación responsive con sidebar, menú móvil y barra inferior.
- Mi Perfil Privado editable.
- El perfil de entrenador no muestra gamificación, logros ni asistencia personal.
- El resto de módulos están separados mediante carga diferida y se migrarán uno a uno.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

La rama `react-vite-migration` tiene CI propio y valida el build sin modificar la aplicación publicada en producción.
