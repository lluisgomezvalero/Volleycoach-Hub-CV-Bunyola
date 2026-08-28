import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  History,
  LoaderCircle,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Target,
  Trophy,
  UsersRound
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './GamePlanPage.css';

const MODEL_VERSION = 2;
const MATCH_TYPES = ['match', 'friendly', 'tournament'];
const ZONES = [4, 3, 2, 7, 8, 9, 5, 6, 1];

const ATTACKS = [
  { key: 'z4a', short: 'AR1', role: 'Atacante receptora 1', dirs: ['line', 'long', 'medium', 'short', 'tip'] },
  { key: 'z4b', short: 'AR2', role: 'Atacante receptora 2', dirs: ['line', 'long', 'medium', 'short', 'tip'] },
  { key: 'z2', short: 'OP', role: 'Opuesta', dirs: ['line', 'long', 'medium', 'short', 'tip'] },
  { key: 'z3a', short: 'C1', role: 'Central 1', dirs: ['attack5', 'attack1', 'tip'] },
  { key: 'z3b', short: 'C2', role: 'Central 2', dirs: ['attack5', 'attack1', 'tip'] }
];

const DIRECTION_LABELS = {
  line: 'Línea',
  long: 'Diagonal larga',
  medium: 'Diagonal media',
  short: 'Diagonal corta',
  tip: 'Finta',
  attack5: 'Ataque a Z5',
  attack1: 'Ataque a Z1'
};

const LEVEL_LABELS = {
  red: 'Objetivo',
  yellow: 'Intermedia',
  green: 'Fuerte'
};

function blankPlan() {
  const attackers = {};
  ATTACKS.forEach(({ key }) => {
    attackers[key] = { name: '', directions: [], visibleToPlayers: false, tipZone: 8 };
  });
  const servePct = {};
  const serveTargets = {};
  ZONES.forEach((zone) => {
    servePct[`z${zone}`] = 0;
    serveTargets[`z${zone}`] = 'none';
  });
  return {
    attackers,
    servePct,
    serveTargets,
    servePlayerTarget: '',
    hideServeObjectives: false,
    opponentReceivers: [
      { name: '', depth: 'long', level: 'red' },
      { name: '', depth: 'long', level: 'yellow' },
      { name: '', depth: 'long', level: 'green' },
      { name: '', depth: 'long', level: 'green' }
    ]
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePlan(raw) {
  const base = blankPlan();
  const source = raw && typeof raw === 'object' ? raw : {};
  const next = { ...base, ...clone(source) };
  next.attackers = {};
  ATTACKS.forEach(({ key, dirs }) => {
    const current = source.attackers?.[key] || {};
    next.attackers[key] = {
      ...base.attackers[key],
      ...clone(current),
      name: String(current.name || ''),
      directions: Array.isArray(current.directions) ? current.directions.filter((item) => dirs.includes(item)) : [],
      visibleToPlayers: Boolean(current.visibleToPlayers),
      tipZone: ZONES.includes(Number(current.tipZone)) ? Number(current.tipZone) : 8
    };
  });
  next.servePct = {};
  next.serveTargets = {};
  ZONES.forEach((zone) => {
    const pct = Number(source.servePct?.[`z${zone}`]);
    next.servePct[`z${zone}`] = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    const target = source.serveTargets?.[`z${zone}`];
    next.serveTargets[`z${zone}`] = ['primary', 'secondary'].includes(target) ? target : 'none';
  });
  next.servePlayerTarget = String(source.servePlayerTarget || '');
  next.hideServeObjectives = Boolean(source.hideServeObjectives);
  const receivers = Array.isArray(source.opponentReceivers) ? source.opponentReceivers : [];
  next.opponentReceivers = base.opponentReceivers.map((fallback, index) => {
    const current = receivers[index] || {};
    return {
      ...fallback,
      ...clone(current),
      name: String(current.name || ''),
      level: ['red', 'yellow', 'green'].includes(current.level) ? current.level : fallback.level
    };
  });
  return next;
}

function opponentName(event) {
  const explicit = String(event?.payload?.opponent || '').trim();
  if (explicit) return explicit;
  const title = String(event?.title || '').trim();
  const parts = title.split(/\s+vs\.?\s+/i);
  if (parts.length > 1) return parts.slice(1).join(' vs ').trim();
  return title || 'Rival por confirmar';
}

function eventLabel(event) {
  const date = new Date(event?.starts_at || 0);
  const dateLabel = Number.isNaN(date.getTime())
    ? 'Fecha por confirmar'
    : new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `${opponentName(event)} · ${dateLabel}`;
}

function detailedDate(event) {
  const date = new Date(event?.starts_at || 0);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function sortPublished(rows) {
  return [...rows]
    .filter((row) => row.status === 'published')
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0) || new Date(b.published_at || 0) - new Date(a.published_at || 0));
}

function latestDraft(rows) {
  return [...rows]
    .filter((row) => row.status === 'draft')
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0] || null;
}

