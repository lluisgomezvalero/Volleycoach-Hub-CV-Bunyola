import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleGauge,
  Dumbbell,
  History,
  LoaderCircle,
  Medal,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  X
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './PerformancePage.css';

const TESTS = ['SJ', 'CMJ', 'Abalakov', 'Drop Jump'];
const TABS = [...TESTS, 'Histórico'];

const TEST_META = {
  SJ: { unit: 'cm', decimals: 1, label: 'Squat Jump', help: 'Salto sin contramovimiento.' },
  CMJ: { unit: 'cm', decimals: 1, label: 'CMJ', help: 'Salto con contramovimiento.' },
  Abalakov: { unit: 'cm', decimals: 1, label: 'Abalakov', help: 'Salto con participación libre de brazos.' },
  'Drop Jump': { unit: 'RSI', decimals: 2, label: 'Drop Jump', help: 'Índice de fuerza reactiva (RSI).' }
};

function playerName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function initials(value) {
  return String(value || 'VB').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function testMeta(test) {
  return TEST_META[test] || TEST_META.CMJ;
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatValue(value, test, withUnit = true) {
  const number = numeric(value);
  if (number === null) return '—';
  const meta = testMeta(test);
  return `${number.toFixed(meta.decimals)}${withUnit ? ` ${meta.unit}` : ''}`;
}

function shortDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date).replace('.', '');
}

function fullDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function sortAsc(rows) {
  return [...rows].sort((a, b) => String(a.tested_on).localeCompare(String(b.tested_on)) || String(a.created_at).localeCompare(String(b.created_at)));
}

function sortDesc(rows) {
  return [...rows].sort((a, b) => String(b.tested_on).localeCompare(String(a.tested_on)) || String(b.created_at).localeCompare(String(a.created_at)));
}

function latestByPlayer(rows) {
  const map = new Map();
  sortDesc(rows).forEach((row) => {
    if (!map.has(row.player_id)) map.set(row.player_id, row);
  });
  return map;
}

function deltaFor(rows) {
  const ordered = sortAsc(rows);
  if (ordered.length < 2) return null;
  const first = numeric(ordered[0].value);
  const last = numeric(ordered[ordered.length - 1].value);
  return first === null || last === null ? null : last - first;
}

function Trend({ records, test, compact = false }) {
  const clean = sortAsc(records).filter((row) => numeric(row.value) !== null).slice(compact ? -8 : -12);
  if (!clean.length) return <div className="perf-chart-empty">Aún no hay registros para este test.</div>;
  const values = clean.map((row) => numeric(row.value));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min = Math.max(0, min - 1);
    max += 1;
  }
  const width = 640;
  const height = compact ? 190 : 235;
  const padX = 36;
  const padTop = 22;
  const padBottom = 38;
  const x = (index) => clean.length === 1 ? width / 2 : padX + index * ((width - padX * 2) / (clean.length - 1));
  const y = (value) => padTop + ((max - value) / (max - min)) * (height - padTop - padBottom);
  const points = clean.map((row, index) => `${x(index)},${y(numeric(row.value))}`).join(' ');
  const meta = testMeta(test);
  return (
    <div className="perf-chart-wrap">
      <svg className="perf-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Evolución de ${test}`}>
        <line className="perf-axis" x1={padX} y1={height - padBottom} x2={width - padX} y2={height - padBottom} />
        <line className="perf-grid-line" x1={padX} y1={padTop} x2={width - padX} y2={padTop} />
        <line className="perf-grid-line" x1={padX} y1={(padTop + height - padBottom) / 2} x2={width - padX} y2={(padTop + height - padBottom) / 2} />
        <polyline className="perf-trend-line" points={points} />
        {clean.map((row, index) => (
          <g key={row.id}>
            <circle className="perf-trend-dot" cx={x(index)} cy={y(numeric(row.value))} r="5" />
            <title>{`${fullDate(row.tested_on)} · ${formatValue(row.value, test)}`}</title>
          </g>
        ))}
        <text className="perf-chart-label" x={padX} y={height - 12} textAnchor="start">{shortDate(clean[0].tested_on)}</text>
        <text className="perf-chart-label" x={width - padX} y={height - 12} textAnchor="end">{shortDate(clean[clean.length - 1].tested_on)}</text>
        <text className="perf-chart-value" x={padX} y={padTop - 7} textAnchor="start">{max.toFixed(meta.decimals)} {meta.unit}</text>
        <text className="perf-chart-value" x={padX} y={height - padBottom - 7} textAnchor="start">{min.toFixed(meta.decimals)} {meta.unit}</text>
      </svg>
    </div>
  );
}

