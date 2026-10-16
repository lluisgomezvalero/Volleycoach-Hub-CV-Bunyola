# Participación en partidos y amistosos

El entrenador registra desde el detalle del calendario la participación individual una vez terminado el evento. Categorías: sin participación ni calentamiento, solo calentamiento, baja (jugó poco), media (aproximadamente la mitad), alta (casi todo). Son criterios prácticos de producto; no una escala científica validada. No se atribuye una carga genérica por ser titular o suplente.

Vacío o borrado significa pendiente, nunca ausencia confirmada. El resumen aparece junto a la cobertura RPE en Inicio y Bienestar, para entrenador y jugadora. Usa los mismos últimos 7 × 24 horas de la carga existente, por inicio del evento, excluyendo futuros, no finalizados y cancelados. Las fechas ISO con offset conservan el instante durante el cambio de hora de Europe/Madrid. No cambia la ventana histórica existente.

No crea RPE, minutos ni UA. No interviene en ACWR ni gráficas de carga. Excluye torneos; los partidos individuales se pueden registrar una vez por evento y jugadora. Eventos duplicados con IDs diferentes no se fusionan automáticamente.

Base de datos: `supabase/match_participation.sql`, aplicada una vez. Tabla con clave evento/jugadora, categoría nullable, autor y fecha de última edición. RLS: personal del mismo club registra para jugadoras del equipo del evento; cada jugadora solo lee su propio registro. Sin backfill ni cambios en registros históricos. `match_callups` conserva las convocatorias.

Limitaciones: plantilla activa actual; no reconstruye plantillas históricas ni cambios de equipo retrospectivos. Conserva el último autor/fecha, sin historial de revisiones. Es observación del entrenador, no esfuerzo percibido individual. Pendiente prueba visual autenticada en móvil.

Comprobaciones: categorías, pendientes, diferencias individuales, exclusiones, deduplicación por ID, ventana temporal y cambio horario; simulación de guardado múltiple, corrección, borrado y fallo de red. `tests/match-participation-rls.sql` comprueba upsert, permisos y privacidad con rollback. Regresión de minutos individuales, cobertura RPE y suites anteriores.
