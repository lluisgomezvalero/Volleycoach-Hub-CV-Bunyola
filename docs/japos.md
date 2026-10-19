# Japos

Acceso: Entrenos → Japos para consultar la clasificación de la temporada del equipo seleccionado. Dentro de cada entrenamiento, Japos permite al cuerpo técnico registrar tantos resultados como se hayan jugado y corregirlos o anularlos. Las jugadoras solo consultan los resultados de su equipo.

## Reglas

Al mejor de tres sets: primeros dos a 10 puntos y tercero a 5. Se guarda el resultado final (2–0, 2–1, 0–2, 1–2), no un marcador punto a punto. El 2–0 reparte 3/0 puntos y el 2–1 reparte 2/1. Cada participante suma los puntos de su equipo, aunque en otro Japo cambie de compañeras. No hay puntos por ausencia. Los empates en puntos comparten puesto; el orden alfabético entre empatadas solo ordena la pantalla. Se muestran jugados y victorias, sin desempate adicional implícito.

No se utiliza para evaluar salud, bienestar, carga ni estadísticas oficiales. No modifica esos módulos ni concede recompensas por RPE o dolor.

## Datos y permisos

Nueva tabla `public.japo_games`, definición reproducible en `supabase/japo_games.sql`, aplicada mediante migración `add_training_japo_games`. Resultado y participantes se guardan juntos de forma atómica. RLS limita lecturas a personal del club y jugadoras del equipo; solo personal puede insertar/corregir/anular. No hay permiso DELETE desde el cliente. El disparador valida participantes sin duplicados, mismo equipo/club y evento de entrenamiento. Las sesiones eliminadas eliminan sus Japos mediante FK; las sesiones canceladas no puntúan.

La clasificación se calcula de los resultados guardados y filtrados por temporada, sin contadores acumulados susceptibles de desincronizarse. UUID estable durante reintentos evita doble inserción y bloqueo síncrono evita doble toque. Ediciones usan updated_at como condición: una edición simultánea no sobrescribe otra silenciosamente. La clasificación se recarga al abrir el panel; no se añade una suscripción en tiempo real.

Se reutilizan nombres visibles de la plantilla. Una participante fuera de la plantilla actual conserva sus puntos identificada de forma genérica; corregir un resultado con una jugadora trasladada de equipo requiere devolverla al equipo o quitarla del resultado, porque se valida la pertenencia actual. Clasificación de temporada del equipo, sin selector de temporadas antiguas en esta primera versión. Si un evento antiguo carece de season_id, debe completarse antes de registrar resultados que se incluyan en la clasificación. No se inventan resultados históricos.

## Verificación

Pruebas Node de los cuatro resultados, negativos/inválidos, participantes, cambios de equipo, ausencias, empates, correcciones, anulaciones, UUID repetido, paginación, carga diferida y formulario con doble toque/error/reintento. Integración con un único runtime React comprobada por la suite existente. Pruebas SQL transaccionales con rollback: escritura del entrenador, corrección/anulación, resultados inválidos, participantes duplicadas/ajenas, lectura de compañeras, aislamiento entre equipos y bloqueo de escritura de jugadoras y acceso anónimo. Advisors sin avisos nuevos sobre las tablas/funciones de Japos; avisos previos del proyecto ajenos a este cambio.

Pendiente revisión visual en móvil con sesión real. No se ha probado un marcador en directo porque esta versión guarda resultados finales.
