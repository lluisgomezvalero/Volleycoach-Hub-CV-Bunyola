import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LockKeyhole,
  Pencil,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trophy,
  X
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './CompetitionPage.css';

const DEFAULT_NAMES = {
  CV_MURO: 'CV Muro',
  CV_ALARO: 'CV Alaró',
  CV_ARTA: 'CV Artà',
  CV_MANACOR: 'CV Manacor',
  CV_SOLLER: 'CV Sóller',
  CV_PORTO_CRISTO: 'CV Porto Cristo',
  CV_POLLENCA: 'CV Pollença',
  CV_SINEU: 'CV Sineu',
  CV_CIDE: 'CIDE',
  CV_MAYURQA: 'Mayurqa',
  CV_SON_FERRER: 'CV Son Ferrer',
  CV_BUNYOLA: 'CV Bunyola'
};

function normalizeResult(value) {
  const text = String(value ?? '').trim().replace(/[–—:]/g, '-').replace(/\s+/g, '');
  const match = text.match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  const own = Number(match[1]);
  const rival = Number(match[2]);
  if (!Number.isInteger(own) || !Number.isInteger(rival) || own < 0 || rival < 0 || own === rival) return null;
  return { own, rival };
}

function pointsForResult(own, rival) {
  const won = own > rival;
  const winner = Math.max(own, rival);
  const loser = Math.min(own, rival);
  let winnerPoints = 0;
  let loserPoints = 0;
  if (winner >= 3) {
    winnerPoints = loser === 2 ? 2 : 3;
    loserPoints = loser === 2 ? 1 : 0;
  } else if (winner === 2) {
    winnerPoints = 2;
    loserPoints = 1;
  } else {
    winnerPoints = 1;
    loserPoints = 0;
  }
  return won ? winnerPoints : loserPoints;
}

function calculateOwnStanding(events) {
  return (events || []).reduce((summary, event) => {
    const result = normalizeResult(event?.payload?.result);
    if (!result) return summary;
    summary.pj += 1;
    summary.sf += result.own;
    summary.sc += result.rival;
    if (result.own > result.rival) summary.pg += 1;
    else summary.pp += 1;
    summary.points += pointsForResult(result.own, result.rival);
    return summary;
  }, { points: 0, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0 });
}

function rowNumber(value) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? Math.round(next) : 0;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const points = rowNumber(b.points) - rowNumber(a.points);
    if (points) return points;
    const diff = (rowNumber(b.sf) - rowNumber(b.sc)) - (rowNumber(a.sf) - rowNumber(a.sc));
    if (diff) return diff;
    const sets = rowNumber(b.sf) - rowNumber(a.sf);
    if (sets) return sets;
    return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
  });
}