function DeltaBadge({ delta, test }) {
  if (!Number.isFinite(delta)) return <span className="perf-delta neutral">Sin comparación</span>;
  const meta = testMeta(test);
  const positive = delta > 0;
  const negative = delta < 0;
  return (
    <span className={`perf-delta ${positive ? 'positive' : negative ? 'negative' : 'neutral'}`}>
      {positive ? <ArrowUpRight size={14} /> : negative ? <ArrowDownRight size={14} /> : null}
      {delta > 0 ? '+' : ''}{delta.toFixed(meta.decimals)} {meta.unit}
    </span>
  );
}

function PlayerDetail({ player, test, records, onClose }) {
  const ordered = sortAsc(records);
  const latest = ordered[ordered.length - 1] || null;
  const best = ordered.length ? Math.max(...ordered.map((row) => numeric(row.value) ?? -Infinity)) : null;
  const delta = deltaFor(ordered);
  return (
    <div className="perf-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="perf-detail-sheet" role="dialog" aria-modal="true" aria-label={`Rendimiento de ${playerName(player)}`}>
        <header className="perf-detail-head">
          <div className="perf-person">
            <span className="perf-avatar">{initials(playerName(player))}</span>
            <div><strong>{playerName(player)}</strong><small>#{player.dorsal || '—'} · {test}</small></div>
          </div>
          <button type="button" className="perf-icon-btn" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
        </header>
        <div className="perf-detail-body">
          <div className="perf-detail-kpis">
            <article><small>Último</small><strong>{latest ? formatValue(latest.value, test) : '—'}</strong><span>{latest ? shortDate(latest.tested_on) : 'Sin test'}</span></article>
            <article><small>Mejor</small><strong>{best !== null && Number.isFinite(best) ? formatValue(best, test) : '—'}</strong><span>mejor registro</span></article>
            <article><small>Cambio</small><strong><DeltaBadge delta={delta} test={test} /></strong><span>primero → último</span></article>
            <article><small>Tests</small><strong>{ordered.length}</strong><span>registros</span></article>
          </div>
          <section className="perf-detail-chart">
            <div className="perf-section-heading"><div><small>Evolución</small><h3>{testMeta(test).label}</h3></div><span>{ordered.length ? `${shortDate(ordered[0].tested_on)} → ${shortDate(ordered[ordered.length - 1].tested_on)}` : 'Sin datos'}</span></div>
            <Trend records={ordered} test={test} compact />
          </section>
          <section className="perf-log-card">
            <div className="perf-section-heading"><div><small>Histórico</small><h3>Últimos registros</h3></div></div>
            <div className="perf-log-list">
              {sortDesc(ordered).slice(0, 8).map((row) => (
                <div key={row.id}><span><CalendarDays size={14} /><b>{fullDate(row.tested_on)}</b>{row.notes ? <small>{row.notes}</small> : null}</span><strong>{formatValue(row.value, test)}</strong></div>
              ))}
              {!ordered.length ? <p className="perf-empty-line">No hay registros todavía.</p> : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export default function PerformancePage() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const teamId = team?.id || identity?.player?.team_id || null;
  const isStaff = ['coach', 'administrator'].includes(profile?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [players, setPlayers] = useState([]);
  const [records, setRecords] = useState([]);
  const [activeTab, setActiveTab] = useState('CMJ');
  const [detailPlayerId, setDetailPlayerId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formPlayerId, setFormPlayerId] = useState('');
  const [formTest, setFormTest] = useState('CMJ');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formValue, setFormValue] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [historyPlayerId, setHistoryPlayerId] = useState('');
  const [historyTest, setHistoryTest] = useState('CMJ');

  async function loadData({ silent = false } = {}) {
    if (!teamId) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const playerRequest = isStaff
        ? supabase.from('players').select('id,legacy_id,dorsal,position,avatar_path,profiles:profile_id(full_name,username)').eq('team_id', teamId).eq('active', true).order('dorsal', { ascending: true, nullsFirst: false })
        : identity?.player?.id
          ? supabase.from('players').select('id,legacy_id,dorsal,position,avatar_path,profiles:profile_id(full_name,username)').eq('id', identity.player.id).single()
          : Promise.resolve({ data: null, error: null });
      const recordRequest = supabase
        .from('performance_tests')
        .select('id,player_id,test_type,value,unit,tested_on,notes,recorded_by,created_at')
        .order('tested_on', { ascending: false })
        .order('created_at', { ascending: false });
      const [playerResult, recordResult] = await Promise.all([playerRequest, recordRequest]);
      if (playerResult.error) throw playerResult.error;
      if (recordResult.error) throw recordResult.error;
      const nextPlayers = isStaff ? (playerResult.data || []) : (playerResult.data ? [playerResult.data] : []);
      setPlayers(nextPlayers);
      setRecords(recordResult.data || []);
      setFormPlayerId((current) => current || nextPlayers[0]?.id || '');
      setHistoryPlayerId((current) => current || nextPlayers[0]?.id || '');
    } catch (loadError) {
      setError(loadError?.message || 'No se pudo cargar Rendimiento.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, [identity?.player?.id, isStaff, teamId]);

  const visiblePlayerIds = useMemo(() => new Set(players.map((player) => player.id)), [players]);
  const visibleRecords = useMemo(() => records.filter((row) => visiblePlayerIds.has(row.player_id)), [records, visiblePlayerIds]);
  const currentRecords = useMemo(() => activeTab === 'Histórico' ? visibleRecords : visibleRecords.filter((row) => row.test_type === activeTab), [activeTab, visibleRecords]);
  const currentLatestMap = useMemo(() => activeTab === 'Histórico' ? new Map() : latestByPlayer(currentRecords), [activeTab, currentRecords]);

  const summary = useMemo(() => {
    if (activeTab === 'Histórico') {
      const last = sortDesc(visibleRecords)[0] || null;
      return { total: visibleRecords.length, evaluated: new Set(visibleRecords.map((row) => row.player_id)).size, last };
    }
    const latestRows = [...currentLatestMap.values()];
    const values = latestRows.map((row) => numeric(row.value)).filter((value) => value !== null);
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const best = currentRecords.length ? [...currentRecords].sort((a, b) => (numeric(b.value) ?? -Infinity) - (numeric(a.value) ?? -Infinity))[0] : null;
    const last = sortDesc(currentRecords)[0] || null;
    return { average, best, last, evaluated: latestRows.length };
  }, [activeTab, currentLatestMap, currentRecords, visibleRecords]);

  const detailPlayer = players.find((player) => player.id === detailPlayerId) || null;
  const detailTest = activeTab === 'Histórico' ? historyTest : activeTab;
  const detailRecords = detailPlayer ? visibleRecords.filter((row) => row.player_id === detailPlayer.id && row.test_type === detailTest) : [];
  const historyPlayer = players.find((player) => player.id === historyPlayerId) || players[0] || null;
  const historyRecords = historyPlayer ? visibleRecords.filter((row) => row.player_id === historyPlayer.id && row.test_type === historyTest) : [];

  async function submitTest(event) {
    event.preventDefault();
    if (!isStaff || saving) return;
    const value = Number(formValue);
    if (!formPlayerId || !TESTS.includes(formTest) || !formDate || !Number.isFinite(value) || value <= 0) {
      setError('Completa jugadora, test, fecha y un resultado válido mayor que 0.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const meta = testMeta(formTest);
      const { data, error: insertError } = await supabase
        .from('performance_tests')
        .insert({
          player_id: formPlayerId,
          test_type: formTest,
          value,
          unit: meta.unit,
          tested_on: formDate,
          notes: formNotes.trim() || null,
          recorded_by: profile?.id || null
        })
        .select('id,player_id,test_type,value,unit,tested_on,notes,recorded_by,created_at')
        .single();
      if (insertError) throw insertError;
      setRecords((rows) => [data, ...rows.filter((row) => row.id !== data.id)]);
      setActiveTab(formTest);
      setFormValue('');
      setFormNotes('');
      setFormOpen(false);
      setNotice(`${formTest} registrado correctamente.`);
    } catch (saveError) {
      setError(saveError?.message || 'No se pudo registrar el test.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="perf-page"><div className="perf-loading"><LoaderCircle className="perf-spin" /> Cargando rendimiento…</div></div>;
  }

  if (!teamId) {
    return <div className="perf-page"><section className="perf-empty-state"><CircleGauge size={32} /><h2>No hay un equipo activo</h2><p>Necesitamos un equipo para mostrar los tests de rendimiento.</p></section></div>;
  }

  return (
    <div className="perf-page">
      <header className="perf-header">
        <div>
          <span className="perf-eyebrow"><Activity size={15} /> Rendimiento</span>
          <h1>{isStaff ? 'Tests físicos del equipo' : 'Tu rendimiento'}</h1>
          <p>{isStaff ? 'Seguimiento de salto y fuerza reactiva, con evolución individual.' : 'Consulta tu evolución en los tests registrados por el cuerpo técnico.'}</p>
        </div>
        <div className="perf-header-actions">
          <button type="button" className="perf-refresh" onClick={() => void loadData({ silent: true })}><RefreshCw size={16} /> Actualizar</button>
          {isStaff ? <button type="button" className="perf-new" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={17} /> Nuevo test</button> : null}
        </div>
      </header>

      {error ? <div className="perf-error">{error}<button type="button" onClick={() => setError('')}>×</button></div> : null}
      {notice ? <div className="perf-notice"><Sparkles size={16} /> {notice}</div> : null}


      {!visibleRecords.length ? (
        <section className="perf-empty-state">
          <CircleGauge size={32} />
          <h2>Aún no hay tests de rendimiento</h2>
          <p>{isStaff ? 'Registra el primer SJ, CMJ, Abalakov o Drop Jump para empezar el seguimiento del equipo.' : 'Cuando el cuerpo técnico registre tu primer test, aparecerá aquí tu evolución.'}</p>
          {isStaff ? <button type="button" className="perf-new" onClick={() => { setError(''); setFormOpen(true); }}><Plus size={17} /> Registrar primer test</button> : null}
        </section>
      ) : null}

      <nav className="perf-tabs" aria-label="Tests de rendimiento">
        {TABS.map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => { setActiveTab(tab); if (tab !== 'Histórico') setHistoryTest(tab); }}>{tab === 'Histórico' ? <History size={15} /> : null}{tab}</button>)}
      </nav>

      {activeTab === 'Histórico' ? (
        <>
          <section className="perf-summary perf-summary-history">
            <div className="perf-summary-title"><span>Histórico</span><strong>Visión global</strong></div>
            <div className="perf-kpis">
              <article><small>Registros</small><strong>{summary.total}</strong><span>todos los tests</span></article>
              {isStaff ? <article><small>Jugadoras</small><strong>{summary.evaluated} de {players.length}</strong><span>con algún registro</span></article> : <article><small>Tests realizados</small><strong>{summary.total}</strong><span>tu histórico</span></article>}
              <article><small>Último test</small><strong>{summary.last ? summary.last.test_type : '—'}</strong><span>{summary.last ? fullDate(summary.last.tested_on) : 'Sin registros'}</span></article>
              <article><small>Última marca</small><strong>{summary.last ? formatValue(summary.last.value, summary.last.test_type) : '—'}</strong><span>{summary.last ? testMeta(summary.last.test_type).label : 'Sin datos'}</span></article>
            </div>
          </section>

          <section className="perf-history-grid">
            <article className="perf-panel perf-history-chart-card">
              <div className="perf-section-heading"><div><small>Histórico individual</small><h2>Evolución</h2></div><TrendingUp size={20} /></div>
              <div className={`perf-history-filters ${!isStaff ? 'single' : ''}`}>
                {isStaff ? <label><span>Jugadora</span><select value={historyPlayerId} onChange={(event) => setHistoryPlayerId(event.target.value)}>{players.map((player) => <option key={player.id} value={player.id}>{playerName(player)} · #{player.dorsal || '—'}</option>)}</select></label> : null}
                <label><span>Test</span><select value={historyTest} onChange={(event) => setHistoryTest(event.target.value)}>{TESTS.map((test) => <option key={test}>{test}</option>)}</select></label>
              </div>
              <div className="perf-history-person"><span className="perf-avatar">{initials(playerName(historyPlayer))}</span><div><strong>{playerName(historyPlayer)}</strong><small>{historyTest} · {historyRecords.length} registro{historyRecords.length === 1 ? '' : 's'}</small></div></div>
              <Trend records={historyRecords} test={historyTest} />
            </article>
            <article className="perf-panel perf-history-log-card">
              <div className="perf-section-heading"><div><small>Registros</small><h2>Últimas mediciones</h2></div><CalendarDays size={20} /></div>
              <div className="perf-log-list">
                {sortDesc(historyRecords).map((row) => <div key={row.id}><span><b>{fullDate(row.tested_on)}</b>{row.notes ? <small>{row.notes}</small> : <small>{historyTest}</small>}</span><strong>{formatValue(row.value, historyTest)}</strong></div>)}
                {!historyRecords.length ? <p className="perf-empty-line">Sin registros para este test.</p> : null}
              </div>
            </article>
          </section>
        </>
      ) : (
        <>
          <section className="perf-summary">
            <div className="perf-summary-title"><span>{testMeta(activeTab).label}</span><strong>{testMeta(activeTab).help}</strong></div>
            <div className="perf-kpis">
              {isStaff ? (
                <>
                  <article><small>Media actual</small><strong>{formatValue(summary.average, activeTab)}</strong><span>última marca por jugadora</span></article>
                  <article><small>Mejor marca</small><strong>{summary.best ? formatValue(summary.best.value, activeTab) : '—'}</strong><span>{summary.best ? playerName(players.find((player) => player.id === summary.best.player_id)) : 'Sin datos'}</span></article>
                  <article><small>Evaluadas</small><strong>{summary.evaluated} de {players.length}</strong><span>con registro de {activeTab}</span></article>
                  <article><small>Último test</small><strong>{summary.last ? shortDate(summary.last.tested_on) : '—'}</strong><span>{summary.last ? playerName(players.find((player) => player.id === summary.last.player_id)) : 'Sin registros'}</span></article>
                </>
              ) : (() => {
                const own = historyPlayer ? currentRecords.filter((row) => row.player_id === historyPlayer.id) : currentRecords;
                const ordered = sortAsc(own);
                const latest = ordered[ordered.length - 1];
                const best = ordered.length ? Math.max(...ordered.map((row) => numeric(row.value) ?? -Infinity)) : null;
                const delta = deltaFor(ordered);
                return <>
                  <article><small>Último</small><strong>{latest ? formatValue(latest.value, activeTab) : '—'}</strong><span>{latest ? fullDate(latest.tested_on) : 'Sin registros'}</span></article>
                  <article><small>Mejor</small><strong>{best !== null && Number.isFinite(best) ? formatValue(best, activeTab) : '—'}</strong><span>mejor marca personal</span></article>
                  <article><small>Cambio</small><strong><DeltaBadge delta={delta} test={activeTab} /></strong><span>primero → último</span></article>
                  <article><small>Tests</small><strong>{ordered.length}</strong><span>registros</span></article>
                </>;
              })()}
            </div>
          </section>

          <section className="perf-panel">
            <div className="perf-section-heading"><div><small>{activeTab}</small><h2>{isStaff ? 'Resultados por jugadora' : 'Tu evolución'}</h2><p>{isStaff ? 'Último resultado, mejor marca y evolución individual.' : 'Toca tu tarjeta para ver el detalle completo.'}</p></div><span className="perf-count">{currentRecords.length} registros</span></div>
            <div className={`perf-player-grid ${!isStaff ? 'single-player' : ''}`}>
              {players.map((player) => {
                const playerRecords = currentRecords.filter((row) => row.player_id === player.id);
                const latest = currentLatestMap.get(player.id) || null;
                const best = playerRecords.length ? Math.max(...playerRecords.map((row) => numeric(row.value) ?? -Infinity)) : null;
                const delta = deltaFor(playerRecords);
                return (
                  <button key={player.id} type="button" className={`perf-player-card ${latest ? 'has-record' : ''}`} onClick={() => setDetailPlayerId(player.id)}>
                    <span className="perf-avatar">{initials(playerName(player))}</span>
                    <span className="perf-player-copy"><strong>{playerName(player)}</strong><small>#{player.dorsal || '—'} · {player.position || 'Jugadora'}</small>{latest ? <em><CalendarDays size={12} /> {fullDate(latest.tested_on)}</em> : <em>Sin registros</em>}</span>
                    <span className="perf-player-metrics"><span><small>Último</small><strong>{latest ? formatValue(latest.value, activeTab) : '—'}</strong></span><span><small>Mejor</small><strong>{best !== null && Number.isFinite(best) ? formatValue(best, activeTab) : '—'}</strong></span></span>
                    <span className="perf-card-delta"><DeltaBadge delta={delta} test={activeTab} /></span>
                    <ChevronRight className="perf-card-chevron" size={17} />
                  </button>
                );
              })}
              {!players.length ? <div className="perf-empty-line">No hay jugadoras disponibles.</div> : null}
            </div>
          </section>
        </>
      )}

      {formOpen && isStaff ? (
        <div className="perf-modal" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setFormOpen(false); }}>
          <form className="perf-form-sheet" onSubmit={submitTest}>
            <header><div><span className="perf-eyebrow"><Dumbbell size={14} /> Nuevo test</span><h2>Registrar rendimiento</h2><p>El registro quedará visible para la jugadora seleccionada.</p></div><button type="button" className="perf-icon-btn" disabled={saving} onClick={() => setFormOpen(false)}><X size={19} /></button></header>
            <div className="perf-form-grid">
              <label><span>Jugadora</span><select value={formPlayerId} onChange={(event) => setFormPlayerId(event.target.value)} required>{players.map((player) => <option key={player.id} value={player.id}>{playerName(player)} · #{player.dorsal || '—'}</option>)}</select></label>
              <label><span>Test</span><select value={formTest} onChange={(event) => setFormTest(event.target.value)} required>{TESTS.map((test) => <option key={test}>{test}</option>)}</select></label>
              <label><span>Fecha</span><input type="date" value={formDate} onChange={(event) => setFormDate(event.target.value)} required /></label>
              <label><span>Resultado ({testMeta(formTest).unit})</span><input type="number" min="0.01" step={formTest === 'Drop Jump' ? '0.01' : '0.1'} inputMode="decimal" value={formValue} onChange={(event) => setFormValue(event.target.value)} placeholder={formTest === 'Drop Jump' ? 'Ej. 1.65' : 'Ej. 28.4'} required /></label>
              <label className="wide"><span>Notas · opcional</span><textarea value={formNotes} onChange={(event) => setFormNotes(event.target.value)} rows="3" placeholder="Contexto del test, protocolo, observaciones…" /></label>
            </div>
            <div className="perf-test-info"><Target size={18} /><div><strong>{testMeta(formTest).label}</strong><span>{testMeta(formTest).help} Unidad: {testMeta(formTest).unit}.</span></div></div>
            <footer><button type="button" className="perf-cancel" disabled={saving} onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="perf-save" disabled={saving}>{saving ? <LoaderCircle className="perf-spin" size={17} /> : <Plus size={17} />} Registrar test</button></footer>
          </form>
        </div>
      ) : null}

      {detailPlayer ? <PlayerDetail player={detailPlayer} test={detailTest} records={detailRecords} onClose={() => setDetailPlayerId('')} /> : null}
    </div>
  );
}
