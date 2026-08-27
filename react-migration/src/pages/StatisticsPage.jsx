import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './StatisticsPage.css';

const METRICS = [
  { key: 'reception_perfect_pct', label: 'Recepción perfecta', short: 'Rec. perfecta', suffix: '%', tone: 'positive' },
  { key: 'reception_error_pct', label: 'Error recepción', short: 'Error recepción', suffix: '%', tone: 'negative' },
  { key: 'attack_efficiency_pct', label: 'Efectividad ataque', short: 'Efect. ataque', suffix: '%', tone: 'positive' },
  { key: 'aces', label: 'Aces', short: 'Aces', suffix: '', tone: 'info' },
  { key: 'blocks', label: 'Bloqueos', short: 'Bloqueos', suffix: '', tone: 'info' },
  { key: 'attack_errors', label: 'Errores de ataque', short: 'Error ataque', suffix: '', tone: 'negative' },
  { key: 'serve_errors', label: 'Errores de saque', short: 'Error saque', suffix: '', tone: 'negative' },
  { key: 'own_errors', label: 'Error nuestro', short: 'Error nuestro', suffix: '', tone: 'negative' },
  { key: 'opponent_errors', label: 'Error rival', short: 'Error rival', suffix: '', tone: 'positive' }
];

const DEFAULT_VISIBLE = ['reception_perfect_pct', 'reception_error_pct', 'aces'];

