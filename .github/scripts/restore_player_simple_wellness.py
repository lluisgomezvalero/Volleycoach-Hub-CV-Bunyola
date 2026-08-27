from pathlib import Path

wellness_path = Path('react-migration/src/pages/WellnessPage.jsx')
wellness_css_path = Path('react-migration/src/pages/WellnessPage.css')
home_path = Path('react-migration/src/pages/HomePage.jsx')
home_css_path = Path('react-migration/src/pages/HomePageDashboard.css')

wellness = wellness_path.read_text()
home = home_path.read_text()

wellness = wellness.replace(
"""      recentSessions: 0,
      ratio: null,""",
"""      recentSessions: 0,
      recentRpeTotal: 0,
      recentRpeMean: null,
      ratio: null,""", 1)

wellness = wellness.replace(
"""      if (age < 7 * DAY_MS) {
        target.seven += load;
        target.recentSessions += 1;
      } else if (age < 35 * DAY_MS) {""",
"""      if (age < 7 * DAY_MS) {
        target.seven += load;
        target.recentSessions += 1;
        target.recentRpeTotal += score;
      } else if (age < 35 * DAY_MS) {""", 1)

wellness = wellness.replace(
"""      value.chronicWeek = value.twentyEight / 4;
      value.historyCoverageDays = value.oldestTime === null""",
"""      value.chronicWeek = value.twentyEight / 4;
      value.recentRpeMean = value.recentSessions > 0 ? value.recentRpeTotal / value.recentSessions : null;
      value.historyCoverageDays = value.oldestTime === null""", 1)

marker = """  const selectedModel = selectedPlayerId ? playerRows.find((row) => row.player.id === selectedPlayerId) || null : null;
  const selectedHistory = selectedPlayerId ? wellnessRows.filter((row) => row.player_id === selectedPlayerId) : [];
"""
replacement = marker + """
  const currentPlayerLatest = currentPlayerHistory[0] || null;
  const currentPlayerSnapshot = (() => {
    if (!currentPlayerLatest) {
      return {
        key: 'neutral',
        title: 'Aún no tenemos registros',
        text: 'Cuando completes tu primer bienestar podremos empezar a enseñarte cómo te estás encontrando.'
      };
    }
    const fatigueValue = Number(currentPlayerLatest.fatigue);
    const sleepValue = Number(currentPlayerLatest.sleep);
    const painValue = Number(currentPlayerLatest.pain_score || 0);
    const attention = fatigueValue >= 4 || sleepValue <= 2 || painValue >= 4;
    const watch = fatigueValue === 3 || sleepValue === 3 || (painValue > 0 && painValue < 4);
    if (attention) return {
      key: 'alert',
      title: 'Hay algo que vigilar',
      text: 'Tus últimas respuestas muestran alguna señal a tener en cuenta. Si lo necesitas, coméntalo con el cuerpo técnico.'
    };
    if (watch) return {
      key: 'warm',
      title: 'Conviene seguir observando',
      text: 'Tus sensaciones están dentro de lo esperable, aunque hay algún detalle que merece seguimiento.'
    };
    return {
      key: 'good',
      title: 'Buenas sensaciones',
      text: 'Tus últimas respuestas no muestran señales destacadas. Sigue escuchando cómo responde tu cuerpo.'
    };
  })();

  const currentPlayerTraining = (() => {
    if (!currentLoad?.ready) return {
      key: 'neutral',
      title: 'Aún sin tendencia',
      text: 'Necesitamos más semanas de entrenamientos para comparar tu carga reciente con tu ritmo habitual.'
    };
    if (!currentLoad?.seven) return {
      key: 'neutral',
      title: 'Semana tranquila',
      text: 'Esta semana todavía tiene poca actividad registrada.'
    };
    if (currentLoad.ratio < 0.8) return {
      key: 'low',
      title: 'Semana más suave',
      text: 'Tu semana está siendo más ligera que tu ritmo habitual.'
    };
    if (currentLoad.ratio <= 1.3) return {
      key: 'stable',
      title: 'En tu ritmo habitual',
      text: 'Tu semana está siendo parecida a lo que vienes haciendo normalmente.'
    };
    return {
      key: 'high',
      title: 'Semana más exigente',
      text: 'Esta semana está siendo más intensa que tu ritmo habitual. Prioriza descanso y buenas sensaciones.'
    };
  })();
"""
if marker not in wellness:
    raise SystemExit('Wellness model marker not found')
