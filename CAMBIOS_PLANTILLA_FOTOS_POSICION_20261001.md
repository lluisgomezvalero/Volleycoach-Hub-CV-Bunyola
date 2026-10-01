# Plantilla: fotos y posiciones

- Pulsar la foto abre una vista a pantalla completa con nombre, dorsal y posición.
- La foto de la ficha también puede ampliarse. Cierre por botón, Escape o fondo, bloqueo de scroll y devolución de foco.
- El entrenador dispone de selector de posición, incluidas las posiciones combinadas actuales; se conservan valores antiguos sin sobrescribirlos.
- Se retira el texto «Sin cuenta vinculada». La posición deportiva es visible para las jugadoras.
- Supabase: se retiran permisos de subida, modificación y borrado de fotos de plantilla para jugadoras. Se conservan lectura y edición por staff.
- Los módulos antiguos reexportan el núcleo actual para compartir React, contexto de sesión y cliente Supabase.

Producción sigue siendo la rama main en GitHub Pages. El punto de entrada es assets/index-roster-20261001.js; la plantilla usa assets/RosterPage-photo-position-20261001.js. Se mantienen los bundles previos como histórico.
