# Gráficos individuales por posición

- Central: bloqueos de punto, ataques en punto y aces.
- Colocadora: colocaciones que terminan en punto, defensas positivas y aces.
- Líbero: recepciones positivas, defensas positivas y aces.
- Receptora: recepción, defensa, ataque y aces.
- Opuesta: ataque, defensa y aces.

Los roles mixtos combinan sus indicadores sin duplicados; se reconocen los nombres actuales de plantilla y C/Z/AR/OP/L. Una posición desconocida no se asigna arbitrariamente: permite ver los indicadores individuales disponibles. Cada indicador esperado sin datos muestra un aviso, no un cero inventado.

Recepción y ataque mantienen sus porcentajes y denominadores originales (INT ya incluye puntos y errores). Bloqueo, defensa, aces y colocaciones de punto usan recuentos por partido. Sus barras se escalan al máximo visible y no convierten volumen en eficacia. Se conserva el aviso sobre rival y participación.

Las colocaciones de punto requieren `stats.setting.points`, nuevo campo opcional del JSON publicado; `setting.positive` no se convierte automáticamente. Se aceptan también los alias de importación `puntos` y `point_assists` en el formato alternativo. Los JSON anteriores siguen siendo válidos. No se rellenan históricos ni se deduce un total de defensas o bloqueos.

Los informes ya guardan la posición al importar desde plantilla. Para la jugadora autenticada se prioriza la posición de su perfil de jugadora si está disponible, conservando la del informe como alternativa. No se modifican permisos, selector de jugadoras, estadísticas de equipo ni los datos completos que consulta el entrenador.

Sin migración de base de datos: todo reside en los JSON existentes. La posición debe estar correctamente asignada y los datos individuales deben haberse publicado. Verificado con pruebas de los cinco roles, combinados, aces reales, cero conocido, datos ausentes, setting.points opcional, INT y una única instancia de React. Pendiente comprobación visual autenticada.
