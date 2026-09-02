import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, RefreshCcw, UsersRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import InfoPopover from './InfoPopover.jsx';
import { supabase } from '../lib/supabase.js';
import './WeeklyTeamWellness.css';

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(value) {
  const date = new Date(`${String(value || '').slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mondayOf(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  const offset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - offset);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mean(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function metricMean(rows, field, min, max) {
  return mean(
    rows
      .map((row) => Number(row?.[field]))
      .filter((value) => Number.isFinite(value) && value >= min && value <= max)
  );
}

function monthShort(date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date).replace('.', '');
}

function weekLabel(start, isCurrent) {
  if (isCurrent) return 'Esta semana';
  const end = addDays(start, 6);
  const startMonth = monthShort(start);
  const endMonth = monthShort(end);
  if (startMonth === endMonth) return `${start.getDate()}–${end.getDate()} ${endMonth}`;
  return `${start.getDate()} ${startMonth}–${end.getDate()} ${endMonth}`;
}

function fatigueClass(value) {
  if (!Number.isFinite(value)) return 'neutral';
  if (value <= 2) return 'good';
  if (value <= 3) return 'warm';
  return 'alert';
}

function usePortalHost(enabled) {
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
      const kpiGrid = document.querySelector('.wellness-coach-page .wellness-kpi-grid');
      if (!kpiGrid) {
        if (currentHost && !currentHost.isConnected) {
          currentHost = null;
          setHost(null);
        }
        return;
      }

      let nextHost = document.getElementById('weekly-team-wellness-host');
      if (!nextHost || !nextHost.isConnected) {
        nextHost = document.createElement('div');
        nextHost.id = 'weekly-team-wellness-host';
        kpiGrid.insertAdjacentElement('afterend', nextHost);
      } else if (nextHost.previousElementSibling !== kpiGrid) {
        kpiGrid.insertAdjacentElement('afterend', nextHost);
      }

      if (currentHost !== nextHost) {
        currentHost = nextHost;
        setHost(nextHost);
      }
    };

    const scheduleSync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(scheduleSync);
    const root = document.getElementById('root');
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

export default function WeeklyTeamWellness() {
  const { identity } = useAuth();
  const profile = identity?.profile;
  const team = identity?.teams?.[0] || null;
  const isStaff = ['coach', 'administrator'].includes(profile?.role);
  const host = usePortalHost(Boolean(isStaff && team?.id));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePlayers, setActivePlayers] = useState([]);
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    if (!isStaff || !team?.id) return;
    setLoading(true);
    setError('');

    try {
      const todayDate = new Date();
      todayDate.setHours(12, 0, 0, 0);
      const currentMonday = mondayOf(todayDate);
      const firstMonday = addDays(currentMonday, -21);
      const fromDate = localDateKey(firstMonday);
      const toDate = localDateKey(todayDate);

      const playerResult = await supabase
        .from('players')
        .select('id')
        .eq('team_id', team.id)
        .eq('active', true);
      if (playerResult.error) throw playerResult.error;

      const players = playerResult.data || [];
      const playerIds = players.map((player) => player.id);
      let wellness = [];

      if (playerIds.length) {
        const wellnessResult = await supabase
          .from('wellness_entries')
          .select('id,player_id,entry_date,fatigue,sleep,pain_score')
          .in('player_id', playerIds)
          .gte('entry_date', fromDate)
          .lte('entry_date', toDate)
          .order('entry_date', { ascending: true });
        if (wellnessResult.error) throw wellnessResult.error;
        wellness = wellnessResult.data || [];
      }

      setActivePlayers(players);
      setRows(wellness);
    } catch (loadError) {
      setError(loadError?.message || 'No se pudo calcular la evolución semanal.');
    } finally {
      setLoading(false);
    }
  }, [isStaff, team?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const weeks = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(12, 0, 0, 0);
    const currentMonday = mondayOf(todayDate);
    const starts = [3, 2, 1, 0].map((weeksAgo) => addDays(currentMonday, -7 * weeksAgo));

    return starts.map((start, index) => {
      const key = localDateKey(start);
      const end = addDays(start, 6);
      const endKey = localDateKey(end);
      const weekRows = rows.filter((row) => row.entry_date >= key && row.entry_date <= endKey);
      const byPlayer = new Map();

      weekRows.forEach((row) => {
        if (!row.player_id) return;
        const current = byPlayer.get(row.player_id) || [];
        current.push(row);
        byPlayer.set(row.player_id, current);
      });

      const playerSummaries = [...byPlayer.values()].map((playerRows) => ({
        fatigue: metricMean(playerRows, 'fatigue', 1, 5),
        sleep: metricMean(playerRows, 'sleep', 1, 5),
        pain: metricMean(playerRows, 'pain_score', 0, 10)
      }));

      const fatigue = mean(playerSummaries.map((summary) => summary.fatigue).filter(Number.isFinite));
      const sleep = mean(playerSummaries.map((summary) => summary.sleep).filter(Number.isFinite));
      const pain = mean(playerSummaries.map((summary) => summary.pain).filter(Number.isFinite));

      return {
        key,
        label: weekLabel(start, index === starts.length - 1),
        fatigue,
        sleep,
        pain,
        responders: byPlayer.size,
        records: weekRows.length,
        totalPlayers: activePlayers.length
      };
    });
  }, [activePlayers.length, rows]);

  if (!isStaff || !team?.id || !host) return null;

  const latestWithData = [...weeks].reverse().find((week) => Number.isFinite(week.fatigue)) || null;

  return createPortal(
    <section className="wellness-card weekly-team-wellness">
      <div className="wellness-card-head weekly-team-wellness-head">
        <div>
          <span><Activity size={14} /> Tendencia del equipo</span>
          <div className="weekly-team-wellness-title-row">
            <h2>Fatiga media semanal</h2>
            <InfoPopover label="Cómo se calcula la fatiga semanal" align="left">
              Primero se calcula la media semanal de cada jugadora y después se promedian esas medias entre sí. Así cada jugadora pesa lo mismo aunque haya respondido más días.
            </InfoPopover>
          </div>
        </div>
        <button type="button" className="weekly-team-wellness-refresh" onClick={() => void load()} disabled={loading} aria-label="Actualizar gráfica">
          <RefreshCcw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {error ? <div className="weekly-team-wellness-error">{error}</div> : null}

      <div className="weekly-team-wellness-chart" aria-label="Fatiga media semanal del equipo">
        {weeks.map((week) => {
          const hasData = Number.isFinite(week.fatigue);
          const height = hasData ? Math.max(8, Math.min(100, (week.fatigue / 5) * 100)) : 0;
          const coverage = week.totalPlayers ? Math.round((week.responders / week.totalPlayers) * 100) : 0;
          return (
            <article key={week.key} className="weekly-team-wellness-week">
              <div className="weekly-team-wellness-plot">
                <div className="weekly-team-wellness-value">{hasData ? week.fatigue.toFixed(1) : '—'}</div>
                <div className="weekly-team-wellness-bar-track">
                  {hasData ? <div className={`weekly-team-wellness-bar ${fatigueClass(week.fatigue)}`} style={{ height: `${height}%` }} /> : <div className="weekly-team-wellness-no-data">Sin datos</div>}
                </div>
              </div>
              <strong className="weekly-team-wellness-label">{week.label}</strong>
              <span className="weekly-team-wellness-coverage"><UsersRound size={12} /> {week.responders}/{week.totalPlayers || 0} · {coverage}%</span>
              <small className="weekly-team-wellness-records">{week.records} registro{week.records === 1 ? '' : 's'}</small>
              <div className="weekly-team-wellness-mini">
                <span><small>Sueño</small><b>{Number.isFinite(week.sleep) ? week.sleep.toFixed(1) : '—'}</b></span>
                <span><small>Dolor</small><b>{Number.isFinite(week.pain) ? week.pain.toFixed(1) : '—'}</b></span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="weekly-team-wellness-foot">
        <span>Fatiga y sueño: 1–5 · Dolor: 0–10</span>
        {latestWithData ? <strong>Última semana con datos: {latestWithData.fatigue.toFixed(1)}/5</strong> : <strong>Aún sin datos semanales</strong>}
      </div>
    </section>,
    host
  );
}
