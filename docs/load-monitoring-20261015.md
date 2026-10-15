# Seguimiento de carga · CV Bunyola · 15 octubre 2026

## Qué se confirmó en la revisión

La aplicación publicada se mantiene como un bundle React en `assets/index-insights-20261012.js`; no contiene el proyecto React original. Se encontraron tres rutas distintas de cálculo (Inicio del entrenador, Inicio de jugadora y Bienestar), filtros limitados a entrenamientos, duración por defecto de 90 minutos y minutos individuales solo para `late`. El historial se consideraba suficiente por antigüedad (35 días), sin validar cobertura. Las franjas temporales mezclaban milisegundos, fechas UTC y medianoche del dispositivo.

## Cambio implementado

`load-model-20261015.js` es el cálculo común y comprobable; `load-ui-20261015.js` reutiliza el cliente Supabase y la instancia React autenticados. Inicio y Carga y bienestar usan el mismo componente. La asistencia y los RPE existentes se conservan; no se rellenan ni se reescriben los históricos.

### Exposición y datos fiables

- Se incluyen entrenamientos, partidos, amistosos y torneos realizados; se excluyen cancelaciones y eventos futuros/en curso.
- Una actividad adicional puede ser otro equipo, selección, gimnasio u otro deporte. Si ya existe un evento, se enlaza con él en vez de añadir otro registro independiente. Hay unicidad por evento/jugadora.
- Los partidos se vinculan explícitamente a su torneo. El torneo contenedor no se suma cuando hay partidos vinculados, y también se puede marcar manualmente como contenedor. No se deducen duplicados por coincidencia de fecha o nombre.
- Carga calculable: participación validada + minutos fiables + RPE individual válido. Fórmula exacta RPE × minutos; 0 es un RPE válido si realmente se comunica, nunca un valor imputado.
- Ausencia/descanso confirmados se conservan como estado distinto de los registros pendientes. No se inventan ceros ni medias.
- Las asistencias antiguas con minutos individuales y validación siguen siendo utilizables. Las asistencias completas antiguas sin minutos no heredan automáticamente la duración programada.
- Para una sesión completa se puede confirmar explícitamente la duración real; las participaciones parciales conservan sus minutos. Los minutos incluyen las pausas habituales.
- En partidos nuevos: minutos = calentamiento realizado + participación en pista, incluidas pausas ordinarias de esa participación. Banquillo registrado aparte, fuera del producto RPE × minutos. Un calentamiento realizado con participación en pista cero sigue siendo exposición. Es una convención operativa de este producto, no una equivalencia fisiológica universal.
- Los registros adicionales sin RPE/minutos fiables se conservan sin UA. Las estimaciones del entrenador no se mezclan con el RPE comunicado por la jugadora.
- Saltos y golpeos opcionales conservan un origen (recuento o estimación) común al registro; no se convierten a UA ni a riesgo.

### Referencia y ventanas

Últimos 7 días: fechas locales desde hoy−6 hasta hoy, contando solamente actividades finalizadas hasta el momento de consulta. Referencia: cuatro periodos móviles anteriores de 7 días, desde hoy−34 hasta hoy−7. Europe/Madrid se aplica explícitamente, incluso al cambiar a horario de invierno/verano. El día actual es parcial y aparece con sus fechas.

La referencia exige semanas conocidas (sesiones resueltas o descanso sin exposición explícitamente confirmado), sin asistencias desconocidas y con al menos 80% de carga registrada entre las sesiones realizadas **en cada semana**. Vacaciones, enfermedad, lesión y retorno dentro del periodo invalidan la interpretación ordinaria. La referencia necesita carga positiva. Una referencia con 80–99% de cobertura puede subestimar el volumen real; la interfaz lo explica. No conocer actividad fuera del equipo sigue siendo una limitación.

El 80% de cobertura y la banda descriptiva de ±15% para “Similar a lo habitual” son decisiones de producto, **no límites científicos validados**. La media habitual no implica que una dosis sea apropiada. No se aplican reducciones automáticas. El aumento planificado es contexto visible, no una alerta de lesión.

ACWR queda únicamente en un desplegable del entrenador: últimos 7 días ÷ media semanal de los 28 días previos, sin incluir los 7 recientes. No aparece para las jugadoras ni se presenta como zona segura, predictor, porcentaje de lesión o prescripción.

### Bienestar y decisiones

Formulario único: fatiga 1–5 (mayor = más fatiga), sueño 1–5 (mayor = mejor calidad), dolor 0–10, localización, limitación (no / modificar / no puede / quiere comentarlo), nota opcional. Se muestra el último registro fechado y el anterior; cualquier aumento reciente de dolor y empeoramiento de fatiga/sueño queda visible, aunque la carga sea estable. Un registro antiguo no se etiqueta como estado de hoy. Son invitaciones a revisar y hablar, no diagnósticos.