wellness = wellness.replace(marker, replacement, 1)

wellness = wellness.replace(
    '<span className="wellness-eyebrow"><HeartPulse size={14} /> Bienestar y carga</span>',
    '<span className="wellness-eyebrow"><HeartPulse size={14} /> Tu bienestar</span>',
    1
)

old_player_load = """        <section className=\"wellness-card wellness-player-load-card\">
          <div className=\"wellness-card-head\">
            <div>
              <span><Zap size={14} /> Mi carga</span>
              <h2>Cómo viene tu semana</h2>
              <p>Te mostramos una lectura simple, sin métricas técnicas innecesarias.</p>
            </div>
          </div>
          <div className=\"wellness-player-load-grid\">
            <div><small>Últimos 7 días</small><strong>{Math.round(currentLoad?.seven || 0)} UA</strong></div>
            <div><small>Sesiones 28 días</small><strong>{currentLoad?.sessions || 0}</strong></div>
          </div>
          <div className={`wellness-load-status wellness-load-${currentLoad?.state?.key || 'neutral'}`}>
            <Gauge size={17} />
            <div><strong>{currentLoad?.state?.label || 'Sin referencia'}</strong><span>{currentLoad?.ready ? 'Se calcula a partir de tus entrenamientos y tu RPE.' : `Necesitamos 35 días de historial para construir tu referencia (${currentLoad?.historyCoverageDays || 0}/35).`}</span></div>
          </div>
        </section>"""
new_player_load = """        <section className={`wellness-player-snapshot wellness-player-snapshot-${currentPlayerSnapshot.key}`}>
          <div className=\"wellness-player-snapshot-head\">
            <div>
              <small>Tu bienestar</small>
              <h2>{currentPlayerSnapshot.title}</h2>
              <p>{currentPlayerSnapshot.text}{currentPlayerLatest ? ` · Último registro: ${shortDate(currentPlayerLatest.entry_date)}` : ''}</p>
            </div>
            <span className=\"wellness-player-snapshot-icon\">{currentPlayerSnapshot.key === 'alert' ? <AlertTriangle /> : <ShieldCheck />}</span>
          </div>
          {currentPlayerLatest ? (
            <div className=\"wellness-player-snapshot-grid\">
              <div className={fatigueTone(currentPlayerLatest.fatigue)}><span><Activity /></span><strong>{currentPlayerLatest.fatigue}/5</strong><small>Fatiga</small></div>
              <div className={sleepTone(currentPlayerLatest.sleep)}><span><BedDouble /></span><strong>{currentPlayerLatest.sleep}/5</strong><small>Sueño</small></div>
              <div className={painTone(currentPlayerLatest.pain_score || 0)}><span><HeartPulse /></span><strong>{currentPlayerLatest.pain_score || 0}/10</strong><small>Molestias</small></div>
            </div>
          ) : null}
        </section>

        <section className=\"wellness-card wellness-player-simple-load\">
          <div className=\"wellness-card-head\">
            <div>
              <h2>Tu carga reciente</h2>
              <p>Resumen simple de tus últimos entrenamientos.</p>
            </div>
          </div>
          <div className=\"wellness-player-simple-grid\">
            <div className=\"wellness-player-week-copy\"><small>Esta semana</small><strong>{currentPlayerTraining.title}</strong><span>{currentPlayerTraining.text}</span></div>
            <div><small>RPE medio</small><strong>{Number.isFinite(currentLoad?.recentRpeMean) ? currentLoad.recentRpeMean.toFixed(1) : '—'}</strong></div>
            <div><small>Sesiones</small><strong>{currentLoad?.recentSessions || 0}</strong></div>
          </div>
          <div className={`wellness-player-trend-pill wellness-player-trend-${currentPlayerTraining.key}`}><Activity size={18} /><strong>{currentPlayerTraining.title}</strong></div>
        </section>"""
if old_player_load not in wellness:
    raise SystemExit('Player load block not found')
