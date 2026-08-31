import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, UsersRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './TodayWellnessAlerts.css';

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function initials(value) {
  return String(value || 'VB')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function fatigueTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'neutral';
  if (n <= 2) return 'good';
  if (n === 3) return 'warm';
  return 'alert';
}

function sleepTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'neutral';
  if (n >= 4) return 'good';
  if (n === 3) return 'warm';
  return 'alert';
}

function painTone(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'neutral';
  if (n <= 2) return 'good';
  if (n <= 5) return 'warm';
  return 'alert';
}

function useDailyResponsesHost(enabled) {
  const [host, setHost] = useState(null);

  useEffect(() => {
    if (!enabled) {
      setHost(null);
      return undefined;
    }

    let currentHost = null;
    let frame = null;

    const sync = () => {
      frame = null;
      const grid = document.querySelector('.wellness-coach-page .wellness-kpi-grid');
      if (!grid) {
        if (currentHost && !currentHost.isConnected) {
          currentHost = null;
          setHost(null);
        }
        return;
      }

      let nextHost = document.getElementById('today-wellness-alerts-host');
      if (!nextHost || !nextHost.isConnected) {
        nextHost = document.createElement('div');
        nextHost.id = 'today-wellness-alerts-host';
        grid.appendChild(nextHost);
      } else if (nextHost.parentElement !== grid) {
        grid.appendChild(nextHost);
      }

      if (currentHost !== nextHost) {
        currentHost = nextHost;
        setHost(nextHost);
      }
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const root = document.getElementById('root');
    const observer = new MutationObserver(schedule);
    if (root) observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (currentHost?.isConnected) currentHost.remove();
      setHost(null);
    };
  }, [enabled]);

  return host;
}

export default function TodayWellnessAlerts() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const isStaff = ['coach', 'administrator'].includes(profile?.role);
  const host = useDailyResponsesHost(Boolean(isStaff && team?.id));

  const [players, setPlayers] = useState([]);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!isStaff || !team?.id) return;

    const playerResult = await supabase
      .from('players')
      .select('id,legacy_id,profiles:profile_id(full_name,username)')
      .eq('team_id', team.id)
      .eq('active', true);

    if (playerResult.error) return;
    const nextPlayers = playerResult.data || [];
    const ids = nextPlayers.map((player) => player.id);

    let nextRows = [];
    if (ids.length) {
      const wellnessResult = await supabase
        .from('wellness_entries')
        .select('player_id,entry_date,fatigue,sleep,pain_score,notes')
        .in('player_id', ids)
        .eq('entry_date', localDateKey());
      if (!wellnessResult.error) nextRows = wellnessResult.data || [];
    }

    setPlayers(nextPlayers);
    setRows(nextRows);
  }, [isStaff, team?.id]);

  useEffect(() => {
    void load();
    if (!isStaff || !team?.id) return undefined;
    const interval = window.setInterval(() => void load(), 30000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isStaff, load, team?.id]);

  const responses = useMemo(() => {
    const playerById = new Map(players.map((player) => [player.id, player]));
    return rows
      .map((row) => ({
        ...row,
        name: displayName(playerById.get(row.player_id))
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [players, rows]);

  const highFatigueCount = useMemo(
    () => responses.filter((row) => Number(row.fatigue) >= 4).length,
    [responses]
  );

  useEffect(() => {
    if (!isStaff || !team?.id) return undefined;
    let frame = null;

    const applyFatigueCard = () => {
      frame = null;
      const card = document.querySelector('.wellness-coach-page .wellness-kpi.alert');
      if (!card) return;
      const label = card.querySelector('small');
      const value = card.querySelector('strong');
      if (label && label.textContent !== 'Fatiga alta') label.textContent = 'Fatiga alta';
      const nextValue = String(highFatigueCount);
      if (value && value.textContent !== nextValue) value.textContent = nextValue;
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(applyFatigueCard);
    };

    applyFatigueCard();
    const root = document.getElementById('root');
    const observer = new MutationObserver(schedule);
    if (root) observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [highFatigueCount, isStaff, team?.id]);

  if (!isStaff || !team?.id || !host) return null;

  const pending = Math.max(0, players.length - responses.length);

  return createPortal(
    <section className={`today-wellness-responses ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="today-wellness-responses-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="today-wellness-responses-icon"><UsersRound size={17} /></span>
        <span className="today-wellness-responses-copy">
          <strong>Respuestas de hoy</strong>
          <small>{responses.length}/{players.length} jugadoras · {pending} pendiente{pending === 1 ? '' : 's'}</small>
        </span>
        <span className="today-wellness-responses-action">{open ? 'Ocultar' : 'Ver detalle'} <ChevronDown size={16} /></span>
      </button>

      {open ? (
        <div className="today-wellness-responses-panel">
          {responses.length ? responses.map((row) => (
            <article key={row.player_id} className="today-wellness-response-row">
              <span className="today-wellness-response-avatar">{initials(row.name)}</span>
              <div className="today-wellness-response-person">
                <strong>{row.name}</strong>
                {String(row.notes || '').trim() ? <small>{row.notes}</small> : null}
              </div>
              <div className="today-wellness-response-metrics">
                <span className={fatigueTone(row.fatigue)}><small>F</small><b>{row.fatigue ?? '—'}</b></span>
                <span className={sleepTone(row.sleep)}><small>S</small><b>{row.sleep ?? '—'}</b></span>
                <span className={painTone(row.pain_score ?? 0)}><small>D</small><b>{row.pain_score ?? 0}</b></span>
              </div>
            </article>
          )) : (
            <div className="today-wellness-responses-empty">Aún no hay respuestas de bienestar hoy.</div>
          )}
          <div className="today-wellness-responses-legend">F = fatiga /5 · S = sueño /5 · D = dolor /10</div>
        </div>
      ) : null}
    </section>,
    host
  );
}
