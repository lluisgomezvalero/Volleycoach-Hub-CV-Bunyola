import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';
import './TodayWellnessAlerts.css';

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayName(player) {
  return player?.profiles?.full_name || player?.profiles?.username || player?.legacy_id || 'Jugadora';
}

function compactName(value) {
  const parts = String(value || 'Jugadora').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Jugadora';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function useAlertKpiHost(enabled) {
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
      const card = document.querySelector('.wellness-coach-page .wellness-kpi.alert');
      if (!card) {
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
        card.appendChild(nextHost);
      } else if (nextHost.parentElement !== card) {
        card.appendChild(nextHost);
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
  const host = useAlertKpiHost(Boolean(isStaff && team?.id));

  const [players, setPlayers] = useState([]);
  const [rows, setRows] = useState([]);

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
        .select('player_id,entry_date,fatigue,pain_score')
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

  const model = useMemo(() => {
    const playerById = new Map(players.map((player) => [player.id, player]));
    const enriched = rows.map((row) => ({
      ...row,
      name: compactName(displayName(playerById.get(row.player_id)))
    }));

    const fatigue = enriched
      .filter((row) => Number(row.fatigue) >= 4)
      .sort((a, b) => Number(b.fatigue) - Number(a.fatigue) || a.name.localeCompare(b.name, 'es'));

    const pain = enriched
      .filter((row) => Number(row.pain_score || 0) >= 4)
      .sort((a, b) => Number(b.pain_score || 0) - Number(a.pain_score || 0) || a.name.localeCompare(b.name, 'es'));

    return { fatigue, pain };
  }, [players, rows]);

  if (!isStaff || !team?.id || !host) return null;

  const fatigueText = model.fatigue.length
    ? model.fatigue.map((row) => `${row.name} ${Number(row.fatigue)}/5`).join(' · ')
    : 'Ninguna';
  const painText = model.pain.length
    ? model.pain.map((row) => `${row.name} ${Number(row.pain_score || 0)}/10`).join(' · ')
    : 'Ninguna';

  return createPortal(
    <div className="today-wellness-alerts-detail" aria-label="Detalle de fatiga alta y dolor de hoy">
      <div>
        <span>Fatiga alta</span>
        <strong title={fatigueText}>{fatigueText}</strong>
      </div>
      <div>
        <span>Dolor ≥4</span>
        <strong title={painText}>{painText}</strong>
      </div>
    </div>,
    host
  );
}