function playerName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function readTime(value) {
  if (!value) return 'Pendiente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Visto';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

function directionText(attacker) {
  return (attacker?.directions || []).map((direction) => {
    if (direction === 'tip') return `Finta Z${attacker.tipZone || 8}`;
    return DIRECTION_LABELS[direction] || direction;
  }).join(' · ');
}

function attackEndpoint(key, direction, tipZone) {
  const zones = {
    1: [82, 86], 2: [82, 28], 3: [50, 28], 4: [18, 28], 5: [18, 86],
    6: [50, 86], 7: [18, 58], 8: [50, 58], 9: [82, 58]
  };
  if (direction === 'tip') return zones[tipZone] || zones[8];
  if (key.startsWith('z4')) {
    if (direction === 'line') return zones[1];
    if (direction === 'short') return zones[4];
    if (direction === 'medium') return zones[7];
    return zones[5];
  }
  if (key === 'z2') {
    if (direction === 'line') return zones[5];
    if (direction === 'short') return zones[2];
    if (direction === 'medium') return zones[9];
    return zones[1];
  }
  if (direction === 'attack5') return zones[5];
  if (direction === 'attack1') return zones[1];
  return zones[8];
}

function attackOrigin(key) {
  if (key.startsWith('z4')) return [82, 9];
  if (key === 'z2') return [18, 9];
  return key === 'z3a' ? [46, 9] : [54, 9];
}

function AttackCourt({ attackKey, attacker }) {
  const [x, y] = attackOrigin(attackKey);
  return (
    <div className="gp-court" aria-label="Pista con tendencias de ataque">
      <div className="gp-court-net"><span>RED</span></div>
      <div className="gp-court-three" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id={`gp-arrow-${attackKey}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" />
          </marker>
        </defs>
        {(attacker?.directions || []).map((direction) => {
          const [x2, y2] = attackEndpoint(attackKey, direction, attacker?.tipZone || 8);
          return direction === 'tip' ? (
            <path
              key={direction}
              className="gp-attack-line gp-attack-tip"
              d={`M ${x} ${y + 2} Q ${(x + x2) / 2 + 5} ${(y + y2) / 2 - 5} ${x2} ${y2}`}
              markerEnd={`url(#gp-arrow-${attackKey})`}
            />
          ) : (
            <line
              key={direction}
              className="gp-attack-line"
              x1={x}
              y1={y + 2}
              x2={x2}
              y2={y2}
              markerEnd={`url(#gp-arrow-${attackKey})`}
            />
          );
        })}
      </svg>
      <span className="gp-contact" style={{ left: `${x}%`, top: `${y}%` }}>{ATTACKS.find((item) => item.key === attackKey)?.short}</span>
      {!attacker?.directions?.length ? <em>Selecciona las direcciones principales</em> : null}
    </div>
  );
}

