from pathlib import Path

jsx_path = Path('react-migration/src/pages/WellnessPage.jsx')
css_path = Path('react-migration/src/pages/WellnessPage.css')
text = jsx_path.read_text()

old_state = """function loadState(ratio, seven) {
  if (!seven) return { key: 'neutral', label: 'Sin carga reciente' };
  if (!Number.isFinite(ratio)) return { key: 'neutral', label: 'Construyendo referencia' };
  if (ratio < 0.8) return { key: 'low', label: 'Carga baja' };
  if (ratio <= 1.3) return { key: 'stable', label: 'Carga estable' };
  return { key: 'high', label: 'Carga elevada' };
}
"""
new_state = """function loadState(ratio, seven) {
  if (!Number.isFinite(ratio)) return { key: 'neutral', label: 'Construyendo referencia' };
  if (!seven) return { key: 'neutral', label: 'Sin carga reciente' };
  if (ratio < 0.8) return { key: 'low', label: 'Carga bastante inferior a la habitual' };
  if (ratio <= 1.3) return { key: 'stable', label: 'Carga similar a la habitual' };
  if (ratio <= 1.5) return { key: 'considerable', label: 'Incremento considerable de carga' };
  return { key: 'high', label: 'Incremento elevado de carga' };
}
"""
if old_state not in text:
    raise SystemExit('loadState block not found')
text = text.replace(old_state, new_state, 1)

text = text.replace("      const from28Iso = new Date(Date.now() - 28 * 86400000).toISOString();\n", "", 1)
text = text.replace("        .gte('starts_at', from28Iso)\n", "", 1)

start = text.index("  const loadsByPlayer = useMemo(() => {")
end_marker = "  }, [attendanceRows, players, rpeRows, trainingEvents]);"
end = text.index(end_marker, start) + len(end_marker)
new_block = """  const loadsByPlayer = useMemo(() => {
    const DAY_MS = 86400000;
    const now = Date.now();
    const eventMap = new Map(trainingEvents.map((event) => [event.id, event]));
    const attendanceMap = new Map(attendanceRows.map((row) => [`${row.event_id}:${row.player_id}`, row]));
    const map = new Map(players.map((player) => [player.id, {
      seven: 0,
      twentyEight: 0,
      chronicWeek: 0,
      sessions: 0,
      recentSessions: 0,
      ratio: null,
      historyCoverageDays: 0,
      ready: false,
      oldestTime: null,
      state: { key: 'neutral', label: 'Construyendo referencia' }
    }]));

    const chosen = new Map();
    rpeRows
      .filter((row) => row.player_id && ['player', 'coach_for_player'].includes(row.source))
      .forEach((row) => {
        const key = `${row.event_id}:${row.player_id}`;
        const previous = chosen.get(key);
        if (!previous || (row.source === 'player' && previous.source !== 'player') ||
          (row.source === previous.source && new Date(row.created_at || 0) > new Date(previous.created_at || 0))) {
          chosen.set(key, row);
        }
      });

    chosen.forEach((row) => {
      const event = eventMap.get(row.event_id);
      if (!event) return;
      const startTime = new Date(event.starts_at).getTime();
      if (!Number.isFinite(startTime) || startTime > now) return;

      const scheduledMinutes = eventDuration(event);
      const eventEnd = event.ends_at
        ? new Date(event.ends_at).getTime()
        : startTime + scheduledMinutes * 60000;
      if (!Number.isFinite(eventEnd) || eventEnd > now) return;

      const attendance = attendanceMap.get(`${row.event_id}:${row.player_id}`);
      const official = attendance?.official_status || null;
      if (!['present', 'late'].includes(official)) return;

      let minutes = scheduledMinutes;
      if (official === 'late') {
        const effectiveMinutes = Number(attendance?.effective_minutes);
        if (!Number.isFinite(effectiveMinutes) || effectiveMinutes <= 0) return;
        minutes = Math.min(scheduledMinutes, Math.round(effectiveMinutes));
      }

      const score = Number(row.score);
      if (!Number.isFinite(score) || score < 0 || score > 10 || !minutes) return;
      const load = Math.round(score * minutes);
      const age = now - startTime;
      if (age < 0) return;

      const target = map.get(row.player_id);
      if (!target) return;
      target.oldestTime = target.oldestTime === null ? startTime : Math.min(target.oldestTime, startTime);
      if (age < 28 * DAY_MS) target.sessions += 1;
      if (age < 7 * DAY_MS) {
        target.seven += load;
        target.recentSessions += 1;
      } else if (age < 35 * DAY_MS) {
        target.twentyEight += load;
      }
    });

    map.forEach((value) => {
      value.chronicWeek = value.twentyEight / 4;
      value.historyCoverageDays = value.oldestTime === null
        ? 0
        : Math.max(0, Math.floor((now - value.oldestTime) / DAY_MS));
      value.ready = value.historyCoverageDays >= 35 && value.chronicWeek > 0;
      value.ratio = value.ready ? value.seven / value.chronicWeek : null;
      value.state = value.ready
        ? loadState(value.ratio, value.seven)
        : { key: 'neutral', label: 'Construyendo referencia' };
      delete value.oldestTime;
    });
    return map;
  }, [attendanceRows, players, rpeRows, trainingEvents]);"""
text = text[:start] + new_block + text[end:]

old_player_status = "<div><strong>{currentLoad?.state?.label || 'Sin referencia'}</strong><span>Se calcula a partir de tus entrenamientos y tu RPE.</span></div>"
new_player_status = "<div><strong>{currentLoad?.state?.label || 'Sin referencia'}</strong><span>{currentLoad?.ready ? 'Se calcula a partir de tus entrenamientos y tu RPE.' : `Necesitamos 35 días de historial para construir tu referencia (${currentLoad?.historyCoverageDays || 0}/35).`}</span></div>"
if old_player_status not in text:
    raise SystemExit('player load status not found')
text = text.replace(old_player_status, new_player_status, 1)

old_metric = '<WellnessMetric label="Carga 28 días" value={Math.round(selectedModel.load.twentyEight)} suffix=" UA" />'
new_metric = '<WellnessMetric label="Carga habitual" value={selectedModel.load.ready ? Math.round(selectedModel.load.chronicWeek) : \'—\'} suffix=" UA" />'
if old_metric not in text:
    raise SystemExit('28d metric not found')
text = text.replace(old_metric, new_metric, 1)

old_detail = "<Info size={17} /><div><strong>{selectedModel.load.state.label}</strong><span>Referencia descriptiva de carga; no equivale por sí sola a riesgo de lesión.</span></div>"
new_detail = "<Info size={17} /><div><strong>{selectedModel.load.state.label}</strong><span>{selectedModel.load.ready ? 'Referencia descriptiva de carga; no equivale por sí sola a riesgo de lesión.' : `Se necesitan 35 días de historial antes de calcular ACWR (${selectedModel.load.historyCoverageDays}/35).`}</span></div>"
if old_detail not in text:
    raise SystemExit('detail load status not found')
text = text.replace(old_detail, new_detail, 1)

jsx_path.write_text(text)

css = css_path.read_text()
addition = ".wellness-ratio-considerable{background:#fff7ed;color:#b45309}.wellness-load-considerable{background:#fff7ed;color:#b45309}"
if addition not in css:
    css += "\n" + addition + "\n"
css_path.write_text(css)
