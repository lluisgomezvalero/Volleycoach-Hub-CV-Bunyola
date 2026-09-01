import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlarmClock,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Dumbbell,
  MapPin,
  MessageSquare,
  NotebookPen,
  Plus,
  Save,
  Sparkles,
  Target,
  UserCheck,
  UserMinus,
  UserRoundCheck,
  Users,
  UsersRound,
  X
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import TeamAttendancePanel from './TeamAttendancePanel.jsx';
import './TrainingPageProfessional.css';

const STATUS = {
  present: { label: 'Presente', short: 'P', icon: UserRoundCheck },
  late: { label: 'Tarde', short: 'T', icon: AlarmClock },
  justified: { label: 'Justificada', short: 'J', icon: UserCheck },
  unjustified: { label: 'No justificada', short: 'X', icon: UserMinus }
};

function playerName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function initials(value) {
  return String(value || 'J').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '—', weekday: '', full: '', time: '', compact: '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    weekday: new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', ''),
    full: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date),
    compact: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(date)
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

function eventEndTime(event) {
  const explicitEnd = event?.ends_at ? new Date(event.ends_at).getTime() : Number.NaN;
  if (Number.isFinite(explicitEnd)) return explicitEnd;
  const start = event?.starts_at ? new Date(event.starts_at).getTime() : Number.NaN;
  return Number.isFinite(start) ? start + durationMinutes(event) * 60 * 1000 : Number.NaN;
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

function RpeScale({ value, onChange, disabled = false }) {
  const labels = ['Muy suave', 'Muy suave', 'Suave', 'Suave', 'Moderado', 'Moderado', 'Intenso', 'Intenso', 'Muy intenso', 'Muy intenso', 'Máximo'];
  return (
    <div className="pro-rpe-scale">
      <div className="pro-rpe-value-row"><strong>{value}</strong><span>{labels[value] || 'Moderado'}</span></div>
      <input type="range" min="0" max="10" step="1" value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="pro-rpe-ticks"><span>0</span><span>5</span><span>10</span></div>
    </div>
  );
}

function SectionHeader({ number, kicker, title, tone = 'gold' }) {
  return (
    <div className={`pro-session-section-head tone-${tone}`}>
      <span className="pro-session-number">{String(number).padStart(2, '0')}</span>
      <span><small>{kicker}</small><strong>{title}</strong></span>
    </div>
  );
}

function SessionDetail({ event, identity, attendanceRows, onBack, onRollCall, onRsvp, rsvpSaving }) {
  const isStaff = ['coach', 'administrator'].includes(identity?.profile?.role);
  const isPlayer = identity?.profile?.role === 'player';
  const [timeNow, setTimeNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setTimeNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [event.id]);
  const endTime = eventEndTime(event);
  const completed = Number.isFinite(endTime) && timeNow >= endTime;
  const rpeAvailable = Number.isFinite(endTime) && timeNow >= endTime + 30 * 60 * 1000;
  const parts = dateParts(event.starts_at);
  const counts = attendanceCounts(attendanceRows);
  const validated = counts.present + counts.late + counts.justified + counts.unjustified;
  const absent = counts.justified + counts.unjustified;
  const ownAttendance = isPlayer ? attendanceRows.find((row) => row.player_id === identity?.player?.id) : null;

  const [loadingExtras, setLoadingExtras] = useState(true);
  const [extrasError, setExtrasError] = useState('');
  const [rpeRows, setRpeRows] = useState([]);
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [rpeValue, setRpeValue] = useState(5);
  const [rpeSaving, setRpeSaving] = useState(false);
  const [rpeSaved, setRpeSaved] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentSaved, setCommentSaved] = useState('');
  const [assessment, setAssessment] = useState('');
  const [continuity, setContinuity] = useState('');
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachSaved, setCoachSaved] = useState('');

  useEffect(() => {
    let active = true;
    async function loadExtras() {
      setLoadingExtras(true);
      setExtrasError('');
      try {
        const requests = [
          supabase.from('rpe_entries').select('id,event_id,player_id,coach_profile_id,score,source,created_at,updated_at').eq('event_id', event.id),
          supabase.from('session_feedback').select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').eq('event_id', event.id)
        ];
        if (isStaff) {
          requests.push(
            supabase.from('players').select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)').eq('team_id', event.team_id).eq('active', true)
          );
        }
        const results = await Promise.all(requests);
        if (results[0].error) throw results[0].error;
        if (results[1].error) throw results[1].error;
        if (results[2]?.error) throw results[2].error;
        if (!active) return;
        const nextRpe = results[0].data || [];
        const nextFeedback = results[1].data || [];
        const nextPlayers = results[2]?.data || [];
        setRpeRows(nextRpe);
        setFeedbackRows(nextFeedback);
        setTeamPlayers(nextPlayers);

        const ownRpe = isStaff
          ? nextRpe.find((row) => row.source === 'coach' && row.coach_profile_id === identity.profile.id)
          : nextRpe.find((row) => row.player_id === identity?.player?.id && row.source === 'player');
        if (ownRpe) setRpeValue(Math.round(Number(ownRpe.score)));

        if (isPlayer) {
          const ownComment = nextFeedback.find((row) => row.kind === 'player_comment' && row.player_id === identity?.player?.id);
          if (ownComment?.comment_text) setCommentText(ownComment.comment_text);
        }
        if (isStaff) {
          const ownCoachFeedback = nextFeedback.find((row) => row.kind === 'coach_assessment' && row.coach_profile_id === identity.profile.id)
            || nextFeedback.find((row) => row.kind === 'coach_assessment');
          if (ownCoachFeedback) {
            setAssessment(ownCoachFeedback.assessment || '');
            setContinuity(ownCoachFeedback.continuity_notes || '');
          }
        }
      } catch (error) {
        if (active) setExtrasError(error?.message || 'No se pudo cargar el seguimiento de la sesión.');
      } finally {
        if (active) setLoadingExtras(false);
      }
    }
    void loadExtras();
    return () => { active = false; };
  }, [event.id, event.team_id, identity?.player?.id, identity?.profile?.id, isPlayer, isStaff]);

  const playerRpes = useMemo(() => rpeRows.filter((row) => row.source === 'player' && row.player_id), [rpeRows]);
  const playerMean = playerRpes.length ? playerRpes.reduce((sum, row) => sum + Number(row.score || 0), 0) / playerRpes.length : null;
  const coachRpe = rpeRows.find((row) => row.source === 'coach' && row.coach_profile_id === identity?.profile?.id);
  const coachScore = coachRpe ? Number(coachRpe.score) : null;
  const rpeGap = coachScore !== null && playerMean !== null ? coachScore - playerMean : null;
  const playerMap = useMemo(() => new Map(teamPlayers.map((player) => [player.id, player])), [teamPlayers]);
  const playerComments = feedbackRows.filter((row) => row.kind === 'player_comment' && String(row.comment_text || '').trim());

  async function saveRpe() {
    if (!rpeAvailable) return;
    setRpeSaving(true);
    setRpeSaved('');
    setExtrasError('');
    try {
      if (isPlayer) {
        const existing = rpeRows.find((row) => row.player_id === identity?.player?.id && row.source === 'player');
        const payload = { score: rpeValue, updated_at: new Date().toISOString() };
        let result;
        if (existing) result = await supabase.from('rpe_entries').update(payload).eq('id', existing.id).select('id,event_id,player_id,coach_profile_id,score,source,created_at,updated_at').single();
        else result = await supabase.from('rpe_entries').insert({ event_id: event.id, player_id: identity.player.id, coach_profile_id: null, score: rpeValue, source: 'player' }).select('id,event_id,player_id,coach_profile_id,score,source,created_at,updated_at').single();
        if (result.error) throw result.error;
        setRpeRows((rows) => [...rows.filter((row) => row.id !== result.data.id && !(row.player_id === identity.player.id && row.source === 'player')), result.data]);
      } else if (isStaff) {
        const existing = rpeRows.find((row) => row.source === 'coach' && row.coach_profile_id === identity.profile.id);
        const payload = { score: rpeValue, updated_at: new Date().toISOString() };
        let result;
        if (existing) result = await supabase.from('rpe_entries').update(payload).eq('id', existing.id).select('id,event_id,player_id,coach_profile_id,score,source,created_at,updated_at').single();
        else result = await supabase.from('rpe_entries').insert({ event_id: event.id, player_id: null, coach_profile_id: identity.profile.id, score: rpeValue, source: 'coach' }).select('id,event_id,player_id,coach_profile_id,score,source,created_at,updated_at').single();
        if (result.error) throw result.error;
        setRpeRows((rows) => [...rows.filter((row) => row.id !== result.data.id && !(row.source === 'coach' && row.coach_profile_id === identity.profile.id)), result.data]);
      }
      setRpeSaved('RPE guardado');
    } catch (error) {
      setExtrasError(error?.message || 'No se pudo guardar el RPE.');
    } finally {
      setRpeSaving(false);
    }
  }

  async function savePlayerComment() {
    if (!isPlayer || !identity?.player?.id || !completed) return;
    setCommentSaving(true);
    setCommentSaved('');
    setExtrasError('');
    try {
      const text = commentText.trim();
      const existing = feedbackRows.find((row) => row.kind === 'player_comment' && row.player_id === identity.player.id);
      const payload = { comment_text: text, updated_at: new Date().toISOString() };
      let result;
      if (existing) result = await supabase.from('session_feedback').update(payload).eq('id', existing.id).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      else result = await supabase.from('session_feedback').insert({ event_id: event.id, player_id: identity.player.id, coach_profile_id: null, kind: 'player_comment', comment_text: text }).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      if (result.error) throw result.error;
      setFeedbackRows((rows) => [...rows.filter((row) => row.id !== result.data.id && !(row.kind === 'player_comment' && row.player_id === identity.player.id)), result.data]);
      setCommentSaved('Comentario enviado');
    } catch (error) {
      setExtrasError(error?.message || 'No se pudo guardar el comentario.');
    } finally {
      setCommentSaving(false);
    }
  }

  async function saveCoachAssessment() {
    if (!isStaff || !completed) return;
    setCoachSaving(true);
    setCoachSaved('');
    setExtrasError('');
    try {
      const existing = feedbackRows.find((row) => row.kind === 'coach_assessment' && row.coach_profile_id === identity.profile.id);
      const payload = { assessment: assessment.trim(), continuity_notes: continuity.trim(), updated_at: new Date().toISOString() };
      let result;
      if (existing) result = await supabase.from('session_feedback').update(payload).eq('id', existing.id).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      else result = await supabase.from('session_feedback').insert({ event_id: event.id, player_id: null, coach_profile_id: identity.profile.id, kind: 'coach_assessment', assessment: assessment.trim(), continuity_notes: continuity.trim() }).select('id,event_id,player_id,coach_profile_id,kind,comment_text,assessment,continuity_notes,created_at,updated_at').single();
      if (result.error) throw result.error;
      setFeedbackRows((rows) => [...rows.filter((row) => row.id !== result.data.id && !(row.kind === 'coach_assessment' && row.coach_profile_id === identity.profile.id)), result.data]);
      setCoachSaved('Valoración guardada');
    } catch (error) {
      setExtrasError(error?.message || 'No se pudo guardar la valoración.');
    } finally {
      setCoachSaving(false);
    }
  }

  return (
    <div className="pro-session-page">
      <button className="pro-session-back" type="button" onClick={onBack}><ArrowLeft size={18} /> Volver a entrenos</button>

      <article className="pro-session-hero-card">
        <div className={`pro-session-status ${completed ? 'completed' : 'upcoming'}`}>{completed ? 'Sesión finalizada' : 'Próxima sesión'}</div>
        <h1>{event.title || 'Entrenamiento'}</h1>
        <p>{parts.full} · {parts.time}{event.location ? ` · ${event.location}` : ''} · {durationMinutes(event)} min</p>
      </article>

      <SectionHeader number={1} kicker="Antes de empezar" title="Preparación" tone="gold" />
      <article className="pro-session-panel tone-gold">
        <div className="pro-panel-title"><Target size={19} /><span><small>Plan de trabajo</small><strong>Objetivos y contenido</strong></span></div>
        {event.payload?.description ? <p className="pro-session-description">{event.payload.description}</p> : null}
        {event.payload?.plan ? <div className="pro-plan-copy">{String(event.payload.plan).split(/\n+/).filter(Boolean).map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div> : <p className="pro-muted-copy">Sin contenido detallado para esta sesión.</p>}
      </article>

      <SectionHeader number={2} kicker="Participación" title="Asistencia" tone="blue" />
      <article className="pro-session-panel tone-blue">
        <div className="pro-panel-title"><Users size={19} /><span><small>Asistencia oficial</small><strong>Asistencia</strong></span></div>
        {isStaff ? (
          <>
            <div className="pro-attendance-kpis">
              <div><strong>{counts.present + counts.late}</strong><span>Presentes</span></div>
              <div><strong>{absent}</strong><span>Ausencias</span></div>
              <div><strong>{validated}</strong><span>Validadas</span></div>
            </div>
            <p className="pro-panel-note">La asistencia oficial es la que cuenta para el seguimiento del equipo y la carga.</p>
            <button className="pro-outline-action" type="button" onClick={() => onRollCall(event)}><ClipboardCheck size={18} /> {validated ? 'Revisar asistencia' : 'Pasar lista'}</button>
          </>
        ) : (
          <>
            {completed ? (
              <div className={`pro-player-attendance ${ownAttendance?.official_status || 'empty'}`}>
                <span>Estado oficial</span><strong>{STATUS[ownAttendance?.official_status]?.label || 'Sin validar'}</strong>
              </div>
            ) : (
              <div className="pro-rsvp-card">
                <span>Confirmación previa</span><strong>¿Asistirás a esta sesión?</strong>
                <div>
                  <button className={ownAttendance?.player_response === 'yes' ? 'active yes' : ''} type="button" disabled={rsvpSaving} onClick={() => onRsvp(event, 'yes')}><Check size={16} /> Sí, asistiré</button>
                  <button className={ownAttendance?.player_response === 'no' ? 'active no' : ''} type="button" disabled={rsvpSaving} onClick={() => onRsvp(event, 'no')}><X size={16} /> No podré</button>
                </div>
              </div>
            )}
          </>
        )}
      </article>

      <SectionHeader number={3} kicker="Al terminar" title="Después de la sesión" tone="orange" />
      <article className="pro-session-panel tone-orange pro-rpe-panel">
        <div className="pro-panel-title pro-rpe-title"><Activity size={19} /><span><small>Percepción del esfuerzo</small><strong>Percepción del esfuerzo</strong></span></div>
        {!rpeAvailable ? <p className="pro-muted-copy">El RPE se habilitará 30 minutos después de finalizar la sesión.</p> : null}
        {rpeAvailable && loadingExtras ? <p className="pro-muted-copy">Cargando seguimiento…</p> : null}
        {rpeAvailable && !loadingExtras ? (
          <>
            {isStaff ? (
              <>
                <div className="pro-rpe-comparison">
                  <div className="pro-rpe-summary-card coach">
                    <span>Entrenador</span>
                    <strong>{coachScore === null ? '—' : coachScore.toFixed(0)}</strong>
                    <div className="pro-rpe-meter" aria-hidden="true"><i style={{ width: `${coachScore === null ? 0 : Math.max(0, Math.min(100, coachScore * 10))}%` }} /></div>
                    <small>{coachScore === null ? 'Sin responder' : 'RPE registrado'}</small>
                  </div>
                  <div className="pro-rpe-summary-card players">
                    <span>Media jugadoras</span>
                    <strong>{playerMean === null ? '—' : playerMean.toFixed(1)}</strong>
                    <div className="pro-rpe-meter" aria-hidden="true"><i style={{ width: `${playerMean === null ? 0 : Math.max(0, Math.min(100, playerMean * 10))}%` }} /></div>
                    <small>{playerRpes.length} respuesta{playerRpes.length === 1 ? '' : 's'}</small>
                  </div>
                </div>
                <div className={`pro-rpe-insight ${rpeGap === null ? 'pending' : Math.abs(rpeGap) <= 1 ? 'aligned' : 'different'}`}>
                  {rpeGap === null
                    ? 'Faltan valoraciones para comparar.'
                    : Math.abs(rpeGap) <= 1
                      ? `Percepción bastante alineada · diferencia ${Math.abs(rpeGap).toFixed(1)}`
                      : `Diferencia de percepción de ${Math.abs(rpeGap).toFixed(1)} puntos.`}
                </div>
              </>
            ) : null}
            {isStaff && coachRpe ? (
              <div className="pro-rpe-locked">
                <Check size={18} />
                <span><strong>RPE previsto registrado</strong><small>Este valor queda cerrado y ya no puede modificarse.</small></span>
              </div>
            ) : (
              <>
                <RpeScale value={rpeValue} onChange={setRpeValue} disabled={rpeSaving} />
                <button className="pro-primary-action" type="button" onClick={() => void saveRpe()} disabled={rpeSaving}><Save size={17} /> {rpeSaving ? 'Guardando…' : isStaff ? 'Guardar RPE' : 'Guardar mi RPE'}</button>
                {rpeSaved ? <p className="pro-success-copy"><Check size={15} /> {rpeSaved}</p> : null}
              </>
            )}
          </>
        ) : null}
      </article>

      {completed && isStaff ? (
        <>
          <article className="pro-session-panel tone-slate pro-coach-review-panel">
            <div className="pro-panel-title"><NotebookPen size={19} /><span><small>Solo cuerpo técnico</small><strong>Valoración y continuidad</strong></span></div>
            <label className="pro-field"><span>Valoración del entrenamiento</span><textarea rows="4" value={assessment} onChange={(event) => setAssessment(event.target.value)} placeholder="Qué funcionó, qué no y cómo respondió el equipo…" /></label>
            <label className="pro-field"><span>Notas para la próxima sesión</span><textarea rows="4" value={continuity} onChange={(event) => setContinuity(event.target.value)} placeholder="Ajustes, incidencias o ideas para continuar…" /></label>
            <button className="pro-secondary-action" type="button" disabled={coachSaving} onClick={() => void saveCoachAssessment()}><Save size={17} /> {coachSaving ? 'Guardando…' : 'Guardar valoración'}</button>
            {coachSaved ? <p className="pro-success-copy"><Check size={15} /> {coachSaved}</p> : null}
          </article>

          <article className="pro-session-panel tone-violet pro-feedback-panel">
            <div className="pro-panel-title"><MessageSquare size={19} /><span><small>Feedback del equipo</small><strong>Comentarios de jugadoras</strong></span></div>
            {playerComments.length ? (
              <div className="pro-player-comments">
                {playerComments.map((row) => {
                  const player = playerMap.get(row.player_id);
                  const name = playerName(player);
                  return <div key={row.id}><span className="pro-comment-avatar">{initials(name)}</span><span><strong>{name}</strong><p>{row.comment_text}</p></span></div>;
                })}
              </div>
            ) : <p className="pro-muted-copy">Aún no hay comentarios de jugadoras.</p>}
          </article>
        </>
      ) : null}

      {completed && isPlayer ? (
        <article className="pro-session-panel tone-violet">
          <div className="pro-panel-title"><MessageSquare size={19} /><span><small>Opcional y privado</small><strong>Mi comentario</strong></span></div>
          <p className="pro-panel-note">Puedes dejar una sensación, incidencia o comentario para el cuerpo técnico.</p>
          <label className="pro-field"><textarea rows="4" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="¿Cómo te has sentido? ¿Hay algo que quieras comentar?" /></label>
          <button className="pro-secondary-action" type="button" disabled={commentSaving} onClick={() => void savePlayerComment()}><MessageSquare size={17} /> {commentSaving ? 'Enviando…' : 'Guardar comentario'}</button>
          {commentSaved ? <p className="pro-success-copy"><Check size={15} /> {commentSaved}</p> : null}
        </article>
      ) : null}

      {extrasError ? <div className="pro-session-error"><CircleAlert size={17} /> {extrasError}</div> : null}
    </div>
  );
}

