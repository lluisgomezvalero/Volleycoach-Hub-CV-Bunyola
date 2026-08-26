import { useEffect, useMemo, useState } from 'react';
import {
  AlarmClock,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Dumbbell,
  MapPin,
  Plus,
  Save,
  Sparkles,
  UserCheck,
  UserMinus,
  UserRoundCheck,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './TrainingPage.css';

const STATUS = {
  present: { label: 'Presente', short: 'P', icon: UserRoundCheck },
  late: { label: 'Tarde', short: 'T', icon: AlarmClock },
  justified: { label: 'Justificada', short: 'J', icon: UserCheck },
  unjustified: { label: 'No justificada', short: 'N', icon: UserMinus }
};

function playerName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function playerInitials(player) {
  return playerName(player).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '—', weekday: '', full: '', time: '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    weekday: new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', ''),
    full: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(date),
    time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
  };
}

function durationMinutes(event) {
  if (event?.starts_at && event?.ends_at) {
    const minutes = Math.round((new Date(event.ends_at) - new Date(event.starts_at)) / 60000);
    if (Number.isFinite(minutes) && minutes > 0) return minutes;
  }
  const payload = Number(event?.payload?.duration);
  return Number.isFinite(payload) && payload > 0 ? Math.round(payload) : 90;
}

function attendanceCounts(rows = []) {
  return rows.reduce((acc, row) => {
    if (row.official_status && acc[row.official_status] !== undefined) acc[row.official_status] += 1;
    return acc;
  }, { present: 0, late: 0, justified: 0, unjustified: 0 });
}

function defaultTrainingForm() {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return {
    title: 'Entrenamiento',
    date: now.toISOString().slice(0, 10),
    time: '18:00',
    duration: 90,
    location: '',
    description: '',
    plan: ''
  };
}