wellness = wellness.replace(old_player_load, new_player_load, 1)
wellness_path.write_text(wellness)

wellness_css = wellness_css_path.read_text()
wellness_add = """

/* Vista jugadora: lenguaje simple, sin UA ni ACWR */
.wellness-player-snapshot{padding:18px;background:#fff;border:1px solid #e4e8ed;border-radius:22px;box-shadow:0 7px 22px rgba(15,23,42,.035)}
.wellness-player-snapshot-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.wellness-player-snapshot-head>div{min-width:0}.wellness-player-snapshot-head small{color:#7f8a9a;font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.055em}.wellness-player-snapshot-head h2{margin:4px 0 4px;color:#1d283b;font-size:1.28rem;line-height:1.08}.wellness-player-snapshot-head p{margin:0;color:#7e8998;font-size:.72rem;line-height:1.48}.wellness-player-snapshot-icon{width:48px;height:48px;flex:0 0 48px;border-radius:15px;display:grid;place-items:center;background:#f1f5f9;color:#64748b}.wellness-player-snapshot-icon svg{width:24px}.wellness-player-snapshot-alert .wellness-player-snapshot-icon{background:#fff1f2;color:#d43b59}.wellness-player-snapshot-good .wellness-player-snapshot-icon{background:#ecfdf5;color:#059669}.wellness-player-snapshot-warm .wellness-player-snapshot-icon{background:#fff7ed;color:#c26719}.wellness-player-snapshot-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:16px}.wellness-player-snapshot-grid>div{min-width:0;padding:12px 8px;border:1px solid #e7ebef;border-radius:15px;background:#fbfcfd;text-align:center}.wellness-player-snapshot-grid>div>span{width:30px;height:30px;margin:0 auto 6px;border-radius:10px;display:grid;place-items:center;background:#f1f5f9;color:#718094}.wellness-player-snapshot-grid>div>span svg{width:15px}.wellness-player-snapshot-grid strong{display:block;color:#273347;font-size:1rem}.wellness-player-snapshot-grid small{display:block;margin-top:3px;color:#8a95a4;font-size:.58rem;font-weight:850}.wellness-player-snapshot-grid .good>span{background:#ecfdf5;color:#059669}.wellness-player-snapshot-grid .warm>span{background:#fff7ed;color:#c26719}.wellness-player-snapshot-grid .alert>span{background:#fff1f2;color:#d43b59}.wellness-player-simple-grid{display:grid;grid-template-columns:1.35fr .75fr .7fr;gap:8px}.wellness-player-simple-grid>div{min-width:0;padding:12px;border:1px solid #e7ebef;border-radius:15px;background:#fbfcfd}.wellness-player-simple-grid small{display:block;color:#8b96a5;font-size:.56rem;font-weight:900;text-transform:uppercase}.wellness-player-simple-grid strong{display:block;margin-top:5px;color:#273347;font-size:1rem;line-height:1.08}.wellness-player-simple-grid span{display:block;margin-top:5px;color:#8792a1;font-size:.61rem;line-height:1.4}.wellness-player-trend-pill{display:inline-flex;align-items:center;gap:7px;margin-top:11px;padding:8px 11px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:.66rem}.wellness-player-trend-stable{background:#ecfdf5;color:#047857}.wellness-player-trend-high{background:#fff7ed;color:#b45309}.wellness-player-trend-low{background:#eff6ff;color:#2563eb}
@media(max-width:560px){.wellness-player-snapshot,.wellness-player-simple-load{border-radius:20px}.wellness-player-simple-grid{grid-template-columns:1.35fr .75fr .65fr}.wellness-player-simple-grid>div{padding:11px 9px}.wellness-player-week-copy strong{font-size:.9rem}.wellness-player-snapshot-grid strong{font-size:.92rem}}
"""
if 'Vista jugadora: lenguaje simple, sin UA ni ACWR' not in wellness_css:
    wellness_css += wellness_add
wellness_css_path.write_text(wellness_css)

home = home.replace(
    "  const [recentMatches, setRecentMatches] = useState([]);",
    "  const [recentMatches, setRecentMatches] = useState([]);\n  const [playerTrainingSummary, setPlayerTrainingSummary] = useState({ weekLoads: [0, 0, 0, 0, 0], recentSessions: 0, recentRpeMean: null, historyCoverageDays: 0, ready: false, label: 'Conociendo tu ritmo', text: 'Estamos empezando a conocer tu ritmo habitual de entrenamiento.' });",
    1
)

