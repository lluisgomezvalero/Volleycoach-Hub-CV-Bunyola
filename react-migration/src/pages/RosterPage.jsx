import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Download,
  Hash,
  Pencil,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './RosterPage.css';

const STATUS_LABELS = ['Disponible', 'Lesionada', 'Baja'];

function displayName(player) {
  return player.display_name || player.profiles?.full_name || player.profiles?.username || player.legacy_id || 'Jugadora';
}

function initials(player) {
  return displayName(player)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function normalizePosition(position) {
  const value = String(position || '').trim();
  return value || 'Sin posición';
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function formatLastLogin(value) {
  if (!value) return 'Nunca';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

export default function RosterPage() {
  const { identity } = useAuth();
  const teams = identity?.teams || [];
  const canEdit = ['coach', 'administrator'].includes(identity?.profile?.role);
  const [teamId, setTeamId] = useState(teams[0]?.id || '');
  const [players, setPlayers] = useState([]);
  const [avatars, setAvatars] = useState({});
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('Todas');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!teamId && teams[0]?.id) setTeamId(teams[0].id);
  }, [teamId, teams]);

  useEffect(() => {
    const refreshDirectory = () => setDirectoryRevision((value) => value + 1);
    window.addEventListener('volleycoach:player-directory-updated', refreshDirectory);
    return () => window.removeEventListener('volleycoach:player-directory-updated', refreshDirectory);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRoster() {
      if (!teamId) {
        setPlayers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data, error: rosterError } = await supabase
          .from('players')
          .select('id,legacy_id,display_name,profile_id,team_id,dorsal,birth_date,position,status,active,avatar_path,profiles:profile_id(id,username,full_name,avatar_path,active,last_login_at)')
          .eq('team_id', teamId)
          .eq('active', true)
          .order('dorsal', { ascending: true, nullsFirst: false });
        if (rosterError) throw rosterError;
        if (!active) return;
        const nextPlayers = data || [];
        setPlayers(nextPlayers);

        const paths = [...new Set(nextPlayers.map((player) => player.avatar_path || player.profiles?.avatar_path).filter(Boolean))];
        if (paths.length) {
          const { data: signed, error: signedError } = await supabase.storage.from('avatars').createSignedUrls(paths, 3600);
          if (!signedError && active) {
            const nextAvatars = {};
            (signed || []).forEach((row, index) => {
              if (row?.signedUrl) nextAvatars[paths[index]] = row.signedUrl;
            });
            setAvatars(nextAvatars);
          }
        } else if (active) {
          setAvatars({});
        }
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No se pudo cargar la plantilla.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadRoster();
    return () => { active = false; };
  }, [teamId, directoryRevision]);

  const positions = useMemo(() => {
    const values = [...new Set(players.map((player) => normalizePosition(player.position)))].sort((a, b) => a.localeCompare(b, 'es'));
    return ['Todas', ...values];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return players.filter((player) => {
      const matchesPosition = position === 'Todas' || normalizePosition(player.position) === position;
      const haystack = `${displayName(player)} ${player.dorsal ?? ''} ${player.position || ''}`.toLowerCase();
      return matchesPosition && (!needle || haystack.includes(needle));
    });
  }, [players, position, query]);

  const selectedTeam = teams.find((team) => team.id === teamId) || teams[0] || null;

  function avatarUrl(player) {
    const path = player.avatar_path || player.profiles?.avatar_path;
    return path ? avatars[path] : null;
  }

  function openPlayer(player) {
    setSelected({ ...player });
    setFormError('');
  }

  async function savePlayer() {
    if (!selected?.id || !canEdit) return;
    setSaving(true);
    setFormError('');
    try {
      const dorsal = selected.dorsal === '' || selected.dorsal === null ? null : Number(selected.dorsal);
      if (dorsal !== null && (!Number.isInteger(dorsal) || dorsal < 0 || dorsal > 99)) {
        throw new Error('El dorsal debe estar entre 0 y 99.');
      }
      const patch = {
        dorsal,
        position: String(selected.position || '').trim(),
        status: String(selected.status || 'Disponible').trim() || 'Disponible',
        birth_date: selected.birth_date || null,
        updated_at: new Date().toISOString()
      };
      const { data, error: saveError } = await supabase
        .from('players')
        .update(patch)
        .eq('id', selected.id)
        .select('id,dorsal,position,status,birth_date')
        .single();
      if (saveError) throw saveError;
      setPlayers((current) => current.map((player) => player.id === selected.id ? { ...player, ...data } : player));
      setSelected((current) => current ? { ...current, ...data } : current);
    } catch (saveError) {
      setFormError(saveError?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const rows = [['Nombre', 'Dorsal', 'Posición', 'Estado', 'Fecha de nacimiento']];
    filteredPlayers.forEach((player) => rows.push([
      displayName(player), player.dorsal ?? '', player.position || '', player.status || 'Disponible', player.birth_date || ''
    ]));
    const csv = '\ufeff' + rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `plantilla-${String(selectedTeam?.name || 'cv-bunyola').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  return (
    <div className="roster-page">
      <section className="roster-hero">
        <div>
          <p className="eyebrow">Plantilla · {identity?.season?.name || 'Temporada actual'}</p>
          <h1>{selectedTeam?.name || 'CV Bunyola'}</h1>
          <p>{selectedTeam?.category || 'Equipo'} · Gestión de jugadoras</p>
        </div>
        <div className="roster-hero-count">
          <Users size={22} />
          <strong>{players.length}</strong>
          <span>jugadoras</span>
        </div>
      </section>

      <section className="roster-toolbar surface-card">
        <div className="roster-toolbar-top">
          <div>
            <p className="eyebrow">Equipo</p>
            {teams.length > 1 ? (
              <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            ) : <strong>{selectedTeam?.name || 'Equipo'}</strong>}
          </div>
          <button className="secondary-button roster-export" type="button" onClick={exportCsv} disabled={!filteredPlayers.length}>
            <Download size={17} /> Exportar CSV
          </button>
        </div>

        <div className="roster-search-row">
          <label className="roster-search">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jugadora, dorsal o posición" />
          </label>
        </div>

        <div className="roster-filter-strip" aria-label="Filtrar por posición">
          {positions.map((item) => (
            <button key={item} className={position === item ? 'active' : ''} type="button" onClick={() => setPosition(item)}>{item}</button>
          ))}
        </div>
      </section>

      {loading ? <div className="roster-state-card">Cargando plantilla…</div> : null}
      {error ? <div className="roster-state-card roster-error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <div className="roster-section-heading">
            <div><p className="eyebrow">Jugadoras</p><h2>{filteredPlayers.length} en esta vista</h2></div>
            <span>Tarjetas conectadas directamente a Supabase</span>
          </div>
          <section className="roster-grid">
            {filteredPlayers.map((player) => {
              const image = avatarUrl(player);
              const status = player.status || 'Disponible';
              return (
                <button className="roster-player-card" key={player.id} type="button" onClick={() => openPlayer(player)}>
                  <div className="roster-card-topline">
                    <span className={`roster-status ${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
                    {player.dorsal !== null && player.dorsal !== undefined ? <strong className="roster-dorsal">#{player.dorsal}</strong> : <span className="roster-dorsal muted">—</span>}
                  </div>
                  <div className="roster-avatar-wrap">
                    {image ? <img src={image} alt="" className="roster-avatar-img" /> : <div className="roster-avatar-fallback">{initials(player)}</div>}
                  </div>
                  <div className="roster-card-copy">
                    <h3>{displayName(player)}</h3>
                    <span className="roster-position-pill">{normalizePosition(player.position)}</span>
                    <small><CalendarDays size={14} /> {formatDate(player.birth_date)}</small>
                  </div>
                  <div className="roster-card-footer">
                    <span><UserRound size={15} /> Ver ficha</span>
                    {canEdit ? <Pencil size={15} /> : null}
                  </div>
                </button>
              );
            })}
          </section>
          {!filteredPlayers.length ? <div className="roster-empty">No hay jugadoras que coincidan con este filtro.</div> : null}
        </>
      ) : null}

      {selected ? (
        <div className="roster-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="roster-detail" role="dialog" aria-modal="true" aria-label={`Ficha de ${displayName(selected)}`}>
            <header className="roster-detail-header">
              <div className="roster-detail-identity">
                {avatarUrl(selected) ? <img src={avatarUrl(selected)} alt="" className="roster-detail-avatar" /> : <div className="roster-detail-avatar fallback">{initials(selected)}</div>}
                <div><p className="eyebrow">Ficha de jugadora</p><h2>{displayName(selected)}</h2><span>{selected.profiles?.username ? `@${selected.profiles.username}` : 'Sin cuenta vinculada'}</span></div>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Cerrar ficha"><X /></button>
            </header>

            <div className="roster-detail-body">
              <div className="roster-detail-summary">
                <div><Hash size={17} /><span>Dorsal</span><strong>{selected.dorsal ?? '—'}</strong></div>
                <div><ShieldCheck size={17} /><span>Posición</span><strong>{normalizePosition(selected.position)}</strong></div>
                <div><CalendarDays size={17} /><span>Nacimiento</span><strong>{formatDate(selected.birth_date)}</strong></div>
              </div>

              {canEdit ? (
                <div className="roster-edit-form">
                  <div className="roster-edit-title"><Pencil size={17} /><strong>Editar datos deportivos</strong></div>
                  <div className="roster-edit-grid">
                    <label><span>Dorsal</span><input type="number" min="0" max="99" value={selected.dorsal ?? ''} onChange={(event) => setSelected((current) => ({ ...current, dorsal: event.target.value }))} /></label>
                    <label><span>Posición</span><input value={selected.position || ''} onChange={(event) => setSelected((current) => ({ ...current, position: event.target.value }))} placeholder="Ej. Colocadora" /></label>
                    <label><span>Estado</span><select value={selected.status || 'Disponible'} onChange={(event) => setSelected((current) => ({ ...current, status: event.target.value }))}>{STATUS_LABELS.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label><span>Fecha de nacimiento</span><input type="date" value={selected.birth_date || ''} onChange={(event) => setSelected((current) => ({ ...current, birth_date: event.target.value }))} /></label>
                  </div>
                  {selected.profiles?.last_login_at ? <p className="roster-login-note">Último acceso a la app: <strong>{formatLastLogin(selected.profiles.last_login_at)}</strong></p> : null}
                  {formError ? <p className="form-error">{formError}</p> : null}
                  <div className="roster-detail-actions">
                    <button className="secondary-button" type="button" onClick={() => setSelected(null)}>Cerrar</button>
                    <button className="primary-button" type="button" onClick={savePlayer} disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                  </div>
                </div>
              ) : (
                <div className="roster-player-note">Esta ficha muestra la información deportiva compartida por el equipo.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
