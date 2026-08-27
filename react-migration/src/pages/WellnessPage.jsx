import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Gauge,
  HeartPulse,
  Info,
  MessageSquareText,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  Zap
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './WellnessPage.css';

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateDaysAgo(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return localDateKey(date);
}

function playerName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function initials(value) {
  return String(value || 'VB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function shortDate(value) {
  if (!value) return 'Sin registro';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date).replace('.', '');
}

function fullDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

function eventDuration(event) {
  if (event?.starts_at && event?.ends_at) {
    const minutes = Math.round((new Date(event.ends_at) - new Date(event.starts_at)) / 60000);
    if (Number.isFinite(minutes) && minutes > 0) return minutes;
  }
  const payload = Number(event?.payload?.duration);
  return Number.isFinite(payload) && payload > 0 ? Math.round(payload) : 90;
}

function mean(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function fatigueTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'neutral';
  if (n <= 2) return 'good';
  if (n === 3) return 'warm';
  return 'alert';
}

function sleepTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'neutral';
  if (n >= 4) return 'good';
  if (n === 3) return 'warm';
  return 'alert';
}

function painTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'neutral';
  if (n <= 2) return 'good';
  if (n <= 5) return 'warm';
  return 'alert';
}

function loadState(ratio, seven) {
  if (!Number.isFinite(ratio)) return { key: 'neutral', label: 'Construyendo referencia' };
  if (!seven) return { key: 'neutral', label: 'Sin carga reciente' };
  if (ratio < 0.8) return { key: 'low', label: 'Carga bastante inferior a la habitual' };
  if (ratio <= 1.3) return { key: 'stable', label: 'Carga similar a la habitual' };
  if (ratio <= 1.5) return { key: 'considerable', label: 'Incremento considerable de carga' };
  return { key: 'high', label: 'Incremento elevado de carga' };
}

function WellnessMetric({ label, value, tone = 'neutral', suffix = '' }) {
  return (
    <div className={`wellness-metric wellness-metric-${tone}`}>
      <small>{label}</small>
      <strong>{value ?? '—'}{value !== null && value !== undefined && value !== '—' ? suffix : ''}</strong>
    </div>
  );
}