old_player_fetch = """        } else if (identity?.player?.id) {
          const wellnessResult = await supabase
            .from('wellness_entries')
            .select('player_id,entry_date,general_state,fatigue,sleep')
            .eq('player_id', identity.player.id)
            .gte('entry_date', from7Date)
            .order('entry_date', { ascending: false });
          if (wellnessResult.error) throw wellnessResult.error;
          nextWellness = wellnessResult.data || [];
        }
"""
new_player_fetch = """        } else if (identity?.player?.id) {
          const wellnessResult = await supabase
            .from('wellness_entries')
            .select('player_id,entry_date,general_state,fatigue,sleep,pain_score')
            .eq('player_id', identity.player.id)
            .gte('entry_date', from7Date)
            .order('entry_date', { ascending: false });
          if (wellnessResult.error) throw wellnessResult.error;
          nextWellness = wellnessResult.data || [];

          const historyStart = new Date(now.getTime() - 35 * 86400000).toISOString();
          const playerEventsResult = await supabase
            .from('events')
            .select('id,starts_at,ends_at,payload')
            .eq('team_id', team.id)
            .eq('event_type', 'training')
            .gte('starts_at', historyStart)
            .lte('starts_at', now.toISOString())
            .order('starts_at', { ascending: true });
          if (playerEventsResult.error) throw playerEventsResult.error;
          const playerEvents = playerEventsResult.data || [];
          const playerEventIds = playerEvents.map((event) => event.id);
          let summary = { weekLoads: [0, 0, 0, 0, 0], recentSessions: 0, recentRpeMean: null, historyCoverageDays: 0, ready: false, label: 'Conociendo tu ritmo', text: 'Estamos empezando a conocer tu ritmo habitual de entrenamiento.' };
          if (playerEventIds.length) {
            const [playerRpeResult, playerAttendanceResult] = await Promise.all([
              supabase.from('rpe_entries').select('event_id,player_id,score,source,created_at').in('event_id', playerEventIds).eq('player_id', identity.player.id),
              supabase.from('attendance').select('event_id,player_id,official_status,effective_minutes').in('event_id', playerEventIds).eq('player_id', identity.player.id)
            ]);
            if (playerRpeResult.error) throw playerRpeResult.error;
            if (playerAttendanceResult.error) throw playerAttendanceResult.error;
            const eventMap = new Map(playerEvents.map((event) => [event.id, event]));
            const attendanceMap = new Map((playerAttendanceResult.data || []).map((row) => [row.event_id, row]));
            const chosen = new Map();
            (playerRpeResult.data || []).filter((row) => ['player', 'coach_for_player'].includes(row.source)).forEach((row) => {
              const prev = chosen.get(row.event_id);
              if (!prev || (row.source === 'player' && prev.source !== 'player') || (row.source === prev.source && new Date(row.created_at || 0) > new Date(prev.created_at || 0))) chosen.set(row.event_id, row);
            });
            const weekLoads = [0, 0, 0, 0, 0];
            const recentRpes = [];
            let oldest = null;
            chosen.forEach((row) => {
              const event = eventMap.get(row.event_id);
              const attendance = attendanceMap.get(row.event_id);
              if (!event || !['present', 'late'].includes(attendance?.official_status)) return;
              const start = new Date(event.starts_at).getTime();
              const duration = eventDuration(event);
              const end = event.ends_at ? new Date(event.ends_at).getTime() : start + duration * 60000;
              if (!Number.isFinite(start) || !Number.isFinite(end) || end > now.getTime()) return;
              let minutes = duration;
              if (attendance.official_status === 'late') {
                const effective = Number(attendance.effective_minutes);
                if (!Number.isFinite(effective) || effective <= 0) return;
                minutes = Math.min(duration, effective);
              }
              const score = Number(row.score);
              if (!Number.isFinite(score) || score < 0 || score > 10) return;
              const age = now.getTime() - start;
              const weekFromNow = Math.floor(age / (7 * 86400000));
              if (weekFromNow < 0 || weekFromNow > 4) return;
              weekLoads[4 - weekFromNow] += Math.round(score * minutes);
              oldest = oldest === null ? start : Math.min(oldest, start);
              if (age < 7 * 86400000) recentRpes.push(score);
            });
            const coverage = oldest === null ? 0 : Math.floor((now.getTime() - oldest) / 86400000);
            const prevMean = weekLoads.slice(0, 4).reduce((sum, value) => sum + value, 0) / 4;
            const current = weekLoads[4];
            const ready = coverage >= 35 && prevMean > 0;
            let label = 'Conociendo tu ritmo';
            let text = 'Estamos empezando a conocer tu ritmo habitual de entrenamiento.';
            if (ready) {
              if (current < prevMean * .8) { label = 'Semana más suave'; text = 'Esta semana está siendo más ligera que tu ritmo habitual.'; }
              else if (current > prevMean * 1.3) { label = 'Semana más exigente'; text = 'Esta semana está siendo más intensa que tu ritmo habitual. Cuida especialmente tu recuperación.'; }
              else { label = 'En tu ritmo habitual'; text = 'Tu semana está siendo parecida a lo que vienes haciendo normalmente.'; }
            }
            summary = {
              weekLoads,
              recentSessions: recentRpes.length,
              recentRpeMean: recentRpes.length ? recentRpes.reduce((a, b) => a + b, 0) / recentRpes.length : null,
              historyCoverageDays: coverage,
              ready,
              label,
              text
            };
          }
          setPlayerTrainingSummary(summary);
        }
"""
if old_player_fetch not in home:
    raise SystemExit('Home player fetch block not found')
