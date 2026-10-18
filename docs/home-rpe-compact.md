# Inicio compacto y acceso al RPE

Vista de jugadora: cabecera con temporada, club/categoría y nombre/rol en dos columnas; sin saludo horario ni subtítulo «Próximo entreno, partido y tu seguimiento personal». Se conserva el panel técnico.

El acceso «Registrar RPE» se presenta como la tarjeta de bienestar, con un color propio y enlace a la sesión. Reemplaza el aviso antiguo, que se calculaba solo al cargar Inicio y añadía 30 minutos respecto del formulario. Reutiliza directamente Xh y WE, las funciones de apertura/cierre de la sesión: desde el final del entrenamiento (o duración de sesión existente si falta ends_at) hasta el final del día del evento según la regla existente del dispositivo. No modifica la disponibilidad del formulario ni sus permisos. Una reapertura del entrenador es válida hasta expires_at.

Solo aparece para entrenamientos sin RPE propio enviado, sin ausencia confirmada y no cancelados. Se comprueba el reloj cada 15 segundos; se consultan cambios al volver a la app, mediante suscripciones a RPE/asistencia/reaperturas y mediante consulta de respaldo cada minuto. Las consultas se detienen con la app oculta y las suscripciones se limpian al salir. Se incluyen sesiones antiguas reabiertas aunque estén fuera de la ventana ordinaria de 35 días. Si no se puede comprobar la disponibilidad no se ofrece un acceso potencialmente caducado.

Usa el cliente autenticado existente, filtros por equipo/jugadora y RLS existente. No escribe datos ni requiere migraciones. No cambia la escala, el registro de RPE o bienestar, ni los indicadores de carga.

Validación: pruebas de apertura exacta/cierre/reapertura/caducidad, RPE ya enviado, ausencias, eventos excluidos, navegación, actualización al volver a la app y limpieza de recursos. Consultas de solo lectura verificadas y suites de regresión. Pendiente prueba visual autenticada en móvil.
