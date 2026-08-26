import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  HeartPulse,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './HomePageDashboard.css';

const ROLE_LABELS = {
  administrator: 'Administrador',
  coach: 'Entrenador principal',
  player: 'Jugadora'
};

const CLUB_LOGO = `${import.meta.env.BASE_URL}../assets/pwa-icon-192.png?v=20260825pwa4`;

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

function eventDuration(event) {
  if (event?.starts_at && event?.ends_at) {
    const minutes = Math.round((new Date(event.ends_at) - new Date(event.starts_at)) / 60000);
    if (Number.isFinite(minutes) && minutes > 0) return minutes;
  }
  const payloadDuration = Number(event?.payload?.duration);
  return Number.isFinite(payloadDuration) && payloadDuration > 0 ? Math.round(payloadDuration) : 90;
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { short: 'Fecha por confirmar', time: '—', weekday: '—' };
  return {
    short: new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short' }).format(date),
    time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date),
    weekday: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).format(date)
  };
}

function daysUntil(value) {
  const diff = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / 86400000));
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function planLines(event) {
  return String(event?.payload?.plan || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function opponentName(event) {
  const explicit = String(event?.payload?.opponent || '').trim();
  if (explicit) return explicit;
  const title = String(event?.title || '').trim();
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length > 1) return parts.slice(1).join(' vs ').trim();
  return title || 'Rival por confirmar';
}

function loadTone(load) {
  if (load >= 1200) return { key: 'high', label: 'Alta' };
  if (load >= 600) return { key: 'optimal', label: 'Moderada' };
  return { key: 'low', label: 'Baja' };
}

function latestWellnessByPlayer(rows) {
  const map = new Map();
  [...rows]
    .sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)))
    .forEach((row) => {
      if (!map.has(row.player_id)) map.set(row.player_id, row);
    });
  return map;
}

function completedMatch(event) {
  return new Date(event?.starts_at).getTime() < Date.now() && Boolean(event?.payload?.result);
}