home = home.replace(old_player_fetch, new_player_fetch, 1)

old_player_home = """        ) : (
          <article className=\"coach-card coach-wellness-card\">
            <div className=\"coach-wellness-head\">
              <div><span className=\"coach-card-kicker\"><ShieldCheck size={13} /> Mi semana</span><h3>Tu seguimiento</h3></div>
              <ShieldCheck size={22} color=\"#7b8798\" />
            </div>
            <div className=\"coach-card-actions\">
              <Link className=\"coach-action-primary\" to=\"/wellness\"><HeartPulse size={15} /> Bienestar</Link>
              <Link className=\"coach-action-secondary\" to=\"/training\"><Clock3 size={15} /> Entrenos</Link>
            </div>
          </article>
        )}"""
new_player_home = """        ) : (
          <article className=\"coach-card player-week-card\">
            <span className=\"coach-card-kicker\"><Activity size={13} /> Tu entrenamiento</span>
            <h3>Tu semana de entrenamiento</h3>
            <div className=\"player-week-status\"><span className=\"player-week-dot\" /><div><strong>{playerTrainingSummary.label}</strong><p>{playerTrainingSummary.text}</p></div></div>
            <div className=\"player-week-divider\" />
            <div className=\"player-week-feelings\">
              <h4>Cómo te has encontrado</h4>
              <small>{wellnessModel.values.length} registro{wellnessModel.values.length === 1 ? '' : 's'} en los últimos 7 días</small>
              {wellnessModel.values[0] ? (
                <div className=\"player-feeling-grid\">
                  <div><span className=\"player-feeling-icon energy\"><Activity size={17} /></span><div><small>Energía</small><strong>{Number(wellnessModel.values[0].fatigue) >= 4 ? 'Más cansada' : Number(wellnessModel.values[0].fatigue) === 3 ? 'Cansancio moderado' : 'Buena energía'}</strong><p>{Number(wellnessModel.values[0].fatigue) >= 4 ? 'Tus últimos registros reflejan más cansancio acumulado.' : 'Tus sensaciones de fatiga están dentro de un rango cómodo.'}</p></div></div>
                  <div><span className=\"player-feeling-icon sleep\"><HeartPulse size={17} /></span><div><small>Sueño</small><strong>{Number(wellnessModel.values[0].sleep) <= 2 ? 'Sueño más flojo' : Number(wellnessModel.values[0].sleep) === 3 ? 'Sueño regular' : 'Buen descanso'}</strong><p>{Number(wellnessModel.values[0].sleep) <= 2 ? 'La calidad de tu sueño ha sido más baja en tu último registro.' : 'Tu descanso reciente acompaña bien al entrenamiento.'}</p></div></div>
                </div>
              ) : <p className=\"player-week-empty\">Cuando registres tu bienestar podremos enseñarte aquí tus sensaciones recientes.</p>}
            </div>
            <div className=\"player-week-divider\" />
            <div className=\"player-week-evolution\">
              <h4>Tu evolución reciente</h4><small>Comparada con tus últimas semanas</small>
              <div className=\"player-week-bars\">
                {playerTrainingSummary.weekLoads.map((value, index, values) => {
                  const max = Math.max(...values, 1);
                  const height = Math.max(8, Math.round((value / max) * 100));
                  const labels = ['Hace 4 sem.', 'Hace 3 sem.', 'Hace 2 sem.', 'Semana pasada', 'Esta semana'];
                  return <div key={labels[index]}><span><i style={{ height: `${height}%` }} /></span><small>{labels[index]}</small></div>;
                })}
              </div>
            </div>
            <Link className=\"coach-inline-link player-week-link\" to=\"/wellness\">Ver mi bienestar <ChevronRight size={14} /></Link>
          </article>
        )}"""
