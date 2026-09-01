import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, ChevronDown, UsersRound } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './TrainingPlayerRpeBreakdown.css';

function playerName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function initials(value) {
  return String(value || 'J')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function sessionDateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { full: '', time: '' };
  return {
    full: new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
  };
}

function scoreTone(score) {
  if (score == null) return 'pending';
  if (score <= 3) return 'low';
  if (score <= 6) return 'moderate';
  if (score <= 8) return 'high';
  return 'very-high';
}

async function functionsErrorMessage(error) {
  let message = error?.message || 'No se pudo enviar la notificación de prueba.';
  try {
    const detail = await error?.context?.json?.();
    if (detail?.error) message = detail.error;
  } catch (_) {}
  return message;
}

export default function TrainingPlayerRpeBreakdown() {
  const { identity } = useAuth();
  const location = useLocation();
  const isStaff = ['coach', 'administrator'].includes(identity?.profile?.role);
  const [host, setHost] = useState(null);
  const [sessionMarker, setSessionMarker] = useState(null);
  const [eventRow, setEventRow] = useState(null);
  const [players, setPlayers] = useState([]);
  const [rpeRows, setRpeRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [testBusyPlayer, setTestBusyPlayer] = useState(null);
  const [testStatus, setTestStatus] = useState({});

  useEffect(() => {
    if (!isStaff || location.pathname !== '/training') {
      setHost(null);
      setSessionMarker(null);
      return undefined;
    }

    let disposed = false;
    let currentHost = null;

    function locate() {
      if (disposed) return;
      const page = document.querySelector('.pro-session-page');
      const panel = page?.querySelector('.pro-rpe-panel');
      const insight = panel?.querySelector('.pro-rpe-insight');
      const hero = page?.querySelector('.pro-session-hero-card');
      const title = hero?.querySelector('h1')?.textContent?.trim() || '';
      const meta = hero?.querySelector('p')?.textContent?.trim() || '';

      if (!page || !panel || !insight || !title || !meta) {
        setHost(null);
        setSessionMarker(null);
        return;
      }

      let nextHost = panel.querySelector('.pro-rpe-player-breakdown-host');
      if (!nextHost) {
        nextHost = document.createElement('div');
        nextHost.className = 'pro-rpe-player-breakdown-host';
        insight.insertAdjacentElement('afterend', nextHost);
      }
      currentHost = nextHost;
      setHost(nextHost);
      setSessionMarker((current) => {
        const next = { title, meta, key: `${title}::${meta}` };
        return current?.key === next.key ? current : next;
      });
    }

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
      if (currentHost?.isConnected) currentHost.remove();
    };
  }, [isStaff, location.pathname]);

  const teamIds = useMemo(() => {
    const ids = new Set((identity?.teams || []).map((team) => team.id).filter(Boolean));
    if (identity?.player?.team_id) ids.add(identity.player.team_id);
    return [...ids];
  }, [identity?.player?.team_id, identity?.teams]);

  useEffect(() => {
    let active = true;
    setOpen(false);
    setEventRow(null);
    setPlayers([]);
    setRpeRows([]);
    setError('');
    setTestBusyPlayer(null);
    setTestStatus({});

    if (!isStaff || !sessionMarker || !teamIds.length) return () => { active = false; };

    async function resolveEvent() {
      try {
        const { data, error: eventError } = await supabase
          .from('events')
          .select('id,team_id,title,starts_at')
          .in('team_id', teamIds)
          .eq('event_type', 'training')
          .eq('title', sessionMarker.title)
          .order('starts_at', { ascending: false })
          .limit(30);
        if (eventError) throw eventError;
        if (!active) return;
        const candidates = data || [];
        const exact = candidates.find((event) => {
          const parts = sessionDateParts(event.starts_at);
          return parts.full && sessionMarker.meta.includes(parts.full) && sessionMarker.meta.includes(parts.time);
        });
        const resolved = exact || (candidates.length === 1 ? candidates[0] : null);
        if (!resolved) {
          setError('No se pudo identificar esta sesión para cargar el RPE individual.');
          return;
        }
        setEventRow(resolved);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No se pudo identificar la sesión.');
      }
    }

    void resolveEvent();
    return () => { active = false; };
  }, [isStaff, sessionMarker?.key, sessionMarker?.meta, sessionMarker?.title, teamIds]);

  useEffect(() => {
    let active = true;
    if (!eventRow?.id || !isStaff) return () => { active = false; };

    async function loadBreakdown() {
      setLoading(true);
      setError('');
      try {
        const [playersResult, rpeResult] = await Promise.all([
          supabase
            .from('players')
            .select('id,profile_id,legacy_id,dorsal,position,profiles:profile_id(full_name,username)')
            .eq('team_id', eventRow.team_id)
            .eq('active', true)
            .order('dorsal', { ascending: true, nullsFirst: false }),
          supabase
            .from('rpe_entries')
            .select('id,player_id,score,source,created_at,updated_at')
            .eq('event_id', eventRow.id)
            .eq('source', 'player')
        ]);
        if (playersResult.error) throw playersResult.error;
        if (rpeResult.error) throw rpeResult.error;
        if (!active) return;
        setPlayers(playersResult.data || []);
        setRpeRows(rpeResult.data || []);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'No se pudo cargar el RPE individual.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBreakdown();
    const refresh = () => void loadBreakdown();
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const channel = supabase
      .channel(`react-training-rpe-${eventRow.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rpe_entries', filter: `event_id=eq.${eventRow.id}` }, refresh)
      .subscribe();

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshVisible);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [eventRow?.id, eventRow?.team_id, isStaff]);

  const latestRpeByPlayer = useMemo(() => {
    const map = new Map();
    rpeRows.forEach((row) => {
      if (!row.player_id) return;
      const previous = map.get(row.player_id);
      const rowTime = new Date(row.updated_at || row.created_at || 0).getTime();
      const previousTime = previous ? new Date(previous.updated_at || previous.created_at || 0).getTime() : -Infinity;
      if (!previous || rowTime >= previousTime) map.set(row.player_id, row);
    });
    return map;
  }, [rpeRows]);

  const responded = players.reduce((count, player) => count + (latestRpeByPlayer.has(player.id) ? 1 : 0), 0);
  const livePlayerMean = useMemo(() => {
    const scores = players
      .map((player) => latestRpeByPlayer.get(player.id))
      .map((row) => Number(row?.score))
      .filter((score) => Number.isFinite(score));
    return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  }, [latestRpeByPlayer, players]);

  useEffect(() => {
    if (!host || !isStaff) return;
    const panel = host.closest('.pro-rpe-panel');
    const summary = panel?.querySelector('.pro-rpe-summary-card.players');
    if (summary) {
      const value = summary.querySelector('strong');
      const meter = summary.querySelector('.pro-rpe-meter i');
      const count = summary.querySelector('small');
      if (value) value.textContent = livePlayerMean === null ? '—' : livePlayerMean.toFixed(1);
      if (meter) meter.style.width = `${livePlayerMean === null ? 0 : Math.max(0, Math.min(100, livePlayerMean * 10))}%`;
      if (count) count.textContent = `${responded} respuesta${responded === 1 ? '' : 's'}`;
    }

    const coachValue = Number(panel?.querySelector('.pro-rpe-summary-card.coach strong')?.textContent);
    const insight = panel?.querySelector('.pro-rpe-insight');
    if (!insight) return;
    if (!Number.isFinite(coachValue) || livePlayerMean === null) {
      insight.className = 'pro-rpe-insight pending';
      insight.textContent = 'Faltan valoraciones para comparar.';
      return;
    }
    const gap = Math.abs(coachValue - livePlayerMean);
    if (gap <= 1) {
      insight.className = 'pro-rpe-insight aligned';
      insight.textContent = `Percepción bastante alineada · diferencia ${gap.toFixed(1)}`;
    } else {
      insight.className = 'pro-rpe-insight different';
      insight.textContent = `Diferencia de percepción de ${gap.toFixed(1)} puntos.`;
    }
  }, [host, isStaff, livePlayerMean, responded]);

  async function sendTestPush(player) {
    if (!player?.id || testBusyPlayer) return;
    setTestBusyPlayer(player.id);
    setTestStatus((current) => ({ ...current, [player.id]: null }));
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-test-push', {
        body: { player_id: player.id, event_id: eventRow?.id || null }
      });
      if (invokeError) throw new Error(await functionsErrorMessage(invokeError));
      if (!data?.ok) throw new Error(data?.error || 'No se pudo enviar la notificación de prueba.');
      setTestStatus((current) => ({ ...current, [player.id]: { type: 'success', text: data.delivered > 1 ? `Enviada a ${data.delivered} dispositivos` : 'Notificación enviada' } }));
    } catch (pushError) {
      setTestStatus((current) => ({ ...current, [player.id]: { type: 'error', text: pushError?.message || 'No se pudo enviar.' } }));
    } finally {
      setTestBusyPlayer(null);
    }
  }

  if (!host || !isStaff || !eventRow) return null;

  return createPortal(
    <div className="individual-rpe-wrap">
      <button
        className={`individual-rpe-toggle${open ? ' open' : ''}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="individual-rpe-toggle-icon"><UsersRound size={17} /></span>
        <span className="individual-rpe-toggle-copy">
          <strong>RPE por jugadora</strong>
          <small>{loading ? 'Actualizando…' : `${responded}/${players.length} respuestas`}</small>
        </span>
        <ChevronDown size={18} className="individual-rpe-chevron" />
      </button>

      {open ? (
        <div className="individual-rpe-panel">
          <div className="individual-rpe-test-hint">
            <BellRing size={14} />
            <span>Usa <strong>Probar aviso</strong> para comprobar el móvil de una jugadora sin esperar 30 minutos.</span>
          </div>
          {error ? <p className="individual-rpe-error">{error}</p> : null}
          {!loading && !error && !players.length ? <p className="individual-rpe-empty">No hay jugadoras activas en el equipo.</p> : null}
          {players.length ? (
            <div className="individual-rpe-list">
              {players.map((player) => {
                const entry = latestRpeByPlayer.get(player.id);
                const rawScore = entry ? Number(entry.score) : null;
                const score = Number.isFinite(rawScore) ? rawScore : null;
                const name = playerName(player);
                const status = testStatus[player.id];
                const busy = testBusyPlayer === player.id;
                return (
                  <div className="individual-rpe-row" key={player.id}>
                    <span className="individual-rpe-avatar">{initials(name)}</span>
                    <span className="individual-rpe-player">
                      <strong>{name}</strong>
                      <small>{player.dorsal != null ? `#${player.dorsal}` : 'Sin dorsal'}{player.position ? ` · ${player.position}` : ''}</small>
                      {status ? <small className={`individual-rpe-test-status ${status.type}`}>{status.text}</small> : null}
                    </span>
                    <span className="individual-rpe-actions">
                      <span className={`individual-rpe-score ${scoreTone(score)}`}>
                        {score == null ? 'Sin responder' : score.toFixed(score % 1 === 0 ? 0 : 1)}
                      </span>
                      {player.profile_id ? (
                        <button
                          type="button"
                          className="individual-rpe-test-button"
                          onClick={() => void sendTestPush(player)}
                          disabled={Boolean(testBusyPlayer)}
                          title={`Enviar notificación de prueba a ${name}`}
                        >
                          <BellRing size={13} /> {busy ? 'Enviando…' : 'Probar aviso'}
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="individual-rpe-legend" aria-label="Escala orientativa de RPE">
            <span className="low">0–3</span><span className="moderate">4–6</span><span className="high">7–8</span><span className="very-high">9–10</span>
          </div>
        </div>
      ) : null}
    </div>,
    host
  );
}
