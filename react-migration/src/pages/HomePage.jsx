import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronRight, CircleGauge, Dumbbell, HeartPulse, MapPin, ShieldCheck, Trophy, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';

const ROLE_LABELS = {
  administrator: 'Administrador',
  coach: 'Entrenador',
  player: 'Jugadora'
};

function formatEventDate(value) {
  if (!value) return 'Fecha por confirmar';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(date);
}

function getEventLabel(event) {
  const payloadType = event?.payload?.type;
  if (payloadType) return payloadType;
  const map = {
    training: 'Entrenamiento',
    match: 'Partido',
    friendly: 'Amistoso',
    tournament: 'Torneo',
    birthday: 'Cumpleaños'
  };
  return map[event?.event_type] || 'Actividad';
}

export default function HomePage() {
  const { identity } = useAuth();
  const [nextEvent, setNextEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const seasonName = identity?.season?.name || '2026/27';
  const firstName = useMemo(() => String(profile?.full_name || profile?.username || '').trim().split(/\s+/)[0] || 'equipo', [profile]);

  useEffect(() => {
    let active = true;

    async function loadNextEvent() {
      setLoadingEvent(true);
      try {
        let query = supabase
          .from('events')
          .select('id, team_id, event_type, title, starts_at, location, status, payload')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(1);

        if (team?.id) query = query.eq('team_id', team.id);
        else if (profile?.club_id) query = query.eq('club_id', profile.club_id);

        const { data, error } = await query;
        if (error) throw error;
        if (active) setNextEvent(data?.[0] || null);
      } catch {
        if (active) setNextEvent(null);
      } finally {
        if (active) setLoadingEvent(false);
      }
    }

    loadNextEvent();
    return () => { active = false; };
  }, [profile?.club_id, team?.id]);

  const shortcuts = [
    { to: '/training', label: 'Entrenos', description: 'Sesiones, asistencia y RPE', icon: Dumbbell },
    { to: '/calendar', label: 'Calendario', description: 'Próximas actividades', icon: CalendarClock },
    { to: '/wellness', label: 'Bienestar', description: 'Seguimiento diario', icon: HeartPulse },
    { to: '/roster', label: 'Plantilla', description: 'Jugadoras y equipo', icon: Users }
  ];

  return (
    <div className="home-stack">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="hero-season">Temporada {seasonName}</p>
          <h1>CV Bunyola</h1>
          <p>{team?.category || team?.name || 'Cadete Femenino 1ª División'}</p>
        </div>
        <div className="hero-badge">
          <ShieldCheck size={18} />
          <span>{ROLE_LABELS[profile?.role] || 'Usuario'}</span>
        </div>
      </section>

      <section className="welcome-row">
        <div>
          <p className="eyebrow">Inicio</p>
          <h2>Hola, {firstName}</h2>
          <p>La nueva base React solo renderiza lo que tienes abierto.</p>
        </div>
        <div className="runtime-pill"><CircleGauge size={17} /> React + Supabase</div>
      </section>

      <section className="home-grid home-grid-main">
        <article className="surface-card next-event-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Próxima actividad</p>
              <h3>{loadingEvent ? 'Cargando…' : (nextEvent?.title || getEventLabel(nextEvent) || 'Sin actividades próximas')}</h3>
            </div>
            <CalendarClock size={24} />
          </div>
          {nextEvent ? (
            <div className="event-details">
              <strong>{getEventLabel(nextEvent)}</strong>
              <span>{formatEventDate(nextEvent.starts_at)}</span>
              {nextEvent.location ? <span><MapPin size={15} /> {nextEvent.location}</span> : null}
            </div>
          ) : !loadingEvent ? (
            <p className="muted-copy">No hay una actividad futura cargada para este equipo.</p>
          ) : null}
        </article>

        <article className="surface-card team-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Equipo activo</p>
              <h3>{team?.name || 'Cadete Femenino'}</h3>
            </div>
            <Trophy size={24} />
          </div>
          <p>{team?.category || '1ª División'}</p>
          <span className="status-dot-line"><i /> Temporada activa</span>
        </article>
      </section>

      <section>
        <div className="section-title-row">
          <div>
            <p className="eyebrow">Acceso rápido</p>
            <h2>Tu día a día</h2>
          </div>
        </div>
        <div className="shortcut-grid">
          {shortcuts.map(({ to, label, description, icon: Icon }) => (
            <Link className="shortcut-card" to={to} key={to}>
              <span className="shortcut-icon"><Icon size={20} /></span>
              <span className="shortcut-copy"><strong>{label}</strong><small>{description}</small></span>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