El entrenador puede registrar motivo, decisión y fecha de revisión. La revisión añade una entrada vinculada, no borra la decisión anterior. Las decisiones son privadas del cuerpo técnico, siguiendo el alcance de club existente. La jugadora solo consulta su carga y bienestar.

### RPE y persistencia

Se reutiliza la regla de recogida: desde 30 minutos después del final hasta medianoche del día de inicio en Europe/Madrid; el entrenador puede reabrir 24 horas, también para partidos. La regla compartida se aplica al detalle de sesión, al nuevo formulario y a las escrituras del servidor. Una actividad que acaba tan tarde que no dispone de esa ventana requiere reapertura. La actividad adicional usa el RPE retrospectivo comunicado y queda identificada por su autora/autor.

La función `save_load_exposure` ejecuta el guardado de exposición y RPE canónico en una transacción. Mantiene los recordatorios y el detalle de sesión sincronizados. Un RPE propio ya guardado no se vuelve a etiquetar como comunicación del entrenador al confirmar los minutos. Un cambio posterior del RPE propio en el detalle se refleja en el motor común. Los `coach_for_player` históricos sin confirmación de procedencia no se reinterpretan retrospectivamente.

Los registros del nuevo módulo conservan autor, fecha, editor y versiones previas en `load_exposure_revisions`. No hay servicio secreto en el navegador ni funciones SECURITY DEFINER nuevas. Las políticas RLS limitan a la propia jugadora o al personal del mismo club.

## Migraciones

Aplicadas en el proyecto de Supabase, sin backfill:

1. `load_monitoring_20261015.sql`: exposiciones, contextos, decisiones y revisiones, RLS, guardado atómico y campos de localización/limitación en bienestar.
2. `load_monitoring_guards_20261015.sql`: reutilización de validaciones oficiales idénticas y ventana de RPE común en servidor.

Los archivos son migraciones de una sola aplicación; el historial de Supabase contiene sus versiones. No volver a ejecutarlos manualmente en producción. No se ha cambiado ningún registro histórico de negocio. Las fixtures de integración se ejecutan con ROLLBACK.

## Verificación

- `node --test tests/load-monitoring.test.mjs tests/load-ui.test.mjs`: escenarios de cálculo, datos ausentes, RPE cero, participación parcial, partidos, torneo sin duplicados, actividad adicional, descanso, referencia incompleta, retorno, dolor creciente, aumento planificado, procedencia, límites de periodos, Madrid/DST, componentes y paginación.
- `tests/load-permissions.sql`: integración real con transacción revertida: permisos propios/ajenos, validación del entrenador, decisiones privadas, revisión de cambios, atomicidad y plazo/reapertura de RPE, bloqueo anónimo.
- Pruebas existentes: avatar, estadísticas/insights, local/visitante, plantilla y series de sesiones.
- Se sustituye el workflow PWA legado (ya fallaba antes de este cambio por buscar la antigua interfaz) por validación de los módulos React actuales, sin commits automáticos.
- Comprobación sintáctica de módulos y bundle, referencias de imports y `git diff --check`.
- Asesor de seguridad: sin avisos nuevos para los objetos del módulo. Se mantienen avisos previos sobre funciones de estadísticas, logs push sin políticas y protección de contraseñas filtradas; no se han modificado por estar fuera del alcance de carga.

La verificación automática de componentes no sustituye una revisión visual en un móvil real. No se realizó una sesión de navegador autenticada. Una carga calculable puede ser válida aunque no exista una referencia interpretable; las dos cosas se muestran por separado.

## Evidencia consultada y límites

- [Impellizzeri et al., 2020 — ACWR: Conceptual Issues and Fundamental Pitfalls](https://pubmed.ncbi.nlm.nih.gov/32502973/): no asumir causalidad ni capacidad predictiva individual del cociente.
- [Saw et al., 2016 — revisión de medidas subjetivas de respuesta al entrenamiento](https://pubmed.ncbi.nlm.nih.gov/26423706/): utilidad del seguimiento subjetivo, con interpretación contextual.
- [Haddad et al., 2017 — Session-RPE Method for Training Load Monitoring](https://pubmed.ncbi.nlm.nih.gov/29163016/): medida global de carga interna, no equivalencia con una dosis mecánica local.

Estos trabajos no validan una zona segura universal para jugadoras cadetes ni los umbrales operativos de esta aplicación. La participación, el RPE, los minutos y los recuentos dependen de la calidad de recogida. No se importan automáticamente cargas de otras aplicaciones ni se infieren saltos a partir de duración.
