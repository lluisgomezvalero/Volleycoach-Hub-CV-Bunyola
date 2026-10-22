# RPE comunicado introducido por el entrenador

Bienestar del entrenador incluye «RPE y actividad adicional → Añadir RPE». Se elige jugadora y:

- Una sesión finalizada del equipo con asistencia validada. Se guarda el RPE comunicado y la duración individual de esa participación.
- Una actividad adicional: otro equipo/categoría, partido, amistoso, gimnasio u otro deporte. Se indican contexto, fecha/hora de inicio Europe/Madrid, minutos individuales y RPE 0–10. Se confirma que la actividad no está ya registrada.

RPE y minutos parten vacíos. El formulario exige confirmar que el esfuerzo lo comunicó la jugadora; no registra una estimación del entrenador como si fuera percepción individual. RPE 0 explícito es válido; valores ausentes no se convierten en cero ni en RPE medio. Límite de 600 minutos por registro como decisión de producto de entrada, sin significado científico. Entrenos incluyen pausas habituales. Para partidos se solicita calentamiento y participación individual, excluyendo banquillo. No se cambia la duración histórica de otros registros.

## Datos

Migración `add_staff_player_rpe_and_additional_activity`: columna `rpe_entries.recorded_by`, tabla `additional_player_loads`, RPC invocadora `record_player_rpe`. Refuerzo `harden_manual_rpe_event_scope` rechaza eventos sin equipo. Definición final reproducible: `supabase/manual_player_rpe.sql`.

La RPC guarda RPE y minutos en una misma transacción, comprueba personal activo del mismo club, jugadora/evento del mismo equipo, entrenamiento finalizado con duración confirmada y asistencia present/late. Reutiliza source=coach_for_player y conserva recorded_by. Si existe source=player, falla sin sobrescribirlo ni modificar sus minutos. Una repetición de RPE manual corrige el mismo registro único evento/jugadora. El RPE global previsto por el entrenador permanece separado. La pantalla de entrenamiento identifica el registro introducido por el entrenador y el acceso RPE de Inicio no pide una segunda respuesta.

Actividades adicionales solo permiten escritura al personal del club, lectura propia a la jugadora, sin lectura entre compañeras ni acceso anónimo. El autor se conserva. UUID estable por formulario más índice único por jugadora/inicio/tipo/contexto previenen doble toque, reintentos y duplicados exactos. Una actividad ya guardada no se acepta como éxito de un reintento si el contenido difiere. Se puede anular y volver a registrar para corregirla; se conserva el registro anulado. No se permite borrado desde el cliente. No se ha creado un importador automático de otras categorías: el entrenador confirma el contexto y que no está duplicado.

## Carga y pantallas

La carga adicional se suma con score × duration_minutes a los totales de Inicio del entrenador, a las barras de Inicio de la jugadora y a Bienestar. Se reutiliza el cálculo existente con una proyección en memoria: eventos/participaciones/RPE adicionales sintéticos y asociados exclusivamente a su jugadora. No crea entrenamientos, asistencias ni partidos ficticios en el calendario. Otra jugadora no acumula una sesión pendiente por este motivo. Las barras y cobertura distinguen actividad adicional y los partidos con RPE/minutos pueden sumar sin convertir las categorías de participación a UA. La tabla de participación de partidos continúa independiente y no genera carga numérica duplicada.

La jugadora ve en Bienestar sus actividades adicionales y el origen del registro. Las sesiones del equipo se consultan por su pantalla habitual. La historia anterior y sus fórmulas permanecen; no se rediseña el ACWR ni se crean avisos médicos. El RPE de actividades adicionales se refiere a datos comunicados, no al sistema genérico de participación en partidos.

## Pruebas y límites

Pruebas de cálculos mixtos (participación parcial + partido extra), ausencia de pendientes para compañeras, doble aplicación/reintento, anulados e inválidos, RPE 0/ausente, fecha futura, cambios de horario Europe/Madrid, formulario/doble toque, controles de jugadora, y suites existentes de carga, recogida RPE y runtime React. Pruebas SQL con rollback verifican guardado atómico, corrección manual, no sobrescritura de source=player, autoría, asistencia requerida, límites, privacidad y anulaciones. Advisors sin hallazgos sobre los objetos nuevos; persisten avisos previos ajenos a este cambio.

Limitaciones: sin datos fiables de RPE o minutos no se guarda este formulario de carga; esta primera versión no es un diario general de exposición incompleta. Las actividades adicionales se corrigen anulando y creando de nuevo. La fecha de inicio debe evitar la hora ambigua/inexistente del cambio horario; no se elige silenciosamente un desplazamiento. Revisión visual con sesión real pendiente. No se han inventado registros ni ejecutado pruebas con datos persistentes de jugadoras: los casos SQL se revierten.
