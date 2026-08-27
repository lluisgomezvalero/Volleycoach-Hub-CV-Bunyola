import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  Cake,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  MapPin,
  Pencil,
  Plus,
  Shield,
  Trash2,
  Trophy,
  X
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './CalendarPage.css';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const EVENT_META = {
  training: { label: 'Entreno', icon: Dumbbell },
  friendly: { label: 'Amistoso', icon: Shield },
  match: { label: 'Liga', icon: Trophy },
  tournament: { label: 'Torneo', icon: Trophy },
  birthday: { label: 'Cumpleaños', icon: Cake }
};

const TYPE_OPTIONS = [
  ['training', 'Entrenamiento'],
  ['friendly', 'Amistoso'],
  ['match', 'Partido de liga'],
  ['tournament', 'Torneo']
];

function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function eventDateKey(event) {
  if (event?.isBirthday) return event.date_key;
  return dateKey(new Date(event?.starts_at));
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatLongDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function typeForEvent(event) {
  if (event?.isBirthday) return 'birthday';
  const raw = String(event?.event_type || '').toLowerCase();
  if (raw === 'training') return 'training';
  if (raw === 'friendly') return 'friendly';
  if (raw === 'tournament') return 'tournament';
  if (raw === 'match' || raw === 'league') return 'match';
  const payloadType = String(event?.payload?.type || '').toLowerCase();
  if (payloadType.includes('amist')) return 'friendly';
  if (payloadType.includes('torneo')) return 'tournament';
  if (payloadType.includes('partido')) return 'match';
  return 'training';
}

function eventTypePayload(type) {
  return {
    training: 'Entrenamiento',
    friendly: 'Amistoso',
    match: 'Partido',
    tournament: 'Torneo'
  }[type] || 'Entrenamiento';
}

function durationMinutes(event) {
  if (event?.starts_at && event?.ends_at) {
    const value = Math.round((new Date(event.ends_at) - new Date(event.starts_at)) / 60000);
    if (Number.isFinite(value) && value > 0) return value;
  }
  const payload = Number(event?.payload?.duration);
  return Number.isFinite(payload) && payload > 0 ? payload : 120;
}

function defaultForm(teamId = '') {
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return {
    team_id: teamId,
    type: 'training',
    title: 'Entrenamiento',
    date: dateKey(now),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    duration: 120,
    location: 'Pabellón Municipal de Bunyola',
    description: '',
    plan: ''
  };
}

function formFromEvent(event) {
  const start = new Date(event.starts_at);
  return {
    team_id: event.team_id || '',
    type: typeForEvent(event),
    title: event.title || 'Entrenamiento',
    date: dateKey(start),
    time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
    duration: durationMinutes(event),
    location: event.location || '',
    description: event.payload?.description || '',
    plan: event.payload?.plan || ''
  };
}

function EventCard({ event, onOpen }) {
  const type = typeForEvent(event);
  const meta = EVENT_META[type] || EVENT_META.training;
  const Icon = meta.icon;
  const time = event.isBirthday ? 'Todo el día' : formatTime(event.starts_at);
  const planItems = String(event?.payload?.plan || '').split('\n').map((item) => item.trim()).filter(Boolean);

  const content = (
    <>
      <span className={`calendar-event-icon type-${type}`}><Icon size={18} /></span>
      <span className="calendar-event-copy">
        <span className="calendar-event-topline"><small>{meta.label}</small><time>{time}</time></span>
        <strong>{event.title || meta.label}</strong>
        {event.location ? <span className="calendar-event-meta"><MapPin size={13} />{event.location}</span> : null}
        {!event.isBirthday && type === 'training' && planItems.length ? <span className="calendar-event-plan">{planItems.slice(0, 2).join(' · ')}</span> : null}
      </span>
      {!event.isBirthday ? <ChevronRight className="calendar-event-chevron" size={18} /> : null}
    </>
  );

  if (event.isBirthday) return <article className={`calendar-event-card type-${type}`}>{content}</article>;
  return <button type="button" className={`calendar-event-card type-${type}`} onClick={() => onOpen(event)}>{content}</button>;
}

function EventModal({ event, isStaff, onClose, onEdit, onDelete }) {
  if (!event) return null;
  const type = typeForEvent(event);
  const meta = EVENT_META[type] || EVENT_META.training;
  const Icon = meta.icon;
  const plan = String(event?.payload?.plan || '').split('\n').map((item) => item.trim()).filter(Boolean);
  const description = String(event?.payload?.description || '').trim();

  return (
    <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="calendar-modal calendar-detail-modal" role="dialog" aria-modal="true" aria-label="Detalle del evento">
        <header className="calendar-modal-head">
          <span className={`calendar-event-icon large type-${type}`}><Icon size={20} /></span>
          <div><small>{meta.label}</small><h2>{event.title || meta.label}</h2></div>
          <button type="button" className="calendar-icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <div className="calendar-detail-date">
          <CalendarDays size={18} />
          <div><strong>{formatLongDate(event.starts_at)}</strong><span>{formatTime(event.starts_at)}{event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}</span></div>
        </div>
        {event.location ? <div className="calendar-detail-row"><MapPin size={17} /><span>{event.location}</span></div> : null}
        {description ? <div className="calendar-detail-block"><small>Información</small><p>{description}</p></div> : null}
        {plan.length ? <div className="calendar-detail-block"><small>{type === 'training' ? 'Qué vamos a trabajar' : 'Notas'}</small><ul>{plan.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null}

        {isStaff ? (
          <footer className="calendar-detail-actions">
            <button type="button" className="calendar-secondary-action danger" onClick={() => onDelete(event)}><Trash2 size={16} />Eliminar</button>
            <button type="button" className="calendar-primary-action" onClick={() => onEdit(event)}><Pencil size={16} />Editar evento</button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function EventEditor({ open, teams, form, setForm, saving, error, editing, onClose, onSubmit }) {
  if (!open) return null;
  return (
    <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="calendar-modal calendar-editor-modal" role="dialog" aria-modal="true" aria-label={editing ? 'Editar evento' : 'Crear evento'}>
        <header className="calendar-modal-head">
          <span className="calendar-event-icon large type-training"><CalendarDays size={20} /></span>
          <div><small>Calendario</small><h2>{editing ? 'Editar evento' : 'Agendar evento'}</h2></div>
          <button type="button" className="calendar-icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>

        <form className="calendar-event-form" onSubmit={onSubmit}>
          {teams.length > 1 ? (
            <label><span>Equipo</span><select value={form.team_id} onChange={(e) => setForm((prev) => ({ ...prev, team_id: e.target.value }))} required>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          ) : null}
          <div className="calendar-form-grid two">
            <label><span>Tipo</span><select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value, title: prev.title === 'Entrenamiento' ? eventTypePayload(e.target.value) : prev.title }))}>{TYPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Título</span><input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required /></label>
          </div>
          <div className="calendar-form-grid three">
            <label><span>Fecha</span><input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} required /></label>
            <label><span>Hora</span><input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} required /></label>
            <label><span>Duración</span><input type="number" min="15" step="15" value={form.duration} onChange={(e) => setForm((prev) => ({ ...prev, duration: Number(e.target.value) }))} required /></label>
          </div>
          <label><span>Lugar</span><input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} placeholder="Pabellón, localidad…" /></label>
          <label><span>Descripción</span><textarea rows="2" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Información general del evento…" /></label>
          <label><span>{form.type === 'training' ? 'Contenido de la sesión' : 'Notas'}</span><textarea rows="4" value={form.plan} onChange={(e) => setForm((prev) => ({ ...prev, plan: e.target.value }))} placeholder={form.type === 'training' ? 'Una tarea o contenido por línea…' : 'Información adicional…'} /></label>
          {error ? <p className="calendar-form-error">{error}</p> : null}
          <div className="calendar-form-actions"><button type="button" className="calendar-secondary-action" onClick={onClose}>Cancelar</button><button type="submit" className="calendar-primary-action" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear evento'}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function CalendarPage() {
  const { identity } = useAuth();
  const teams = identity?.teams || [];
  const teamIds = useMemo(() => teams.map((team) => team.id).filter(Boolean), [teams]);
  const isStaff = ['coach', 'administrator'].includes(identity?.profile?.role);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [selectedKey, setSelectedKey] = useState(() => dateKey(today));
  const [events, setEvents] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [detailEvent, setDetailEvent] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState(() => defaultForm(teamIds[0] || ''));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!form.team_id && teamIds[0]) setForm((prev) => ({ ...prev, team_id: teamIds[0] }));
  }, [form.team_id, teamIds]);

  useEffect(() => {
    let active = true;
    async function loadMonth() {
      if (!teamIds.length) {
        setEvents([]);
        setBirthdays([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError('');
      try {
        const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1, 0, 0, 0, 0);
        const requests = [
          supabase.from('events').select('id,club_id,team_id,season_id,event_type,title,starts_at,ends_at,location,status,payload,created_by').in('team_id', teamIds).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString()).order('starts_at'),
          supabase.from('players').select('id,team_id,birth_date,profiles:profile_id(full_name,username)').in('team_id', teamIds).eq('active', true).not('birth_date', 'is', null)
        ];
        const [eventResult, playerResult] = await Promise.all(requests);
        if (eventResult.error) throw eventResult.error;
        if (playerResult.error) throw playerResult.error;
        if (!active) return;
        setEvents(eventResult.data || []);
        const month = cursor.getMonth() + 1;
        const year = cursor.getFullYear();
        const nextBirthdays = (playerResult.data || []).flatMap((player) => {
          const raw = String(player.birth_date || '');
          const [, birthMonth, birthDay] = raw.split('-').map(Number);
          if (!birthMonth || !birthDay || birthMonth !== month) return [];
          const date = new Date(year, birthMonth - 1, birthDay, 12);
          const name = player.profiles?.full_name || player.profiles?.username || 'Jugadora';
          return [{ id: `birthday-${player.id}-${year}`, isBirthday: true, date_key: dateKey(date), starts_at: date.toISOString(), title: `Cumpleaños de ${name}`, event_type: 'birthday', team_id: player.team_id }];
        });
        setBirthdays(nextBirthdays);
      } catch (error) {
        if (active) setLoadError(error?.message || 'No se pudo cargar el calendario.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadMonth();
    return () => { active = false; };
  }, [cursor, teamIds]);

  const monthEvents = useMemo(() => [...events, ...birthdays].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))), [events, birthdays]);
  const byDate = useMemo(() => {
    const map = new Map();
    monthEvents.forEach((event) => {
      const key = eventDateKey(event);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    });
    return map;
  }, [monthEvents]);

  useEffect(() => {
    const prefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-`;
    if (selectedKey.startsWith(prefix)) return;
    const todayKey = dateKey(today);
    const eventDays = [...byDate.keys()].sort();
    if (todayKey.startsWith(prefix)) setSelectedKey(todayKey);
    else setSelectedKey(eventDays[0] || dateKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)));
  }, [byDate, cursor, selectedKey, today]);

  const selectedDate = useMemo(() => {
    const [year, month, day] = selectedKey.split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day, 12) : cursor;
  }, [cursor, selectedKey]);
  const selectedEvents = byDate.get(selectedKey) || [];

  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12);
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => index - offset + 1);

  function moveMonth(delta) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12));
  }

  function goToday() {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1, 12));
    setSelectedKey(dateKey(now));
  }

  function openCreate() {
    setEditingEvent(null);
    setForm(defaultForm(teamIds[0] || ''));
    setFormError('');
    setEditorOpen(true);
  }

  function openEdit(event) {
    setDetailEvent(null);
    setEditingEvent(event);
    setForm(formFromEvent(event));
    setFormError('');
    setEditorOpen(true);
  }

  async function saveEvent(event) {
    event.preventDefault();
    if (!isStaff) return;
    setSaving(true);
    setFormError('');
    try {
      const start = new Date(`${form.date}T${form.time}:00`);
      if (Number.isNaN(start.getTime())) throw new Error('La fecha u hora no es válida.');
      const minutes = Math.max(15, Number(form.duration) || 120);
      const end = new Date(start.getTime() + minutes * 60000);
      const previousPayload = editingEvent?.payload || {};
      const payload = {
        ...previousPayload,
        type: eventTypePayload(form.type),
        time: form.time,
        duration: minutes,
        description: form.description.trim(),
        plan: form.plan.trim(),
        status: editingEvent?.status || 'Próximo'
      };
      const row = {
        club_id: identity.profile.club_id,
        team_id: form.team_id || teamIds[0],
        season_id: identity?.season?.id || null,
        event_type: form.type,
        title: form.title.trim() || eventTypePayload(form.type),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        location: form.location.trim(),
        status: editingEvent?.status || 'Próximo',
        payload,
        created_by: editingEvent?.created_by || identity.profile.id,
        updated_at: new Date().toISOString()
      };
      let result;
      if (editingEvent) result = await supabase.from('events').update(row).eq('id', editingEvent.id).select('id,club_id,team_id,season_id,event_type,title,starts_at,ends_at,location,status,payload,created_by').single();
      else result = await supabase.from('events').insert(row).select('id,club_id,team_id,season_id,event_type,title,starts_at,ends_at,location,status,payload,created_by').single();
      if (result.error) throw result.error;
      const saved = result.data;
      const savedDate = new Date(saved.starts_at);
      setCursor(new Date(savedDate.getFullYear(), savedDate.getMonth(), 1, 12));
      setSelectedKey(dateKey(savedDate));
      setEvents((rows) => [...rows.filter((item) => item.id !== saved.id), saved].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))));
      setEditorOpen(false);
      setEditingEvent(null);
    } catch (error) {
      setFormError(error?.message || 'No se pudo guardar el evento.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(event) {
    if (!isStaff || !event?.id) return;
    if (!window.confirm(`¿Eliminar “${event.title || 'este evento'}”?`)) return;
    setLoadError('');
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      setLoadError(error.message || 'No se pudo eliminar el evento.');
      return;
    }
    setEvents((rows) => rows.filter((item) => item.id !== event.id));
    setDetailEvent(null);
  }

  return (
    <div className="calendar-page">
      <section className="calendar-hero">
        <div><span className="calendar-eyebrow">TEMPORADA {identity?.season?.name || '2026/27'}</span><h1>Calendario del equipo</h1><p>Entrenos, partidos, torneos y fechas importantes en un solo lugar.</p></div>
        {isStaff ? <button type="button" className="calendar-add-button" onClick={openCreate}><Plus size={18} /><span>Agendar evento</span></button> : null}
      </section>

      <section className="calendar-toolbar">
        <button type="button" className="calendar-today" onClick={goToday}>Hoy</button>
        <div className="calendar-month-navigation"><button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button><h2>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h2><button type="button" onClick={() => moveMonth(1)} aria-label="Mes siguiente"><ChevronRight size={20} /></button></div>
        {isStaff ? <button type="button" className="calendar-add-icon" onClick={openCreate} aria-label="Agendar evento"><Plus size={19} /></button> : <span />}
      </section>

      {loadError ? <div className="calendar-alert">{loadError}</div> : null}

      <div className="calendar-layout">
        <section className="calendar-month-card">
          <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {cells.map((day, index) => {
              if (day < 1 || day > daysInMonth) return <span key={`empty-${index}`} className="calendar-empty-cell" />;
              const date = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12);
              const key = dateKey(date);
              const items = byDate.get(key) || [];
              const types = [...new Set(items.map(typeForEvent))].slice(0, 3);
              const selected = key === selectedKey;
              const isToday = key === dateKey(today);
              return (
                <button key={key} type="button" className={`calendar-day${selected ? ' selected' : ''}${isToday ? ' today' : ''}${items.length ? ' has-events' : ''}`} onClick={() => setSelectedKey(key)}>
                  <span>{day}</span>
                  <i className="calendar-day-dots">{types.map((type) => <b key={type} className={`dot-${type}`} />)}</i>
                </button>
              );
            })}
          </div>
          <div className="calendar-legend"><span><i className="dot-training" />Entreno</span><span><i className="dot-match" />Partido</span><span><i className="dot-friendly" />Amistoso</span><span><i className="dot-tournament" />Torneo</span><span><i className="dot-birthday" />Cumpleaños</span></div>
        </section>

        <section className="calendar-agenda-card">
          <header className="calendar-agenda-head"><div><span>AGENDA</span><h2>{formatLongDate(selectedDate)}</h2></div><small>{selectedEvents.length} {selectedEvents.length === 1 ? 'evento' : 'eventos'}</small></header>
          <div className="calendar-agenda-list">
            {loading ? <div className="calendar-empty-state"><span className="calendar-loading-dot" /><strong>Cargando calendario…</strong></div> : selectedEvents.length ? selectedEvents.map((event) => <EventCard key={event.id} event={event} onOpen={setDetailEvent} />) : <div className="calendar-empty-state"><CalendarCheck size={24} /><strong>Sin eventos este día</strong><span>Pulsa otra fecha para consultar su agenda.</span></div>}
          </div>
        </section>
      </div>

      <EventModal event={detailEvent} isStaff={isStaff} onClose={() => setDetailEvent(null)} onEdit={openEdit} onDelete={deleteEvent} />
      <EventEditor open={editorOpen} teams={teams} form={form} setForm={setForm} saving={saving} error={formError} editing={Boolean(editingEvent)} onClose={() => { if (!saving) { setEditorOpen(false); setEditingEvent(null); } }} onSubmit={saveEvent} />
    </div>
  );
}