export default function TrainingPageProfessional() {
  const { identity } = useAuth();
  const location = useLocation();
  const deepLinkHandled = useRef('');
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
      if (!ids.length) setAttendance([]);
      else {
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

  useEffect(() => {
    if (loading || !events.length) return;
    const params = new URLSearchParams(location.search);
    const eventId = params.get('event');
    const mode = params.get('mode') || 'session';
    if (!eventId) return;
    const key = `${eventId}:${mode}`;
    if (deepLinkHandled.current === key) return;
    const target = events.find((event) => event.id === eventId);
    if (!target) {
      deepLinkHandled.current = key;
      setError('No se encontró el entrenamiento solicitado.');
      return;
    }
    deepLinkHandled.current = key;
    if (mode === 'attendance' && isStaff) {
      void openRollCall(target);
      return;
    }
    setSelected(target);
  }, [events, isStaff, loading, location.search]);

  const now = Date.now();
  const upcoming = useMemo(() => events.filter((event) => new Date(event.starts_at).getTime() >= now - 3 * 60 * 60 * 1000).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), [events, now]);
  const history = useMemo(() => events.filter((event) => new Date(event.starts_at).getTime() < now - 3 * 60 * 60 * 1000).sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)), [events, now]);
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
      const payload = { type: 'Entrenamiento', time: createForm.time, duration, description: String(createForm.description || '').trim(), plan: String(createForm.plan || '').trim() };
      const { data, error: insertError } = await supabase.from('events').insert({
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
      }).select('id,club_id,team_id,season_id,title,starts_at,ends_at,location,status,payload,created_by').single();
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
      const row = { event_id: event.id, player_id: identity.player.id, player_response: response, updated_at: new Date().toISOString() };
      const { data, error: rsvpError } = await supabase.from('attendance').upsert(row, { onConflict: 'event_id,player_id' }).select('event_id,player_id,player_response,official_status,effective_minutes,validated_at').single();
      if (rsvpError) throw rsvpError;
      setAttendance((current) => [...current.filter((item) => !(item.event_id === data.event_id && item.player_id === data.player_id)), data]);
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
        supabase.from('players').select('id,legacy_id,dorsal,position,status,active,profiles:profile_id(username,full_name)').eq('team_id', event.team_id).eq('active', true).order('dorsal', { ascending: true, nullsFirst: false }),
        supabase.from('attendance').select('event_id,player_id,player_response,official_status,effective_minutes,validated_at').eq('event_id', event.id)
      ]);
      if (playersError) throw playersError;
      if (existingError) throw existingError;
      const existingMap = new Map((existing || []).map((row) => [row.player_id, row]));
      const statuses = {};
      const responses = {};
      (players || []).forEach((player) => {
        const row = existingMap.get(player.id);
        statuses[player.id] = { status: row?.official_status || '', minutes: row?.effective_minutes ?? '' };
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
    setRollCall((current) => current ? { ...current, statuses: { ...current.statuses, [playerId]: { ...current.statuses[playerId], ...patch } } } : current);
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
        return { event_id: rollCall.event.id, player_id: player.id, player_response: rollCall.responses[player.id] || null, official_status: status, effective_minutes: effectiveMinutes, validated_by: status ? identity.profile.id : null, validated_at: status ? nowIso : null, updated_at: nowIso };
      });
      const { data, error: saveError } = await supabase.from('attendance').upsert(rows, { onConflict: 'event_id,player_id' }).select('event_id,player_id,player_response,official_status,effective_minutes,validated_at');
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
    const complete = Number.isFinite(eventEndTime(event)) && eventEndTime(event) <= Date.now();
    return (
      <button className={`pro-training-session${featured ? ' featured' : ''}`} type="button" onClick={() => setSelected(event)}>
        <span className="pro-training-date"><b>{parts.day}</b><small>{parts.weekday}</small></span>
        <span className="pro-training-session-copy">
          <span className={`pro-training-state ${complete ? 'complete' : 'next'}`}>{complete ? 'Finalizada' : 'Próxima'}</span>
          <strong>{event.title || 'Entrenamiento'}</strong>
          <small><Clock3 size={13} /> {parts.time} · {durationMinutes(event)} min {event.location ? <><MapPin size={13} /> {event.location}</> : null}</small>
        </span>
        <span className="pro-training-session-side">
          {isStaff ? <small>{counts.present + counts.late}/{counts.present + counts.late + counts.justified + counts.unjustified || '—'}</small> : null}
          {isPlayer && own?.player_response ? <small>{own.player_response === 'yes' ? 'Asistiré' : 'No podré'}</small> : null}
          <ChevronRight size={18} />
        </span>
      </button>
    );
  }

  if (selected) {
    return <SessionDetail event={selected} identity={identity} attendanceRows={eventAttendance(selected.id)} onBack={() => setSelected(null)} onRollCall={(event) => void openRollCall(event)} onRsvp={(event, response) => void setRsvp(event, response)} rsvpSaving={rsvpSaving} />;
  }

  return (
    <div className="pro-training-page">
      <div className="pro-training-heading">
        <div><p className="eyebrow">{identity?.season?.name || 'Temporada actual'}</p><h1>Entrenos</h1><span>{selectedTeam?.name || 'CV Bunyola'} · {selectedTeam?.category || 'Equipo'}</span></div>
        {isStaff ? <button className="pro-new-session" type="button" onClick={() => { setCreateError(''); setCreateForm(defaultTrainingForm()); setCreateOpen(true); }}><Plus size={18} /> Nueva sesión</button> : null}
      </div>

      <section className="pro-training-toolbar">
        <div className="pro-training-tabs">
          <button className={tab === 'upcoming' ? 'active' : ''} type="button" onClick={() => setTab('upcoming')}><Sparkles size={17} /> Próxima sesión</button>
          <button className={tab === 'history' ? 'active' : ''} type="button" onClick={() => setTab('history')}><CalendarDays size={17} /> Completados</button>
          {isStaff ? <button className={tab === 'attendance' ? 'active' : ''} type="button" onClick={() => setTab('attendance')}><UsersRound size={17} /> Asistencia del equipo</button> : null}
        </div>
        {teams.length > 1 ? <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select> : null}
      </section>

      {loading ? <div className="pro-training-state">Cargando entrenamientos…</div> : null}
      {error ? <div className="pro-training-state error"><CircleAlert size={18} /> {error}</div> : null}

      {!loading && !error && tab === 'attendance' && isStaff ? <TeamAttendancePanel teamId={teamId} events={events} /> : null}

      {!loading && !error && tab !== 'attendance' ? (
        <>
          {tab === 'upcoming' && nextSession ? <section className="pro-training-feature"><p className="eyebrow">Siguiente sesión</p><SessionRow event={nextSession} featured /></section> : null}
          <section className="pro-training-list-section">
            <div className="pro-training-list-head"><div><p className="eyebrow">{tab === 'history' ? 'Sesiones realizadas' : 'Agenda'}</p><h2>{tab === 'history' ? 'Historial de entrenamientos' : 'Próximos entrenamientos'}</h2></div></div>
            <div className="pro-training-list">{(tab === 'upcoming' && nextSession ? shown.filter((event) => event.id !== nextSession.id) : shown).map((event) => <SessionRow key={event.id} event={event} />)}</div>
            {!shown.length ? <div className="pro-training-state">No hay entrenamientos en esta vista.</div> : null}
          </section>
        </>
      ) : null}

      {createOpen ? (
        <div className="pro-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <section className="pro-create-modal" role="dialog" aria-modal="true">
            <header><div><p className="eyebrow">Nueva sesión</p><h2>Crear entrenamiento</h2><span>{selectedTeam?.name || 'Equipo'}</span></div><button className="icon-button" type="button" onClick={() => setCreateOpen(false)}><X /></button></header>
            <div className="pro-create-body">
              <div className="pro-form-grid">
                <label className="wide"><span>Título</span><input value={createForm.title} onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} /></label>
                <label><span>Fecha</span><input type="date" value={createForm.date} onChange={(event) => setCreateForm((current) => ({ ...current, date: event.target.value }))} /></label>
                <label><span>Hora</span><input type="time" value={createForm.time} onChange={(event) => setCreateForm((current) => ({ ...current, time: event.target.value }))} /></label>
                <label><span>Duración (min)</span><input type="number" min="15" max="300" step="5" value={createForm.duration} onChange={(event) => setCreateForm((current) => ({ ...current, duration: event.target.value }))} /></label>
                <label><span>Lugar</span><input value={createForm.location} onChange={(event) => setCreateForm((current) => ({ ...current, location: event.target.value }))} /></label>
                <label className="wide"><span>Objetivo / descripción</span><textarea rows="3" value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} /></label>
                <label className="wide"><span>Plan de sesión</span><textarea rows="6" value={createForm.plan} onChange={(event) => setCreateForm((current) => ({ ...current, plan: event.target.value }))} placeholder="Prevención\nFuerza\nControl de bola\nJuego…" /></label>
              </div>
              {createError ? <p className="form-error">{createError}</p> : null}
              <footer><button className="secondary-button" type="button" onClick={() => setCreateOpen(false)}>Cancelar</button><button className="primary-button" type="button" disabled={creating} onClick={() => void createTraining()}><Save size={17} /> {creating ? 'Creando…' : 'Crear sesión'}</button></footer>
            </div>
          </section>
        </div>
      ) : null}

      {rollCall ? (
        <div className="pro-modal-backdrop rollcall-backdrop">
          <section className="rollcall-modal" role="dialog" aria-modal="true">
            <header className="rollcall-header"><div><p className="eyebrow">Asistencia oficial</p><h2>{rollCall.event.title || 'Entrenamiento'}</h2><span>{dateParts(rollCall.event.starts_at).full} · {dateParts(rollCall.event.starts_at).time} · {durationMinutes(rollCall.event)} min</span></div><button className="icon-button" type="button" onClick={() => setRollCall(null)}><X /></button></header>
            <div className="rollcall-toolbar"><span><Users size={17} /> {rollCall.players.length} jugadoras</span><button type="button" onClick={allPresent} disabled={rollLoading || !rollCall.players.length}><Check size={16} /> Todas presentes</button></div>
            <div className="rollcall-body">
              {rollLoading ? <div className="rollcall-loading">Preparando lista…</div> : null}
              {!rollLoading ? rollCall.players.map((player) => {
                const entry = rollCall.statuses[player.id] || { status: '', minutes: '' };
                const response = rollCall.responses[player.id];
                return (
                  <article className="rollcall-player" key={player.id}>
                    <div className="rollcall-player-id"><span className="rollcall-avatar">{initials(playerName(player))}</span><span><span className="rollcall-player-name-line"><strong>{playerName(player)}</strong>{response ? <span className={`rollcall-rsvp-badge ${response === 'yes' ? 'yes' : 'no'}`}>{response === 'yes' ? 'Asistirá' : 'No asistirá'}</span> : null}</span><small>{player.dorsal != null ? `#${player.dorsal}` : 'Sin dorsal'} · {player.position || 'Sin posición'}</small></span></div>
                    <div className="rollcall-statuses">{Object.entries(STATUS).map(([key, meta]) => { const Icon = meta.icon; return <button key={key} className={`${key}${entry.status === key ? ' active' : ''}`} type="button" onClick={() => patchRoll(player.id, { status: entry.status === key ? '' : key, minutes: key === 'late' ? entry.minutes : '' })}><Icon size={15} /><span>{meta.label}</span><b>{meta.short}</b></button>; })}</div>
                    {entry.status === 'late' ? <label className="late-minutes"><span>Minutos realizados</span><input type="number" inputMode="numeric" min="1" max={durationMinutes(rollCall.event)} value={entry.minutes} onChange={(event) => patchRoll(player.id, { minutes: event.target.value })} /><small>de {durationMinutes(rollCall.event)} min</small></label> : null}
                  </article>
                );
              }) : null}
            </div>
            <footer className="rollcall-footer"><div className="rollcall-message">{rollError ? <span className="error"><CircleAlert size={16} /> {rollError}</span> : null}{rollSuccess ? <span className="success"><Check size={16} /> {rollSuccess}</span> : null}</div><div className="rollcall-actions"><button className="secondary-button" type="button" onClick={() => setRollCall(null)}>Cerrar</button><button className="primary-button" type="button" disabled={rollSaving || rollLoading} onClick={() => void saveRollCall()}><Save size={17} /> {rollSaving ? 'Guardando…' : 'Guardar lista'}</button></div></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
