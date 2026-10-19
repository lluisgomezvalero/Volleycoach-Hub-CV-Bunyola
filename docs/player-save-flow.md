# Fluidez de registro: primera revisión

Cambios acotados a Inicio y el guardado existente:

- Consulta propia de bienestar en Inicio independiente del bloque de competición/carga. Usa el mismo cliente autenticado, filtros y registros; botón de reintento si falla. No se afirma una reducción de latencia medida: elimina dependencias innecesarias del acceso.
- Guardado de Bienestar actualiza su estado y caché con la fila devuelta por el servidor; elimina la consulta posterior de entrenamientos, RPE, asistencia, plantilla e historial. Mantiene la pantalla montada y su posición.
- Los registros confirmados desde Inicio actualizan las cachés existentes que ya contienen a esa jugadora y publican la fila en el evento de actualización. Los receptores pueden fusionarla sin consultar de nuevo todo el módulo.
- Confirmación visible de bienestar y anuncio de RPE guardado. El RPE ya se actualizaba localmente; se conserva ese comportamiento.
- Bloqueo síncrono de doble envío, además del estado de botón ocupado, en bienestar de Inicio, Bienestar y RPE.
- Ante fallo, no se cierra el formulario ni se reinician respuestas. Cerrar y reabrir el formulario de Inicio tampoco descarta lo escrito; tras éxito se limpian sus campos. No se guardan borradores sensibles en almacenamiento persistente.
- Ante un conflicto de registro duplicado de bienestar o RPE, se lee el registro real propio. Nunca se confirma usando valores inventados del intento ni se sobrescribe el registro confirmado.
- El acceso al RPE se actualiza con el evento de guardado, además de los mecanismos existentes.

No requiere migraciones ni cambios de permisos. No añade envío automático sin conexión, persistencia tras cerrar la app, cambios de navegación ni restauración global de scroll entre rutas. No se afirma haber realizado una prueba visual autenticada con red móvil lenta; se simulan respuestas pendientes y fallos en tests. Se han probado guardado lento, doble pulsación antes del render, reintento, conflicto con valores distintos y fusión de caché sin alterar otras jugadoras. Queda pendiente la comprobación de experiencia real en móvil.