function n(value) {
  if (value === '' || value === null || value === undefined) return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function metricFrom(source, key) {
  const aliases = {
    reception_perfect_pct: ['reception_perfect_pct', 'receptionPerfectPct', 'recPerfectPct', 'receptionPerfect', 'perfectReception'],
    reception_error_pct: ['reception_error_pct', 'receptionErrorPct', 'recErrorPct', 'receptionError'],
    attack_efficiency_pct: ['attack_efficiency_pct', 'attackEfficiencyPct', 'attackEfficiency', 'attack_effectiveness'],
    aces: ['aces', 'serveAces'],
    blocks: ['blocks', 'blockPoints', 'blockingPoints'],
    attack_errors: ['attack_errors', 'attackErrors'],
    serve_errors: ['serve_errors', 'serveErrors'],
    own_errors: ['own_errors', 'ownErrors', 'teamErrors'],
    opponent_errors: ['opponent_errors', 'opponentErrors', 'rivalErrors']
  };
  for (const alias of aliases[key] || [key]) {
    const value = source?.[alias];
    if (value !== undefined && value !== null && value !== '') return n(value);
  }
  return null;
}

function normalizePayload(record, event) {
  const direct = record?.payload || {};
  const legacy = event?.payload?.stats || {};
  const source = { ...legacy, ...direct };
  const metrics = {};
  METRICS.forEach((metric) => { metrics[metric.key] = metricFrom(source, metric.key); });
  return {
    ...source,
    result: String(source.result ?? event?.payload?.result ?? '').trim(),
    notes: String(source.notes ?? '').trim(),
    metrics
  };
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(date)
    .replaceAll('.', '');
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function eventLabel(event, index) {
  const type = event?.event_type;
  if (type === 'friendly') return 'Amistoso';
  if (type === 'tournament') return 'Torneo';
  const round = event?.payload?.round ?? event?.payload?.jornada ?? event?.round;
  if (round) return `Jornada ${round}`;
  return `Partido ${index + 1}`;
}

function statusLabel(status) {
  if (status === 'published') return 'Publicada';
  if (status === 'archived') return 'Archivada';
  if (status === 'draft') return 'Borrador';
  return 'Sin datos';
}

function parseResult(result) {
  const match = String(result || '').match(/(\d+)\s*[-–:]\s*(\d+)/);
  if (!match) return null;
  return { ours: Number(match[1]), theirs: Number(match[2]) };
}

function mean(values) {
  const valid = values.map(n).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function MetricValue({ metric, value, compact = false }) {
  const shown = Number.isFinite(n(value)) ? `${n(value)}${metric.suffix}` : '—';
  return (
    <div className={`stats-metric stats-tone-${metric.tone}${compact ? ' compact' : ''}`}>
      <small>{metric.short}</small>
      <strong>{shown}</strong>
    </div>
  );
}

function MiniTrend({ label, metricKey, items, tone = 'positive' }) {
  const values = items.map((item) => item.payload.metrics[metricKey]).filter(Number.isFinite);
  const max = Math.max(100, ...values, 1);
  return (
    <section className="stats-trend-card">
      <div className="stats-trend-head">
        <div><small>Evolución por partido</small><h3>{label}</h3></div>
        <strong>{values.length ? `${mean(values).toFixed(1)}%` : '—'}</strong>
      </div>
      {items.length ? (
        <div className="stats-bars" style={{ '--stats-count': Math.max(items.length, 1) }}>
          {items.map((item, index) => {
            const value = n(item.payload.metrics[metricKey]);
            const height = Number.isFinite(value) ? Math.max(4, Math.min(100, (value / max) * 100)) : 2;
            return (
              <div className="stats-bar-col" key={item.event.id}>
                <div className="stats-bar-track">
                  <i className={`stats-bar stats-bar-${tone}${!Number.isFinite(value) ? ' empty' : ''}`} style={{ height: `${height}%` }} />
                </div>
                <small>{index + 1}</small>
              </div>
            );
          })}
        </div>
      ) : <div className="stats-empty-inline">Todavía no hay partidos con datos.</div>}
    </section>
  );
}

function EditorModal({ item, team, profile, onClose, onSaved }) {
  const existing = item.record;
  const normalized = item.payload;
  const [result, setResult] = useState(normalized.result || '');
  const [notes, setNotes] = useState(normalized.notes || '');
  const [values, setValues] = useState(() => Object.fromEntries(METRICS.map((metric) => [metric.key, normalized.metrics[metric.key] ?? ''])));
  const [visible, setVisible] = useState(() => new Set(existing?.visible_metrics?.length ? existing.visible_metrics : DEFAULT_VISIBLE));
  const [status, setStatus] = useState(existing?.status || 'draft');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setMetric(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleVisible(key) {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function save(nextStatus = status) {
    if (!team?.id || !profile?.club_id) return;
    setSaving(true);
    setError('');
    try {
      const metricsPayload = Object.fromEntries(METRICS.map((metric) => [metric.key, n(values[metric.key])]));
      const payload = { ...metricsPayload, result: result.trim(), notes: notes.trim() };
      const row = {
        event_id: item.event.id,
        club_id: profile.club_id,
        team_id: team.id,
        status: nextStatus,
        visible_metrics: Array.from(visible),
        payload,
        created_by: existing?.created_by || profile.id,
        published_at: nextStatus === 'published' ? (existing?.published_at || new Date().toISOString()) : null
      };
      const { data, error: saveError } = await supabase
        .from('match_statistics')
        .upsert(row, { onConflict: 'event_id' })
        .select('*')
        .single();
      if (saveError) throw saveError;
      onSaved(data);
    } catch (saveError) {
      setError(saveError?.message || 'No se pudieron guardar las estadísticas.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stats-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="stats-modal" role="dialog" aria-modal="true" aria-label="Editar estadísticas del partido">
        <header className="stats-modal-head">
          <div><small>{item.label}</small><h2>{item.event.title}</h2><p>{formatDate(item.event.starts_at)} · {formatTime(item.event.starts_at)}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X /></button>
        </header>
        <div className="stats-modal-scroll">
          <section className="stats-editor-section stats-editor-result">
            <div><small>Resultado</small><strong>Marcador del partido</strong></div>
            <input value={result} onChange={(event) => setResult(event.target.value)} placeholder="Ej: 3-1" inputMode="numeric" />
          </section>

          <section className="stats-editor-section">
            <div className="stats-editor-title"><div><small>Rendimiento</small><strong>Datos del partido</strong></div><Activity size={20} /></div>
            <div className="stats-editor-grid">
              {METRICS.map((metric) => (
                <label key={metric.key}>
                  <span>{metric.label}</span>
                  <div><input type="number" step={metric.suffix === '%' ? '0.1' : '1'} min="0" value={values[metric.key]} onChange={(event) => setMetric(metric.key, event.target.value)} /><em>{metric.suffix || 'n'}</em></div>
                </label>
              ))}
            </div>
          </section>

          <section className="stats-editor-section">
            <div className="stats-editor-title"><div><small>Vista jugadoras</small><strong>Qué quieres compartir</strong><p>Solo verán estas métricas cuando la estadística esté publicada.</p></div><Eye size={20} /></div>
            <div className="stats-visible-grid">
              {METRICS.map((metric) => (
                <button type="button" key={metric.key} className={visible.has(metric.key) ? 'active' : ''} onClick={() => toggleVisible(metric.key)}>
                  <span>{visible.has(metric.key) ? <CheckCircle2 size={17} /> : <Eye size={17} />}</span>
                  <strong>{metric.label}</strong>
                </button>
              ))}
            </div>
          </section>

          <label className="stats-notes-field">
            <span>Notas del cuerpo técnico</span>
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto, incidencias o lectura del partido…" />
          </label>

          {error ? <div className="stats-error">{error}</div> : null}
        </div>
        <footer className="stats-modal-actions">
          <button type="button" className="stats-action-muted" onClick={() => { setStatus('draft'); void save('draft'); }} disabled={saving}><Save size={17} /> Guardar borrador</button>
          <button type="button" className="stats-action-primary" onClick={() => { setStatus('published'); void save('published'); }} disabled={saving}><ShieldCheck size={17} /> {saving ? 'Guardando…' : 'Publicar'}</button>
        </footer>
      </section>
    </div>
  );
}

export default function StatisticsPage() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const teamId = team?.id || identity?.player?.team_id || null;
  const isStaff = ['coach', 'administrator'].includes(profile?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [records, setRecords] = useState([]);
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const loadData = useCallback(async () => {
    if (!teamId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [eventResult, statsResult] = await Promise.all([
        supabase
          .from('events')
          .select('id,event_type,title,starts_at,ends_at,location,status,payload')
          .eq('team_id', teamId)
          .in('event_type', ['match', 'friendly', 'tournament'])
          .order('starts_at', { ascending: false }),
        supabase
          .from('match_statistics')
          .select('id,event_id,club_id,team_id,status,visible_metrics,payload,published_at,created_by,updated_at')
          .eq('team_id', teamId)
          .order('updated_at', { ascending: false })
      ]);
      if (eventResult.error) throw eventResult.error;
      if (statsResult.error) throw statsResult.error;
      setEvents(eventResult.data || []);
      setRecords(statsResult.data || []);
    } catch (loadError) {
      setError(loadError?.message || 'No se pudieron cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const items = useMemo(() => {
    const byEvent = new Map(records.map((record) => [record.event_id, record]));
    return events.map((event, index) => {
      const record = byEvent.get(event.id) || null;
      return { event, record, label: eventLabel(event, index), payload: normalizePayload(record, event) };
    });
  }, [events, records]);

  const withData = useMemo(() => items.filter((item) => item.record || Object.values(item.payload.metrics).some(Number.isFinite)), [items]);

  const seasonSummary = useMemo(() => {
    const resultRows = withData.map((item) => parseResult(item.payload.result)).filter(Boolean);
    const wins = resultRows.filter((result) => result.ours > result.theirs).length;
    const losses = resultRows.filter((result) => result.ours < result.theirs).length;
    const metricValues = (key) => withData.map((item) => item.payload.metrics[key]).filter(Number.isFinite);
    return {
      wins,
      losses,
      recPerfect: mean(metricValues('reception_perfect_pct')),
      recError: mean(metricValues('reception_error_pct')),
      attackEff: mean(metricValues('attack_efficiency_pct')),
      aces: metricValues('aces').reduce((sum, value) => sum + value, 0),
      blocks: metricValues('blocks').reduce((sum, value) => sum + value, 0),
      attackErrors: metricValues('attack_errors').reduce((sum, value) => sum + value, 0),
      serveErrors: metricValues('serve_errors').reduce((sum, value) => sum + value, 0),
      ownErrors: metricValues('own_errors').reduce((sum, value) => sum + value, 0),
      opponentErrors: metricValues('opponent_errors').reduce((sum, value) => sum + value, 0)
    };
  }, [withData]);

  const filteredItems = useMemo(() => {
    if (!isStaff) return items;
    if (filter === 'all') return items;
    if (filter === 'empty') return items.filter((item) => !item.record);
    return items.filter((item) => item.record?.status === filter);
  }, [filter, isStaff, items]);

  const editingItem = editingId ? items.find((item) => item.event.id === editingId) : null;

  async function archiveRecord(item) {
    if (!item.record) return;
    const { data, error: archiveError } = await supabase
      .from('match_statistics')
      .update({ status: 'archived', published_at: null })
      .eq('id', item.record.id)
      .select('*')
      .single();
    if (archiveError) { setError(archiveError.message); return; }
    setRecords((current) => current.map((record) => record.id === data.id ? data : record));
  }

  function applySaved(data) {
    setRecords((current) => {
      const exists = current.some((record) => record.id === data.id);
      return exists ? current.map((record) => record.id === data.id ? data : record) : [data, ...current];
    });
    setEditingId(null);
    setOpenId(data.event_id);
  }

  if (loading) return <div className="stats-loading">Cargando estadísticas…</div>;

  if (!teamId) {
    return <section className="stats-shell"><div className="stats-empty-state"><BarChart3 /><h2>Estadísticas</h2><p>No hemos encontrado un equipo asociado a este perfil.</p></div></section>;
  }

  return (
    <section className="stats-shell">
      <header className="stats-hero">
        <div>
          <span className="stats-eyebrow"><Trophy size={14} /> Temporada {identity?.season?.name || '2026/27'}</span>
          <h1>Estadísticas</h1>
          <p>{isStaff ? 'Rendimiento del equipo, partido a partido.' : 'Consulta los datos que el cuerpo técnico ha compartido contigo.'}</p>
        </div>
        {isStaff ? <div className="stats-record"><strong>{seasonSummary.wins}-{seasonSummary.losses}</strong><span>Balance</span></div> : <ShieldCheck className="stats-player-shield" />}
      </header>

      {error ? <div className="stats-error">{error}</div> : null}

      {isStaff ? (
        <>
          <section className="stats-priority-card">
            <div className="stats-section-head"><div><span>Claves de rendimiento</span><h2>Lo más importante</h2></div><Sparkles size={20} /></div>
            <div className="stats-priority-grid">
              <MetricValue metric={METRICS[0]} value={seasonSummary.recPerfect === null ? null : seasonSummary.recPerfect.toFixed(1)} />
              <MetricValue metric={METRICS[1]} value={seasonSummary.recError === null ? null : seasonSummary.recError.toFixed(1)} />
              <MetricValue metric={METRICS[2]} value={seasonSummary.attackEff === null ? null : seasonSummary.attackEff.toFixed(1)} />
            </div>
          </section>

          <details className="stats-season-more">
            <summary><span>Más datos de temporada</span></summary>
            <div className="stats-season-metrics">
              <MetricValue metric={METRICS[3]} value={seasonSummary.aces} compact />
              <MetricValue metric={METRICS[4]} value={seasonSummary.blocks} compact />
              <MetricValue metric={METRICS[5]} value={seasonSummary.attackErrors} compact />
              <MetricValue metric={METRICS[6]} value={seasonSummary.serveErrors} compact />
              <MetricValue metric={METRICS[7]} value={seasonSummary.ownErrors} compact />
              <MetricValue metric={METRICS[8]} value={seasonSummary.opponentErrors} compact />
            </div>
          </details>

          <div className="stats-trends-grid">
            <MiniTrend label="Recepción perfecta (# +)" metricKey="reception_perfect_pct" items={withData.slice().reverse()} tone="positive" />
            <MiniTrend label="Error en recepción (=)" metricKey="reception_error_pct" items={withData.slice().reverse()} tone="negative" />
          </div>
        </>
      ) : null}

      <section className="stats-matches-card">
        <div className="stats-list-head">
          <div><span>{isStaff ? 'Partidos y jornadas' : 'Tus partidos'}</span><h2>{isStaff ? 'Estadísticas de la temporada' : 'Resumen publicado'}</h2><p>{isStaff ? 'Abre una jornada para revisar, editar o publicar los datos.' : 'Solo aparecen datos que el cuerpo técnico ha decidido compartir.'}</p></div>
          {isStaff ? (
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">Todas</option>
              <option value="published">Publicadas</option>
              <option value="draft">Borradores</option>
              <option value="archived">Archivadas</option>
              <option value="empty">Sin datos</option>
            </select>
          ) : null}
        </div>

        <div className="stats-match-list">
          {filteredItems.length ? filteredItems.map((item) => {
            const expanded = openId === item.event.id;
            const visibleMetrics = isStaff
              ? METRICS
              : METRICS.filter((metric) => item.record?.visible_metrics?.includes(metric.key));
            const canOpen = isStaff || item.record?.status === 'published';
            return (
              <article className={`stats-match-row stats-status-${item.record?.status || 'empty'}`} key={item.event.id}>
                <button className="stats-match-summary" type="button" disabled={!canOpen} onClick={() => setOpenId(expanded ? null : item.event.id)}>
                  <div className="stats-match-main">
                    <small><i /> {item.label} · {statusLabel(item.record?.status)}</small>
                    <strong>{item.event.title}</strong>
                    <span>{formatDate(item.event.starts_at)}{formatTime(item.event.starts_at) ? ` · ${formatTime(item.event.starts_at)}` : ''}</span>
                  </div>
                  <div className="stats-match-side">
                    <strong>{item.payload.result || '—'}</strong>
                    {canOpen ? (expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />) : <Eye size={17} />}
                  </div>
                </button>

                {expanded ? (
                  <div className="stats-match-expanded">
                    {visibleMetrics.length ? <div className="stats-match-metrics">{visibleMetrics.map((metric) => <MetricValue key={metric.key} metric={metric} value={item.payload.metrics[metric.key]} compact />)}</div> : <div className="stats-empty-inline">No hay métricas visibles para este partido.</div>}
                    {item.payload.notes && isStaff ? <p className="stats-match-notes">{item.payload.notes}</p> : null}
                    {isStaff ? (
                      <div className="stats-match-actions">
                        <button type="button" onClick={() => setEditingId(item.event.id)}><Pencil size={16} /> {item.record ? 'Editar' : 'Añadir datos'}</button>
                        {item.record?.status !== 'archived' && item.record ? <button type="button" onClick={() => void archiveRecord(item)}><Archive size={16} /> Archivar</button> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isStaff && !item.record ? <button type="button" className="stats-quick-add" onClick={() => setEditingId(item.event.id)}><Plus size={16} /> Añadir estadística</button> : null}
              </article>
            );
          }) : <div className="stats-empty-state compact"><Target /><h3>No hay partidos en este filtro</h3><p>Cuando haya jornadas o estadísticas aparecerán aquí.</p></div>}
        </div>
      </section>

      {!isStaff && !records.length ? (
        <div className="stats-player-note"><ShieldCheck size={20} /><div><strong>Aún no hay estadísticas publicadas</strong><span>Cuando el cuerpo técnico publique un partido, podrás consultar aquí únicamente los indicadores seleccionados para el equipo.</span></div></div>
      ) : null}

      {editingItem ? <EditorModal item={editingItem} team={team || { id: teamId }} profile={profile} onClose={() => setEditingId(null)} onSaved={applySaved} /> : null}
    </section>
  );
}
