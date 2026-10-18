# Barras individuales de carga

Cambio incremental en Inicio y Bienestar de las jugadoras. Componente compartido con cinco barras pulsables y accesibles por teclado. Al seleccionar: fechas y horas Europe/Madrid, UA registradas, sesiones con carga calculable, datos pendientes y ausencias confirmadas. Las barras usan un único color neutro; tramas indican registros pendientes. Una mayor carga no significa una mejora. Los partidos siguen separados.

Reutiliza los registros ya consultados, minutos individuales y la fórmula RPE individual × minutos. No cambia la recogida de RPE, permisos, registros históricos ni cálculo de carga/ACWR del entrenador. El ACWR ya estaba limitado a la vista del entrenador; no se incorpora al nuevo componente.

Ventana: cinco periodos consecutivos de 7 × 24 horas, anclados en la fecha de consulta, por inicio del evento, con límite inferior excluido y superior incluido en cada periodo. No son semanas de calendario. Solo entrenamientos finalizados; sin duplicar IDs, sin eventos cancelados ni fuentes de RPE estimadas por entrenador. El RPE comunicado por la jugadora, incluido coach_for_player, cuenta; un cero válido sí cuenta. Nulos y vacíos no se convierten en cero.

La referencia descriptiva requiere los cuatro periodos anteriores con al menos una sesión y sin asistencia/RPE/minutos pendientes; los periodos con ausencias confirmadas sí están contabilizados. Media positiva necesaria para comparar. Es una decisión conservadora de producto, no un criterio científico validado. Se mantienen las bandas descriptivas existentes (<80%, 80–130%, >130%) únicamente para mensajes de menor/similar/mayor carga registrada. No son zonas seguras, objetivos ni riesgo de lesión. Sin referencia interpretable: «Referencia insuficiente». Datos pendientes: «Faltan registros».

No evalúa aún vacaciones, lesión, enfermedad o retorno, ni garantiza que todas las sesiones reales estén en el calendario. Un periodo sin sesiones registradas no confirma descanso. La duración de sesión conserva su comportamiento existente; no se modifica el histórico.

Validación: pruebas del modelo, selección por teclado/pulsación simulada y regresiones existentes. No requiere migración. Pendiente revisión visual autenticada en dispositivo.
