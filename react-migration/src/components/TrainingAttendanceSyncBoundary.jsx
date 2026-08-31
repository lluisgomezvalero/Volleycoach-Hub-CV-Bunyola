import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { supabase } from '../lib/supabase.js';

function isTrainingRoute() {
  return window.location.hash === '#/training' || window.location.hash.startsWith('#/training?');
}

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function dateParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { full: '', time: '' };
  return {
    full: new Intl.DateTimeFormat('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(date),
    time: new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
  };
}

function visibleTrainingView() {
  const rollCall = document.querySelector('.rollcall-modal');
  if (rollCall) {
    return {
      mode: 'attendance',
      title: rollCall.querySelector('.rollcall-header h2')?.textContent || '',
      meta: rollCall.querySelector('.rollcall-header span')?.textContent || ''
    };
  }

  const detail = document.querySelector('.pro-session-page');
  if (detail) {
    return {
      mode: 'session',
      title: detail.querySelector('.pro-session-hero-card h1')?.textContent || '',
      meta: detail.querySelector('.pro-session-hero-card p')?.textContent || ''
    };
  }

  return { mode: 'list', title: '', meta: '' };
}

function eventMatchesView(event, view) {
  if (!event || view.mode === 'list') return false;
  if (normalize(event.title || 'Entrenamiento') !== normalize(view.title || 'Entrenamiento')) return false;
  const parts = dateParts(event.starts_at);
  const meta = normalize(view.meta);
  return (!parts.full || meta.includes(normalize(parts.full))) && (!parts.time || meta.includes(normalize(parts.time)));
}

export default function TrainingAttendanceSyncBoundary({ children }) {
  const { identity } = useAuth();
  const [revision, setRevision] = useState(0);
  const refreshingRef = useRef(false);
  const profileId = identity?.profile?.id || '';
  const playerId = identity?.player?.id || '';
  const role = identity?.profile?.role || '';
  const teamIds = (identity?.teams || []).map((team) => team.id).filter(Boolean);

  const remountView = useCallback((event, mode) => {
    if (!event?.id || mode === 'list') {
      setRevision((value) => value + 1);
      return;
    }
    const query = new URLSearchParams({ event: event.id, mode, sync: String(Date.now()) });
    window.location.hash = `#/training?${query.toString()}`;
    window.setTimeout(() => setRevision((value) => value + 1), 20);
  }, []);

  const resolveVisibleEvent = useCallback(async (preferredEventId = '') => {
    if (!isTrainingRoute() || !teamIds.length || refreshingRef.current) return;
    const view = visibleTrainingView();
    if (view.mode === 'list') {
      remountView(null, 'list');
      return;
    }

    refreshingRef.current = true;
    try {
      let events = [];
      if (preferredEventId) {
        const { data } = await supabase
          .from('events')
          .select('id,team_id,title,starts_at')
          .eq('id', preferredEventId)
          .eq('event_type', 'training')
          .maybeSingle();
        if (data) events = [data];
      } else {
        const from = new Date(Date.now() - 180 * 86400000).toISOString();
        const to = new Date(Date.now() + 180 * 86400000).toISOString();
        const { data } = await supabase
          .from('events')
          .select('id,team_id,title,starts_at')
          .in('team_id', teamIds)
          .eq('event_type', 'training')
          .gte('starts_at', from)
          .lte('starts_at', to);
        events = data || [];
      }

      const current = events.find((event) => eventMatchesView(event, view));
      if (current) remountView(current, view.mode);
    } finally {
      window.setTimeout(() => { refreshingRef.current = false; }, 250);
    }
  }, [remountView, teamIds.join('|')]);

  useEffect(() => {
    if (!profileId || !teamIds.length) return undefined;

    const channel = supabase
      .channel(`react-training-attendance-sync-${profileId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
        if (!isTrainingRoute()) return;
        const row = payload?.new && Object.keys(payload.new).length ? payload.new : payload?.old || {};
        const changedPlayerId = String(row.player_id || '');
        const validatedBy = String(row.validated_by || '');

        // La propia respuesta de una jugadora ya se actualiza de forma optimista en su pantalla.
        if (role === 'player' && changedPlayerId === String(playerId) && !validatedBy) return;
        // Evita cerrar/reabrir la lista por una validación que acaba de guardar este mismo entrenador.
        if ((role === 'coach' || role === 'administrator') && validatedBy === String(profileId)) return;

        void resolveVisibleEvent(String(row.event_id || ''));
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [playerId, profileId, resolveVisibleEvent, role, teamIds.join('|')]);

  useEffect(() => {
    if (!profileId) return undefined;
    let timer = 0;
    const refreshOnReturn = () => {
      if (!isTrainingRoute() || document.visibilityState === 'hidden') return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void resolveVisibleEvent(); }, 180);
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [profileId, resolveVisibleEvent]);

  return <Fragment key={revision}>{children}</Fragment>;
}