function WellnessForm({
  title,
  subtitle,
  fatigue,
  setFatigue,
  sleep,
  setSleep,
  pain,
  setPain,
  notes,
  setNotes,
  saving,
  onSubmit,
  submitLabel = 'Enviar valoración',
  children
}) {
  const fatigueLabels = ['Muy fresca', 'Bien', 'Moderada', 'Cansada', 'Muy cansada'];
  const sleepLabels = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'];

  return (
    <form className="wellness-form" onSubmit={onSubmit}>
      <div className="wellness-form-head">
        <div>
          <span>Check-in</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <HeartPulse size={24} />
      </div>

      {children}

      <section className="wellness-question">
        <div className="wellness-question-head">
          <div>
            <small>Fatiga</small>
            <strong>{fatigue} · {fatigueLabels[fatigue - 1]}</strong>
          </div>
          <span className={`wellness-value-badge ${fatigueTone(fatigue)}`}>{fatigue}/5</span>
        </div>
        <input
          className="wellness-range"
          type="range"
          min="1"
          max="5"
          step="1"
          value={fatigue}
          onChange={(event) => setFatigue(Number(event.target.value))}
        />
        <div className="wellness-range-scale"><span>Fresca</span><span>Moderada</span><span>Muy cansada</span></div>
      </section>

      <section className="wellness-question">
        <div className="wellness-question-head">
          <div>
            <small>Sueño</small>
            <strong>{sleepLabels[sleep - 1]}</strong>
          </div>
          <span className={`wellness-value-badge ${sleepTone(sleep)}`}>{sleep}/5</span>
        </div>
        <div className="wellness-choice-grid">
          {sleepLabels.map((label, index) => {
            const value = index + 1;
            return (
              <button
                key={label}
                type="button"
                className={sleep === value ? 'active' : ''}
                onClick={() => setSleep(value)}
              >
                <strong>{value}</strong><small>{label}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="wellness-question">
        <div className="wellness-question-head">
          <div>
            <small>Dolor / molestias</small>
            <strong>{pain === 0 ? 'Sin dolor' : pain <= 3 ? 'Molestia leve' : pain <= 6 ? 'Molestia moderada' : 'Molestia alta'}</strong>
          </div>
          <span className={`wellness-value-badge ${painTone(pain)}`}>{pain}/10</span>
        </div>
        <input
          className="wellness-range wellness-range-pain"
          type="range"
          min="0"
          max="10"
          step="1"
          value={pain}
          onChange={(event) => setPain(Number(event.target.value))}
        />
        <div className="wellness-range-scale"><span>0</span><span>5</span><span>10</span></div>
      </section>

      <label className="wellness-notes-field">
        <span><MessageSquareText size={15} /> Notas o molestias físicas</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ej: ligera molestia en rodilla derecha…"
          rows={3}
        />
      </label>

      <button className="wellness-submit" type="submit" disabled={saving}>
        {saving ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}

export default function WellnessPage() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const isStaff = ['coach', 'administrator'].includes(profile?.role);
  const currentPlayerId = identity?.player?.id || null;
  const today = localDateKey();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [players, setPlayers] = useState([]);
  const [wellnessRows, setWellnessRows] = useState([]);
  const [trainingEvents, setTrainingEvents] = useState([]);
  const [rpeRows, setRpeRows] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlayerId, setManualPlayerId] = useState('');
  const [manualDate, setManualDate] = useState(today);

  const [fatigue, setFatigue] = useState(2);
  const [sleep, setSleep] = useState(2);
  const [pain, setPain] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const loadData = useCallback(async () => {
    if (!team?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const from28Date = dateDaysAgo(27);
      const nowIso = new Date().toISOString();

      let nextPlayers = [];
      if (isStaff) {
        const playerResult = await supabase
          .from('players')
          .select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)')
          .eq('team_id', team.id)
          .eq('active', true)
          .order('dorsal', { ascending: true, nullsFirst: false });
        if (playerResult.error) throw playerResult.error;
        nextPlayers = playerResult.data || [];
      } else if (currentPlayerId) {
        const playerResult = await supabase
          .from('players')
          .select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)')
          .eq('id', currentPlayerId)
          .maybeSingle();
        if (playerResult.error) throw playerResult.error;
        nextPlayers = playerResult.data ? [playerResult.data] : [];
      }

      const eventResult = await supabase
        .from('events')
        .select('id,starts_at,ends_at,title,payload')
        .eq('team_id', team.id)
        .eq('event_type', 'training')
        .lte('starts_at', nowIso)
        .order('starts_at', { ascending: false });
      if (eventResult.error) throw eventResult.error;

      const playerIds = nextPlayers.map((player) => player.id);
      const eventIds = (eventResult.data || []).map((event) => event.id);

      const wellnessQuery = playerIds.length
        ? supabase
            .from('wellness_entries')
            .select('id,player_id,entry_date,general_state,fatigue,sleep,pain_score,notes,created_at,updated_at')
            .in('player_id', playerIds)
            .gte('entry_date', from28Date)
            .order('entry_date', { ascending: false })
        : Promise.resolve({ data: [], error: null });

      let rpeQuery = eventIds.length
        ? supabase
            .from('rpe_entries')
            .select('event_id,player_id,coach_profile_id,score,source,created_at')
            .in('event_id', eventIds)
        : Promise.resolve({ data: [], error: null });
      if (!isStaff && currentPlayerId && eventIds.length) rpeQuery = rpeQuery.eq('player_id', currentPlayerId);

      let attendanceQuery = eventIds.length
        ? supabase
            .from('attendance')
            .select('event_id,player_id,official_status,effective_minutes')
            .in('event_id', eventIds)
        : Promise.resolve({ data: [], error: null });
      if (!isStaff && currentPlayerId && eventIds.length) attendanceQuery = attendanceQuery.eq('player_id', currentPlayerId);

      const [wellnessResult, rpeResult, attendanceResult] = await Promise.all([wellnessQuery, rpeQuery, attendanceQuery]);
      if (wellnessResult.error) throw wellnessResult.error;
      if (rpeResult.error) throw rpeResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      setPlayers(nextPlayers);
      setTrainingEvents(eventResult.data || []);
      setWellnessRows(wellnessResult.data || []);
      setRpeRows(rpeResult.data || []);
      setAttendanceRows(attendanceResult.data || []);
    } catch (loadError) {
      setError(loadError?.message || 'No se pudo cargar el módulo de bienestar.');
    } finally {
      setLoading(false);
    }
  }, [currentPlayerId, isStaff, team?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const latestByPlayer = useMemo(() => {
    const map = new Map();
    wellnessRows.forEach((row) => {
      if (!map.has(row.player_id)) map.set(row.player_id, row);
    });
    return map;
  }, [wellnessRows]);

  const todayByPlayer = useMemo(() => {
    const map = new Map();
    wellnessRows.filter((row) => row.entry_date === today).forEach((row) => map.set(row.player_id, row));
    return map;
  }, [today, wellnessRows]);

  const loadsByPlayer = useMemo(() => {
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
      recentRpeTotal: 0,
      recentRpeMean: null,
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
        target.recentRpeTotal += score;
      } else if (age < 35 * DAY_MS) {
        target.twentyEight += load;
      }
    });

    map.forEach((value) => {
      value.chronicWeek = value.twentyEight / 4;
      value.recentRpeMean = value.recentSessions > 0 ? value.recentRpeTotal / value.recentSessions : null;
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
  }, [attendanceRows, players, rpeRows, trainingEvents]);

  const teamToday = useMemo(() => {
    const rows = [...todayByPlayer.values()];
    return {
      responses: rows.length,
      low: rows.filter((row) => Number(row.fatigue) <= 2).length,
      medium: rows.filter((row) => Number(row.fatigue) === 3).length,
      high: rows.filter((row) => Number(row.fatigue) >= 4).length,
      pain: rows.filter((row) => Number(row.pain_score || 0) >= 4).length
    };
  }, [todayByPlayer]);

  const playerRows = useMemo(() => {
    return players.map((player) => {
      const latest = latestByPlayer.get(player.id) || null;
      const todayEntry = todayByPlayer.get(player.id) || null;
      const load = loadsByPlayer.get(player.id) || { seven: 0, twentyEight: 0, ratio: null, state: loadState(null, 0) };
      const alertScore = todayEntry
        ? Number(todayEntry.fatigue >= 4) + Number(todayEntry.sleep <= 2) + Number((todayEntry.pain_score || 0) >= 4) + Number(Boolean(String(todayEntry.notes || '').trim()))
        : 0;
      return { player, latest, todayEntry, load, alertScore };
    });
  }, [latestByPlayer, loadsByPlayer, players, todayByPlayer]);

  const alerts = useMemo(() => {
    return playerRows
      .filter((row) => row.todayEntry && row.alertScore > 0)
      .sort((a, b) => b.alertScore - a.alertScore || playerName(a.player).localeCompare(playerName(b.player), 'es'));
  }, [playerRows]);

  const recentSessions = useMemo(() => {
    return trainingEvents.slice(0, 4).map((event) => {
      const rows = rpeRows.filter((row) => row.event_id === event.id);
      const playerScores = rows.filter((row) => row.source === 'player').map((row) => Number(row.score));
      const coachScore = rows.find((row) => row.source === 'coach')?.score ?? null;
      return {
        event,
        average: mean(playerScores),
        responses: playerScores.length,
        coach: coachScore !== null ? Number(coachScore) : null
      };
    });
  }, [rpeRows, trainingEvents]);

  const currentPlayerToday = currentPlayerId ? todayByPlayer.get(currentPlayerId) || null : null;
  const currentPlayerHistory = useMemo(
    () => wellnessRows.filter((row) => row.player_id === currentPlayerId).slice(0, 10),
    [currentPlayerId, wellnessRows]
  );
  const currentLoad = currentPlayerId ? loadsByPlayer.get(currentPlayerId) || { seven: 0, twentyEight: 0, ratio: null, state: loadState(null, 0) } : null;

  const selectedModel = selectedPlayerId ? playerRows.find((row) => row.player.id === selectedPlayerId) || null : null;
  const selectedHistory = selectedPlayerId ? wellnessRows.filter((row) => row.player_id === selectedPlayerId) : [];

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

  function resetForm(row = null) {
    setFatigue(Number(row?.fatigue || 2));
    setSleep(Number(row?.sleep || 2));
    setPain(Number(row?.pain_score || 0));
    setNotes(String(row?.notes || ''));
    setSaveMessage('');
  }

  async function submitPlayerWellness(event) {
    event.preventDefault();
    if (!currentPlayerId || currentPlayerToday) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const { error: insertError } = await supabase.from('wellness_entries').insert({
        player_id: currentPlayerId,
        entry_date: today,
        general_state: fatigue,
        fatigue,
        sleep,
        pain_score: pain,
        notes: notes.trim()
      });
      if (insertError) throw insertError;
      setSaveMessage('Valoración guardada. Gracias.');
      await loadData();
    } catch (saveError) {
      if (saveError?.code === '23505') {
        setSaveMessage('Tu valoración de hoy ya estaba registrada.');
        await loadData();
      } else {
        setSaveMessage(saveError?.message || 'No se pudo guardar la valoración.');
      }
    } finally {
      setSaving(false);
    }
  }

  function openManual(playerId = players[0]?.id || '') {
    const existing = wellnessRows.find((row) => row.player_id === playerId && row.entry_date === today) || null;
    setManualPlayerId(playerId);
    setManualDate(today);
    resetForm(existing);
    setManualOpen(true);
  }

  function changeManualPlayer(playerId) {
    setManualPlayerId(playerId);
    const existing = wellnessRows.find((row) => row.player_id === playerId && row.entry_date === manualDate) || null;
    resetForm(existing);
  }

  function changeManualDate(value) {
    setManualDate(value);
    const existing = wellnessRows.find((row) => row.player_id === manualPlayerId && row.entry_date === value) || null;
    resetForm(existing);
  }

  async function submitManual(event) {
    event.preventDefault();
    if (!manualPlayerId || !manualDate) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const { error: upsertError } = await supabase.from('wellness_entries').upsert({
        player_id: manualPlayerId,
        entry_date: manualDate,
        general_state: fatigue,
        fatigue,
        sleep,
        pain_score: pain,
        notes: notes.trim()
      }, { onConflict: 'player_id,entry_date' });
      if (upsertError) throw upsertError;
      await loadData();
      setManualOpen(false);
    } catch (saveError) {
      setSaveMessage(saveError?.message || 'No se pudo guardar la valoración.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="wellness-loading"><HeartPulse /><span>Cargando bienestar y carga…</span></div>;
  }

  if (!team?.id) {
    return <div className="wellness-empty"><HeartPulse /><h2>Bienestar</h2><p>No hay un equipo activo asociado a este perfil.</p></div>;
  }

  if (!isStaff) {
    const player = players[0];
    return (
      <div className="wellness-page wellness-player-page">
        <header className="wellness-page-head">
          <div>
            <span className="wellness-eyebrow"><HeartPulse size={14} /> Tu bienestar</span>
            <h1>¿Cómo estás hoy?</h1>
            <p>Tu información es personal y la utiliza el cuerpo técnico para adaptar mejor el entrenamiento.</p>
          </div>
        </header>

        {error ? <div className="wellness-error">{error}</div> : null}
        {saveMessage ? <div className="wellness-save-message">{saveMessage}</div> : null}

        {currentPlayerToday ? (
          <section className="wellness-player-complete">
            <div className="wellness-complete-icon"><CheckCircle2 /></div>
            <div>
              <span>Registro de hoy completado</span>
              <h2>Tu valoración ya está guardada</h2>
              <p>No necesitas volver a responder hoy. Mañana se abrirá un nuevo check-in.</p>
            </div>
            <div className="wellness-complete-grid">
              <WellnessMetric label="Fatiga" value={currentPlayerToday.fatigue} tone={fatigueTone(currentPlayerToday.fatigue)} suffix="/5" />
              <WellnessMetric label="Sueño" value={currentPlayerToday.sleep} tone={sleepTone(currentPlayerToday.sleep)} suffix="/5" />
              <WellnessMetric label="Dolor" value={currentPlayerToday.pain_score ?? 0} tone={painTone(currentPlayerToday.pain_score ?? 0)} suffix="/10" />
            </div>
          </section>
        ) : (
          <WellnessForm
            title={`Hola${player ? `, ${playerName(player).split(/\s+/)[0]}` : ''}`}
            subtitle="Responde una vez al día. Te llevará menos de un minuto."
            fatigue={fatigue}
            setFatigue={setFatigue}
            sleep={sleep}
            setSleep={setSleep}
            pain={pain}
            setPain={setPain}
            notes={notes}
            setNotes={setNotes}
            saving={saving}
            onSubmit={submitPlayerWellness}
          />
        )}

        <section className={`wellness-player-snapshot wellness-player-snapshot-${currentPlayerSnapshot.key}`}>
          <div className="wellness-player-snapshot-head">
            <div>
              <small>Tu bienestar</small>
              <h2>{currentPlayerSnapshot.title}</h2>
              <p>{currentPlayerSnapshot.text}{currentPlayerLatest ? ` · Último registro: ${shortDate(currentPlayerLatest.entry_date)}` : ''}</p>
            </div>
            <span className="wellness-player-snapshot-icon">{currentPlayerSnapshot.key === 'alert' ? <AlertTriangle /> : <ShieldCheck />}</span>
          </div>
          {currentPlayerLatest ? (
            <div className="wellness-player-snapshot-grid">
              <div className={fatigueTone(currentPlayerLatest.fatigue)}><span><Activity /></span><strong>{currentPlayerLatest.fatigue}/5</strong><small>Fatiga</small></div>
              <div className={sleepTone(currentPlayerLatest.sleep)}><span><BedDouble /></span><strong>{currentPlayerLatest.sleep}/5</strong><small>Sueño</small></div>
              <div className={painTone(currentPlayerLatest.pain_score || 0)}><span><HeartPulse /></span><strong>{currentPlayerLatest.pain_score || 0}/10</strong><small>Molestias</small></div>
            </div>
          ) : null}
        </section>

        <section className="wellness-card wellness-player-simple-load">
          <div className="wellness-card-head">
            <div>
              <h2>Tu carga reciente</h2>
              <p>Resumen simple de tus últimos entrenamientos.</p>
            </div>
          </div>
          <div className="wellness-player-simple-grid">
            <div className="wellness-player-week-copy"><small>Esta semana</small><strong>{currentPlayerTraining.title}</strong><span>{currentPlayerTraining.text}</span></div>
            <div><small>RPE medio</small><strong>{Number.isFinite(currentLoad?.recentRpeMean) ? currentLoad.recentRpeMean.toFixed(1) : '—'}</strong></div>
            <div><small>Sesiones</small><strong>{currentLoad?.recentSessions || 0}</strong></div>
          </div>
          <div className={`wellness-player-trend-pill wellness-player-trend-${currentPlayerTraining.key}`}><Activity size={18} /><strong>{currentPlayerTraining.title}</strong></div>
        </section>

        <section className="wellness-card">
          <div className="wellness-card-head">
            <div>
              <span><CalendarDays size={14} /> Historial</span>
              <h2>Tus últimos registros</h2>
              <p>Solo tú y el cuerpo técnico podéis consultar estas valoraciones.</p>
            </div>
          </div>
          {currentPlayerHistory.length ? (
            <div className="wellness-player-history">
              {currentPlayerHistory.map((row) => (
                <article key={row.id} className="wellness-history-day">
                  <strong>{shortDate(row.entry_date)}</strong>
                  <div><span>Fatiga</span><b className={fatigueTone(row.fatigue)}>{row.fatigue}/5</b></div>
                  <div><span>Sueño</span><b className={sleepTone(row.sleep)}>{row.sleep}/5</b></div>
                  <div><span>Dolor</span><b className={painTone(row.pain_score || 0)}>{row.pain_score || 0}/10</b></div>
                </article>
              ))}
            </div>
          ) : <div className="wellness-inline-empty">Aún no tienes registros anteriores.</div>}
        </section>
      </div>
    );
  }

  return (
    <div className="wellness-page wellness-coach-page">
      <header className="wellness-page-head wellness-coach-head">
        <div>
          <span className="wellness-eyebrow"><HeartPulse size={14} /> Bienestar y carga</span>
          <h1>Estado del equipo, hoy</h1>
          <p>Señales de bienestar, carga reciente y percepción del esfuerzo en un único panel.</p>
        </div>
        <div className="wellness-head-actions">
          <button type="button" className="wellness-secondary-button" onClick={() => void loadData()}><RefreshCcw size={16} /> Actualizar</button>
          <button type="button" className="wellness-primary-button" onClick={() => openManual()}><Plus size={16} /> Registrar</button>
        </div>
      </header>

      {error ? <div className="wellness-error">{error}</div> : null}

      <section className="wellness-kpi-grid">
        <article className="wellness-kpi">
          <span className="wellness-kpi-icon"><UserRound /></span>
          <div><small>Han respondido hoy</small><strong>{teamToday.responses}/{players.length}</strong></div>
        </article>
        <article className="wellness-kpi good">
          <span className="wellness-kpi-icon"><Sparkles /></span>
          <div><small>Fatiga baja</small><strong>{teamToday.low}</strong></div>
        </article>
        <article className="wellness-kpi warm">
          <span className="wellness-kpi-icon"><Activity /></span>
          <div><small>Fatiga moderada</small><strong>{teamToday.medium}</strong></div>
        </article>
        <article className="wellness-kpi alert">
          <span className="wellness-kpi-icon"><AlertTriangle /></span>
          <div><small>Fatiga alta / dolor</small><strong>{teamToday.high + teamToday.pain}</strong></div>
        </article>
      </section>

      <section className="wellness-card wellness-attention-card">
        <div className="wellness-card-head">
          <div>
            <span><AlertTriangle size={14} /> Atención</span>
            <h2>Señales a revisar hoy</h2>
            <p>Fatiga, sueño, dolor o comentarios que pueden requerir contexto antes de entrenar.</p>
          </div>
          <small>{alerts.length} jugadora{alerts.length === 1 ? '' : 's'}</small>
        </div>
        {alerts.length ? (
          <div className="wellness-alert-list">
            {alerts.map(({ player, todayEntry }) => (
              <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)}>
                <span className="wellness-avatar">{initials(playerName(player))}</span>
                <div className="wellness-alert-copy">
                  <strong>{playerName(player)}</strong>
                  <span>
                    Fatiga {todayEntry.fatigue}/5 · Sueño {todayEntry.sleep}/5 · Dolor {todayEntry.pain_score || 0}/10
                    {todayEntry.notes ? ` · ${todayEntry.notes}` : ''}
                  </span>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
        ) : (
          <div className="wellness-positive-empty"><ShieldCheck /><div><strong>Sin señales destacadas entre las respuestas de hoy</strong><span>Revisa también quién queda pendiente de responder.</span></div></div>
        )}
      </section>

      <section className="wellness-card">
        <div className="wellness-card-head">
          <div>
            <span><Zap size={14} /> Carga y RPE</span>
            <h2>Últimas sesiones</h2>
            <p>RPE previsto del entrenador frente a la percepción media de las jugadoras.</p>
          </div>
        </div>
        {recentSessions.length ? (
          <div className="wellness-session-grid">
            {recentSessions.map(({ event, average, responses, coach }) => (
              <article key={event.id}>
                <div className="wellness-session-date"><span>{shortDate(localDateKey(new Date(event.starts_at)))}</span><small>{responses} respuestas</small></div>
                <strong>{event.title || 'Entrenamiento'}</strong>
                <div className="wellness-session-rpe">
                  <span><small>Entrenador</small><b>{coach !== null ? coach.toFixed(1) : '—'}</b></span>
                  <span><small>Jugadoras</small><b>{average !== null ? average.toFixed(1) : '—'}</b></span>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="wellness-inline-empty">Todavía no hay sesiones con RPE registradas.</div>}
      </section>

      <section className="wellness-card wellness-team-tracking">
        <div className="wellness-card-head">
          <div>
            <span><Gauge size={14} /> Seguimiento individual</span>
            <h2>Bienestar y carga por jugadora</h2>
            <p>Pulsa una jugadora para revisar su histórico de las últimas cuatro semanas.</p>
          </div>
        </div>
        <div className="wellness-player-table">
          <div className="wellness-player-table-head"><span>Jugadora</span><span>Bienestar</span><span>Carga 7 d</span><span>ACWR</span></div>
          {playerRows.map(({ player, latest, load }) => (
            <button key={player.id} type="button" className="wellness-player-row" onClick={() => setSelectedPlayerId(player.id)}>
              <span className="wellness-player-identity">
                <i className="wellness-avatar">{initials(playerName(player))}</i>
                <span><strong>{playerName(player)}</strong><small>{player.position || 'Jugadora'} · {latest ? shortDate(latest.entry_date) : 'Sin registro'}</small></span>
              </span>
              <span className="wellness-row-metrics">
                <b className={fatigueTone(latest?.fatigue)}>F {latest?.fatigue ?? '—'}</b>
                <b className={sleepTone(latest?.sleep)}>S {latest?.sleep ?? '—'}</b>
                <b className={painTone(latest?.pain_score ?? 0)}>D {latest?.pain_score ?? '—'}</b>
              </span>
              <strong className="wellness-row-load">{Math.round(load.seven)} UA</strong>
              <span className={`wellness-ratio wellness-ratio-${load.state.key}`}>{Number.isFinite(load.ratio) ? load.ratio.toFixed(2) : '—'}</span>
              <ChevronRight className="wellness-row-arrow" />
            </button>
          ))}
        </div>
      </section>

      {selectedModel ? (
        <div className="wellness-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedPlayerId(null); }}>
          <section className="wellness-detail-modal">
            <header>
              <div className="wellness-detail-person">
                <span className="wellness-avatar large">{initials(playerName(selectedModel.player))}</span>
                <div><small>Seguimiento individual</small><h2>{playerName(selectedModel.player)}</h2><p>{selectedModel.player.position || 'Jugadora'} · dorsal {selectedModel.player.dorsal || '—'}</p></div>
              </div>
              <button type="button" onClick={() => setSelectedPlayerId(null)} aria-label="Cerrar"><X /></button>
            </header>

            <div className="wellness-detail-load">
              <WellnessMetric label="Carga 7 días" value={Math.round(selectedModel.load.seven)} suffix=" UA" />
              <WellnessMetric label="Carga habitual" value={selectedModel.load.ready ? Math.round(selectedModel.load.chronicWeek) : '—'} suffix=" UA" />
              <WellnessMetric label="ACWR" value={Number.isFinite(selectedModel.load.ratio) ? selectedModel.load.ratio.toFixed(2) : '—'} tone={selectedModel.load.state.key === 'high' ? 'alert' : selectedModel.load.state.key === 'stable' ? 'good' : 'neutral'} />
            </div>

            <div className={`wellness-load-status wellness-load-${selectedModel.load.state.key}`}>
              <Info size={17} /><div><strong>{selectedModel.load.state.label}</strong><span>{selectedModel.load.ready ? 'Referencia descriptiva de carga; no equivale por sí sola a riesgo de lesión.' : `Se necesitan 35 días de historial antes de calcular ACWR (${selectedModel.load.historyCoverageDays}/35).`}</span></div>
            </div>

            <div className="wellness-detail-history-head"><h3>Últimos registros</h3><button type="button" onClick={() => { setSelectedPlayerId(null); openManual(selectedModel.player.id); }}><Plus size={14} /> Registrar</button></div>
            <div className="wellness-detail-history">
              {selectedHistory.length ? selectedHistory.map((row) => (
                <article key={row.id}>
                  <div><strong>{fullDate(row.entry_date)}</strong>{row.notes ? <p>{row.notes}</p> : null}</div>
                  <span className={fatigueTone(row.fatigue)}>F {row.fatigue}</span>
                  <span className={sleepTone(row.sleep)}>S {row.sleep}</span>
                  <span className={painTone(row.pain_score || 0)}>D {row.pain_score || 0}</span>
                </article>
              )) : <div className="wellness-inline-empty">Sin registros en los últimos 28 días.</div>}
            </div>
          </section>
        </div>
      ) : null}

      {manualOpen ? (
        <div className="wellness-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setManualOpen(false); }}>
          <section className="wellness-manual-modal">
            <button className="wellness-modal-close" type="button" onClick={() => setManualOpen(false)} aria-label="Cerrar"><X /></button>
            <WellnessForm
              title="Registrar bienestar"
              subtitle="El cuerpo técnico puede completar o corregir manualmente una valoración."
              fatigue={fatigue}
              setFatigue={setFatigue}
              sleep={sleep}
              setSleep={setSleep}
              pain={pain}
              setPain={setPain}
              notes={notes}
              setNotes={setNotes}
              saving={saving}
              onSubmit={submitManual}
              submitLabel="Guardar valoración"
            >
              <div className="wellness-manual-fields">
                <label><span>Jugadora</span><select value={manualPlayerId} onChange={(event) => changeManualPlayer(event.target.value)} required><option value="">Seleccionar…</option>{players.map((player) => <option key={player.id} value={player.id}>{playerName(player)}</option>)}</select></label>
                <label><span>Fecha</span><input type="date" value={manualDate} max={today} onChange={(event) => changeManualDate(event.target.value)} required /></label>
              </div>
              {saveMessage ? <div className="wellness-save-message">{saveMessage}</div> : null}
            </WellnessForm>
          </section>
        </div>
      ) : null}
    </div>
  );
}
