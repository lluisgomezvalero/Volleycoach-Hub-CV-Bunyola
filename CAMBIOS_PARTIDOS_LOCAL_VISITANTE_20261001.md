# Partidos: local o visitante

El formulario de calendario incluye «Jugamos como: Local / Visitante» para partidos, amistosos y torneos, con vista previa de escudos y nombres. La selección se guarda en events.payload.match_venue (home / away) y se recupera al editar.

El calendario, el detalle del evento y la tarjeta del próximo partido muestran primero al local y después al visitante. Los partidos anteriores sin este campo conservan Bunyola primero; se puede cambiar editando el evento. El lugar continúa siendo un campo independiente.

Se conservan el resto del payload, incluidos resultados y estadísticas. No se requieren cambios de esquema ni permisos.

Validación: tests/match-venue-runtime.test.cjs cubre creación, edición, guardado, vista previa, orden en calendario/inicio, compatibilidad con eventos anteriores y conservación de datos. Prueba de guardado con el rol de staff en Supabase dentro de una transacción revertida.