function ServeCourt({ plan, mode, interactive = false, onZone }) {
  const rival = mode === 'rival';
  return (
    <div className={`gp-serve-court ${rival ? 'is-rival' : 'is-ours'}`}>
      <div className="gp-serve-net">RED</div>
      <div className="gp-zone-grid">
        {ZONES.map((zone) => {
          const key = `z${zone}`;
          const raw = rival ? Number(plan.servePct[key] || 0) : plan.serveTargets[key];
          const state = rival ? (raw >= 75 ? 'primary' : raw > 0 ? 'secondary' : 'none') : raw;
          const text = rival
            ? (raw >= 75 ? 'Principal' : raw > 0 ? 'Frecuente' : 'Sin marcar')
            : (state === 'primary' ? 'Principal' : state === 'secondary' ? 'Alternativa' : 'Sin marcar');
          const content = <><b>Z{zone}</b><span>{text}</span>{rival && raw > 0 ? <small>{Math.round(raw)}%</small> : null}</>;
          return interactive ? (
            <button key={zone} type="button" className={`gp-zone is-${state}`} onClick={() => onZone?.(zone)}>{content}</button>
          ) : (
            <div key={zone} className={`gp-zone is-${state}`}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerPlanView({ plan: rawPlan, event, preview, activeAttack, onAttackChange, onBack }) {
  const plan = normalizePlan(rawPlan);
  const visibleAttacks = ATTACKS.filter(({ key }) => plan.attackers[key].visibleToPlayers && plan.attackers[key].directions.length);
  const active = visibleAttacks.some(({ key }) => key === activeAttack) ? activeAttack : visibleAttacks[0]?.key;
  const rivalServe = ZONES.some((zone) => Number(plan.servePct[`z${zone}`] || 0) > 0);
  const ourServeZones = ZONES.some((zone) => plan.serveTargets[`z${zone}`] !== 'none');
  const receivers = plan.opponentReceivers.filter((receiver) => receiver.name);
  const quick = [];
  visibleAttacks.slice(0, 2).forEach(({ key, short }) => quick.push(`${short}: ${directionText(plan.attackers[key])}`));
  const rivalZones = ZONES.filter((zone) => Number(plan.servePct[`z${zone}`] || 0) > 0);
  if (rivalZones.length) quick.push(`Saque rival: zonas ${rivalZones.join(', ')}`);
  if (!plan.hideServeObjectives && plan.servePlayerTarget) quick.push(`Nuestro saque: ${plan.servePlayerTarget}`);
  const hasContent = visibleAttacks.length || rivalServe || (!plan.hideServeObjectives && (ourServeZones || plan.servePlayerTarget)) || receivers.length;

  return (
    <div className="gp-player-view">
      {preview ? <button type="button" className="gp-back" onClick={onBack}><ArrowLeft size={16} /> Volver a editar</button> : null}
      <section className="gp-player-hero">
        <span className="gp-player-kicker"><ShieldCheck size={14} /> {preview ? 'Vista de jugadora' : 'Plan publicado'}</span>
        <h2>{opponentName(event)}</h2>
        <p>{detailedDate(event)}{event?.location ? ` · ${event.location}` : ''}</p>
      </section>

      {!hasContent ? (
        <section className="gp-empty"><Target size={30} /><h3>Plan publicado sin indicaciones visibles</h3><p>El cuerpo técnico no ha marcado todavía objetivos para mostrar al equipo.</p></section>
      ) : null}

      {quick.length ? (
        <section className="gp-quick-summary">
          <small>Resumen rápido</small>
          <h3>Qué debemos recordar</h3>
          <div>{quick.map((item) => <span key={item}><Check size={15} /> {item}</span>)}</div>
        </section>
      ) : null}

      {visibleAttacks.length ? (
        <section className="gp-player-section">
          <div className="gp-section-title"><span>1</span><div><h3>Preferencias de ataque rival</h3><p>Patrones principales publicados por el entrenador.</p></div></div>
          <div className="gp-attack-tabs gp-player-tabs">
            {visibleAttacks.map(({ key, short }) => (
              <button key={key} type="button" className={key === active ? 'active' : ''} onClick={() => onAttackChange(key)}>{short}</button>
            ))}
          </div>
          {active ? (
            <article className="gp-player-attack">
              <header><small>{ATTACKS.find((item) => item.key === active)?.role}</small><strong>{plan.attackers[active].name || ATTACKS.find((item) => item.key === active)?.short}</strong></header>
              <p>{directionText(plan.attackers[active])}</p>
              <AttackCourt attackKey={active} attacker={plan.attackers[active]} />
            </article>
          ) : null}
        </section>
      ) : null}

      {rivalServe ? (
        <section className="gp-player-section">
          <div className="gp-section-title"><span>2</span><div><h3>Saque rival</h3><p>Zonas hacia las que concentra el saque.</p></div></div>
          <ServeCourt plan={plan} mode="rival" />
          <div className="gp-legend"><span><i className="is-secondary" /> Frecuente</span><span><i className="is-primary" /> Principal</span></div>
        </section>
      ) : null}

      {!plan.hideServeObjectives && (ourServeZones || plan.servePlayerTarget) ? (
        <section className="gp-player-section">
          <div className="gp-section-title"><span>3</span><div><h3>Nuestro saque</h3><p>Objetivo acordado para el partido.</p></div></div>
          {plan.servePlayerTarget ? <div className="gp-target-player"><small>Sacar a</small><strong>{plan.servePlayerTarget}</strong></div> : null}
          {ourServeZones ? <ServeCourt plan={plan} mode="ours" /> : null}
          <div className="gp-legend"><span><i className="is-secondary" /> Alternativa</span><span><i className="is-primary" /> Principal</span></div>
        </section>
      ) : null}

      {receivers.length ? (
        <section className="gp-player-section">
          <div className="gp-section-title"><span>4</span><div><h3>Recepción rival</h3><p>Referencias rápidas para orientar el saque.</p></div></div>
          <div className="gp-player-receivers">
            {receivers.map((receiver, index) => <span key={`${receiver.name}-${index}`} className={`is-${receiver.level}`}><b>{receiver.name}</b><small>{LEVEL_LABELS[receiver.level]}</small></span>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function GamePlanPage() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const isStaff = ['coach', 'administrator'].includes(profile?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [events, setEvents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [draft, setDraft] = useState(() => blankPlan());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [activeAttack, setActiveAttack] = useState('z4a');
  const [reads, setReads] = useState([]);
  const [readsOpen, setReadsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hydratedRef = useRef('');
  const savingRef = useRef(false);
  const draftRef = useRef(draft);
  const readGuardRef = useRef(new Set());

  useEffect(() => { draftRef.current = draft; }, [draft]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) || null, [events, selectedEventId]);
  const eventPlans = useMemo(() => plans.filter((row) => row.event_id === selectedEventId), [plans, selectedEventId]);
  const publishedPlans = useMemo(() => sortPublished(eventPlans), [eventPlans]);
  const published = publishedPlans[0] || null;
  const remoteDraft = useMemo(() => latestDraft(eventPlans), [eventPlans]);

  const history = useMemo(() => {
    const now = Date.now();
    return events
      .filter((event) => new Date(event.starts_at).getTime() < now)
      .map((event) => {
        const publication = sortPublished(plans.filter((row) => row.event_id === event.id))[0] || null;
        return { event, publication };
      })
      .filter((row) => row.publication)
      .sort((a, b) => new Date(b.event.starts_at) - new Date(a.event.starts_at));
  }, [events, plans]);

  async function fetchPlans() {
    if (!team?.id) return [];
    const { data, error: planError } = await supabase
      .from('game_plans')
      .select('id,event_id,club_id,team_id,version,status,payload,published_at,created_by,created_at,updated_at')
      .eq('team_id', team.id)
      .order('updated_at', { ascending: false });
    if (planError) throw planError;
    setPlans(data || []);
    return data || [];
  }

  useEffect(() => {
    let active = true;
    async function load() {
      if (!team?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const now = new Date();
        const from = new Date(now.getTime() - 370 * 86400000).toISOString();
        const to = new Date(now.getTime() + 370 * 86400000).toISOString();
        const eventRequest = supabase
          .from('events')
          .select('id,event_type,title,starts_at,ends_at,location,status,payload')
          .eq('team_id', team.id)
          .in('event_type', MATCH_TYPES)
          .gte('starts_at', from)
          .lte('starts_at', to)
          .order('starts_at', { ascending: true });
        const planRequest = supabase
          .from('game_plans')
          .select('id,event_id,club_id,team_id,version,status,payload,published_at,created_by,created_at,updated_at')
          .eq('team_id', team.id)
          .order('updated_at', { ascending: false });
        const playerRequest = isStaff
          ? supabase.from('players').select('id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)').eq('team_id', team.id).eq('active', true).order('dorsal', { ascending: true, nullsFirst: false })
          : Promise.resolve({ data: [], error: null });
        const [eventResult, planResult, playerResult] = await Promise.all([eventRequest, planRequest, playerRequest]);
        if (eventResult.error) throw eventResult.error;
        if (planResult.error) throw planResult.error;
        if (playerResult.error) throw playerResult.error;
        if (!active) return;
        const nextEvents = eventResult.data || [];
        const nextPlans = planResult.data || [];
        setEvents(nextEvents);
        setPlans(nextPlans);
        setPlayers(playerResult.data || []);
        setSelectedEventId((current) => {
          if (current && nextEvents.some((event) => event.id === current)) return current;
          const next = nextEvents.find((event) => new Date(event.starts_at).getTime() >= Date.now()) || nextEvents[nextEvents.length - 1];
          return next?.id || '';
        });
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No se pudo cargar el plan de juego.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [isStaff, team?.id]);

  useEffect(() => {
    if (!team?.id) return undefined;
    const channel = supabase.channel(`react-game-plans-${team.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_plans', filter: `team_id=eq.${team.id}` }, () => {
        void fetchPlans().catch(() => {});
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [team?.id]);

  useEffect(() => {
    if (!selectedEventId) return;
    const sourceRow = isStaff ? (remoteDraft || published) : published;
    const sourceKey = `${selectedEventId}:${sourceRow?.id || 'empty'}:${sourceRow?.updated_at || sourceRow?.published_at || ''}`;
    if (hydratedRef.current === sourceKey) return;
    if (dirty && hydratedRef.current.startsWith(`${selectedEventId}:`)) return;
    setDraft(normalizePlan(sourceRow?.payload?.plan));
    setDirty(false);
    setPreview(false);
    setReadsOpen(false);
    const preferred = ATTACKS.find(({ key }) => sourceRow?.payload?.plan?.attackers?.[key]?.directions?.length)?.key || 'z4a';
    setActiveAttack(preferred);
    hydratedRef.current = sourceKey;
  }, [dirty, isStaff, published, remoteDraft, selectedEventId]);

  useEffect(() => {
    let active = true;
    if (!isStaff || !published?.id) {
      setReads([]);
      return undefined;
    }
    async function loadReads() {
      const { data, error: readError } = await supabase
        .from('game_plan_reads')
        .select('id,game_plan_id,event_id,player_id,publication_version,read_at')
        .eq('game_plan_id', published.id)
        .order('read_at', { ascending: true });
      if (!readError && active) setReads(data || []);
    }
    void loadReads();
    const channel = supabase.channel(`react-game-plan-reads-${published.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_plan_reads', filter: `game_plan_id=eq.${published.id}` }, () => void loadReads())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [isStaff, published?.id]);

  useEffect(() => {
    if (isStaff || !identity?.player?.id || !published?.id || !selectedEvent?.id) return;
    const guardKey = `${published.id}:${identity.player.id}`;
    if (readGuardRef.current.has(guardKey)) return;
    readGuardRef.current.add(guardKey);
    void (async () => {
      const { data: existing, error: checkError } = await supabase
        .from('game_plan_reads')
        .select('id')
        .eq('game_plan_id', published.id)
        .eq('player_id', identity.player.id)
        .maybeSingle();
      if (checkError || existing?.id) return;
      const version = String(published.payload?.publicationVersion || published.published_at || '');
      const { error: insertError } = await supabase.from('game_plan_reads').insert({
        game_plan_id: published.id,
        event_id: selectedEvent.id,
        player_id: identity.player.id,
        publication_version: version,
        read_at: new Date().toISOString()
      });
      if (!insertError) setNotice('Lectura registrada.');
    })();
  }, [identity?.player?.id, isStaff, published?.id, selectedEvent?.id]);

  function updateDraft(mutator) {
    setDraft((current) => {
      const next = normalizePlan(current);
      mutator(next);
      return next;
    });
    setDirty(true);
    setNotice('');
  }

  async function persistDraft({ showNotice = false } = {}) {
    if (!isStaff || !selectedEvent || !team?.id || !profile?.club_id || savingRef.current) return null;
    savingRef.current = true;
    setSaving(true);
    const snapshot = normalizePlan(draftRef.current);
    const snapshotKey = JSON.stringify(snapshot);
    const payload = {
      plan: snapshot,
      modelVersion: MODEL_VERSION,
      draftBasePlanId: published?.id || null
    };
    try {
      let result;
      if (remoteDraft?.id) {
        result = await supabase
          .from('game_plans')
          .update({ payload, version: Math.max(Number(remoteDraft.version || 1), Number(published?.version || 0) + 1), updated_at: new Date().toISOString() })
          .eq('id', remoteDraft.id)
          .select('id,event_id,club_id,team_id,version,status,payload,published_at,created_by,created_at,updated_at')
          .single();
      } else {
        result = await supabase
          .from('game_plans')
          .insert({
            event_id: selectedEvent.id,
            club_id: profile.club_id,
            team_id: team.id,
            version: Number(published?.version || 0) + 1,
            status: 'draft',
            payload,
            created_by: profile.id
          })
          .select('id,event_id,club_id,team_id,version,status,payload,published_at,created_by,created_at,updated_at')
          .single();
      }
      if (result.error) throw result.error;
      const saved = result.data;
      setPlans((rows) => {
        const without = rows.filter((row) => row.id !== saved.id);
        return [saved, ...without];
      });
      if (JSON.stringify(normalizePlan(draftRef.current)) === snapshotKey) setDirty(false);
      hydratedRef.current = `${selectedEvent.id}:${saved.id}:${saved.updated_at || ''}`;
      if (showNotice) setNotice('Borrador guardado.');
      return saved;
    } catch (saveError) {
      setError(saveError?.message || 'No se pudo guardar el borrador.');
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!isStaff || !dirty || !selectedEventId || publishing) return undefined;
    const timer = window.setTimeout(() => { void persistDraft(); }, 850);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, isStaff, publishing, selectedEventId]);

  async function changeEvent(nextId) {
    if (dirty && isStaff) await persistDraft();
    hydratedRef.current = '';
    setDirty(false);
    setPreview(false);
    setSelectedEventId(nextId);
  }

  async function publishPlan() {
    if (!isStaff || !selectedEvent || !team?.id || !profile?.club_id || publishing) return;
    setPublishing(true);
    setError('');
    setNotice('');
    try {
      if (dirty) await persistDraft();
      const currentPlan = normalizePlan(draftRef.current);
      const now = new Date().toISOString();
      const version = Number(published?.version || 0) + 1;
      const payload = { plan: currentPlan, publicationVersion: now, modelVersion: MODEL_VERSION };
      const { data, error: publishError } = await supabase
        .from('game_plans')
        .insert({
          event_id: selectedEvent.id,
          club_id: profile.club_id,
          team_id: team.id,
          version,
          status: 'published',
          payload,
          published_at: now,
          created_by: profile.id
        })
        .select('id,event_id,club_id,team_id,version,status,payload,published_at,created_by,created_at,updated_at')
        .single();
      if (publishError) throw publishError;
      setPlans((rows) => [data, ...rows]);
      setDraft(currentPlan);
      draftRef.current = currentPlan;
      setDirty(false);
      setReads([]);
      hydratedRef.current = `${selectedEvent.id}:${remoteDraft?.id || data.id}:${remoteDraft?.updated_at || data.updated_at || ''}`;
      setNotice(published ? `Publicación actualizada · versión ${version}.` : 'Plan publicado para las jugadoras.');
    } catch (publishError) {
      setError(publishError?.message || 'No se pudo publicar el plan.');
    } finally {
      setPublishing(false);
    }
  }

  function cycleRivalZone(zone) {
    updateDraft((next) => {
      const key = `z${zone}`;
      const value = Number(next.servePct[key] || 0);
      next.servePct[key] = value <= 0 ? 50 : value < 75 ? 100 : 0;
    });
  }

  function cycleOurZone(zone) {
    updateDraft((next) => {
      const key = `z${zone}`;
      const value = next.serveTargets[key];
      next.serveTargets[key] = value === 'none' ? 'secondary' : value === 'secondary' ? 'primary' : 'none';
    });
  }

  const readMap = useMemo(() => {
    const map = new Map();
    reads.forEach((row) => {
      const key = String(row.player_id);
      if (!map.has(key) || new Date(row.read_at) < new Date(map.get(key).read_at)) map.set(key, row);
    });
    return map;
  }, [reads]);
  const seenCount = players.filter((player) => readMap.has(String(player.id))).length;

  if (loading) return <div className="gp-page"><div className="gp-loading"><LoaderCircle className="spin" /> Cargando plan de juego…</div></div>;

  if (!team?.id) {
    return <div className="gp-page"><section className="gp-empty"><Trophy size={30} /><h2>No hay un equipo activo</h2><p>Necesitamos un equipo para vincular los planes a sus partidos.</p></section></div>;
  }

  if (!events.length) {
    return <div className="gp-page"><section className="gp-empty"><Trophy size={30} /><h2>No hay partidos disponibles</h2><p>Cuando haya un partido o amistoso en el calendario podrás preparar aquí el plan.</p></section></div>;
  }

  if (!isStaff) {
    return (
      <div className="gp-page gp-page-player">
        {notice ? <div className="gp-notice"><CheckCircle2 size={16} /> {notice}</div> : null}
        {!published?.payload?.plan ? (
          <section className="gp-empty gp-empty-player">
            <ShieldCheck size={34} />
            <span>Próximo partido</span>
            <h2>{opponentName(selectedEvent)}</h2>
            <p>{detailedDate(selectedEvent)}</p>
            <strong>El cuerpo técnico todavía no ha publicado el plan.</strong>
          </section>
        ) : (
          <PlayerPlanView plan={published.payload.plan} event={selectedEvent} activeAttack={activeAttack} onAttackChange={setActiveAttack} />
        )}
      </div>
    );
  }

  if (preview) {
    return (
      <div className="gp-page">
        <PlayerPlanView
          plan={published?.payload?.plan || draft}
          event={selectedEvent}
          preview
          activeAttack={activeAttack}
          onAttackChange={setActiveAttack}
          onBack={() => setPreview(false)}
        />
      </div>
    );
  }

  const activeMeta = ATTACKS.find((item) => item.key === activeAttack) || ATTACKS[0];
  const activeAttacker = draft.attackers[activeMeta.key];

  return (
    <div className="gp-page">
      <header className="gp-header">
        <div>
          <span className="gp-eyebrow"><ShieldCheck size={15} /> Plan de juego</span>
          <h1>{opponentName(selectedEvent)}</h1>
          <p>{detailedDate(selectedEvent)}{selectedEvent?.location ? ` · ${selectedEvent.location}` : ''}</p>
        </div>
        <div className="gp-header-tools">
          <label>
            <span>Partido</span>
            <select value={selectedEventId} onChange={(event) => void changeEvent(event.target.value)}>
              {events.map((event) => <option key={event.id} value={event.id}>{eventLabel(event)}</option>)}
            </select>
          </label>
          <button type="button" className="gp-history-button" onClick={() => setHistoryOpen((value) => !value)}><History size={16} /> Historial</button>
        </div>
      </header>

      {error ? <div className="gp-error">{error}<button type="button" onClick={() => setError('')}>×</button></div> : null}
      {notice ? <div className="gp-notice"><CheckCircle2 size={16} /> {notice}</div> : null}

      <section className="gp-status-row">
        <div className={`gp-status-card ${published ? 'is-published' : 'is-draft'}`}>
          <span className="gp-status-dot" />
          <div><small>Estado del plan</small><strong>{published ? `Publicado · v${published.version}` : 'Sin publicar'}</strong><em>{dirty ? 'Cambios sin publicar' : saving ? 'Guardando borrador…' : remoteDraft ? 'Borrador sincronizado' : 'Preparado para editar'}</em></div>
        </div>
        <button type="button" className="gp-read-summary" disabled={!published} onClick={() => setReadsOpen((value) => !value)}>
          <UsersRound size={19} />
          <span><small>Seguimiento</small><strong>{published ? `${seenCount}/${players.length} vistos` : 'Publica para activar'}</strong></span>
        </button>
      </section>

      {readsOpen && published ? (
        <section className="gp-read-panel">
          <div className="gp-panel-heading"><div><small>Seguimiento de lectura</small><h3>Quién ha visto la publicación</h3></div><span>{seenCount}/{players.length}</span></div>
          <div className="gp-read-grid">
            {players.map((player) => {
              const read = readMap.get(String(player.id));
              return <div key={player.id} className={read ? 'seen' : ''}><span>{read ? <Check size={15} /> : <Clock3 size={15} />}</span><div><b>{playerName(player)}</b><small>{read ? readTime(read.read_at) : 'Pendiente'}</small></div></div>;
            })}
          </div>
        </section>
      ) : null}

      {historyOpen ? (
        <section className="gp-history-panel">
          <div className="gp-panel-heading"><div><small>Archivo</small><h3>Planes anteriores</h3></div><History size={19} /></div>
          {history.length ? <div className="gp-history-list">{history.map(({ event, publication }) => (
            <button key={event.id} type="button" onClick={() => { hydratedRef.current = ''; setSelectedEventId(event.id); setPreview(true); setHistoryOpen(false); }}>
              <span><small>{eventLabel(event)}</small><strong>{opponentName(event)}</strong></span><em>v{publication.version} · Ver</em>
            </button>
          ))}</div> : <div className="gp-history-empty">Todavía no hay planes publicados de partidos anteriores.</div>}
        </section>
      ) : null}

      <section className="gp-editor-section">
        <div className="gp-section-title"><span>1</span><div><h2>Tendencias de ataque rival</h2><p>Configura cada atacante por separado y decide qué pistas verá el equipo.</p></div></div>
        <div className="gp-attack-tabs">
          {ATTACKS.map((item) => {
            const configured = draft.attackers[item.key].directions.length > 0;
            return <button key={item.key} type="button" className={`${item.key === activeAttack ? 'active' : ''}${configured ? ' done' : ''}`} onClick={() => setActiveAttack(item.key)}>{item.short}{configured ? <Check size={13} /> : null}</button>;
          })}
        </div>
        <div className="gp-attack-editor">
          <div className="gp-editor-fields">
            <label className="gp-field"><span>Nombre rival · {activeMeta.role}</span><input value={activeAttacker.name} placeholder={activeMeta.short} onChange={(event) => updateDraft((next) => { next.attackers[activeMeta.key].name = event.target.value; })} /></label>
            <label className="gp-switch-row"><span><b>Mostrar a las jugadoras</b><small>Solo se publicará esta pista si tiene direcciones.</small></span><input type="checkbox" checked={activeAttacker.visibleToPlayers} onChange={(event) => updateDraft((next) => { next.attackers[activeMeta.key].visibleToPlayers = event.target.checked; })} /></label>
            <div className="gp-direction-grid">
              {activeMeta.dirs.map((direction) => {
                const checked = activeAttacker.directions.includes(direction);
                return <label key={direction} className={checked ? 'checked' : ''}><input type="checkbox" checked={checked} onChange={(event) => updateDraft((next) => { const set = new Set(next.attackers[activeMeta.key].directions); if (event.target.checked) set.add(direction); else set.delete(direction); next.attackers[activeMeta.key].directions = [...set]; })} /><span>{DIRECTION_LABELS[direction]}</span></label>;
              })}
            </div>
            {activeAttacker.directions.includes('tip') ? <label className="gp-field gp-field-small"><span>Zona de finta</span><select value={activeAttacker.tipZone} onChange={(event) => updateDraft((next) => { next.attackers[activeMeta.key].tipZone = Number(event.target.value); })}>{ZONES.map((zone) => <option key={zone} value={zone}>Zona {zone}</option>)}</select></label> : null}
          </div>
          <div><AttackCourt attackKey={activeMeta.key} attacker={activeAttacker} /><p className="gp-court-caption">{directionText(activeAttacker) || 'Sin tendencia seleccionada'}</p></div>
        </div>
      </section>

      <section className="gp-editor-section">
        <div className="gp-section-title"><span>2</span><div><h2>Saque rival</h2><p>Marca las zonas donde el rival concentra su saque. Toca cada zona para alternar intensidad.</p></div></div>
        <div className="gp-two-column">
          <ServeCourt plan={draft} mode="rival" interactive onZone={cycleRivalZone} />
          <div className="gp-side-note"><Target size={22} /><h3>Lectura rápida</h3><p><b>Frecuente</b> marca una tendencia secundaria. <b>Principal</b> identifica la zona de mayor concentración.</p><div className="gp-legend"><span><i className="is-secondary" /> Frecuente</span><span><i className="is-primary" /> Principal</span></div></div>
        </div>
      </section>

      <section className="gp-editor-section">
        <div className="gp-section-title"><span>3</span><div><h2>Nuestro saque</h2><p>Define el objetivo del equipo sin mezclarlo con la tendencia del rival.</p></div></div>
        <div className="gp-two-column">
          <ServeCourt plan={draft} mode="ours" interactive onZone={cycleOurZone} />
          <div className="gp-editor-fields">
            <label className="gp-field"><span>Receptora objetivo</span><input value={draft.servePlayerTarget} placeholder="Nombre o dorsal rival" onChange={(event) => updateDraft((next) => { next.servePlayerTarget = event.target.value; })} /></label>
            <label className="gp-switch-row"><span><b>Ocultar objetivos de saque</b><small>El cuerpo técnico los conserva, pero no aparecen en la vista de jugadora.</small></span><input type="checkbox" checked={draft.hideServeObjectives} onChange={(event) => updateDraft((next) => { next.hideServeObjectives = event.target.checked; })} /></label>
            <div className="gp-legend"><span><i className="is-secondary" /> Alternativa</span><span><i className="is-primary" /> Principal</span></div>
          </div>
        </div>
      </section>

      <section className="gp-editor-section">
        <div className="gp-section-title"><span>4</span><div><h2>Recepción rival</h2><p>Cuatro referencias rápidas. Rojo = objetivo más débil; verde = receptora más sólida.</p></div></div>
        <div className="gp-receiver-grid">
          {draft.opponentReceivers.map((receiver, index) => (
            <article key={index} className={`gp-receiver-card is-${receiver.level}`}>
              <span>R{index + 1}</span>
              <label className="gp-field"><span>Nombre</span><input value={receiver.name} placeholder={`Receptora ${index + 1}`} onChange={(event) => updateDraft((next) => { next.opponentReceivers[index].name = event.target.value; })} /></label>
              <label className="gp-field"><span>Nivel de recepción</span><select value={receiver.level} onChange={(event) => updateDraft((next) => { next.opponentReceivers[index].level = event.target.value; })}><option value="red">Rojo · Objetivo</option><option value="yellow">Amarillo · Intermedia</option><option value="green">Verde · Fuerte</option></select></label>
            </article>
          ))}
        </div>
      </section>

      <div className="gp-actions-bar">
        <div><small>{saving ? 'Sincronizando…' : dirty ? 'Cambios pendientes de publicar' : remoteDraft ? 'Borrador sincronizado' : 'Sin cambios pendientes'}</small><strong>{published ? `Publicación v${published.version}` : 'Aún sin publicar'}</strong></div>
        <button type="button" className="gp-action-secondary" onClick={() => setPreview(true)}><Eye size={16} /> Vista jugadora</button>
        <button type="button" className="gp-action-secondary" disabled={saving} onClick={() => void persistDraft({ showNotice: true })}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Guardar</button>
        <button type="button" className="gp-action-primary" disabled={publishing} onClick={() => void publishPlan()}>{publishing ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />} {published ? 'Actualizar publicación' : 'Publicar'}</button>
      </div>
    </div>
  );
}