if old_player_home not in home:
    raise SystemExit('Home player card block not found')
home = home.replace(old_player_home, new_player_home, 1)
home_path.write_text(home)

home_css = home_css_path.read_text()
home_add = """

/* Panel de jugadora: ritmo y sensaciones sin métricas técnicas */
.player-week-card{padding:18px}.player-week-card>h3{margin:5px 0 14px;color:#1f2a3d;font-size:1.22rem}.player-week-status{display:flex;align-items:flex-start;gap:12px;padding:14px;border:1px solid #e4e8ed;border-radius:16px;background:#fbfcfd}.player-week-dot{width:16px;height:16px;flex:0 0 16px;margin-top:2px;border-radius:50%;background:#a9b7c9;box-shadow:0 0 0 6px #eef2f7}.player-week-status strong{display:block;color:#263247;font-size:.88rem}.player-week-status p{margin:4px 0 0;color:#7e8998;font-size:.7rem;line-height:1.45}.player-week-divider{height:1px;margin:16px 0;background:#e8ebef}.player-week-feelings h4,.player-week-evolution h4{margin:0;color:#344155;font-size:.88rem}.player-week-feelings>small,.player-week-evolution>small{display:block;margin-top:2px;color:#98a2af;font-size:.62rem}.player-feeling-grid{display:grid;gap:8px;margin-top:11px}.player-feeling-grid>div{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;padding:11px;border:1px solid #e6eaef;border-radius:15px;background:#fbfcfd}.player-feeling-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center}.player-feeling-icon.energy{background:#f6eafe;color:#9236c4}.player-feeling-icon.sleep{background:#e8f1ff;color:#3473d5}.player-feeling-grid small{color:#8b96a5;font-size:.55rem;font-weight:900;text-transform:uppercase}.player-feeling-grid strong{display:block;margin-top:2px;color:#273347;font-size:.78rem}.player-feeling-grid p{margin:3px 0 0;color:#8792a1;font-size:.62rem;line-height:1.4}.player-week-empty{color:#8792a1;font-size:.68rem}.player-week-bars{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:12px}.player-week-bars>div{min-width:0;text-align:center}.player-week-bars>div>span{height:74px;display:flex;align-items:flex-end;border-radius:10px;background:#f0f3f8;overflow:hidden}.player-week-bars i{display:block;width:100%;min-height:6px;background:#8fa2b9;border-radius:8px 8px 0 0}.player-week-bars>div:last-child i{background:#50627a}.player-week-bars small{display:block;margin-top:5px;color:#8f9aa8;font-size:.48rem;line-height:1.1}.player-week-link{margin-top:13px}
@media(max-width:560px){.player-week-card{padding:16px}.player-week-bars{gap:5px}.player-week-bars>div>span{height:68px}.player-week-bars small{font-size:.45rem}}
"""
if 'Panel de jugadora: ritmo y sensaciones sin métricas técnicas' not in home_css:
    home_css += home_add
home_css_path.write_text(home_css)