function resolveLogo(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const clean = raw.replace(/^\.?\//, '');
  return `../${clean}`;
}

function initials(name) {
  return String(name || 'CV')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function TeamLogo({ row }) {
  const [broken, setBroken] = useState(false);
  const src = resolveLogo(row?.logo);
  if (!src || broken) return <span className="competition-logo-fallback">{initials(row?.name)}</span>;
  return <img src={src} alt="" onError={() => setBroken(true)} />;
}

function EditTeamModal({ row, onClose, onSaved, profileId }) {
  const [form, setForm] = useState(() => ({
    name: row.name || '',
    points: rowNumber(row.points),
    pj: rowNumber(row.pj),
    pg: rowNumber(row.pg),
    pp: rowNumber(row.pp),
    sf: rowNumber(row.sf),
    sc: rowNumber(row.sc)
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: String(form.name || '').trim() || row.name,
        points: rowNumber(form.points),
        pj: rowNumber(form.pj),
        pg: rowNumber(form.pg),
        pp: rowNumber(form.pp),
        sf: rowNumber(form.sf),
        sc: rowNumber(form.sc),
        updated_by: profileId || null,
        updated_at: new Date().toISOString()
      };
      const { data, error: updateError } = await supabase
        .from('league_standings')
        .update(payload)
        .eq('id', row.id)
        .select('*')
        .single();
      if (updateError) throw updateError;
      onSaved(data);
    } catch (saveError) {
      setError(saveError?.message || 'No se pudo guardar la clasificación.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="competition-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="competition-modal" role="dialog" aria-modal="true" aria-label={`Editar ${row.name}`}>
        <header className="competition-modal-head">
          <div>
            <small>Clasificación</small>
            <h2>{row.name}</h2>
            <p>Actualiza los datos oficiales de este rival.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </header>
        <form onSubmit={submit}>
          <label className="competition-name-field"><span>Equipo</span><input value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
          <div className="competition-editor-grid">
            {[
              ['points', 'Puntos'], ['pj', 'PJ'], ['pg', 'PG'], ['pp', 'PP'], ['sf', 'SF'], ['sc', 'SC']
            ].map(([key, label]) => (
              <label key={key}><span>{label}</span><input type="number" min="0" step="1" inputMode="numeric" value={form[key]} onChange={(event) => update(key, event.target.value)} /></label>
            ))}
          </div>
          <div className="competition-form-hint">PJ = partidos jugados · PG/PP = ganados/perdidos · SF/SC = sets a favor/en contra.</div>
          {error ? <div className="competition-error">{error}</div> : null}
          <footer className="competition-modal-actions">
            <button type="button" className="competition-secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="competition-primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function CompetitionPage() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const teamId = team?.id || identity?.player?.team_id || null;
  const clubId = profile?.club_id || identity?.player?.club_id || team?.club_id || null;
  const isStaff = ['coach', 'administrator'].includes(profile?.role);

  const [rows, setRows] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(false);

  const loadData = useCallback(async () => {
    if (!teamId) {
      setRows([]);
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [standingResult, matchResult] = await Promise.all([
        supabase
          .from('league_standings')
          .select('id,club_id,context_team_id,season,team_key,name,logo,is_own,points,pj,pg,pp,sf,sc,updated_at')
          .eq('context_team_id', teamId),
        supabase
          .from('events')
          .select('id,event_type,title,starts_at,status,payload')
          .eq('team_id', teamId)
          .eq('event_type', 'match')
          .order('starts_at', { ascending: true })
      ]);
      if (standingResult.error) throw standingResult.error;
      if (matchResult.error) throw matchResult.error;

      const loadedRows = standingResult.data || [];
      const loadedMatches = matchResult.data || [];
      const ownSummary = calculateOwnStanding(loadedMatches);
      const own = loadedRows.find((row) => row.is_own) || loadedRows.find((row) => /bunyola/i.test(String(row.name || '')));
      const mergedRows = loadedRows.map((row) => row.id === own?.id ? { ...row, ...ownSummary } : row);
      setRows(mergedRows);
      setMatches(loadedMatches);

      if (isStaff && own?.id) {
        const changed = ['points', 'pj', 'pg', 'pp', 'sf', 'sc'].some((key) => rowNumber(own[key]) !== rowNumber(ownSummary[key]));
        if (changed) {
          const { error: ownError } = await supabase
            .from('league_standings')
            .update({ ...ownSummary, updated_by: profile?.id || null, updated_at: new Date().toISOString() })
            .eq('id', own.id);
          if (ownError) console.warn('No se pudo sincronizar la fila automática de CV Bunyola.', ownError);
        }
      }
    } catch (loadError) {
      setError(loadError?.message || 'No se pudo cargar la clasificación.');
    } finally {
      setLoading(false);
    }
  }, [isStaff, profile?.id, teamId]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (!teamId) return undefined;
    const channel = supabase
      .channel(`league-standings-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_standings', filter: `context_team_id=eq.${teamId}` }, () => { void loadData(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadData, teamId]);

  const sorted = useMemo(() => sortRows(rows), [rows]);
  const ownIndex = useMemo(() => sorted.findIndex((row) => row.is_own || /bunyola/i.test(String(row.name || ''))), [sorted]);
  const own = ownIndex >= 0 ? sorted[ownIndex] : null;
  const season = rows.find((row) => row.season)?.season || identity?.season?.name || '2026/27';

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es');
    if (!term) return sorted;
    return sorted.filter((row) => String(row.name || '').toLocaleLowerCase('es').includes(term));
  }, [search, sorted]);

  function handleSaved(updated) {
    setRows((current) => current.map((row) => row.id === updated.id ? updated : row));
    setEditing(null);
  }

  async function resetRivals() {
    if (!isStaff || !rows.length) return;
    const ok = window.confirm('¿Reiniciar los datos de todos los rivales? CV Bunyola seguirá calculándose automáticamente a partir de los resultados de Liga.');
    if (!ok) return;
    setResetting(true);
    setError('');
    try {
      const rivals = rows.filter((row) => !row.is_own);
      const results = await Promise.all(rivals.map((row) => supabase
        .from('league_standings')
        .update({
          name: DEFAULT_NAMES[row.team_key] || row.name,
          points: 0,
          pj: 0,
          pg: 0,
          pp: 0,
          sf: 0,
          sc: 0,
          updated_by: profile?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id)));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      await loadData();
    } catch (resetError) {
      setError(resetError?.message || 'No se pudo reiniciar la clasificación.');
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return <section className="competition-page"><div className="competition-loading"><Trophy size={22} /><span>Cargando clasificación…</span></div></section>;
  }

  return (
    <section className="competition-page">
      {error ? <div className="competition-error">{error}</div> : null}

      {own ? (
        <section className="competition-summary">
          <div className="competition-summary-team">
            <div className="competition-summary-logo"><TeamLogo row={own} /></div>
            <div><small>Temporada {season}</small><strong>{own.name}</strong><span>Datos automáticos desde los resultados de Liga</span></div>
          </div>
          <div className="competition-summary-metrics">
            <div><small>Posición</small><strong>{own.pj > 0 ? `${ownIndex + 1}º` : '—'}</strong><span>{own.pj > 0 ? `de ${sorted.length}` : 'Sin jornadas'}</span></div>
            <div><small>Puntos</small><strong>{rowNumber(own.points)}</strong><span>{rowNumber(own.pj)} PJ</span></div>
            <div><small>Balance</small><strong>{rowNumber(own.pg)}–{rowNumber(own.pp)}</strong><span>{rowNumber(own.sf)}–{rowNumber(own.sc)} sets</span></div>
          </div>
        </section>
      ) : null}

      <section className="competition-card">
        <div className="competition-toolbar">
          <label className="competition-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar equipo…" /></label>
          {isStaff ? (
            <button type="button" className="competition-reset-button" onClick={resetRivals} disabled={resetting} title="Reiniciar clasificación" aria-label="Reiniciar clasificación"><RefreshCcw size={17} /> <span>{resetting ? 'Reiniciando…' : 'Reiniciar'}</span></button>
          ) : null}
        </div>

        {!filtered.length ? <div className="competition-empty">No hay equipos que coincidan con la búsqueda.</div> : (
          <>
            <div className="competition-table-wrap">
              <table className="competition-table">
                <thead><tr><th>Pos</th><th>Equipo</th><th>PTS</th><th>PJ</th><th>PG</th><th>PP</th><th>SF</th><th>SC</th>{isStaff ? <th /> : null}</tr></thead>
                <tbody>
                  {filtered.map((row) => {
                    const position = sorted.findIndex((item) => item.id === row.id) + 1;
                    const ownRow = Boolean(row.is_own);
                    return (
                      <tr key={row.id} className={ownRow ? 'is-own' : ''}>
                        <td><span className="competition-rank">{position}</span></td>
                        <td><div className="competition-team-cell"><span className="competition-team-logo"><TeamLogo row={row} /></span><div><strong>{row.name}</strong>{ownRow ? <small><LockKeyhole size={11} /> Automático</small> : null}</div></div></td>
                        <td className="competition-points">{rowNumber(row.points)}</td><td>{rowNumber(row.pj)}</td><td>{rowNumber(row.pg)}</td><td>{rowNumber(row.pp)}</td><td>{rowNumber(row.sf)}</td><td>{rowNumber(row.sc)}</td>
                        {isStaff ? <td>{ownRow ? <span className="competition-auto-label"><LockKeyhole size={13} /> Automático</span> : <button type="button" className="competition-edit-button" onClick={() => setEditing(row)}><Pencil size={14} /> Editar</button>}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="competition-mobile-list">
              {filtered.map((row) => {
                const position = sorted.findIndex((item) => item.id === row.id) + 1;
                const ownRow = Boolean(row.is_own);
                return (
                  <article className={`competition-mobile-row${ownRow ? ' is-own' : ''}`} key={`mobile-${row.id}`}>
                    <span className="competition-mobile-rank">{position}</span>
                    <div className="competition-mobile-team"><span><TeamLogo row={row} /></span><strong>{row.name}</strong></div>
                    <div className="competition-mobile-points"><strong>{rowNumber(row.points)}</strong><small>pts</small></div>
                    <div className="competition-mobile-meta">
                      <span>PJ <b>{rowNumber(row.pj)}</b></span><span>PG <b>{rowNumber(row.pg)}</b></span><span>PP <b>{rowNumber(row.pp)}</b></span><span>SF <b>{rowNumber(row.sf)}</b></span><span>SC <b>{rowNumber(row.sc)}</b></span>
                      {ownRow ? <em><LockKeyhole size={11} /> Automático</em> : isStaff ? <button type="button" onClick={() => setEditing(row)}><Pencil size={12} /> Editar</button> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      {editing ? <EditTeamModal row={editing} onClose={() => setEditing(null)} onSaved={handleSaved} profileId={profile?.id} /> : null}
    </section>
  );
}
