import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  CircleMinus,
  CircleX,
  Clock3,
  List,
  Table2,
  UsersRound
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import './TeamAttendancePanel.css';

const STATUS = {
  present: { label: 'Presente', short: 'P' },
  late: { label: 'Tarde', short: 'T' },
  justified: { label: 'Justificada', short: 'J' },
  unjustified: { label: 'No justificada', short: 'X' }
};

function nameOf(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function initials(player) {
  return nameOf(player).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function pctTone(value) {
  if (value === null) return 'empty';
  if (value >= 90) return 'high';
  if (value >= 80) return 'medium';
  return 'low';
}

function sessionLabel(event) {
  const date = new Date(event?.starts_at);
  if (Number.isNaN(date.getTime())) return { day: '—', date: '—' };
  return {
    day: new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(date).replace('.', '').toUpperCase(),
    date: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(date)
  };
}

function Ring({ value, small = false }) {
  const safe = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={`team-attendance-ring ${small ? 'small' : 'large'} tone-${pctTone(value)}`} style={{ '--attendance-pct': safe }}>
      <div><strong>{value === null ? '—' : `${value}%`}</strong>{small ? null : <small>asistencia</small>}</div>
    </div>
  );
}

export default function TeamAttendancePanel({ teamId, events = [] }) {
  const [players, setPlayers] = useState([]);
  const [rows, setRows] = useState([]);
  const [avatars, setAvatars] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('sessions');
  const [sort, setSort] = useState('attendance');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!teamId) return;
      setLoading(true);
      setError('');
      try {
        const ids = events.map((event) => event.id).filter(Boolean);
        const [playersResult, attendanceResult] = await Promise.all([
          supabase
            .from('players')
            .select('id,legacy_id,dorsal,position,avatar_path,active,profiles:profile_id(username,full_name,avatar_path)')
            .eq('team_id', teamId)
            .eq('active', true)
            .order('dorsal', { ascending: true, nullsFirst: false }),
          ids.length
            ? supabase
              .from('attendance')
              .select('event_id,player_id,official_status,validated_at')
              .in('event_id', ids)
              .not('official_status', 'is', null)
            : Promise.resolve({ data: [], error: null })
        ]);
        if (playersResult.error) throw playersResult.error;
        if (attendanceResult.error) throw attendanceResult.error;
        if (!active) return;
        const nextPlayers = playersResult.data || [];
        setPlayers(nextPlayers);
        setRows(attendanceResult.data || []);
        const paths = [...new Set(nextPlayers.map((player) => player.avatar_path || player.profiles?.avatar_path).filter(Boolean))];
        if (paths.length) {
          const { data: signed } = await supabase.storage.from('avatars').createSignedUrls(paths, 3600);
          if (active) {
            const map = {};
            (signed || []).forEach((item, index) => { if (item?.signedUrl) map[paths[index]] = item.signedUrl; });
            setAvatars(map);
          }
        } else {
          setAvatars({});
        }
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No se pudo cargar el resumen de asistencia.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [teamId, events]);

  const model = useMemo(() => {
    const now = Date.now();
    const eligible = events
      .filter((event) => new Date(event.starts_at).getTime() <= now)
      .filter((event) => rows.some((row) => row.event_id === event.id && row.official_status))
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    const totals = { present: 0, late: 0, justified: 0, unjustified: 0 };
    const playerRows = players.map((player) => {
      const counts = { present: 0, late: 0, justified: 0, unjustified: 0 };
      const bySession = new Map();
      eligible.forEach((event) => {
        const row = rows.find((item) => item.event_id === event.id && item.player_id === player.id && item.official_status);
        const status = row?.official_status || null;
        if (status && counts[status] !== undefined) counts[status] += 1;
        bySession.set(event.id, status);
      });
      Object.keys(totals).forEach((key) => { totals[key] += counts[key]; });
      const total = counts.present + counts.late + counts.justified + counts.unjustified;
      const attended = counts.present + counts.late;
      return { player, counts, total, pct: total ? Math.round((attended * 100) / total) : null, bySession };
    });
    const totalRecords = Object.values(totals).reduce((sum, value) => sum + value, 0);
    const teamPct = totalRecords ? Math.round(((totals.present + totals.late) * 100) / totalRecords) : null;
    return { sessions: eligible, totals, playerRows, teamPct };
  }, [events, players, rows]);

  const sortedPlayers = useMemo(() => {
    const next = [...model.playerRows];
    if (sort === 'name') return next.sort((a, b) => nameOf(a.player).localeCompare(nameOf(b.player), 'es'));
    if (sort === 'absences') return next.sort((a, b) => (b.counts.justified + b.counts.unjustified) - (a.counts.justified + a.counts.unjustified) || nameOf(a.player).localeCompare(nameOf(b.player), 'es'));
    if (sort === 'late') return next.sort((a, b) => b.counts.late - a.counts.late || nameOf(a.player).localeCompare(nameOf(b.player), 'es'));
    return next.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || nameOf(a.player).localeCompare(nameOf(b.player), 'es'));
  }, [model.playerRows, sort]);

  function avatarUrl(player) {
    const path = player.avatar_path || player.profiles?.avatar_path;
    return path ? avatars[path] : null;
  }

  if (loading) return <div className="team-attendance-state">Cargando asistencia…</div>;
  if (error) return <div className="team-attendance-state error">{error}</div>;

  return (
    <section className="team-attendance-overview">
      <header className="team-attendance-header">
        <div>
          <span className="team-attendance-kicker"><UsersRound size={17} /> Seguimiento del equipo</span>
          <h2>Asistencia</h2>
          <p>Histórico basado únicamente en asistencia oficial validada.</p>
        </div>
        <div className="team-attendance-view-toggle">
          <button className={mode === 'summary' ? 'active' : ''} type="button" onClick={() => setMode('summary')} aria-pressed={mode === 'summary'}><List size={17} /> Resumen</button>
          <button className={mode === 'sessions' ? 'active' : ''} type="button" onClick={() => setMode('sessions')} aria-pressed={mode === 'sessions'}><Table2 size={17} /> Por sesiones</button>
        </div>
      </header>

      {mode === 'summary' ? (
        <>
          <article className="team-attendance-overall-card">
            <Ring value={model.teamPct} />
            <div className="team-attendance-overall-copy">
              <span>Asistencia del equipo</span>
              <strong>{model.sessions.length} sesión{model.sessions.length === 1 ? '' : 'es'} con lista oficial</strong>
              <p>Presentes y llegadas tarde computan como asistencia.</p>
            </div>
          </article>

          <article className="team-attendance-status-card">
            <div className="team-attendance-status-item tone-present"><CheckCircle2 /><strong>{model.totals.present}</strong><small>Presentes</small></div>
            <div className="team-attendance-status-item tone-late"><Clock3 /><strong>{model.totals.late}</strong><small>Retrasos</small></div>
            <div className="team-attendance-status-item tone-justified"><CircleMinus /><strong>{model.totals.justified}</strong><small>Justificadas</small></div>
            <div className="team-attendance-status-item tone-unjustified"><CircleX /><strong>{model.totals.unjustified}</strong><small>No justificadas</small></div>
          </article>

          <div className="team-attendance-list-head">
            <div><span>Jugadoras</span><strong>Asistencia acumulada</strong></div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar asistencia">
              <option value="attendance">Asistencia</option>
              <option value="name">Nombre</option>
              <option value="absences">Más ausencias</option>
              <option value="late">Más retrasos</option>
            </select>
          </div>

          <div className="team-attendance-player-list">
            {sortedPlayers.map((item) => {
              const player = item.player;
              const avatar = avatarUrl(player);
              return (
                <article className="team-attendance-player-row" key={player.id}>
                  <div className="team-attendance-player-main">
                    <div className="team-attendance-avatar">{avatar ? <img src={avatar} alt="" /> : <b>{initials(player)}</b>}</div>
                    <div className="team-attendance-player-copy"><strong>{nameOf(player)}</strong><small>#{player.dorsal ?? '—'} · {player.position || 'Sin posición'}</small></div>
                    <Ring value={item.pct} small />
                    <ChevronRight className="team-attendance-row-arrow" size={18} />
                  </div>
                  <div className="team-attendance-breakdown">
                    <span className="tone-present"><b>{item.counts.present}</b><small>P</small></span>
                    <span className="tone-late"><b>{item.counts.late}</b><small>T</small></span>
                    <span className="tone-justified"><b>{item.counts.justified}</b><small>J</small></span>
                    <span className="tone-unjustified"><b>{item.counts.unjustified}</b><small>X</small></span>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="team-attendance-session-view">
          {!model.sessions.length ? <div className="team-attendance-state">Aún no hay listas oficiales.</div> : (
            <>
              <div className="team-attendance-legend" aria-label="Leyenda de asistencia">
                <span className="tone-present">P · Presente</span>
                <span className="tone-late">T · Tarde</span>
                <span className="tone-justified">J · Justificada</span>
                <span className="tone-unjustified">X · No justificada</span>
              </div>
              <p className="team-attendance-swipe-hint">Cada columna es una sesión · desliza horizontalmente para ver el histórico →</p>
              <div className="team-attendance-matrix-scroll">
                <table className="team-attendance-matrix">
                  <thead>
                    <tr>
                      <th>Jugadora</th>
                      {model.sessions.map((event) => {
                        const label = sessionLabel(event);
                        return <th key={event.id}><span>{label.day}</span><strong>{label.date}</strong></th>;
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((item) => (
                      <tr key={item.player.id}>
                        <th><strong>{nameOf(item.player)}</strong><small>{item.pct === null ? 'Sin datos' : `${item.pct}%`}</small></th>
                        {model.sessions.map((event) => {
                          const status = item.bySession.get(event.id);
                          const label = status ? STATUS[status]?.label : 'Sin validar';
                          return (
                            <td key={event.id} title={label} aria-label={`${nameOf(item.player)} · ${sessionLabel(event).date} · ${label}`}>
                              <span className={`attendance-matrix-status tone-${status || 'empty'}`}>{status ? STATUS[status]?.short || '—' : '—'}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