export default function TrainingPage() {
  const { identity } = useAuth();
  const teams = identity?.teams || [];
  const isStaff = ['coach', 'administrator'].includes(identity?.profile?.role);
  const isPlayer = identity?.profile?.role === 'player';
  const [teamId, setTeamId] = useState(teams[0]?.id || identity?.player?.team_id || '');
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');
  const [selected, setSelected] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultTrainingForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [rollCall, setRollCall] = useState(null);
  const [rollLoading, setRollLoading] = useState(false);
  const [rollSaving, setRollSaving] = useState(false);
  const [rollError, setRollError] = useState('');
  const [rollSuccess, setRollSuccess] = useState('');
  const [rsvpSaving, setRsvpSaving] = useState(false);

  useEffect(() => {
    if (!teamId) {
      const fallback = teams[0]?.id || identity?.player?.team_id;
      if (fallback) setTeamId(fallback);
    }
  }, [identity?.player?.team_id, teamId, teams]);

  async function loadEvents() {
    if (!teamId) {
      setEvents([]);
      setAttendance([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: eventRows, error: eventsError } = await supabase
        .from('events')
        .select('id,club_id,team_id,season_id,title,starts_at,ends_at,location,status,payload,created_by')
        .eq('team_id', teamId)
        .eq('event_type', 'training')
        .order('starts_at', { ascending: false })
        .limit(80);
      if (eventsError) throw eventsError;
      const nextEvents = eventRows || [];
      setEvents(nextEvents);
      const ids = nextEvents.map((event) => event.id);
      if (!ids.length) {
        setAttendance([]);
      } else {
        const { data: attendanceRows, error: attendanceError } = await supabase
          .from('attendance')
          .select('event_id,player_id,player_response,official_status,effective_minutes,validated_at')
          .in('event_id', ids);
        if (attendanceError) throw attendanceError;
        setAttendance(attendanceRows || []);
      }
    } catch (loadError) {
      setError(loadError?.message || 'No se pudieron cargar los entrenamientos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEvents(); }, [teamId]);

  const now = Date.now();
  const upcoming = useMemo(() => events
    .filter((event) => new Date(event.starts_at).getTime() >= now - 3 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), [events, now]);
  const history = useMemo(() => events
    .filter((event) => new Date(event.starts_at).getTime() < now - 3 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)), [events, now]);
  const shown = tab === 'history' ? history : upcoming;
  const nextSession = upcoming[0] || null;
  const selectedTeam = teams.find((team) => team.id === teamId) || teams[0] || null;

  function eventAttendance(eventId) {
    return attendance.filter((row) => row.event_id === eventId);
  }

  function ownAttendance(eventId) {
    const playerId = identity?.player?.id;
    return playerId ? attendance.find((row) => row.event_id === eventId && row.player_id === playerId) : null;
  }

  async function createTraining() {
    if (!isStaff || !teamId) return;
    setCreating(true);
    setCreateError('');
    try {
      if (!createForm.date || !createForm.time) throw new Error('Indica fecha y hora.');
      const duration = Number(createForm.duration);
      if (!Number.isFinite(duration) || duration < 15 || duration > 300) throw new Error('La duración debe estar entre 15 y 300 minutos.');
      const starts = new Date(`${createForm.date}T${createForm.time}:00`);
      if (Number.isNaN(starts.getTime())) throw new Error('Fecha u hora no válidas.');
      const ends = new Date(starts.getTime() + duration * 60000);
      const payload = {
        type: 'Entrenamiento',
        time: createForm.time,
        duration,
        description: String(createForm.description || '').trim(),
        plan: String(createForm.plan || '').trim()
      };
      const { data, error: insertError } = await supabase
        .from('events')
        .insert({
          club_id: identity.profile.club_id,
          team_id: teamId,
          season_id: identity.season?.id || selectedTeam?.season_id || null,
          event_type: 'training',
          title: String(createForm.title || 'Entrenamiento').trim() || 'Entrenamiento',
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
          location: String(createForm.location || '').trim() || null,
          status: 'Próximo',
          payload,
          created_by: identity.profile.id
        })
        .select('id,club_id,team_id,season_id,title,starts_at,ends_at,location,status,payload,created_by')
        .single();
      if (insertError) throw insertError;
      setEvents((current) => [data, ...current]);
      setCreateOpen(false);
      setCreateForm(defaultTrainingForm());
      setTab('upcoming');
    } catch (saveError) {
      setCreateError(saveError?.message || 'No se pudo crear el entrenamiento.');
    } finally {
      setCreating(false);
    }
  }

  async function setRsvp(event, response) {
    if (!isPlayer || !identity?.player?.id) return;
    setRsvpSaving(true);
    try {
      const row = {
        event_id: event.id,
        player_id: identity.player.id,
        player_response: response,
        updated_at: new Date().toISOString()
      };
      const { data, error: rsvpError } = await supabase
        .from('attendance')
        .upsert(row, { onConflict: 'event_id,player_id' })
        .select('event_id,player_id,player_response,official_status,effective_minutes,validated_at')
        .single();
      if (rsvpError) throw rsvpError;
      setAttendance((current) => {
        const without = current.filter((item) => !(item.event_id === data.event_id && item.player_id === data.player_id));
        return [...without, data];
      });
    } catch (responseError) {
      setError(responseError?.message || 'No se pudo guardar tu respuesta.');
    } finally {
      setRsvpSaving(false);
    }
  }

  async function openRollCall(event) {
    if (!isStaff) return;
    setSelected(null);
    setRollLoading(true);
    setRollError('');
    setRollSuccess('');
    setRollCall({ event, players: [], statuses: {}, responses: {} });
    try {
      const [{ data: players, error: playersError }, { data: existing, error: existingError }] = await Promise.all([
        supabase
          .from('players')
          .select('id,legacy_id,dorsal,position,status,active,profiles:profile_id(username,full_name)')
          .eq('team_id', event.team_id)
          .eq('active', true)
          .order('dorsal', { ascending: true, nullsFirst: false }),
        supabase
          .from('attendance')
          .select('event_id,player_id,player_response,official_status,effective_minutes,validated_at')
          .eq('event_id', event.id)
      ]);
      if (playersError) throw playersError;
      if (existingError) throw existingError;
      const existingMap = new Map((existing || []).map((row) => [row.player_id, row]));
      const statuses = {};
      const responses = {};
      (players || []).forEach((player) => {
        const row = existingMap.get(player.id);
        statuses[player.id] = {
          status: row?.official_status || '',
          minutes: row?.effective_minutes ?? ''
        };
        responses[player.id] = row?.player_response || null;
      });
      setRollCall({ event, players: players || [], statuses, responses });
    } catch (rollLoadError) {
      setRollError(rollLoadError?.message || 'No se pudo preparar la lista.');
    } finally {
      setRollLoading(false);
    }
  }

  function patchRoll(playerId, patch) {
    setRollSuccess('');
    setRollCall((current) => current ? {
      ...current,
      statuses: { ...current.statuses, [playerId]: { ...current.statuses[playerId], ...patch } }
    } : current);
  }

  function allPresent() {
    setRollSuccess('');
    setRollCall((current) => {
      if (!current) return current;
      const statuses = { ...current.statuses };
      current.players.forEach((player) => { statuses[player.id] = { status: 'present', minutes: '' }; });
      return { ...current, statuses };
    });
  }

  async function saveRollCall() {
    if (!rollCall || rollSaving) return;
    setRollSaving(true);
    setRollError('');
    setRollSuccess('');
    try {
      const duration = durationMinutes(rollCall.event);
      const nowIso = new Date().toISOString();
      const rows = rollCall.players.map((player) => {
        const entry = rollCall.statuses[player.id] || { status: '', minutes: '' };
        const status = entry.status || null;
        let effectiveMinutes = null;
        if (status === 'late') {
          const minutes = Number(entry.minutes);
          if (!Number.isFinite(minutes) || minutes <= 0) throw new Error(`Indica los minutos realizados por ${playerName(player)}.`);
          if (minutes > duration) throw new Error(`${playerName(player)} no puede superar ${duration} min.`);
          effectiveMinutes = Math.round(minutes);
        }
        return {
          event_id: rollCall.event.id,
          player_id: player.id,
          official_status: status,
          effective_minutes: effectiveMinutes,
          validated_by: status ? identity.profile.id : null,
          validated_at: status ? nowIso : null,
          updated_at: nowIso
        };
      });
      const { data, error: saveError } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'event_id,player_id' })
        .select('event_id,player_id,player_response,official_status,effective_minutes,validated_at');
      if (saveError) throw saveError;
      const saved = data || [];
      setAttendance((current) => {
        const ids = new Set(saved.map((row) => `${row.event_id}:${row.player_id}`));
        return [...current.filter((row) => !ids.has(`${row.event_id}:${row.player_id}`)), ...saved];
      });
      const counts = attendanceCounts(saved);
      setRollSuccess(`Lista guardada · ${counts.present} presentes · ${counts.late} tarde · ${counts.justified} justificadas · ${counts.unjustified} no justificadas.`);
    } catch (saveError) {
      setRollError(saveError?.message || 'No se pudo guardar la lista.');
    } finally {
      setRollSaving(false);
    }
  }

  function SessionRow({ event, featured = false }) {
    const parts = dateParts(event.starts_at);
    const counts = attendanceCounts(eventAttendance(event.id));
    const own = ownAttendance(event.id);
    return (
      <button className={`training-session-card${featured ? ' featured' : ''}`} type="button" onClick={() => setSelected(event)}>
        <span className="training-date-block"><b>{parts.day}</b><small>{parts.weekday}</small></span>
        <span className="training-session-main">
          <span className="training-session-kicker">{parts.full}</span>
          <strong>{event.title || 'Entrenamiento'}</strong>
          <small><Clock3 size={14} /> {parts.time} · {durationMinutes(event)} min {event.location ? <><MapPin size={14} /> {event.location}</> : null}</small>
        </span>
        <span className="training-session-side">
          {isStaff ? <span className="attendance-mini"><UserCheck size={15} /> {counts.present + counts.late}/{Math.max(counts.present + counts.late + counts.justified + counts.unjustified, 0)}</span> : null}
          {isPlayer && own?.player_response ? <span className={`rsvp-mini ${own.player_response}`}>{own.player_response === 'yes' ? 'Asistiré' : 'No podré'}</span> : null}
          <ChevronRight size={18} />
        </span>
      </button>
    );
  }

  return (
    <div className="training-page">
      <section className="training-hero">
        <div>
          <p className="eyebrow">Entrenamientos · {identity?.season?.name || 'Temporada actual'}</p>
          <h1>{selectedTeam?.name || 'CV Bunyola'}</h1>
          <p>{selectedTeam?.category || 'Equipo'} · sesiones, asistencia y seguimiento</p>
        </div>
        <div className="training-hero-mark"><Dumbbell size={24} /><strong>{events.length}</strong><span>sesiones</span></div>
      </section>

      <section className="training-toolbar surface-card">
        <div className="training-toolbar-row">
          <div className="training-tabs">
            <button className={tab === 'upcoming' ? 'active' : ''} type="button" onClick={() => setTab('upcoming')}><Sparkles size={16} /> Próximos <span>{upcoming.length}</span></button>
            <button className={tab === 'history' ? 'active' : ''} type="button" onClick={() => setTab('history')}><CalendarDays size={16} /> Historial <span>{history.length}</span></button>
          </div>
          {isStaff ? <button className="primary-button training-new" type="button" onClick={() => { setCreateError(''); setCreateForm(defaultTrainingForm()); setCreateOpen(true); }}><Plus size={17} /> Nueva sesión</button> : null}
        </div>
        {teams.length > 1 ? (
          <label className="training-team-select"><span>Equipo</span><select value={teamId} onChange={(event) => setTeamId(event.target.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        ) : null}
      </section>

      {loading ? <div className="training-state">Cargando entrenamientos…</div> : null}
      {error ? <div className="training-state error"><CircleAlert size={18} /> {error}</div> : null}

      {!loading && !error ? (
        <>
          {tab === 'upcoming' && nextSession ? (
            <section className="training-next-block">
              <div className="training-section-title"><div><p className="eyebrow">Siguiente sesión</p><h2>Lo próximo del equipo</h2></div><span>Abre la ficha para consultar o pasar lista</span></div>
              <SessionRow event={nextSession} featured />
            </section>
          ) : null}

          <section className="training-list-block">
            <div className="training-section-title"><div><p className="eyebrow">{tab === 'history' ? 'Sesiones realizadas' : 'Agenda'}</p><h2>{tab === 'history' ? 'Historial de entrenos' : 'Próximos entrenamientos'}</h2></div></div>
            <div className="training-session-list">
              {(tab === 'upcoming' && nextSession ? shown.filter((event) => event.id !== nextSession.id) : shown).map((event) => <SessionRow key={event.id} event={event} />)}
            </div>
            {!shown.length ? <div className="training-empty">No hay entrenamientos en esta vista.</div> : null}
          </section>
        </>
      ) : null}

      {selected ? (
        <div className="training-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="training-detail" role="dialog" aria-modal="true">
            <header className="training-detail-header">
              <div><p className="eyebrow">Ficha de sesión</p><h2>{selected.title || 'Entrenamiento'}</h2><span>{dateParts(selected.starts_at).full}</span></div>
              <button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Cerrar"><X /></button>
            </header>
            <div className="training-detail-body">
              <div className="training-detail-facts">
                <div><Clock3 size={18} /><span>Hora</span><strong>{dateParts(selected.starts_at).time}</strong></div>
                <div><Dumbbell size={18} /><span>Duración</span><strong>{durationMinutes(selected)} min</strong></div>
                <div><MapPin size={18} /><span>Lugar</span><strong>{selected.location || 'Sin indicar'}</strong></div>
              </div>
              {selected.payload?.description ? <div className="training-copy-card"><span>Objetivo / descripción</span><p>{selected.payload.description}</p></div> : null}
              {selected.payload?.plan ? <div className="training-copy-card"><span>Plan de sesión</span><p>{selected.payload.plan}</p></div> : null}

              {isStaff ? (
                <div className="training-attendance-summary">
                  <div><p className="eyebrow">Asistencia</p><h3>Estado de la sesión</h3></div>
                  <div className="training-count-grid">
                    {Object.entries(STATUS).map(([key, meta]) => <span key={key} className={`count-${key}`}><b>{attendanceCounts(eventAttendance(selected.id))[key]}</b><small>{meta.label}</small></span>)}
                  </div>
                  <button className="primary-button roll-call-launch" type="button" onClick={() => void openRollCall(selected)}><Users size={18} /> Pasar lista</button>
                </div>
              ) : null}

              {isPlayer ? (
                <div className="training-rsvp-card">
                  <div><p className="eyebrow">Confirmación previa</p><h3>¿Asistirás?</h3></div>
                  <div className="training-rsvp-actions">
                    <button className={ownAttendance(selected.id)?.player_response === 'yes' ? 'active yes' : ''} type="button" disabled={rsvpSaving} onClick={() => void setRsvp(selected, 'yes')}><Check size={17} /> Sí, asistiré</button>
                    <button className={ownAttendance(selected.id)?.player_response === 'no' ? 'active no' : ''} type="button" disabled={rsvpSaving} onClick={() => void setRsvp(selected, 'no')}><X size={17} /> No podré</button>
                  </div>
                  {ownAttendance(selected.id)?.official_status ? <p className="official-player-status">Asistencia oficial: <strong>{STATUS[ownAttendance(selected.id).official_status]?.label || ownAttendance(selected.id).official_status}</strong></p> : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {createOpen ? (
        <div className="training-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <section className="training-create-modal" role="dialog" aria-modal="true">
            <header className="training-detail-header"><div><p className="eyebrow">Nueva sesión</p><h2>Crear entrenamiento</h2><span>{selectedTeam?.name || 'Equipo'}</span></div><button className="icon-button" onClick={() => setCreateOpen(false)} aria-label="Cerrar"><X /></button></header>
            <div className="training-create-body">
              <div className="training-form-grid">
                <label className="wide"><span>Título</span><input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label><span>Fecha</span><input type="date" value={createForm.date} onChange={(event) => setCreateForm((current) => ({ ...current, date: event.target.value }))} /></label>
                <label><span>Hora</span><input type="time" value={createForm.time} onChange={(event) => setCreateForm((current) => ({ ...current, time: event.target.value }))} /></label>
                <label><span>Duración (min)</span><input type="number" min="15" max="300" step="5" value={createForm.duration} onChange={(event) => setCreateForm((current) => ({ ...current, duration: event.target.value }))} /></label>
                <label><span>Lugar</span><input value={createForm.location} onChange={(event) => setCreateForm((current) => ({ ...current, location: event.target.value }))} placeholder="Pabellón / pista" /></label>
                <label className="wide"><span>Objetivo / descripción</span><textarea rows="3" value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <label className="wide"><span>Plan de sesión</span><textarea rows="5" value={createForm.plan} onChange={(event) => setCreateForm((current) => ({ ...current, plan: event.target.value }))} placeholder="Bloques, tareas, objetivos…" /></label>
              </div>
              {createError ? <p className="form-error">{createError}</p> : null}
              <div className="training-modal-actions"><button className="secondary-button" type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary-button" type="button" disabled={creating} onClick={() => void createTraining()}><Save size={17} /> {creating ? 'Creando…' : 'Crear sesión'}</button></div>
            </div>
          </section>
        </div>
      ) : null}

      {rollCall ? (
        <div className="training-modal-backdrop rollcall-backdrop">
          <section className="rollcall-modal" role="dialog" aria-modal="true">
            <header className="rollcall-header">
              <div><p className="eyebrow">Pasar lista</p><h2>{rollCall.event.title || 'Entrenamiento'}</h2><span>{dateParts(rollCall.event.starts_at).full} · {dateParts(rollCall.event.starts_at).time} · {durationMinutes(rollCall.event)} min</span></div>
              <button className="icon-button" type="button" onClick={() => setRollCall(null)} aria-label="Cerrar lista"><X /></button>
            </header>
            <div className="rollcall-toolbar">
              <span><Users size={17} /> {rollCall.players.length} jugadoras</span>
              <button type="button" onClick={allPresent} disabled={rollLoading || !rollCall.players.length}><Check size={16} /> Todas presentes</button>
            </div>
            <div className="rollcall-body">
              {rollLoading ? <div className="rollcall-loading">Preparando lista…</div> : null}
              {!rollLoading ? rollCall.players.map((player) => {
                const entry = rollCall.statuses[player.id] || { status: '', minutes: '' };
                const response = rollCall.responses[player.id];
                return (
                  <article className="rollcall-player" key={player.id}>
                    <div className="rollcall-player-id"><span className="rollcall-avatar">{playerInitials(player)}</span><span><strong>{playerName(player)}</strong><small>{player.dorsal != null ? `#${player.dorsal}` : 'Sin dorsal'} · {player.position || 'Sin posición'} {response ? `· ${response === 'yes' ? 'Confirmó que asistirá' : 'Avisó que no podrá'}` : ''}</small></span></div>
                    <div className="rollcall-statuses">
                      {Object.entries(STATUS).map(([key, meta]) => {
                        const Icon = meta.icon;
                        return <button key={key} className={`${key}${entry.status === key ? ' active' : ''}`} type="button" onClick={() => patchRoll(player.id, { status: entry.status === key ? '' : key, minutes: key === 'late' ? entry.minutes : '' })}><Icon size={15} /><span>{meta.label}</span><b>{meta.short}</b></button>;
                      })}
                    </div>
                    {entry.status === 'late' ? <label className="late-minutes"><span>Minutos realizados</span><input type="number" inputMode="numeric" min="1" max={durationMinutes(rollCall.event)} value={entry.minutes} onChange={(event) => patchRoll(player.id, { minutes: event.target.value })} /><small>de {durationMinutes(rollCall.event)} min</small></label> : null}
                  </article>
                );
              }) : null}
            </div>
            <footer className="rollcall-footer">
              <div className="rollcall-message">{rollError ? <span className="error"><CircleAlert size={16} /> {rollError}</span> : null}{rollSuccess ? <span className="success"><Check size={16} /> {rollSuccess}</span> : null}</div>
              <div className="rollcall-actions"><button className="secondary-button" type="button" onClick={() => setRollCall(null)}>Cerrar</button><button className="primary-button" type="button" disabled={rollSaving || rollLoading} onClick={() => void saveRollCall()}><Save size={17} /> {rollSaving ? 'Guardando…' : 'Guardar lista'}</button></div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