export default function HomePage() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const seasonName = identity?.season?.name || '2026/27';
  const isStaff = ['coach', 'administrator'].includes(profile?.role);
  const firstName = useMemo(() => String(profile?.full_name || profile?.username || '').trim().split(/\s+/)[0] || 'equipo', [profile]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextTraining, setNextTraining] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [trainingAttendance, setTrainingAttendance] = useState([]);
  const [gamePlan, setGamePlan] = useState(null);
  const [players, setPlayers] = useState([]);
  const [wellness, setWellness] = useState([]);
  const [workloadRows, setWorkloadRows] = useState([]);
  const [recentMatches, setRecentMatches] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      if (!team?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const now = new Date();
        const from28 = new Date(now.getTime() - 28 * 86400000).toISOString();
        const from7Date = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

        const [futureResult, pastTrainingResult, recentMatchResult] = await Promise.all([
          supabase
            .from('events')
            .select('id,team_id,event_type,title,starts_at,ends_at,location,status,payload')
            .eq('team_id', team.id)
            .gte('starts_at', now.toISOString())
            .order('starts_at', { ascending: true })
            .limit(20),
          supabase
            .from('events')
            .select('id,starts_at,ends_at,payload')
            .eq('team_id', team.id)
            .eq('event_type', 'training')
            .gte('starts_at', from28)
            .lte('starts_at', now.toISOString())
            .order('starts_at', { ascending: false })
            .limit(30),
          supabase
            .from('events')
            .select('id,event_type,title,starts_at,payload')
            .eq('team_id', team.id)
            .in('event_type', ['match', 'friendly', 'tournament'])
            .lt('starts_at', now.toISOString())
            .order('starts_at', { ascending: false })
            .limit(5)
        ]);

        if (futureResult.error) throw futureResult.error;
        if (pastTrainingResult.error) throw pastTrainingResult.error;
        if (recentMatchResult.error) throw recentMatchResult.error;

        const future = futureResult.data || [];
        const training = future.find((event) => event.event_type === 'training') || null;
        const match = future.find((event) => ['match', 'friendly', 'tournament'].includes(event.event_type)) || null;
        const pastTrainings = pastTrainingResult.data || [];

        let nextPlayers = [];
        let nextWellness = [];
        let nextWorkloads = [];
        let nextAttendance = [];
        let nextPlan = null;

        if (isStaff) {
          const playersResult = await supabase
            .from('players')
            .select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)')
            .eq('team_id', team.id)
            .eq('active', true)
            .order('dorsal', { ascending: true, nullsFirst: false });
          if (playersResult.error) throw playersResult.error;
          nextPlayers = playersResult.data || [];

          const playerIds = nextPlayers.map((player) => player.id);
          const eventIds = pastTrainings.map((event) => event.id);
          const requests = [];

          requests.push(playerIds.length
            ? supabase.from('wellness_entries').select('player_id,entry_date,general_state,fatigue,sleep').in('player_id', playerIds).gte('entry_date', from7Date).order('entry_date', { ascending: false })
            : Promise.resolve({ data: [], error: null }));
          requests.push(eventIds.length
            ? supabase.from('rpe_entries').select('event_id,player_id,score,source').in('event_id', eventIds).not('player_id', 'is', null)
            : Promise.resolve({ data: [], error: null }));
          requests.push(training?.id
            ? supabase.from('attendance').select('player_id,player_response,official_status').eq('event_id', training.id)
            : Promise.resolve({ data: [], error: null }));
          requests.push(match?.id
            ? supabase.from('game_plans').select('id,event_id,status,published_at').eq('event_id', match.id).order('updated_at', { ascending: false }).limit(1)
            : Promise.resolve({ data: [], error: null }));

          const [wellnessResult, rpeResult, attendanceResult, planResult] = await Promise.all(requests);
          if (wellnessResult.error) throw wellnessResult.error;
          if (rpeResult.error) throw rpeResult.error;
          if (attendanceResult.error) throw attendanceResult.error;
          if (planResult.error) throw planResult.error;

          nextWellness = wellnessResult.data || [];
          nextAttendance = attendanceResult.data || [];
          nextPlan = planResult.data?.[0] || null;

          const eventMap = new Map(pastTrainings.map((event) => [event.id, event]));
          const loads = new Map(nextPlayers.map((player) => [player.id, { seven: 0, twentyEight: 0 }]));
          const sevenCutoff = now.getTime() - 7 * 86400000;
          (rpeResult.data || []).forEach((row) => {
            if (!row.player_id) return;
            const event = eventMap.get(row.event_id);
            if (!event) return;
            const load = Math.round(Number(row.score || 0) * eventDuration(event));
            const target = loads.get(row.player_id) || { seven: 0, twentyEight: 0 };
            target.twentyEight += load;
            if (new Date(event.starts_at).getTime() >= sevenCutoff) target.seven += load;
            loads.set(row.player_id, target);
          });

          nextWorkloads = nextPlayers
            .map((player) => ({ player, ...(loads.get(player.id) || { seven: 0, twentyEight: 0 }) }))
            .sort((a, b) => b.seven - a.seven || playerName(a.player).localeCompare(playerName(b.player), 'es'));
        } else if (identity?.player?.id) {
          const wellnessResult = await supabase
            .from('wellness_entries')
            .select('player_id,entry_date,general_state,fatigue,sleep')
            .eq('player_id', identity.player.id)
            .gte('entry_date', from7Date)
            .order('entry_date', { ascending: false });
          if (wellnessResult.error) throw wellnessResult.error;
          nextWellness = wellnessResult.data || [];
        }

        if (!active) return;
        setNextTraining(training);
        setNextMatch(match);
        setPlayers(nextPlayers);
        setWellness(nextWellness);
        setWorkloadRows(nextWorkloads);
        setTrainingAttendance(nextAttendance);
        setGamePlan(nextPlan);
        setRecentMatches(recentMatchResult.data || []);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No se pudo cargar el panel técnico.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => { active = false; };
  }, [identity?.player?.id, isStaff, team?.id]);

  const wellnessModel = useMemo(() => {
    const latest = latestWellnessByPlayer(wellness);
    const values = [...latest.values()];
    const low = values.filter((row) => Number(row.fatigue || 0) <= 2).length;
    const medium = values.filter((row) => Number(row.fatigue || 0) === 3).length;
    const high = values.filter((row) => Number(row.fatigue || 0) >= 4).length;
    return { latest, values, low, medium, high };
  }, [wellness]);

  const attendanceModel = useMemo(() => {
    const confirmed = trainingAttendance.filter((row) => row.player_response === 'yes').length;
    const unavailable = trainingAttendance.filter((row) => row.player_response === 'no').length;
    const pending = Math.max(0, players.length - confirmed - unavailable);
    return { confirmed, unavailable, pending };
  }, [players.length, trainingAttendance]);

  const completedMatches = recentMatches.filter(completedMatch);
  const planReady = gamePlan?.status === 'published';
  const trainingCountdown = nextTraining ? daysUntil(nextTraining.starts_at) : null;
  const matchCountdown = nextMatch ? daysUntil(nextMatch.starts_at) : null;
  const trainingDate = nextTraining ? dateParts(nextTraining.starts_at) : null;
  const matchDate = nextMatch ? dateParts(nextMatch.starts_at) : null;
  const trainingPlan = nextTraining ? planLines(nextTraining) : [];

  return (
    <div className="coach-home">
      <section className="coach-home-identity">
        <span className="coach-home-season"><Trophy size={12} /> Temporada {seasonName}</span>
        <div className="coach-home-club-row">
          <img className="coach-home-club-logo" src={CLUB_LOGO} alt="CV Bunyola" />
          <div className="coach-home-club-copy">
            <h1>CV Bunyola</h1>
            <p>{team?.category || team?.name || 'Cadete Femenino 1ª División'}</p>
          </div>
        </div>
        <div className="coach-home-greeting">
          <small>{greetingForNow()}</small>
          <strong>{firstName}</strong>
          <span>{ROLE_LABELS[profile?.role] || 'Usuario'}</span>
        </div>
      </section>

      <header className="coach-home-section-head">
        <div>
          <small>Panel técnico</small>
          <h2>Lo importante, de un vistazo</h2>
          <p>Entrenos, competición, bienestar y carga del equipo.</p>
        </div>
      </header>

      {error ? <div className="coach-home-error">{error}</div> : null}

      <div className="coach-home-grid">
        {loading ? (
          <article className="coach-card coach-card-skeleton">Cargando próximo entrenamiento…</article>
        ) : nextTraining ? (
          <article className="coach-card coach-card-dark coach-card-pad">
            <div className="coach-card-top">
              <div>
                <span className="coach-card-kicker"><Dumbbell size={13} /> Próximo entrenamiento</span>
                <h3 className="coach-training-title">{nextTraining.title || 'Entrenamiento'}</h3>
              </div>
              {trainingCountdown !== null ? <span className="coach-countdown">{trainingCountdown === 0 ? 'Hoy' : `Dentro de ${trainingCountdown} día${trainingCountdown === 1 ? '' : 's'}`}</span> : null}
            </div>

            <div className="coach-event-meta">
              <span><CalendarDays size={13} /> {trainingDate?.weekday} · {trainingDate?.time}</span>
              {nextTraining.location ? <span><MapPin size={13} /> {nextTraining.location}</span> : null}
            </div>

            <div className="coach-plan-box">
              <small><Target size={13} /> Qué vamos a trabajar</small>
              <div className="coach-plan-list">
                {trainingPlan.length ? trainingPlan.map((line, index) => <span key={`${line}-${index}`}>{line}</span>) : <span>Sesión pendiente de detallar.</span>}
              </div>
            </div>

            <div className="coach-mini-stats">
              <span>{attendanceModel.confirmed} confirmadas</span>
              <span>{attendanceModel.pending} pendientes</span>
              <span>{eventDuration(nextTraining)} min</span>
            </div>

            <div className="coach-card-actions">
              <Link className="coach-action-primary" to="/training"><Activity size={15} /> Abrir sesión</Link>
              {isStaff ? <Link className="coach-action-secondary" to="/training"><ClipboardCheck size={15} /> Pasar lista</Link> : <Link className="coach-action-secondary" to="/training"><CheckCircle2 size={15} /> Mi asistencia</Link>}
            </div>
          </article>
        ) : (
          <article className="coach-card coach-card-skeleton">No hay entrenamientos próximos.</article>
        )}

        {loading ? (
          <article className="coach-card coach-card-skeleton">Cargando próximo partido…</article>
        ) : nextMatch ? (
          <article className="coach-card coach-match-card">
            <div className="coach-card-top">
              <span className="coach-card-kicker"><Trophy size={13} /> Próximo partido</span>
              {matchCountdown !== null ? <span className="coach-countdown">{matchCountdown === 0 ? 'Hoy' : `${matchCountdown} días`}</span> : null}
            </div>
            <div className="coach-match-main">
              <div className="coach-team-mark">
                <span><img src={CLUB_LOGO} alt="" /></span>
                <strong>CV Bunyola</strong>
              </div>
              <div className="coach-match-vs">VS</div>
              <div className="coach-team-mark">
                <span>{initials(opponentName(nextMatch))}</span>
                <strong>{opponentName(nextMatch)}</strong>
              </div>
            </div>
            <div className="coach-match-date">
              <strong>{matchDate?.weekday} · {matchDate?.time}</strong>
              <span>{nextMatch.location || 'Lugar por confirmar'}</span>
            </div>
            <div className="coach-status-pill">{planReady ? 'Plan de juego publicado' : 'Plan de juego pendiente'}</div>
            <Link className="coach-inline-link" to="/game-plan">Ver plan de juego <ChevronRight size={14} /></Link>
          </article>
        ) : (
          <article className="coach-card coach-card-skeleton">No hay partidos próximos.</article>
        )}

        <article className="coach-card coach-wellness-card">
          <div className="coach-wellness-head">
            <div>
              <span className="coach-card-kicker"><HeartPulse size={13} /> Próximos 7 días</span>
              <h3>Carga y bienestar</h3>
            </div>
            <HeartPulse size={22} color="#7b8798" />
          </div>
          <div className="coach-wellness-grid">
            <div className="coach-wellness-metric low"><strong>{wellnessModel.low}</strong><span>Fatiga baja</span></div>
            <div className="coach-wellness-metric medium"><strong>{wellnessModel.medium}</strong><span>Fatiga moderada</span></div>
            <div className="coach-wellness-metric high"><strong>{wellnessModel.high}</strong><span>Fatiga alta</span></div>
          </div>
          <div className="coach-wellness-foot">
            <span>{wellnessModel.values.length} respuestas recientes</span>
            <Link to="/wellness">Ver detalle <ChevronRight size={12} /></Link>
          </div>
        </article>

        <article className="coach-card coach-form-card">
          <span className="coach-card-kicker"><Sparkles size={13} /> En forma esta fase</span>
          <h3>Últimos partidos</h3>
          <div className="coach-form-line" />
          {completedMatches.length ? (
            <p>{completedMatches.slice(0, 3).map((event) => event.payload?.result).filter(Boolean).join(' · ')}</p>
          ) : (
            <p>La temporada todavía no ha comenzado.</p>
          )}
        </article>

        {isStaff ? (
          <article className="coach-card coach-load-card">
            <div className="coach-load-head">
              <div>
                <span className="coach-card-kicker"><Activity size={13} /> Carga del equipo</span>
                <h3>Seguimiento individual de carga</h3>
                <p>Volumen de los últimos 7 días calculado con sRPE × duración.</p>
              </div>
              <select className="coach-load-select" defaultValue="7d" aria-label="Periodo de carga">
                <option value="7d">Carga 7 días</option>
              </select>
            </div>
            <div className="coach-load-table-wrap">
              {workloadRows.length ? (
                <table className="coach-load-table">
                  <thead><tr><th>Jugadora</th><th>Carga 7 días</th><th>Estado</th></tr></thead>
                  <tbody>
                    {workloadRows.map((row) => {
                      const tone = loadTone(row.seven);
                      const name = playerName(row.player);
                      return (
                        <tr key={row.player.id}>
                          <td><div className="coach-load-player"><span className="coach-load-avatar">{initials(name)}</span><span><strong>{name}</strong><small>#{row.player.dorsal ?? '—'} · {row.player.position || 'Sin posición'}</small></span></div></td>
                          <td className="coach-load-value"><strong>{row.seven} UA</strong><small>{row.twentyEight} UA · 28 días</small></td>
                          <td><span className={`coach-load-state ${tone.key}`}>{tone.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="coach-load-empty">Aún no hay datos de RPE suficientes para mostrar carga.</div>}
            </div>
          </article>
        ) : (
          <article className="coach-card coach-wellness-card">
            <div className="coach-wellness-head">
              <div><span className="coach-card-kicker"><ShieldCheck size={13} /> Mi semana</span><h3>Tu seguimiento</h3></div>
              <ShieldCheck size={22} color="#7b8798" />
            </div>
            <div className="coach-card-actions">
              <Link className="coach-action-primary" to="/wellness"><HeartPulse size={15} /> Bienestar</Link>
              <Link className="coach-action-secondary" to="/training"><Clock3 size={15} /> Entrenos</Link>
            </div>
          </article>
        )}
      </div>
      <div className="coach-mobile-spacer" />
    </div>
  );
}
